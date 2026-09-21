// 日次選出（決定論・全員同じ・秘匿）。
// JST基準の通し日数から、パズル番号・日付文字列・当日の隠し選手を算出する。
// player はサーバ内部専用の値。正解/降参のレスポンス以外には絶対に含めないこと。
import { dailyPlayer } from "./players";

const JST_OFFSET_MS = 9 * 3600 * 1000;
const DAY_MS = 86400000;

// 2026-09-21 が #1 になる基準日（dayNumber と同じ式で算出する）。
export const EPOCH = Math.floor((Date.UTC(2026, 8, 21, 0, 0, 0) + JST_OFFSET_MS) / DAY_MS);

// JST基準の通し日数。
export function dayNumberOf(now: number = Date.now()): number {
  return Math.floor((now + JST_OFFSET_MS) / DAY_MS);
}

// JST の YYYY-MM-DD 文字列。
export function dateStringOf(now: number = Date.now()): string {
  const d = new Date(now + JST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// dayNumber → パズル番号（#1, #2, ...）。
export function puzzleNumberOf(dayNumber: number): number {
  return dayNumber - EPOCH + 1;
}

export type Daily = {
  dayNumber: number;
  number: number;
  date: string;
  player: string;
};

// 現在時刻から、当日のパズル情報一式を返す。
export function getDaily(now: number = Date.now()): Daily {
  const dayNumber = dayNumberOf(now);
  return {
    dayNumber,
    number: puzzleNumberOf(dayNumber),
    date: dateStringOf(now),
    player: dailyPlayer(dayNumber),
  };
}
