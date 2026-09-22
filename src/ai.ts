// 真偽判定の抽象化。
//   BACKEND === "jev" かつ TYPESAFE_API_KEY あり → typesafe.ai の Jev(Noul) を直接呼ぶ
//   それ以外 → Cloudflare 無料モデル（クレジット不要）
import type { Env } from "./index";
import { getFacts, FACTS_AS_OF_DATE, type PlayerRecord } from "./facts";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type Verdict = "yes" | "no" | "maybe";

// waitUntil だけを使うための最小限の構造型。
// Cloudflare Workers の ExecutionContext / Hono の c.executionCtx のどちらも満たす。
type WaitUntilCtx = { waitUntil: (promise: Promise<unknown>) => void };

function useJev(env: Env): boolean {
  return env.BACKEND === "jev" && !!env.TYPESAFE_API_KEY;
}

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

export type AnswerResult = { verdict: Verdict; noul: number | null };

// 従来（正規化なし）の Jev 呼び出し。正規化が失敗した場合のフォールバックとしても使う。
const LEGACY_YES_INSTRUCTIONS =
  "state.question はユーザーがNBA選手 state.player について尋ねる Yes/No 質問である。その質問への正しい答えが「はい(Yes)」であるか。";
const LEGACY_YES_CRITERIA = {
  true: "事実として答えはYes",
  false: "事実として答えはNo、または質問が state.player に当てはまらない",
};

async function jevAnswerLegacy(env: Env, player: string, question: string): Promise<AnswerResult> {
  const answers = await jevSystemOne(
    env,
    { player, question },
    { yes: { type: "noul", instructions: LEGACY_YES_INSTRUCTIONS, criteria: LEGACY_YES_CRITERIA } },
  );
  const noul = answers.yes?.noul ?? 0.5;
  return { verdict: noulToVerdict(noul), noul };
}

// --- 質問の正規化 ---
// Jev(Noul) は criteria の false 側に「具体的な対立候補」を名指しすると判別が鋭くなることが
// 実測で確認されている（例: ポジション質問で false="誤りである"(汎用) だと 0.55 で曖昧判定になるが、
// false="主にSF/PF/Cとしてプレーする"(対比) にすると 0.75 で正しく判定できる）。
// ユーザーの生の質問をそのまま渡すのではなく、一度この関数で
// claim（原子的で一意な命題）/ whenTrue（真になる条件）/ whenFalse（対立候補を名指しした偽の条件）
// の3つに分解し、Jev の instructions / criteria として渡す。
export type NormalizedQuestion = { claim: string; whenTrue: string; whenFalse: string };

const NORMALIZE_SYSTEM_PROMPT = `あなたはNBA選手当てゲームの「質問の正規化」アシスタントです。
ユーザーの Yes/No 質問を、後段の真偽判定AI(Jev)に渡すための3つのフィールドに変換してください。

# 狙い（重要）
Jevは criteria の false 側に「具体的な対立候補」を名指しすると判別が鋭くなることが実測で確認されています。
例えば「ポジションはガードか」という質問を、
  false="その主張は誤りである"（汎用な言い回し）
で聞くと判定が0.55（どちらとも言えない）と曖昧になりますが、
  false="主にスモールフォワード、パワーフォワード、またはセンターとしてプレーする"（対立候補を名指し）
で聞くと0.75（正しくYes）と鋭く判定できます。
したがって whenFalse には必ず具体的な対立候補・条件を書き、「誤りである」「当てはまらない」のような
汎用的な言い回しは禁止です。

# 出力する3フィールド
- claim: state.player を主語にした、原子的で一意な命題。曖昧語がある場合は最も一般的な意味に特定すること
  （例:「MVP」→「レギュラーシーズンMVP（年間最優秀選手賞）」）。
- whenTrue: claim が真になる条件の具体的な記述。
- whenFalse: claim が偽になる場合の、具体的な対立候補を名指しした記述。汎用表現は禁止。

# 良い例
質問「ガードですか？」→
{"claim":"state.player は主にポイントガード(PG)またはシューティングガード(SG)としてプレーする","whenTrue":"主なポジションがPGまたはSGである","whenFalse":"主なポジションがスモールフォワード(SF)、パワーフォワード(PF)、またはセンター(C)である"}

質問「MVPを受賞したことがありますか？」→
{"claim":"state.player はレギュラーシーズンMVP（年間最優秀選手賞）を受賞したことがある","whenTrue":"NBAレギュラーシーズンMVPを1回以上受賞している","whenFalse":"NBAレギュラーシーズンMVPを一度も受賞していない"}

質問「アメリカ出身ですか？」→
{"claim":"state.player はアメリカ合衆国出身である","whenTrue":"出生国がアメリカ合衆国である","whenFalse":"出生国がアメリカ合衆国以外の国である"}

# 悪い例（禁止）
{"whenFalse":"その主張は誤りである"}
{"whenFalse":"質問の内容に当てはまらない"}
のような、対立候補を名指ししない汎用的な whenFalse は禁止です。

# 制約
- 選手名は与えられません。質問文だけを一般化して書き換えてください。
- claim / whenTrue / whenFalse の主語には必ずリテラル文字列 "state.player" を使うこと（実際の選手名は使わない）。
- 出力は厳密なJSONのみ: {"claim":"...","whenTrue":"...","whenFalse":"..."}。前後に説明文やコードブロックを付けないこと。`;

function isValidNormalized(v: any): v is NormalizedQuestion {
  return (
    !!v &&
    typeof v.claim === "string" &&
    v.claim.trim().length > 0 &&
    typeof v.whenTrue === "string" &&
    v.whenTrue.trim().length > 0 &&
    typeof v.whenFalse === "string" &&
    v.whenFalse.trim().length > 0
  );
}

// trim→小文字化→連続空白を1つに（index.ts の normalize と同等。循環import回避のためローカルに定義）。
function normalizeForKey(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// caches.default が使えない実行文脈（ローカル環境等）でも落ちないようにする安全な取得。
function getDefaultCache(): Cache | null {
  try {
    if (typeof caches === "undefined" || !(caches as any).default) return null;
    return (caches as any).default as Cache;
  } catch {
    return null;
  }
}

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

function buildJevState(player: string, facts: PlayerRecord | null): Record<string, unknown> {
  if (!facts) return { player };
  return { player, 記録: facts, 記録の基準日: FACTS_AS_OF_DATE };
}

function buildJevInstructions(claim: string, hasFacts: boolean): string {
  if (!hasFacts) return claim;
  return `${FACTS_INSTRUCTION_PREFIX}\n${claim}\n${FACTS_INSTRUCTION_SUFFIX}`;
}

// 質問の正規化は選手に依存しないため、7日キャッシュする。
export async function normalizeQuestion(
  env: Env,
  question: string,
  ctx?: WaitUntilCtx,
): Promise<NormalizedQuestion | null> {
  const cache = getDefaultCache();
  const cacheKey = cache
    ? new Request(`https://cache.ballerdle/n?q=${encodeURIComponent(normalizeForKey(question))}`)
    : null;

  if (cache && cacheKey) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const data = await cached.json();
        if (isValidNormalized(data)) return data;
      }
    } catch {
      // キャッシュ読み取り失敗は無視して通常経路へ
    }
  }

  try {
    const res: any = await env.AI.run(FREE_MODEL as any, {
      messages: [
        { role: "system", content: NORMALIZE_SYSTEM_PROMPT },
        { role: "user", content: `ユーザーの質問: ${question}` },
      ],
      max_tokens: 400,
      temperature: 0,
    } as any);
    const parsed = extractJson(res.response);
    if (!isValidNormalized(parsed)) return null;
    const result: NormalizedQuestion = {
      claim: String(parsed.claim),
      whenTrue: String(parsed.whenTrue),
      whenFalse: String(parsed.whenFalse),
    };

    if (cache && cacheKey) {
      try {
        const cacheable = new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json", "cache-control": "max-age=604800" },
        });
        const putPromise = cache.put(cacheKey, cacheable);
        if (ctx?.waitUntil) {
          ctx.waitUntil(putPromise);
        } else {
          await putPromise;
        }
      } catch {
        // キャッシュ書き込み失敗は無視（正規化結果自体は返す）
      }
    }
    return result;
  } catch {
    return null;
  }
}

// ユーザーの質問に対する、隠し選手についての答えを yes / no / maybe で返す。
export async function answerQuestion(
  env: Env,
  player: string,
  question: string,
  ctx?: WaitUntilCtx,
): Promise<AnswerResult> {
  if (useJev(env)) {
    const normalized = await normalizeQuestion(env, question, ctx).catch(() => null);
    if (normalized) {
      try {
        const facts = getFacts(player);
        const answers = await jevSystemOne(
          env,
          buildJevState(player, facts),
          {
            yes: {
              type: "noul",
              instructions: buildJevInstructions(normalized.claim, !!facts),
              criteria: { true: normalized.whenTrue, false: normalized.whenFalse },
            },
          },
        );
        const noul = answers.yes?.noul ?? 0.5;
        return { verdict: noulToVerdict(noul), noul };
      } catch {
        // 正規化後の Jev 呼び出しが失敗した場合も、下の従来経路にフォールバックする。
      }
    }
    // フォールバック: 正規化が失敗（例外・JSONパース失敗・フィールド欠落）、
    // または正規化後の Jev 呼び出しが失敗した場合は、従来のプロンプトのまま動作させる。
    return jevAnswerLegacy(env, player, question);
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
// 指定された player に対して、正規化 + Jev を実際に実行し、内部の claim/whenTrue/whenFalse まで
// 含めて返す。/api/_debug/ask からのみ呼ばれる（DEBUG_API=1 のときだけ有効）。
export type DebugAnswerResult = {
  claim: string | null;
  whenTrue: string | null;
  whenFalse: string | null;
  noul: number | null;
  verdict: Verdict;
  normalized: boolean;
  factsUsed: boolean;
};

export async function debugAnswerQuestion(
  env: Env,
  player: string,
  question: string,
  ctx?: WaitUntilCtx,
): Promise<DebugAnswerResult> {
  if (!useJev(env)) {
    throw new Error("jev backend not configured（BACKEND=jev かつ TYPESAFE_API_KEY が必要）");
  }

  const normalized = await normalizeQuestion(env, question, ctx).catch(() => null);
  if (normalized) {
    const facts = getFacts(player);
    const answers = await jevSystemOne(
      env,
      buildJevState(player, facts),
      {
        yes: {
          type: "noul",
          instructions: buildJevInstructions(normalized.claim, !!facts),
          criteria: { true: normalized.whenTrue, false: normalized.whenFalse },
        },
      },
    );
    const noul = answers.yes?.noul ?? 0.5;
    return {
      claim: normalized.claim,
      whenTrue: normalized.whenTrue,
      whenFalse: normalized.whenFalse,
      noul,
      verdict: noulToVerdict(noul),
      normalized: true,
      factsUsed: !!facts,
    };
  }

  // 正規化に失敗した場合は従来のプロンプトで実行し、その旨を normalized: false で示す。
  const legacy = await jevAnswerLegacy(env, player, question);
  return {
    claim: null,
    whenTrue: null,
    whenFalse: null,
    noul: legacy.noul,
    verdict: legacy.verdict,
    normalized: false,
    factsUsed: false,
  };
}
