// フロントエンド（単一HTML）。Worker から / で配信する。
export const HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#fff9f0" />
<title>NBA逆アキネータ</title>
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

  .progress { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 12px; min-height: 16px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); transition: background .2s ease, transform .2s ease; }
  .dot.filled { background: var(--yellow); transform: scale(1.15); }
  .qbadge {
    background: var(--yellow); color: #7a5b00; font-weight: 800; font-size: 13px;
    padding: 4px 12px; border-radius: 999px;
  }

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

  .inputrow { display: flex; gap: 8px; }
  input[type=text] {
    flex: 1; background: var(--surface); border: 2px solid var(--border); color: var(--text);
    padding: 14px 16px; border-radius: 16px; font-size: 15px; font-weight: 700;
    font-family: inherit; outline: none;
  }
  input[type=text]:focus { border-color: var(--orange); }
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
    font-weight: 800; font-size: 26px; color: var(--green-dark);
  }
  .card .name {
    font-size: 28px; font-weight: 800; color: var(--orange); margin: 8px 0;
    font-family: "Baloo 2", "M PLUS Rounded 1c", sans-serif;
  }
  .card p { color: var(--muted); font-size: 14px; font-weight: 700; line-height: 1.6; margin: 4px 0 0; }
  .card .btn { margin-top: 18px; width: 100%; padding: 16px; }

  @keyframes bounceBall { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  @keyframes bounceDot { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
  @keyframes pop {
    0% { transform: scale(.85); opacity: 0; }
    60% { transform: scale(1.04); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ball, .row, .card { animation: none !important; }
    .loading-dots span { animation: none !important; opacity: .6; }
  }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="ball" aria-hidden="true">🏀</div>
    <h1>だれだ！？<span class="accent">NBA</span></h1>
    <p class="sub">AIが思い浮かべた選手をYes/No質問で当てよう！</p>
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
    <p id="resultDesc"></p>
    <button id="again" class="btn btn-blue" type="button">もう一回あそぶ</button>
  </div>
</div>

<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), input = $("text"), send = $("send"), progress = $("progress");
  const tabAsk = $("tabAsk"), tabGuess = $("tabGuess"), hintText = $("hintText");
  const overlay = $("overlay");
  let token = null, mode = "ask", n = 0, busy = false;

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function renderProgress(count) {
    if (count > 10) {
      progress.innerHTML = '<span class="qbadge">Q' + count + '</span>';
      return;
    }
    let html = "";
    for (let i = 1; i <= 10; i++) {
      html += '<span class="dot' + (i <= count ? " filled" : "") + '"></span>';
    }
    progress.innerHTML = html;
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

  function setMode(m) {
    mode = m;
    tabAsk.classList.toggle("active", m === "ask");
    tabGuess.classList.toggle("active", m === "guess");
    input.placeholder = m === "ask" ? "例: その選手はガードですか？" : "例: ステフィン・カリー";
    send.textContent = m === "ask" ? "送信" : "当てる";
    send.classList.toggle("btn-orange", m === "ask");
    send.classList.toggle("btn-blue", m === "guess");
    hintText.textContent = m === "ask" ? "はい / いいえ / どちらとも、で答えるよ。" : "選手のフルネームを入力してね。";
    input.focus();
  }
  tabAsk.onclick = () => setMode("ask");
  tabGuess.onclick = () => setMode("guess");

  async function api(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  const loadingHtml = '<span class="loading-dots"><span></span><span></span><span></span></span>';

  async function newGame() {
    overlay.classList.remove("show");
    log.innerHTML = ""; n = 0; renderProgress(0);
    setMode("ask");
    addRow("sys", loadingHtml + " 選手を選んでいます…");
    try {
      const d = await api("/api/new", {});
      token = d.token;
      log.innerHTML = "";
      addRow("sys", "選手を決めたよ。質問をどうぞ！");
    } catch (e) {
      log.innerHTML = ""; addRow("sys", "開始に失敗しました。再読み込みしてください。");
    }
  }

  const verdictChip = {
    yes: '<span class="chip chip-yes">✅ はい</span>',
    no: '<span class="chip chip-no">❌ いいえ</span>',
    maybe: '<span class="chip chip-maybe">🤔 どちらとも</span>',
  };

  function renderAnswer(d) {
    const chip = verdictChip[d.verdict] || verdictChip.maybe;
    if (typeof d.noul !== "number") return chip; // 較正値が無い場合はチップのみ
    const pct = Math.round(d.noul * 100);
    return chip +
      '<div class="gauge">' +
        '<div class="gauge-track"><div class="gauge-marker" style="left:' + pct + '%"></div></div>' +
        '<div class="gauge-label">Yes度 ' + pct + '%</div>' +
      '</div>';
  }

  async function submit() {
    const val = input.value.trim();
    if (!val || busy || !token) return;
    busy = true; send.disabled = true;
    addRow("me", escapeHtml(val));
    input.value = "";
    const thinking = addRow("ai", loadingHtml);
    try {
      if (mode === "ask") {
        const d = await api("/api/ask", { token, question: val });
        n++; renderProgress(n);
        thinking.querySelector(".bubble").innerHTML = renderAnswer(d);
      } else {
        const d = await api("/api/guess", { token, guess: val });
        if (d.correct) {
          thinking.querySelector(".bubble").innerHTML = '<span class="chip chip-yes">✅ せいかい！</span>';
          finish(true, d.answer);
        } else {
          thinking.querySelector(".bubble").innerHTML = '<span class="chip chip-no">❌ ちがうよ</span> べつの選手みたい。';
        }
      }
    } catch (e) {
      thinking.querySelector(".bubble").innerHTML = "エラーが発生しました。もう一度お試しください。";
    } finally {
      busy = false; send.disabled = false; input.focus();
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

  function finish(win, name) {
    $("cardEmoji").textContent = win ? "🎉" : "🙈";
    $("resultTitle").textContent = win ? "せいかい！" : "答えはこちら";
    $("resultName").textContent = name;
    $("resultDesc").textContent = win ? (n + "問で当てたよ！") : ("正解は " + name + " でした。");
    overlay.classList.add("show");
    if (win) launchConfetti();
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

  newGame();
})();
</script>
</body>
</html>`;
