// 真偽判定の抽象化。
//   BACKEND === "jev" かつ TYPESAFE_API_KEY あり → typesafe.ai の Jev(Noul) を直接呼ぶ
//   それ以外 → Cloudflare 無料モデル（クレジット不要）

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function useJev(env) {
  return env.BACKEND === "jev" && !!env.TYPESAFE_API_KEY;
}

// typesafe.ai の System One API を直接叩く。answers を返す。
async function jevSystemOne(env, state, questions) {
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
  const data = await res.json();
  return data.answers || {};
}

function extractJson(text) {
  const s = typeof text === "string" ? text : JSON.stringify(text ?? "");
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : s);
  } catch {
    return null;
  }
}

function noulToVerdict(noul) {
  if (noul >= 0.66) return "yes";
  if (noul <= 0.34) return "no";
  return "maybe";
}

// ユーザーの質問に対する、隠し選手についての答えを yes / no / maybe で返す。
export async function answerQuestion(env, player, question) {
  if (useJev(env)) {
    const answers = await jevSystemOne(
      env,
      { player, question },
      {
        yes: {
          type: "noul",
          instructions:
            "state.question はユーザーがNBA選手 state.player について尋ねる Yes/No 質問である。その質問への正しい答えが「はい(Yes)」であるか。",
          criteria: {
            true: "事実として答えはYes",
            false: "事実として答えはNo、または質問が state.player に当てはまらない",
          },
        },
      },
    );
    const noul = answers.yes?.noul ?? 0.5;
    return { verdict: noulToVerdict(noul), noul };
  }

  // 無料モデル
  const sys =
    "あなたはNBAの専門家です。ユーザーは、あなただけが知っている「隠し選手」について Yes/No 質問をします。" +
    "隠し選手は入力で与えられます。その事実に基づいて質問に答えてください。" +
    "重要: 選手名やそれを特定できるヒントは絶対に出力しないこと。" +
    '出力は厳密なJSONのみ: {"verdict":"yes"|"no"|"maybe"}。' +
    "事実として正しければ yes、誤りなら no、Yes/Noで断定できない・情報が曖昧・質問がYes/No形式でないなら maybe。";
  const user = `隠し選手: ${player}\nユーザーの質問: ${question}`;
  const res = await env.AI.run(FREE_MODEL, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 64,
    temperature: 0,
  });
  const parsed = extractJson(res.response);
  let verdict = parsed?.verdict;
  if (!["yes", "no", "maybe"].includes(verdict)) verdict = "maybe";
  // 無料モデルは較正された確率を返さないので noul は null（ゲージは非表示になる）
  return { verdict, noul: null };
}

// 推測名が隠し選手と同一人物か判定。{ correct: boolean } を返す。
export async function checkGuess(env, player, guess) {
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
  const res = await env.AI.run(FREE_MODEL, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 32,
    temperature: 0,
  });
  const parsed = extractJson(res.response);
  return { correct: parsed?.same === true };
}
