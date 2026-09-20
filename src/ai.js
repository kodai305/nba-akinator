// 真偽判定の抽象化。既定は無料モデル、env.BACKEND === "jev" で typesafe/jev に切替。

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function gatewayOpts(env) {
  return env.GATEWAY_ID ? { gateway: { id: env.GATEWAY_ID } } : undefined;
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

// ユーザーの質問に対する、隠し選手についての答えを yes / no / maybe で返す。
// { verdict: "yes"|"no"|"maybe", value } を返す（value はデバッグ用の生値）。
export async function answerQuestion(env, player, question) {
  if (env.BACKEND === "jev") {
    const res = await env.AI.run(
      "typesafe/jev",
      {
        state: { player, question },
        questions: {
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
      },
      gatewayOpts(env),
    );
    const noul = res.answers?.yes?.noul ?? 0.5;
    const verdict = noul >= 0.66 ? "yes" : noul <= 0.34 ? "no" : "maybe";
    return { verdict, value: noul };
  }

  // 無料モデル
  const sys =
    "あなたはNBAの専門家です。ユーザーは、あなただけが知っている「隠し選手」について Yes/No 質問をします。" +
    "隠し選手は入力で与えられます。その事実に基づいて質問に答えてください。" +
    "重要: 選手名やそれを特定できるヒントは絶対に出力しないこと。" +
    '出力は厳密なJSONのみ: {"verdict":"yes"|"no"|"maybe"}。' +
    "事実として正しければ yes、誤りなら no、Yes/Noで断定できない・情報が曖昧・質問がYes/No形式でないなら maybe。";
  const user = `隠し選手: ${player}\nユーザーの質問: ${question}`;
  const res = await env.AI.run(
    FREE_MODEL,
    {
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      max_tokens: 64,
      temperature: 0,
    },
    gatewayOpts(env),
  );
  const parsed = extractJson(res.response);
  let verdict = parsed?.verdict;
  if (!["yes", "no", "maybe"].includes(verdict)) verdict = "maybe";
  return { verdict, value: parsed?.verdict ?? null };
}

// 推測名が隠し選手と同一人物か判定。{ correct: boolean } を返す。
export async function checkGuess(env, player, guess) {
  if (env.BACKEND === "jev") {
    const res = await env.AI.run(
      "typesafe/jev",
      {
        state: { player, guess },
        questions: {
          same: {
            type: "noul",
            instructions:
              "state.guess は state.player と同一のNBA選手を指すか（愛称・表記ゆれ・日本語/英語表記の違いを許容）。",
            criteria: {
              true: "同一人物を指している",
              false: "別人、または誰を指すか不明",
            },
          },
        },
      },
      gatewayOpts(env),
    );
    return { correct: (res.answers?.same?.noul ?? 0) >= 0.75 };
  }

  const sys =
    "あなたはNBAの専門家です。2つの名前が同一のNBA選手を指すか判定します。" +
    "愛称・スペル違い・日本語/英語表記の違いは同一とみなします。" +
    '出力は厳密なJSONのみ: {"same": true|false}。';
  const user = `名前A(正解): ${player}\n名前B(ユーザーの推測): ${guess}`;
  const res = await env.AI.run(
    FREE_MODEL,
    {
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      max_tokens: 32,
      temperature: 0,
    },
    gatewayOpts(env),
  );
  const parsed = extractJson(res.response);
  return { correct: parsed?.same === true };
}
