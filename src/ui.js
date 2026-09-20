// フロントエンド（単一HTML）。Worker から / で配信する。
export const HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>NBA逆アキネータ</title>
<style>
  :root {
    --bg: #0f1220; --panel: #191d31; --panel2: #212642; --line: #2c3255;
    --text: #eef1ff; --muted: #9aa3c7; --accent: #f5a623; --accent2: #4f7cff;
    --yes: #2fbf71; --no: #e5484d; --maybe: #b8862f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: radial-gradient(1200px 600px at 50% -10%, #1b2140, var(--bg));
    color: var(--text); font-family: system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    min-height: 100dvh; display: flex; justify-content: center;
  }
  .app { width: 100%; max-width: 560px; display: flex; flex-direction: column; min-height: 100dvh; }
  header { padding: 18px 18px 10px; text-align: center; }
  header h1 { margin: 0; font-size: 20px; letter-spacing: .04em; }
  header h1 .ball { color: var(--accent); }
  header p { margin: 6px 0 0; color: var(--muted); font-size: 12.5px; line-height: 1.5; }
  .counter { margin: 10px auto 0; font-size: 12px; color: var(--muted); }
  .counter b { color: var(--text); font-size: 15px; }

  .log { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; }
  .row.me { justify-content: flex-end; }
  .bubble { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 14.5px; line-height: 1.5; }
  .me .bubble { background: var(--accent2); border-bottom-right-radius: 4px; }
  .ai .bubble { background: var(--panel2); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
  .verdict { font-weight: 700; }
  .verdict.yes { color: var(--yes); } .verdict.no { color: var(--no); } .verdict.maybe { color: var(--maybe); }
  .sys { text-align: center; color: var(--muted); font-size: 12.5px; padding: 4px 0; }

  footer { padding: 10px 12px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--panel); }
  .inputrow { display: flex; gap: 8px; }
  input[type=text] {
    flex: 1; background: var(--panel2); border: 1px solid var(--line); color: var(--text);
    padding: 12px 14px; border-radius: 12px; font-size: 15px; outline: none;
  }
  input::placeholder { color: #6b7399; }
  button {
    border: none; border-radius: 12px; padding: 12px 16px; font-size: 14px; font-weight: 700;
    cursor: pointer; color: #0f1220; background: var(--accent); white-space: nowrap;
  }
  button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
  .tabs { display: flex; gap: 8px; margin-bottom: 8px; }
  .tabs button { flex: 1; background: var(--panel2); color: var(--muted); border: 1px solid var(--line); }
  .tabs button.active { background: var(--accent); color: #0f1220; }
  .hint { color: var(--muted); font-size: 11.5px; margin-top: 8px; text-align: center; }

  .overlay {
    position: fixed; inset: 0; background: rgba(8,10,20,.72); backdrop-filter: blur(4px);
    display: none; align-items: center; justify-content: center; padding: 24px;
  }
  .overlay.show { display: flex; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 26px 22px;
    max-width: 420px; width: 100%; text-align: center;
  }
  .card h2 { margin: 0 0 8px; font-size: 22px; }
  .card .name { font-size: 26px; font-weight: 800; color: var(--accent); margin: 10px 0; }
  .card p { color: var(--muted); font-size: 13.5px; line-height: 1.6; }
  .card button { margin-top: 16px; width: 100%; padding: 14px; }
  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--muted);
    border-top-color: transparent; border-radius: 50%; animation: sp .7s linear infinite; vertical-align: -2px; }
  @keyframes sp { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="app">
  <header>
    <h1><span class="ball">🏀</span> NBA逆アキネータ</h1>
    <p>私（AI）が NBA選手を1人 思い浮かべました。<br>Yes / No で答えられる質問をして、誰かを当ててください。</p>
    <div class="counter">質問数 <b id="count">0</b></div>
  </header>

  <div class="log" id="log"></div>

  <footer>
    <div class="tabs">
      <button id="tabAsk" class="active">質問する</button>
      <button id="tabGuess">当てる</button>
    </div>
    <div class="inputrow">
      <input id="text" type="text" autocomplete="off" placeholder="例: その選手はガードですか？" />
      <button id="send">送信</button>
    </div>
    <div class="hint" id="hint">はい / いいえ / たぶん のいずれかで答えます。降参は <a href="#" id="giveup" style="color:var(--muted)">こちら</a></div>
  </footer>
</div>

<div class="overlay" id="overlay">
  <div class="card">
    <h2 id="resultTitle"></h2>
    <div class="name" id="resultName"></div>
    <p id="resultDesc"></p>
    <button id="again">もう一度あそぶ</button>
  </div>
</div>

<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), input = $("text"), send = $("send"), count = $("count");
  const tabAsk = $("tabAsk"), tabGuess = $("tabGuess"), hint = $("hint");
  const overlay = $("overlay");
  let token = null, mode = "ask", n = 0, busy = false;

  function addRow(side, html) {
    const row = document.createElement("div");
    row.className = "row " + side;
    if (side === "sys") { row.className = "sys"; row.innerHTML = html; }
    else { row.innerHTML = '<div class="bubble">' + html + '</div>'; }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function setMode(m) {
    mode = m;
    tabAsk.classList.toggle("active", m === "ask");
    tabGuess.classList.toggle("active", m === "guess");
    input.placeholder = m === "ask" ? "例: その選手はガードですか？" : "例: ステフィン・カリー";
    send.textContent = m === "ask" ? "送信" : "当てる";
    input.focus();
  }
  tabAsk.onclick = () => setMode("ask");
  tabGuess.onclick = () => setMode("guess");

  async function api(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function newGame() {
    overlay.classList.remove("show");
    log.innerHTML = ""; n = 0; count.textContent = "0";
    setMode("ask");
    addRow("sys", '<span class="spin"></span> 選手を選んでいます…');
    try {
      const d = await api("/api/new", {});
      token = d.token;
      log.innerHTML = "";
      addRow("sys", "選手を決めました。質問をどうぞ！");
    } catch (e) {
      log.innerHTML = ""; addRow("sys", "開始に失敗しました。再読み込みしてください。");
    }
  }

  const verdictJa = { yes: '<span class="verdict yes">はい</span>', no: '<span class="verdict no">いいえ</span>', maybe: '<span class="verdict maybe">たぶん / どちらとも言えない</span>' };

  async function submit() {
    const val = input.value.trim();
    if (!val || busy || !token) return;
    busy = true; send.disabled = true;
    addRow("me", escapeHtml(val));
    input.value = "";
    const thinking = addRow("ai", '<span class="spin"></span>');
    try {
      if (mode === "ask") {
        const d = await api("/api/ask", { token, question: val });
        n++; count.textContent = n;
        thinking.querySelector(".bubble").innerHTML = verdictJa[d.verdict] || verdictJa.maybe;
      } else {
        const d = await api("/api/guess", { token, guess: val });
        if (d.correct) {
          thinking.querySelector(".bubble").innerHTML = '正解！🎉 その通りです。';
          finish(true, d.answer);
        } else {
          thinking.querySelector(".bubble").innerHTML = '<span class="verdict no">違います</span> 別の選手です。';
        }
      }
    } catch (e) {
      thinking.querySelector(".bubble").innerHTML = "エラーが発生しました。もう一度お試しください。";
    } finally {
      busy = false; send.disabled = false; input.focus();
    }
  }

  function finish(win, name) {
    $("resultTitle").textContent = win ? "🎉 正解！" : "答えはこちら";
    $("resultName").textContent = name;
    $("resultDesc").textContent = win ? (n + " 問の質問で当てました！") : ("正解は " + name + " でした。");
    overlay.classList.add("show");
  }

  $("giveup").onclick = async (e) => {
    e.preventDefault();
    if (!token || busy) return;
    busy = true;
    try { const d = await api("/api/giveup", { token }); finish(false, d.answer); }
    catch { addRow("sys", "エラーが発生しました。"); }
    finally { busy = false; }
  };

  $("again").onclick = newGame;
  send.onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  newGame();
})();
</script>
</body>
</html>`;
