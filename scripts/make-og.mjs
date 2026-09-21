// public/og.png (1200x630) 生成スクリプト。
// すべてベクター図形（SVG）で描画し、絵文字は一切使わない
// （sharp/librsvgでの絵文字フォント欠落＝豆腐(□)化を回避するため）。
//
// 再実行: `node scripts/make-og.mjs`
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "og.png");

const W = 1200;
const H = 630;

// ブランドカラー（public/styles.css の :root と揃える）
const CREAM = "#fff9f0";
const WASH = "#e8f7ff";
const SURFACE = "#ffffff";
const BORDER = "#e8e2d8";
const BORDER_DARK = "#d8cfbd";
const ORANGE = "#ff7a1a";
const ORANGE_DARK = "#d9600a";
const YELLOW = "#ffc800";
const YELLOW_TEXT = "#7a5b00";
const GREEN = "#58cc02";
const GREEN_DARK = "#46a302";
const GREEN_CHIP_BG = "#e7f9d9";
const RED = "#ff4b4b";
const TEXT = "#2f2f2f";
const MUTED = "#8a8378";

// macOS のシステムCJKフォント(Hiragino)を優先し、無ければ欧文フォントへ。
// Webフォント(Baloo 2 / M PLUS Rounded 1c)はラスタライザにインストールされて
// いない前提で使わない（豆腐/フォールバック崩れを避けるため）。
const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Arial, sans-serif';

// ---- ワードマーク & タグライン（日本語が描画できない環境向けの英語フォールバックも用意）----
const JP_OK = true; // 実描画結果を目視確認済み（Hiragino Sansでテスト済み: 豆腐化なし）
const TAGLINE = JP_OK ? "毎日ひとり、NBA選手を当てる。" : "Guess the NBA player. Daily.";
const BADGE_TEXT = JP_OK ? "1日1問" : "1 / DAY";
const Q_TEXT = JP_OK ? "ガードですか？" : "Is he a guard?";
const A_TEXT = JP_OK ? "はい" : "Yes";
const GAUGE_LABEL = JP_OK ? "Yes度 82%" : "82% Yes";
const CAPTION = JP_OK ? "少ない質問でズバリ当てる" : "Guess it in fewer questions";
const BULLETS = JP_OK
  ? ["Yes / No 質問で推理する", "最大20問で勝負", "毎日ひとりだけ、みんな同じ問題"]
  : ["Ask Yes / No questions", "20 questions max", "One player a day, for everyone"];

// 本物のバスケットボールの縫い目パターン: 縦の中心線・横の中心線・左右に膨らむ弧
// （"(" "）"を左右対称に）。地球儀の緯線に見えないよう、弧は円の真上/真下の極点
// ではなく、その少し脇（上端・下端付近）の円周上に接続する。
function basketballIcon(cx, cy, r) {
  const sw = Math.max(3, r * 0.09);
  // 弧は極点(真上/真下)ではなく、そこから角度をつけた"肩"の位置で円周に接続する。
  // → 縦の中心線の端点と弧の端点が別の場所になるため、経線が1点に収束する
  //   「地球儀」の見た目にならず、左右一対の縫い目として独立して見える。
  const theta = (35 * Math.PI) / 180;
  const xOff = r * Math.sin(theta);
  const yEdge = r * Math.cos(theta);
  const yTop = cy - yEdge;
  const yBot = cy + yEdge;
  const bulge = r * 1.0; // 頂点は外周のやや内側まで（外周と重ならない適度な張り出し）
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${ORANGE}" />
    <g stroke="#241a12" stroke-width="${sw}" stroke-linecap="round" fill="none">
      <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" />
      <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" />
      <path d="M ${cx - xOff} ${yTop} Q ${cx - bulge} ${cy} ${cx - xOff} ${yBot}" />
      <path d="M ${cx + xOff} ${yTop} Q ${cx + bulge} ${cy} ${cx + xOff} ${yBot}" />
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#241a12" stroke-width="${sw}" />
  `;
}

// 同心円の的（🎯の代わり・ベクター）
function targetMark(cx, cy, r) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${RED}" />
    <circle cx="${cx}" cy="${cy}" r="${r * 0.64}" fill="${SURFACE}" />
    <circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${ORANGE}" />
  `;
}

function roundedRect(x, y, w, h, rx, fill, opts = {}) {
  const stroke = opts.stroke ? `stroke="${opts.stroke}" stroke-width="${opts.strokeWidth ?? 2}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${stroke} />`;
}

// ---- レイアウト定数 ----
const MARGIN = 64;

// 右側パネル（ミニ実演）
const PANEL_X = 650;
const PANEL_Y = 84;
const PANEL_W = 486;
const PANEL_H = 470;
const PANEL_R = 32;
const PAD = 40;
const CX = PANEL_X + PANEL_W / 2; // パネル中心x

// ミステリー選手シルエット
const JERSEY_W = 128;
const JERSEY_H = 118;
const JERSEY_X = CX - JERSEY_W / 2;
const JERSEY_Y = PANEL_Y + 36;

// 質問フキダシ
const BUBBLE_X = PANEL_X + PAD;
const BUBBLE_Y = JERSEY_Y + JERSEY_H + 26;
const BUBBLE_W = PANEL_W - PAD * 2;
const BUBBLE_H = 66;

// 回答チップ＋ゲージ
const CHIP_X = BUBBLE_X;
const CHIP_Y = BUBBLE_Y + BUBBLE_H + 22;
const CHIP_W = 118;
const CHIP_H = 44;
const GAUGE_X = BUBBLE_X;
const GAUGE_Y = CHIP_Y + CHIP_H + 20;
const GAUGE_W = BUBBLE_W;
const GAUGE_H = 18;
const GAUGE_MARKER_X = GAUGE_X + GAUGE_W * 0.82;
const GAUGE_MARKER_Y = GAUGE_Y + GAUGE_H / 2;

// トレース行（絵文字の代わりに角丸スクエア＋的マーク）
const TRACE_COLORS = [RED, YELLOW, GREEN, RED, GREEN, GREEN];
const SQ = 38;
const SQ_GAP = 9;
const TARGET_R = 23;
const TARGET_GAP = 14;
const TRACE_ROW_W = TRACE_COLORS.length * SQ + (TRACE_COLORS.length - 1) * SQ_GAP + TARGET_GAP + TARGET_R * 2;
const TRACE_Y = GAUGE_Y + GAUGE_H + 52;
const TRACE_X = CX - TRACE_ROW_W / 2;

const squares = TRACE_COLORS.map((c, i) => {
  const x = TRACE_X + i * (SQ + SQ_GAP);
  return roundedRect(x, TRACE_Y, SQ, SQ, 10, c);
}).join("\n");
const targetCx = TRACE_X + TRACE_COLORS.length * (SQ + SQ_GAP) - SQ_GAP + TARGET_GAP + TARGET_R;
const targetCy = TRACE_Y + SQ / 2;

// バッジ（パネル右上にステッカーのように重ねる）
const BADGE_W = 168;
const BADGE_H = 56;
const BADGE_X = PANEL_X + PANEL_W - BADGE_W - 8;
const BADGE_Y = PANEL_Y - BADGE_H * 0.55;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="topWash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${WASH}" />
      <stop offset="100%" stop-color="${CREAM}" />
    </linearGradient>
    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${RED}" />
      <stop offset="50%" stop-color="#e5e1d8" />
      <stop offset="100%" stop-color="${GREEN}" />
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="${CREAM}" />
  <rect width="${W}" height="300" fill="url(#topWash)" />

  <!-- ワードマーク + バスケットボール -->
  ${basketballIcon(MARGIN + 46, 116, 46)}
  <text x="${MARGIN + 112}" y="140" font-family='${FONT}' font-size="78" font-weight="800" fill="${TEXT}">
    <tspan>Ba</tspan><tspan fill="${ORANGE}">ll</tspan><tspan>erdle</tspan>
  </text>
  <text x="${MARGIN}" y="190" font-family='${FONT}' font-size="30" font-weight="700" fill="${MUTED}">${TAGLINE}</text>

  <!-- 遊び方の要点（3行） -->
  ${BULLETS.map((b, i) => {
    const y = 268 + i * 58;
    return `
    <circle cx="${MARGIN + 15}" cy="${y - 9}" r="16" fill="none" stroke="${ORANGE}" stroke-width="3" />
    <text x="${MARGIN + 15}" y="${y - 3}" font-family='${FONT}' font-size="17" font-weight="800" fill="${ORANGE_DARK}" text-anchor="middle">${i + 1}</text>
    <text x="${MARGIN + 44}" y="${y}" font-family='${FONT}' font-size="24" font-weight="700" fill="${TEXT}">${b}</text>
    `;
  }).join("\n")}

  <!-- フッター -->
  <text x="${MARGIN}" y="${H - 40}" font-family='${FONT}' font-size="24" font-weight="700" fill="${MUTED}">ballerdle.tkg216.org</text>

  <!-- 右パネル: ミニ実演（チャンキーなドロップシャドウはブランドに合わせてベタ塗りオフセットで表現） -->
  ${roundedRect(PANEL_X, PANEL_Y + 10, PANEL_W, PANEL_H, PANEL_R, BORDER_DARK)}
  ${roundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, PANEL_R, SURFACE, { stroke: BORDER, strokeWidth: 3 })}

  <!-- ミステリー選手のシルエット -->
  <g>
    <path d="M ${JERSEY_X + 24} ${JERSEY_Y}
             L ${JERSEY_X + JERSEY_W - 24} ${JERSEY_Y}
             L ${JERSEY_X + JERSEY_W} ${JERSEY_Y + 26}
             L ${JERSEY_X + JERSEY_W - 16} ${JERSEY_Y + 40}
             L ${JERSEY_X + JERSEY_W - 16} ${JERSEY_Y + JERSEY_H}
             Q ${JERSEY_X + JERSEY_W / 2} ${JERSEY_Y + JERSEY_H + 14} ${JERSEY_X + 16} ${JERSEY_Y + JERSEY_H}
             L ${JERSEY_X + 16} ${JERSEY_Y + 40}
             L ${JERSEY_X} ${JERSEY_Y + 26}
             Z"
          fill="#efe9dc" stroke="${BORDER_DARK}" stroke-width="3" />
    <text x="${CX}" y="${JERSEY_Y + JERSEY_H / 2 + 26}" font-family='${FONT}' font-size="76" font-weight="800"
          fill="${ORANGE}" text-anchor="middle">?</text>
  </g>

  <!-- 質問フキダシ -->
  ${roundedRect(BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H, 20, SURFACE, { stroke: BORDER, strokeWidth: 2 })}
  <circle cx="${BUBBLE_X + 30}" cy="${BUBBLE_Y + BUBBLE_H / 2}" r="16" fill="#fff3e6" stroke="${BORDER}" stroke-width="2" />
  ${basketballIcon(BUBBLE_X + 30, BUBBLE_Y + BUBBLE_H / 2, 9)}
  <text x="${BUBBLE_X + 58}" y="${BUBBLE_Y + BUBBLE_H / 2 + 9}" font-family='${FONT}' font-size="25" font-weight="700" fill="${TEXT}">${Q_TEXT}</text>

  <!-- 回答チップ -->
  ${roundedRect(CHIP_X, CHIP_Y, CHIP_W, CHIP_H, CHIP_H / 2, GREEN_CHIP_BG)}
  <circle cx="${CHIP_X + 24}" cy="${CHIP_Y + CHIP_H / 2}" r="11" fill="${GREEN_DARK}" />
  <path d="M ${CHIP_X + 19} ${CHIP_Y + CHIP_H / 2} l 4 4 l 8 -8" fill="none" stroke="${SURFACE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  <text x="${CHIP_X + 44}" y="${CHIP_Y + CHIP_H / 2 + 8}" font-family='${FONT}' font-size="22" font-weight="800" fill="${GREEN_DARK}">${A_TEXT}</text>

  <!-- 確信度ゲージ（Yes寄り） -->
  ${roundedRect(GAUGE_X, GAUGE_Y, GAUGE_W, GAUGE_H, GAUGE_H / 2, "url(#gaugeGrad)", { stroke: BORDER, strokeWidth: 2 })}
  <circle cx="${GAUGE_MARKER_X}" cy="${GAUGE_MARKER_Y}" r="12" fill="${SURFACE}" stroke="${TEXT}" stroke-width="3" />
  <text x="${GAUGE_X + GAUGE_W}" y="${GAUGE_Y + GAUGE_H + 26}" font-family='${FONT}' font-size="18" font-weight="800" fill="${TEXT}" text-anchor="end">${GAUGE_LABEL}</text>

  <!-- トレース行（色付きスクエア + 的マーク） -->
  ${squares}
  ${targetMark(targetCx, targetCy, TARGET_R)}
  <text x="${CX}" y="${TRACE_Y + SQ + 34}" font-family='${FONT}' font-size="18" font-weight="700" fill="${MUTED}" text-anchor="middle">${CAPTION}</text>

  <!-- バッジ: 1日1問 -->
  ${roundedRect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, BADGE_H / 2, YELLOW, { stroke: "#e0ad00", strokeWidth: 3 })}
  <text x="${BADGE_X + BADGE_W / 2}" y="${BADGE_Y + BADGE_H / 2 + 9}" font-family='${FONT}' font-size="26" font-weight="800" fill="${YELLOW_TEXT}" text-anchor="middle">${BADGE_TEXT}</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(OUT, png);

const meta = await sharp(png).metadata();
console.log(`wrote ${OUT} (${meta.width}x${meta.height})`);
