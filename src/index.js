// NBA逆アキネータ — Cloudflare Worker（フロント配信 + API）。
import { HTML } from "./ui.js";
import { pickPlayer } from "./players.js";
import { seal, open } from "./crypto.js";
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (request.method === "POST" && pathname.startsWith("/api/")) {
      try {
        if (pathname === "/api/new") {
          const player = pickPlayer(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
          const token = await seal(env, { p: player, t: Date.now() });
          return json({ token });
        }

        const body = await readBody(request);
        if (!body.token) return json({ error: "missing token" }, 400);
        let state;
        try {
          state = await open(env, body.token);
        } catch {
          return json({ error: "invalid token" }, 400);
        }
        const player = state.p;

        if (pathname === "/api/ask") {
          const question = String(body.question || "").slice(0, 300);
          if (!question) return json({ error: "empty question" }, 400);
          const { verdict } = await answerQuestion(env, player, question);
          return json({ verdict });
        }

        if (pathname === "/api/guess") {
          const guess = String(body.guess || "").slice(0, 120);
          if (!guess) return json({ error: "empty guess" }, 400);
          const { correct } = await checkGuess(env, player, guess);
          return json(correct ? { correct: true, answer: player } : { correct: false });
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
