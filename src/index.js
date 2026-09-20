// スモークテスト用 Worker。
// 目的: (1) Worker→AIバインディングの疎通確認 (2) モデルのNBA知識精度の実測
//
//   GET /smoke            → 無料モデル(@cf/...) で実行（クレジット不要）
//   GET /smoke?model=jev  → typesafe/jev で実行（AI Gatewayクレジットが必要）
//
// 本実装に入る前の検証専用。あとで丸ごと置き換える。

// 無料の第一党モデル（Neurons無料枠で動く）。知識が弱ければ 3.3-70b に上げる。
const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// 各選手について「主張 → 期待する真偽」
const BATTERIES = {
  "Stephen Curry": [
    ["主にポイントガードとしてプレーする", true],
    ["主にセンターとしてプレーする", false],
    ["NBAのMVPを受賞したことがある", true],
    ["ゴールデンステート・ウォリアーズでプレーしている", true],
    ["スリーポイントシュートで有名である", true],
    ["身長が213cm(7フィート)を超えている", false],
  ],
  "Shaquille O'Neal": [
    ["主にセンターとしてプレーする", true],
    ["主にポイントガードとしてプレーする", false],
    ["スリーポイントシュートで有名である", false],
    ["すでにNBAを引退している", true],
    ["NBAチャンピオンになったことがある", true],
    ["身長が180cm未満である", false],
  ],
  "Nikola Jokic": [
    ["主にセンターとしてプレーする", true],
    ["デンバー・ナゲッツでプレーしている", true],
    ["NBAのMVPを受賞したことがある", true],
    ["アメリカ出身である", false],
  ],
};

// ---- Jev バックエンド（typesafe/jev） ----
async function runBatteryJev(env, player, items) {
  const questions = {};
  items.forEach(([claim], i) => {
    questions["q" + i] = {
      type: "noul",
      instructions: `state.player という NBA選手について、次の主張は正しいか: ${claim}`,
      criteria: { true: "その主張は事実として正しい", false: "その主張は誤り、または当てはまらない" },
    };
  });
  const opts = env.GATEWAY_ID ? { gateway: { id: env.GATEWAY_ID } } : undefined;
  const res = await env.AI.run("typesafe/jev", { state: { player }, questions }, opts);
  const rows = items.map(([claim, expected], i) => {
    const noul = res.answers["q" + i]?.noul;
    const predicted = noul >= 0.5;
    return { claim, expected, value: Math.round(noul * 100) / 100, predicted, ok: predicted === expected };
  });
  return { player, backend: "jev", score: `${rows.filter((r) => r.ok).length}/${rows.length}`, rows, usage: res.usage };
}

// ---- 無料モデルバックエンド（LLMにJSONで真偽を答えさせる） ----
async function runBatteryFree(env, player, items) {
  const numbered = items.map(([claim], i) => `${i}: ${claim}`).join("\n");
  const sys =
    "あなたはNBAの専門家です。与えられた選手について各主張の真偽を判定します。" +
    '必ず次の形式の厳密なJSONだけを返してください: {"answers":[{"i":<番号>,"verdict":"yes"|"no"|"unsure"}]}。説明文は不要。';
  const user = `選手: ${player}\n各主張が事実として正しいか判定してください。\n${numbered}`;
  const res = await env.AI.run(FREE_MODEL, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 512,
  });
  const text = typeof res.response === "string" ? res.response : JSON.stringify(res.response ?? res);
  let parsed = null;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch (_) {}
  const verdicts = {};
  (parsed?.answers || []).forEach((a) => (verdicts[a.i] = a.verdict));
  const rows = items.map(([claim, expected], i) => {
    const v = verdicts[i];
    const predicted = v === "yes" ? true : v === "no" ? false : null;
    return { claim, expected, value: v ?? "?", predicted, ok: predicted === expected };
  });
  return {
    player,
    backend: FREE_MODEL,
    score: `${rows.filter((r) => r.ok).length}/${rows.length}`,
    rows,
    raw: parsed ? undefined : String(text).slice(0, 400), // パース失敗時のみ生テキストを出す
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/smoke") {
      const useJev = url.searchParams.get("model") === "jev";
      try {
        const results = [];
        for (const [player, items] of Object.entries(BATTERIES)) {
          results.push(useJev ? await runBatteryJev(env, player, items) : await runBatteryFree(env, player, items));
        }
        return Response.json({ ok: true, mode: useJev ? "jev" : "free", results }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        return Response.json({ ok: false, error: String(e), stack: e?.stack }, { status: 500 });
      }
    }
    return new Response("smoke test worker: GET /smoke (add ?model=jev for typesafe/jev)", { status: 200 });
  },
};
