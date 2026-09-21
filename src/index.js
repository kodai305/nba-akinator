// Ballerdle — Cloudflare Worker（フロント配信 + API）。
// 毎日ひとり、NBA選手を当てる日次チャレンジ。選手はJST基準で決定論的に選出され、
// 正解/降参時以外はレスポンスに絶対含めない。
import { HTML } from "./ui.js";
import { getDaily } from "./daily.js";
import { answerQuestion, checkGuess } from "./ai.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// trim→小文字化→連続空白を1つに。
function normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (request.method === "GET" && pathname === "/api/today") {
      const { number, date } = getDaily();
      return json({ number, date });
    }

    if (request.method === "POST" && pathname.startsWith("/api/")) {
      try {
        const { player, date } = getDaily();
        const body = await readBody(request);
        const cache = caches.default;

        if (pathname === "/api/ask") {
          const question = String(body.question || "").slice(0, 300);
          if (!question) return json({ error: "empty question" }, 400);

          const cacheKey = new Request(
            `https://cache.ballerdle/q?d=${date}&q=${encodeURIComponent(normalize(question))}`,
          );
          const cached = await cache.match(cacheKey);
          if (cached) return cached;

          const { verdict, noul } = await answerQuestion(env, player, question);
          const payload = { verdict, noul: typeof noul === "number" ? Math.round(noul * 1000) / 1000 : null };
          const cacheable = new Response(JSON.stringify(payload), {
            headers: { "content-type": "application/json", "cache-control": "max-age=86400" },
          });
          ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
          return cacheable;
        }

        if (pathname === "/api/guess") {
          const guess = String(body.guess || "").slice(0, 120);
          if (!guess) return json({ error: "empty guess" }, 400);

          const cacheKey = new Request(
            `https://cache.ballerdle/g?d=${date}&q=${encodeURIComponent(normalize(guess))}`,
          );
          const cached = await cache.match(cacheKey);
          if (cached) return cached;

          const { correct } = await checkGuess(env, player, guess);
          const payload = correct ? { correct: true, answer: player } : { correct: false };
          const cacheable = new Response(JSON.stringify(payload), {
            headers: { "content-type": "application/json", "cache-control": "max-age=86400" },
          });
          ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
          return cacheable;
        }

        if (pathname === "/api/giveup") {
          return json({ answer: player });
        }

        return json({ error: "not found" }, 404);
      } catch (e) {
        return json({ error: "server error", detail: String(e) }, 500);
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
