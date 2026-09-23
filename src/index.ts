// Ballerdle — Cloudflare Worker（Hono）。フロントは public/ の静的アセット配信に委ね、
// このファイルは /api/* のみを扱う。
// 毎日ひとり、NBA選手を当てる日次チャレンジ。選手はJST基準で決定論的に選出され、
// 正解/降参時以外はレスポンスに絶対含めない。
import { Hono } from "hono";
import { getDaily } from "./daily";
import { answerQuestion, checkGuess, debugAnswerQuestion } from "./ai";

export type Env = {
  AI: Ai;
  ASSETS: Fetcher;
  BACKEND?: string;
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  JEV_MODEL?: string;
  // 計測専用エンドポイント /api/_debug/ask を有効にするフラグ。"1" のときだけ有効。
  // wrangler.toml の [vars] には追加しない。ローカルでのみ `--var DEBUG_API:1` 等で指定する。
  DEBUG_API?: string;
};

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// trim→小文字化→連続空白を1つに。
function normalize(s: unknown): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/today", (c) => {
  const { number, date } = getDaily();
  return c.json({ number, date });
});

app.post("/api/ask", async (c) => {
  try {
    const { player, date } = getDaily();
    const body = await readBody(c.req.raw);
    const cache = caches.default;

    const question = String(body.question || "").slice(0, 300);
    if (!question) return c.json({ error: "empty question" }, 400);

    const cacheKey = new Request(
      `https://cache.ballerdle/q?d=${date}&q=${encodeURIComponent(normalize(question))}`,
    );
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const { verdict, noul } = await answerQuestion(c.env, player, question);
    const payload = { verdict, noul: typeof noul === "number" ? Math.round(noul * 1000) / 1000 : null };
    const cacheable = new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "cache-control": "max-age=86400" },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  } catch (e) {
    return c.json({ error: "server error", detail: String(e) }, 500);
  }
});

app.post("/api/guess", async (c) => {
  try {
    const { player, date } = getDaily();
    const body = await readBody(c.req.raw);
    const cache = caches.default;

    const guess = String(body.guess || "").slice(0, 120);
    if (!guess) return c.json({ error: "empty guess" }, 400);

    const cacheKey = new Request(
      `https://cache.ballerdle/g?d=${date}&q=${encodeURIComponent(normalize(guess))}`,
    );
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const { correct } = await checkGuess(c.env, player, guess);
    const payload = correct ? { correct: true, answer: player } : { correct: false };
    const cacheable = new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "cache-control": "max-age=86400" },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  } catch (e) {
    return c.json({ error: "server error", detail: String(e) }, 500);
  }
});

app.post("/api/giveup", async (c) => {
  try {
    const { player } = getDaily();
    return c.json({ answer: player });
  } catch (e) {
    return c.json({ error: "server error", detail: String(e) }, 500);
  }
});

// 計測専用: 指定 player に対してその場で正規化+Jevを実行し、内部状態まで含めて返す。
// DEBUG_API="1" のときだけ有効（それ以外は404）。本番の wrangler.toml [vars] には追加しない。
app.post("/api/_debug/ask", async (c) => {
  if (c.env.DEBUG_API !== "1") return c.notFound();
  try {
    const body = await readBody(c.req.raw);
    const player = String(body.player || "").slice(0, 120);
    const question = String(body.question || "").slice(0, 300);
    if (!player || !question) return c.json({ error: "player and question are required" }, 400);

    const result = await debugAnswerQuestion(c.env, player, question);
    return c.json(result);
  } catch (e) {
    return c.json({ error: "server error", detail: String(e) }, 500);
  }
});

// /api/* 以外（`/` 等）は静的アセットにフォールバック。
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
