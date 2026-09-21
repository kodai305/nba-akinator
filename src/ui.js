// フロントエンド（単一HTML）。Worker から / で配信する。
// Ballerdle: 毎日ひとり、NBA選手を当てる日次チャレンジ。
export const HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#fff9f0" />
<title>Ballerdle</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=M+PLUS+Rounded+1c:wght@700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --cream: #fff9f0;
    --surface: #ffffff;
    --border: #e8e2d8;
    --orange: #ff7a1a;
    --orange-dark: #d9600a;
    --blue: #1cb0f6;
    --blue-dark: #1391cc;
    --yellow: #ffc800;
    --green: #58cc02;
    --green-dark: #46a302;
    --red: #ff4b4b;
    --red-dark: #d63a3a;
    --text: #4b4b4b;
    --muted: #a8a29a;
  }
  * { box-sizing: border-box; }
  html, body { overflow-x: hidden; }
  body {
    margin: 0;
    background-color: var(--cream);
    background-image: linear-gradient(180deg, #e8f7ff 0%, var(--cream) 320px);
    background-repeat: no-repeat;
    color: var(--text);
    font-family: "M PLUS Rounded 1c", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    min-height: 100dvh;
    display: flex;
    justify-content: center;
  }
  .app {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  header { padding: 20px 16px 10px; text-align: center; }
  .ball { display: inline-block; font-size: 46px; animation: bounceBall 1.6s ease-in-out infinite; }
  header h1 {
    margin: 4px 0 2px;
    font-family: "Baloo 2", "M PLUS Rounded 1c", sans-serif;
    font-weight: 800;
    font-size: 26px;
    letter-spacing: .02em;
  }
  header h1 .accent { color: var(--orange); }
  header .sub { margin: 2px 0 0; color: var(--muted); font-size: 13px; font-weight: 700; }

  .daybadge-row { margin-top: 10px; }
  .qbadge {
    display: inline-block;
    background: var(--yellow); color: #7a5b00; font-weight: 800; font-size: 13px;
    padding: 4px 12px; border-radius: 999px;
  }

  .progress { margin-top: 12px; }
  .progress-wrap { max-width: 240px; margin: 0 auto; }
  .progress-label { font-size: 12.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px; text-align: center; }
  .progress-track { height: 10px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 999px; transition: width .25s ease, background-color .25s ease; }

  .log { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; align-items: flex-end; gap: 8px; animation: pop .25s ease; }
  .row.me { justify-content: flex-end; }
  .row.ai { justify-content: flex-start; }
  .avatar {
    width: 32px; height: 32px; border-radius: 50%; background: #fff3e6; border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0;
  }
  .bubble {
    max-width: 76%; padding: 12px 16px; border-radius: 22px; font-size: 15px; line-height: 1.6; font-weight: 700;
  }
  .ai .bubble { background: var(--surface); border: 2px solid var(--border); border-bottom-left-radius: 6px; color: var(--text); }
  .me .bubble { background: var(--blue); color: #fff; border-bottom-right-radius: 6px; }
  .sys { text-align: center; color: var(--muted); font-size: 13px; font-weight: 700; padding: 4px 0; }

  .chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px;
    font-weight: 800; font-size: 14px;
  }
  .chip-yes { background: #e7f9d9; color: var(--green-dark); }
  .chip-no { background: #ffe1e1; color: var(--red-dark); }
  .chip-maybe { background: #fff3d6; color: #a3760a; }

  .gauge { margin-top: 10px; min-width: 180px; }
  .gauge-track {
    position: relative; height: 14px; border-radius: 999px; border: 2px solid var(--border);
    background: linear-gradient(90deg, var(--red), #e5e1d8 50%, var(--green));
  }
  .gauge-marker {
    position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%;
    background: #fff; border: 3px solid var(--text); transform: translate(-50%, -50%);
    box-shadow: 0 2px 4px rgba(0,0,0,.25);
  }
  .gauge-label { margin-top: 6px; font-size: 12.5px; font-weight: 800; color: var(--text); text-align: center; }

  .loading-dots { display: inline-flex; gap: 4px; padding: 4px 2px; }
  .loading-dots span {
    width: 8px; height: 8px; border-radius: 50%; background: var(--muted);
    animation: bounceDot .6s infinite ease-in-out;
  }
  .loading-dots span:nth-child(2) { animation-delay: .15s; }
  .loading-dots span:nth-child(3) { animation-delay: .3s; }

  footer {
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--border);
    background: var(--surface);
  }
  .segment { display: flex; gap: 8px; margin-bottom: 10px; }
  .seg-btn {
    flex: 1; padding: 10px; border-radius: 14px; border: 2px solid var(--border);
    background: var(--surface); color: var(--muted); font-weight: 800; font-size: 14px;
    font-family: inherit; cursor: pointer;
  }
  .seg-btn#tabAsk.active { background: var(--orange); color: #fff; border-color: var(--orange-dark); box-shadow: 0 3px 0 var(--orange-dark); }
  .seg-btn#tabGuess.active { background: var(--blue); color: #fff; border-color: var(--blue-dark); box-shadow: 0 3px 0 var(--blue-dark); }
  .seg-btn:disabled { opacity: .5; cursor: default; }

  .inputrow { display: flex; gap: 8px; }
  input[type=text] {
    flex: 1; background: var(--surface); border: 2px solid var(--border); color: var(--text);
    padding: 14px 16px; border-radius: 16px; font-size: 15px; font-weight: 700;
    font-family: inherit; outline: none;
  }
  input[type=text]:focus { border-color: var(--orange); }
  input[type=text]:disabled { opacity: .6; }
  input::placeholder { color: var(--muted); font-weight: 700; }

  .btn {
    border: none; border-radius: 16px; padding: 14px 18px; font-size: 15px; font-weight: 800;
    font-family: inherit; cursor: pointer; color: #fff; white-space: nowrap;
    transition: transform .05s ease, box-shadow .05s ease;
  }
  .btn-orange { background: var(--orange); box-shadow: 0 4px 0 var(--orange-dark); }
  .btn-orange:active { transform: translateY(4px); box-shadow: 0 0 0 var(--orange-dark); }
  .btn-blue { background: var(--blue); box-shadow: 0 4px 0 var(--blue-dark); }
  .btn-blue:active { transform: translateY(4px); box-shadow: 0 0 0 var(--blue-dark); }
  .btn:disabled { opacity: .6; cursor: default; transform: none !important; }

  .hint { color: var(--muted); font-size: 11.5px; font-weight: 700; margin-top: 10px; text-align: center; }
  .hint a { color: var(--blue-dark); text-decoration: none; font-weight: 800; }
  .hint a.disabled { pointer-events: none; opacity: .4; }

  .overlay {
    position: fixed; inset: 0; background: rgba(75,75,75,.45);
    display: none; align-items: center; justify-content: center; padding: 24px; z-index: 50;
  }
  .overlay.show { display: flex; }
  #confetti { position: fixed; inset: 0; pointer-events: none; z-index: 51; }
  .card {
    position: relative; z-index: 52; background: var(--surface); border: 3px solid var(--border);
    border-radius: 28px; padding: 32px 24px; max-width: 400px; width: 100%; text-align: center;
    box-shadow: 0 10px 0 var(--border); animation: pop .3s ease;
  }
  .card-emoji { font-size: 48px; line-height: 1; }
  .card h2 {
    margin: 4px 0 8px; font-family: "Baloo 2", "M PLUS Rounded 1c", sans-serif;
    font-weight: 800; font-size: 22px; color: var(--green-dark);
  }
  .card .name {
    font-size: 28px; font-weight: 800; color: var(--orange); margin: 8px 0;
    font-family: "Baloo 2", "M PLUS Rounded 1c", sans-serif;
  }
  .card p { color: var(--muted); font-size: 14px; font-weight: 700; line-height: 1.6; margin: 4px 0 0; }
  .stamp {
    display: inline-block; margin: 4px 0 2px; padding: 6px 16px;
    border: 3px solid var(--red); border-radius: 10px; color: var(--red-dark);
    font-weight: 800; font-size: 15px; font-family: "Baloo 2", "M PLUS Rounded 1c", sans-serif;
    transform: rotate(-6deg); animation: stampPop .45s cubic-bezier(.34,1.56,.64,1);
  }
  .trace-row {
    font-size: 26px; letter-spacing: 3px; line-height: 1.5; margin: 14px 0 2px;
    word-break: break-all;
  }
  .share-row { display: flex; gap: 8px; margin-top: 18px; }
  .share-row .btn { flex: 1; margin-top: 0; padding: 14px 10px; font-size: 14px; }
  .countdown { margin-top: 14px; font-size: 12.5px; font-weight: 800; color: var(--muted); }

  @keyframes bounceBall { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  @keyframes bounceDot { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
  @keyframes pop {
    0% { transform: scale(.85); opacity: 0; }
    60% { transform: scale(1.04); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes stampPop {
    0% { transform: scale(0) rotate(-25deg); opacity: 0; }
    60% { transform: scale(1.15) rotate(8deg); opacity: 1; }
    100% { transform: scale(1) rotate(-6deg); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ball, .row, .card, .stamp { animation: none !important; }
    .loading-dots span { animation: none !important; opacity: .6; }
  }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="ball" aria-hidden="true">🏀</div>
    <h1><span class="accent">Ballerdle</span></h1>
    <p class="sub">毎日ひとり、NBA選手を当てる。</p>
    <div class="daybadge-row"><span class="qbadge" id="daybadge">#--</span></div>
    <div class="progress" id="progress"></div>
  </header>

  <div class="log" id="log"></div>

  <footer>
    <div class="segment">
      <button id="tabAsk" class="seg-btn active" type="button">質問する</button>
      <button id="tabGuess" class="seg-btn" type="button">当てる</button>
    </div>
    <div class="inputrow">
      <input id="text" type="text" autocomplete="off" placeholder="例: その選手はガードですか？" />
      <button id="send" class="btn btn-orange" type="button">送信</button>
    </div>
    <div class="hint"><span id="hintText">はい / いいえ / どちらとも、で答えるよ。</span> <a href="#" id="giveup">降参する</a></div>
  </footer>
</div>

<div class="overlay" id="overlay">
  <canvas id="confetti"></canvas>
  <div class="card">
    <div class="card-emoji" id="cardEmoji">🎉</div>
    <h2 id="resultTitle">せいかい！</h2>
    <div class="name" id="resultName"></div>
    <div class="stamp" id="stamp" style="display:none">🎯 ズバリ！</div>
    <div class="trace-row" id="traceRow"></div>
    <p id="resultDesc"></p>
    <div class="share-row">
      <button id="shareX" class="btn btn-blue" type="button">𝕏でシェア</button>
      <button id="shareCopy" class="btn btn-orange" type="button">コピー</button>
    </div>
    <p class="countdown" id="countdown"></p>
  </div>
</div>

<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), input = $("text"), send = $("send"), progress = $("progress");
  const tabAsk = $("tabAsk"), tabGuess = $("tabGuess"), hintText = $("hintText");
  const overlay = $("overlay"), daybadge = $("daybadge"), giveupLink = $("giveup");
  const MAX_QUESTIONS = 20;
  const STREAK_KEY = "ballerdle:streak";

  let today = null;
  let game = null;
  let streak = { current: 0, best: 0, lastWonDate: null };
  let mode = "ask", busy = false, shareTextCache = "", countdownTimer = null;

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function storageKey(date) { return "ballerdle:v1:" + date; }

  function loadGame(date) {
    try {
      const raw = localStorage.getItem(storageKey(date));
      if (!raw) return { log: [], used: 0, questions: 0, status: "playing", trace: [] };
      const obj = JSON.parse(raw);
      return {
        log: Array.isArray(obj.log) ? obj.log : [],
        used: typeof obj.used === "number" ? obj.used : 0,
        questions: typeof obj.questions === "number" ? obj.questions : 0,
        status: ["playing", "won", "lost"].indexOf(obj.status) !== -1 ? obj.status : "playing",
        trace: Array.isArray(obj.trace) ? obj.trace : [],
      };
    } catch (e) {
      return { log: [], used: 0, questions: 0, status: "playing", trace: [] };
    }
  }

  function saveGame() {
    try { localStorage.setItem(storageKey(today.date), JSON.stringify(game)); } catch (e) {}
  }

  function loadStreak() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (!raw) return { current: 0, best: 0, lastWonDate: null };
      const obj = JSON.parse(raw);
      return {
        current: typeof obj.current === "number" ? obj.current : 0,
        best: typeof obj.best === "number" ? obj.best : 0,
        lastWonDate: obj.lastWonDate || null,
      };
    } catch (e) {
      return { current: 0, best: 0, lastWonDate: null };
    }
  }

  function saveStreak() {
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(streak)); } catch (e) {}
  }

  function prevDateString(dateStr) {
    const parts = dateStr.split("-");
    const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function recordStreakOnWin() {
    streak = loadStreak();
    const prev = prevDateString(today.date);
    streak.current = streak.lastWonDate === prev ? streak.current + 1 : 1;
    streak.best = Math.max(streak.best, streak.current);
    streak.lastWonDate = today.date;
    saveStreak();
  }

  function renderProgress() {
    const remaining = Math.max(0, MAX_QUESTIONS - game.used);
    const pct = Math.max(0, Math.min(100, Math.round((remaining / MAX_QUESTIONS) * 100)));
    const color = remaining <= 4 ? "var(--red)" : remaining <= 9 ? "var(--yellow)" : "var(--green)";
    progress.innerHTML =
      '<div class="progress-wrap">' +
        '<div class="progress-label">残り ' + remaining + ' 問</div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      "</div>";
  }

  function addRow(side, html) {
    const row = document.createElement("div");
    if (side === "sys") {
      row.className = "sys";
      row.innerHTML = html;
    } else {
      row.className = "row " + side;
      let inner = "";
      if (side === "ai") inner += '<div class="avatar">🏀</div>';
      inner += '<div class="bubble">' + html + "</div>";
      row.innerHTML = inner;
    }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function addPersistedRow(side, html) {
    addRow(side, html);
    game.log.push({ side: side, html: html });
    saveGame();
  }

  function setMode(m) {
    mode = m;
    tabAsk.classList.toggle("active", m === "ask");
    tabGuess.classList.toggle("active", m === "guess");
    input.placeholder = m === "ask" ? "例: その選手はガードですか？" : "例: ステフィン・カリー";
    send.textContent = m === "ask" ? "送信" : "当てる";
    send.classList.toggle("btn-orange", m === "ask");
    send.classList.toggle("btn-blue", m === "guess");
    hintText.textContent = m === "ask" ? "はい / いいえ / どちらとも、で答えるよ。" : "選手のフルネームを入力してね。";
    if (game && game.status === "playing") input.focus();
  }
  tabAsk.onclick = () => setMode("ask");
  tabGuess.onclick = () => setMode("guess");

  async function apiGet(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  const loadingHtml = '<span class="loading-dots"><span></span><span></span><span></span></span>';

  const verdictChip = {
    yes: '<span class="chip chip-yes">✅ はい</span>',
    no: '<span class="chip chip-no">❌ いいえ</span>',
    maybe: '<span class="chip chip-maybe">🤔 どちらとも</span>',
  };
  const verdictEmoji = {
    yes: "🟩",
    no: "🟥",
    maybe: "🟨",
  };

  function renderAnswer(d) {
    const chip = verdictChip[d.verdict] || verdictChip.maybe;
    if (typeof d.noul !== "number") return chip; // 較正値が無い場合はチップのみ
    const pct = Math.round(d.noul * 100);
    return chip +
      '<div class="gauge">' +
        '<div class="gauge-track"><div class="gauge-marker" style="left:' + pct + '%"></div></div>' +
        '<div class="gauge-label">Yes度 ' + pct + '%</div>' +
      "</div>";
  }

  function lockUI() {
    input.disabled = true; send.disabled = true;
    tabAsk.disabled = true; tabGuess.disabled = true;
    giveupLink.classList.add("disabled");
  }
  function unlockUI() {
    input.disabled = false; send.disabled = false;
    tabAsk.disabled = false; tabGuess.disabled = false;
    giveupLink.classList.remove("disabled");
  }

  function msUntilNextJstMidnight() {
    const JST_OFFSET = 9 * 3600 * 1000, DAY = 86400000;
    const now = Date.now();
    const dayNum = Math.floor((now + JST_OFFSET) / DAY);
    const nextBoundaryUtc = (dayNum + 1) * DAY - JST_OFFSET;
    return Math.max(0, nextBoundaryUtc - now);
  }
  function fmtHMS(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  function updateCountdown() {
    const ms = msUntilNextJstMidnight();
    const el = $("countdown");
    if (ms <= 0) {
      el.textContent = "更新中…";
      if (countdownTimer) clearInterval(countdownTimer);
      location.reload();
      return;
    }
    el.textContent = "また明日！ 次の問題まで あと " + fmtHMS(ms);
  }
  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
  }

  // 画面のトレース表示とシェア文で共通して使う、確定済みトレース文字列。
  // win 時は game.trace の末尾に既に 🎯 が積まれている。lose 時のみ表示直前に ❌ を付ける。
  function renderedTrace(win) {
    const base = (game.trace || []).join("");
    return win ? base : base + "❌";
  }

  function buildShareText(win) {
    const n = today.number;
    const traceStr = renderedTrace(win);
    const lines = [];
    if (win) {
      lines.push("Ballerdle #" + n + " 🏀 " + game.used + "問で正解！");
      lines.push(traceStr);
      if (streak.current >= 2) lines.push("🔥" + streak.current + "日連続");
    } else {
      lines.push("Ballerdle #" + n + " 🏀 ギブアップ…");
      lines.push(traceStr);
    }
    lines.push("#ballerdle  ballerdle.tkg216.org");
    return lines.join("\n");
  }

  function renderResult(win, answerName) {
    $("cardEmoji").textContent = win ? "🎉" : "🙈";
    $("resultTitle").textContent = win ? "せいかい！🎉" : ("残念！正解は " + answerName);
    $("resultName").textContent = win ? answerName : "";
    $("resultName").style.display = win ? "" : "none";
    $("stamp").style.display = win ? "inline-block" : "none";
    $("traceRow").textContent = renderedTrace(win);
    const descParts = [];
    if (win) {
      descParts.push("#" + today.number + " を " + game.used + "問でクリア！");
      if (streak.current >= 2) descParts.push("🔥" + streak.current + "日連続（最高" + streak.best + "）");
    }
    $("resultDesc").innerHTML = descParts.join("<br>");
    shareTextCache = buildShareText(win);
    overlay.classList.add("show");
    startCountdown();
    if (win) launchConfetti();
  }

  async function triggerLoss() {
    try {
      const d = await apiPost("/api/giveup", {});
      game.status = "lost";
      saveGame();
      lockUI();
      renderResult(false, d.answer);
    } catch (e) {
      addRow("sys", "エラーが発生しました。");
    }
  }

  async function submit() {
    if (!game || game.status !== "playing") return;
    const val = input.value.trim();
    if (!val || busy) return;
    busy = true; send.disabled = true;
    addPersistedRow("me", escapeHtml(val));
    input.value = "";
    const thinking = addRow("ai", loadingHtml);
    try {
      if (mode === "ask") {
        const d = await apiPost("/api/ask", { question: val });
        const html = renderAnswer(d);
        thinking.querySelector(".bubble").innerHTML = html;
        game.log.push({ side: "ai", html: html });
        game.trace.push(verdictEmoji[d.verdict] || verdictEmoji.maybe);
        game.used += 1;
        game.questions += 1;
        saveGame();
        renderProgress();
        if (game.used >= MAX_QUESTIONS) await triggerLoss();
      } else {
        const d = await apiPost("/api/guess", { guess: val });
        if (d.correct) {
          const winHtml = '<span class="chip chip-yes">✅ せいかい！</span>';
          thinking.querySelector(".bubble").innerHTML = winHtml;
          game.log.push({ side: "ai", html: winHtml });
          game.trace.push("🎯");
          game.status = "won";
          saveGame();
          recordStreakOnWin();
          lockUI();
          renderResult(true, d.answer);
        } else {
          const missHtml = '<span class="chip chip-no">❌ ちがうよ</span> べつの選手みたい。';
          thinking.querySelector(".bubble").innerHTML = missHtml;
          game.log.push({ side: "ai", html: missHtml });
          game.trace.push("⬛");
          game.used += 1;
          saveGame();
          renderProgress();
          if (game.used >= MAX_QUESTIONS) await triggerLoss();
        }
      }
    } catch (e) {
      thinking.querySelector(".bubble").innerHTML = "エラーが発生しました。もう一度お試しください。";
    } finally {
      busy = false;
      if (game.status === "playing") { send.disabled = false; input.focus(); }
    }
  }

  function resizeConfetti() {
    const c = $("confetti");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  window.addEventListener("resize", () => { if (overlay.classList.contains("show")) resizeConfetti(); });

  function launchConfetti() {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = $("confetti");
    resizeConfetti();
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (reduceMotion) return;
    const colors = ["#ff7a1a", "#1cb0f6", "#ffc800", "#58cc02", "#ff4b4b"];
    const particles = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.6,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 2 + Math.random() * 3,
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    const start = Date.now();
    const duration = 3000;
    function frame() {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (elapsed < duration) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  $("shareX").onclick = () => {
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareTextCache), "_blank");
  };
  $("shareCopy").onclick = () => {
    const btn = $("shareCopy");
    const orig = "コピー";
    function done() {
      btn.textContent = "コピーしました";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareTextCache).then(done).catch(() => { fallbackCopy(shareTextCache); done(); });
    } else {
      fallbackCopy(shareTextCache);
      done();
    }
  };

  giveupLink.onclick = async (e) => {
    e.preventDefault();
    if (!game || game.status !== "playing" || busy) return;
    busy = true;
    try {
      const d = await apiPost("/api/giveup", {});
      game.status = "lost";
      saveGame();
      lockUI();
      renderResult(false, d.answer);
    } catch (e2) {
      addRow("sys", "エラーが発生しました。");
    } finally {
      busy = false;
    }
  };

  send.onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

  async function init() {
    setMode("ask");
    try {
      today = await apiGet("/api/today");
    } catch (e) {
      addRow("sys", "読み込みに失敗しました。再読み込みしてください。");
      return;
    }
    daybadge.textContent = "#" + today.number;
    streak = loadStreak();
    game = loadGame(today.date);
    log.innerHTML = "";
    if (game.log.length) {
      game.log.forEach((entry) => addRow(entry.side, entry.html));
    } else if (game.status === "playing") {
      addPersistedRow("sys", "#" + today.number + " の選手が決まったよ。質問をどうぞ！");
    }
    renderProgress();

    if (game.status === "won" || game.status === "lost") {
      lockUI();
      let answerName = "";
      try {
        const d = await apiPost("/api/giveup", {});
        answerName = d.answer;
      } catch (e) {}
      renderResult(game.status === "won", answerName);
    } else {
      unlockUI();
      input.focus();
    }
  }

  init();
})();
</script>
</body>
</html>`;
