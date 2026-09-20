// スモークテスト用 Worker。
// GET /smoke で typesafe/jev に既知のNBA事実を問い、知識精度を確認する。
// 本実装に入る前の検証専用。あとで丸ごと置き換える。

const NOUL = (instructions, criteria) => ({ type: "noul", instructions, criteria });

// 各選手について「主張 → 期待するnoul(1に近い=真)」を並べる
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

async function runBattery(env, player, items) {
  const questions = {};
  items.forEach(([claim], i) => {
    questions["q" + i] = NOUL(
      `state.player という NBA選手について、次の主張は正しいか: ${claim}`,
      { true: "その主張は事実として正しい", false: "その主張は誤り、または当てはまらない" }
    );
  });
  // 追加: ポジションを Choice で当てられるか
  questions.position = {
    type: "choice",
    instructions: "state.player という NBA選手の主なポジションはどれか",
    criteria: {
      PG: "ポイントガード",
      SG: "シューティングガード",
      SF: "スモールフォワード",
      PF: "パワーフォワード",
      C: "センター",
    },
  };

  const res = await env.AI.run("typesafe/jev", { state: { player }, questions });

  const rows = items.map(([claim, expected], i) => {
    const noul = res.answers["q" + i]?.noul;
    const predicted = noul >= 0.5;
    return {
      claim,
      expected,
      noul: Math.round(noul * 100) / 100,
      predicted,
      ok: predicted === expected,
    };
  });
  const correct = rows.filter((r) => r.ok).length;
  return {
    player,
    position: res.answers.position?.choice,
    position_conf: res.answers.position?.confidence,
    score: `${correct}/${rows.length}`,
    rows,
    usage: res.usage,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/smoke") {
      try {
        const results = [];
        for (const [player, items] of Object.entries(BATTERIES)) {
          results.push(await runBattery(env, player, items));
        }
        return Response.json({ ok: true, results }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        return Response.json({ ok: false, error: String(e), stack: e?.stack }, { status: 500 });
      }
    }
    return new Response("smoke test worker: GET /smoke", { status: 200 });
  },
};
