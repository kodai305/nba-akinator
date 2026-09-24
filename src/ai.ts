// 真偽判定の抽象化。
//   BACKEND === "jev" かつ TYPESAFE_API_KEY あり → typesafe.ai の Jev(Noul) を直接呼ぶ
//   それ以外 → Cloudflare 無料モデル（クレジット不要）
import type { Env } from "./index";
import { getFacts, FACTS_AS_OF_DATE, type PlayerRecord } from "./facts";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type Verdict = "yes" | "no" | "maybe";

type SystemOneAnswers = Record<string, { noul?: number } | undefined>;

// typesafe.ai の System One API を直接叩く。answers を返す。
async function jevSystemOne(
  env: Env,
  state: Record<string, unknown>,
  questions: Record<string, unknown>,
): Promise<SystemOneAnswers> {
  const base = env.TYPESAFE_BASE_URL || "https://api.typesafe.ai/v1";
  const res = await fetch(`${base}/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: env.JEV_MODEL || "jev-latest", state, questions }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`typesafe ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { answers?: SystemOneAnswers };
  return data.answers || {};
}

function extractJson(text: unknown): any {
  const s = typeof text === "string" ? text : JSON.stringify(text ?? "");
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : s);
  } catch {
    return null;
  }
}

function noulToVerdict(noul: number): Verdict {
  if (noul >= 0.66) return "yes";
  if (noul <= 0.34) return "no";
  return "maybe";
}

function useJev(env: Env): boolean {
  return env.BACKEND === "jev" && !!env.TYPESAFE_API_KEY;
}

export type AnswerResult = { verdict: Verdict; noul: number | null };

// Jev(Noul) に渡す共通の指示文。
// 実測（141問）で、質問文をそのまま渡しても正規化（claim/whenTrue/whenFalse への書き換え）ありと
// 同等の正答率（正規化なし 140/141 ≒ 99.3% / 正規化あり 141/141・140/141）が出る一方、
// レイテンシは中央値 2.24s→0.52s, p90 4.27s→0.59s まで縮む。選手ファクトを state に渡すようになった
// 現在は正規化の必要が薄いため、質問はユーザーの生の文言のままここへ渡す。
const BASE_INSTRUCTION =
  "state.question はユーザーがNBA選手 state.player について尋ねた Yes/No 質問である。" +
  "その質問への正しい答えが「はい(Yes)」であるか。";
const YES_CRITERIA = {
  true: "事実として答えはYes",
  false: "事実として答えはNo、または質問が state.player に当てはまらない",
};

// --- ファクトの付与 ---
// data/players.json にファクトがある選手のみ、Jev の state.記録 に NBA公式記録を渡す。
// 「身長の閾値比較」「在籍年代レンジ」のような、モデルの一般知識だけでは誤答しやすい判定を
// 事実ベースで正しく行わせるための補強（ファクトが無い選手は従来どおり）。
const FACTS_INSTRUCTION_PREFIX =
  "state.記録 はNBA公式の記録である。判断が state.記録 から決まる場合は、必ずそれを根拠にすること" +
  "（例: 身長の比較、在籍年代の判定、受賞回数）。";
const FACTS_INSTRUCTION_SUFFIX =
  "state.記録 に無い事柄は、一般的な知識で判断してよい。" +
  "state.記録の基準日 より後の出来事は反映されていない可能性がある。";

function buildJevState(player: string, question: string, facts: PlayerRecord | null): Record<string, unknown> {
  if (!facts) return { player, question };
  return { player, 記録: facts, question, 記録の基準日: FACTS_AS_OF_DATE };
}

function buildJevInstructions(hasFacts: boolean): string {
  if (!hasFacts) return BASE_INSTRUCTION;
  return `${FACTS_INSTRUCTION_PREFIX}\n${BASE_INSTRUCTION}\n${FACTS_INSTRUCTION_SUFFIX}`;
}

async function jevAnswer(env: Env, player: string, question: string): Promise<AnswerResult> {
  const facts = getFacts(player);
  const answers = await jevSystemOne(
    env,
    buildJevState(player, question, facts),
    {
      yes: {
        type: "noul",
        instructions: buildJevInstructions(!!facts),
        criteria: YES_CRITERIA,
      },
    },
  );
  const noul = answers.yes?.noul ?? 0.5;
  return { verdict: noulToVerdict(noul), noul };
}

// ユーザーの質問に対する、隠し選手についての答えを yes / no / maybe で返す。
export async function answerQuestion(env: Env, player: string, question: string): Promise<AnswerResult> {
  if (useJev(env)) {
    // Jev呼び出し（jevSystemOne）自体が失敗した場合、ここで例外を投げずに握りつぶす
    // フォールバックはあえて設けていない。呼び出し元の /api/ask（src/index.ts）が
    // try/catch で 500 を返し、フロント（public/app.js の submit()）はそれを
    // 「エラーが発生しました。もう一度お試しください。」として表示するだけで
    // 質問数（game.used）は消費されない。つまりゲームは止まらず、ユーザーは
    // そのまま再送できるため、関数内に別経路のフォールバックを重ねる必要はない。
    return jevAnswer(env, player, question);
  }

  // 無料モデル
  const sys =
    "あなたはNBAの専門家です。ユーザーは、あなただけが知っている「隠し選手」について Yes/No 質問をします。" +
    "隠し選手は入力で与えられます。その事実に基づいて質問に答えてください。" +
    "重要: 選手名やそれを特定できるヒントは絶対に出力しないこと。" +
    '出力は厳密なJSONのみ: {"verdict":"yes"|"no"|"maybe"}。' +
    "事実として正しければ yes、誤りなら no、Yes/Noで断定できない・情報が曖昧・質問がYes/No形式でないなら maybe。";
  const user = `隠し選手: ${player}\nユーザーの質問: ${question}`;
  const res: any = await env.AI.run(FREE_MODEL as any, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 64,
    temperature: 0,
  } as any);
  const parsed = extractJson(res.response);
  let verdict = parsed?.verdict;
  if (!["yes", "no", "maybe"].includes(verdict)) verdict = "maybe";
  // 無料モデルは較正された確率を返さないので noul は null（ゲージは非表示になる）
  return { verdict, noul: null };
}

export type GuessResult = { correct: boolean };

// 推測名が隠し選手と同一人物か判定。{ correct: boolean } を返す。
export async function checkGuess(env: Env, player: string, guess: string): Promise<GuessResult> {
  if (useJev(env)) {
    const answers = await jevSystemOne(
      env,
      { player, guess },
      {
        same: {
          type: "noul",
          instructions:
            "state.guess は state.player と同一のNBA選手を指すか（愛称・表記ゆれ・日本語/英語表記の違いを許容）。",
          criteria: { true: "同一人物を指している", false: "別人、または誰を指すか不明" },
        },
      },
    );
    return { correct: (answers.same?.noul ?? 0) >= 0.75 };
  }

  const sys =
    "あなたはNBAの専門家です。2つの名前が同一のNBA選手を指すか判定します。" +
    "愛称・スペル違い・日本語/英語表記の違いは同一とみなします。" +
    '出力は厳密なJSONのみ: {"same": true|false}。';
  const user = `名前A(正解): ${player}\n名前B(ユーザーの推測): ${guess}`;
  const res: any = await env.AI.run(FREE_MODEL as any, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 32,
    temperature: 0,
  } as any);
  const parsed = extractJson(res.response);
  return { correct: parsed?.same === true };
}

// --- 計測専用 ---
// 指定された player に対して Jev を実際に実行し、noul とファクト使用有無を返す。
// /api/_debug/ask からのみ呼ばれる（DEBUG_API=1 のときだけ有効）。
export type DebugAnswerResult = {
  noul: number | null;
  verdict: Verdict;
  factsUsed: boolean;
};

export async function debugAnswerQuestion(env: Env, player: string, question: string): Promise<DebugAnswerResult> {
  if (!useJev(env)) {
    throw new Error("jev backend not configured（BACKEND=jev かつ TYPESAFE_API_KEY が必要）");
  }
  const { verdict, noul } = await jevAnswer(env, player, question);
  return { noul, verdict, factsUsed: !!getFacts(player) };
}
