// 判定精度ベンチマーク。
//
// 目的: Jev の判定精度（はい/いいえ/どちらとも）が、プロンプトやデータの変更で
// 落ちていないかを数字で確認する。
//
// 重要な設計方針: アプリのプロンプトを複製しない。ここでは src/ai.ts の
// answerQuestion(env, player, question) を直接 import して呼ぶだけで、
// Jev に送る文言（instructions/criteria/state の組み立て）は一切ここで組み立てない。
// そうしないと、アプリ側でプロンプトを変えたときにベンチの計測がずれてしまう。
//
// 実行: npx tsx scripts/bench/run.ts [--json <path>] [--min <割合>]
//
// 正解データ: scripts/bench/cases.json（選手 × 質問 の期待値、141件）。
// 曖昧で判定対象外だったペア（元データで None）は最初から含まれていない。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { answerQuestion } from "../../src/ai";
import type { Env } from "../../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

type Verdict = "yes" | "no" | "maybe";

type Case = {
  player: string;
  key: string;
  question: string;
  expected: "yes" | "no";
};

type CaseResult = {
  case: Case;
  verdict: Verdict | "error";
  noul: number | null;
  correct: boolean;
  errored: boolean;
  latencyMs: number;
};

const CONCURRENCY = 4;
const RETRY_ONCE = true;

function loadApiKey(): string {
  const fromEnv = process.env.TYPESAFE_API_KEY;
  if (fromEnv) return fromEnv;

  const devVarsPath = join(ROOT, ".dev.vars");
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, "utf-8");
    const line = content.split("\n").find((l) => l.startsWith("TYPESAFE_API_KEY="));
    if (line) {
      const value = line.slice("TYPESAFE_API_KEY=".length).trim();
      if (value) return value;
    }
  }

  console.error(
    "TYPESAFE_API_KEY が見つかりません。環境変数 TYPESAFE_API_KEY を設定するか、" +
      ".dev.vars に TYPESAFE_API_KEY=... の行を用意してください。",
  );
  process.exit(1);
}

function parseArgs(argv: string[]): { jsonPath: string | null; min: number | null } {
  let jsonPath: string | null = null;
  let min: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") {
      jsonPath = argv[++i] ?? null;
    } else if (argv[i] === "--min") {
      const v = Number(argv[++i]);
      if (!Number.isNaN(v)) min = v;
    }
  }
  return { jsonPath, min };
}

function loadCases(): Case[] {
  const raw = readFileSync(join(__dirname, "cases.json"), "utf-8");
  return JSON.parse(raw) as Case[];
}

async function runOne(env: Env, c: Case): Promise<CaseResult> {
  const start = Date.now();
  const attempt = async (): Promise<{ verdict: Verdict; noul: number | null }> => {
    return answerQuestion(env, c.player, c.question);
  };

  let verdict: Verdict | "error" = "error";
  let noul: number | null = null;
  let errored = false;
  try {
    const result = await attempt();
    verdict = result.verdict;
    noul = result.noul;
  } catch (e1) {
    if (RETRY_ONCE) {
      try {
        const result = await attempt();
        verdict = result.verdict;
        noul = result.noul;
      } catch (e2) {
        errored = true;
      }
    } else {
      errored = true;
    }
  }

  const latencyMs = Date.now() - start;
  const correct = !errored && verdict === c.expected;
  return { case: c, verdict, noul, correct, errored, latencyMs };
}

// 最大 CONCURRENCY 並列でタスクを流す簡易プール。
async function runPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

async function main() {
  const { jsonPath, min } = parseArgs(process.argv.slice(2));
  const apiKey = loadApiKey();

  // Env が要求する AI/ASSETS 等は Jev 経路（BACKEND==="jev"）では参照されないため、
  // ベンチ用の最小限のオブジェクトを as unknown as Env で通す。
  const env = {
    BACKEND: "jev",
    TYPESAFE_API_KEY: apiKey,
  } as unknown as Env;

  const cases = loadCases();
  console.log(`ベンチ対象: ${cases.length}件（並列度 ${CONCURRENCY}）`);

  const results = await runPool(cases, CONCURRENCY, (c) => runOne(env, c));

  const errors = results.filter((r) => r.errored);
  const scored = results.filter((r) => !r.errored);
  const correct = scored.filter((r) => r.correct);

  const total = scored.length;
  const ok = correct.length;
  const rate = total > 0 ? ok / total : 0;

  console.log("");
  console.log(`総合: 正答 ${ok}/${total} (${(rate * 100).toFixed(1)}%)` + (errors.length ? `  ※エラー ${errors.length}件は正答・誤答いずれにも含まない` : ""));

  // 項目キー別
  console.log("");
  console.log("項目キー別:");
  const byKey = new Map<string, { ok: number; total: number }>();
  for (const r of scored) {
    const k = r.case.key;
    const cur = byKey.get(k) ?? { ok: 0, total: 0 };
    cur.total += 1;
    if (r.correct) cur.ok += 1;
    byKey.set(k, cur);
  }
  for (const [key, { ok: kOk, total: kTotal }] of byKey) {
    const pct = kTotal > 0 ? (kOk / kTotal) * 100 : 0;
    console.log(`  ${key.padEnd(10)} ${String(kOk).padStart(3)}/${String(kTotal).padEnd(3)} (${pct.toFixed(1)}%)`);
  }

  // 誤答一覧
  const wrong = scored.filter((r) => !r.correct);
  console.log("");
  console.log(`誤答 ${wrong.length}件:`);
  for (const r of wrong) {
    const noulStr = r.noul == null ? "null" : r.noul.toFixed(2);
    console.log(
      `  ${r.case.player.padEnd(24)}${r.case.key.padEnd(10)}期待=${r.case.expected.padEnd(4)}verdict=${String(r.verdict).padEnd(6)}noul=${noulStr}`,
    );
  }

  // エラー一覧
  if (errors.length > 0) {
    console.log("");
    console.log(`エラー ${errors.length}件:`);
    for (const r of errors) {
      console.log(`  ${r.case.player.padEnd(24)}${r.case.key.padEnd(10)}期待=${r.case.expected}`);
    }
  }

  // レイテンシ
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const median = percentile(latencies, 0.5);
  const p90 = percentile(latencies, 0.9);
  const max = latencies[latencies.length - 1] ?? 0;
  console.log("");
  console.log(`レイテンシ: 中央値 ${median}ms  p90 ${p90}ms  最大 ${max}ms`);

  if (jsonPath) {
    const out = {
      total,
      ok,
      rate,
      errors: errors.length,
      byKey: Object.fromEntries(byKey),
      wrong: wrong.map((r) => ({
        player: r.case.player,
        key: r.case.key,
        expected: r.case.expected,
        verdict: r.verdict,
        noul: r.noul,
      })),
      latencyMs: { median, p90, max },
      results: results.map((r) => ({
        player: r.case.player,
        key: r.case.key,
        expected: r.case.expected,
        verdict: r.verdict,
        noul: r.noul,
        correct: r.correct,
        errored: r.errored,
        latencyMs: r.latencyMs,
      })),
    };
    writeFileSync(jsonPath, JSON.stringify(out, null, 2) + "\n", "utf-8");
    console.log(`\nJSON出力: ${jsonPath}`);
  }

  if (min != null && rate < min) {
    console.error(`\n正答率 ${(rate * 100).toFixed(1)}% が --min ${(min * 100).toFixed(1)}% を下回りました。`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
