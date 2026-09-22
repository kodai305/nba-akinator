// 選手ファクト（data/players.json）の読み込みと、Jev の state 用への整形。
// data/players.json は取得済みの実データ（stats.nba.com 由来、83名）。誤答が集中していた
// 「身長の閾値比較」「在籍年代レンジ」を Jev に事実として渡すために使う。
import playersData from "../data/players.json";

type RawPlayerFact = {
  nba_id?: number | null;
  height_cm?: number | null;
  position?: string | null;
  country?: string | null;
  birth_year?: number | null;
  from_year?: number | null;
  to_year?: number | null;
  mvp?: number | null;
  titles?: number | null;
  all_star?: number | null;
};

type PlayersFile = {
  source: string;
  fetched_at: string;
  note?: string;
  players: Record<string, RawPlayerFact>;
};

const DATA = playersData as unknown as PlayersFile;

// data/players.json の fetched_at ("2026-09-22T06:28:38+00:00" 等)の日付部分のみ。
export const FACTS_AS_OF_DATE: string = String(DATA.fetched_at || "").slice(0, 10);

// 「現役か」はモデルに推測させない。基準日以降に引退した可能性を気にして判定が
// 中間値に沈む（実測: Jokić が maybe 0.38）ため、to_year と基準日から計算で確定させる。
// NBAのシーズンは10月開始なので、7月以降はその年を開始年とするシーズンとみなす。
function seasonYearOf(isoDate: string): number {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  return d.getUTCMonth() + 1 >= 7 ? year : year - 1;
}

const AS_OF_SEASON = seasonYearOf(DATA.fetched_at);

// Jev の state.記録 に渡すキー名。機械的な英語キーだと年代判定等を誤るため、
// 自己説明的な日本語キーに変換する（値が null/欠損のものはキーごと省く）。
export type PlayerRecord = {
  "身長cm"?: number;
  "記録の基準日時点で現役か"?: boolean;
  "登録ポジション"?: string;
  "出身国"?: string;
  "生年"?: number;
  "NBA初シーズンの開始年"?: number;
  "最終シーズンの開始年"?: number;
  "レギュラーシーズンMVP受賞回数"?: number;
  "優勝回数"?: number;
  "オールスター選出回数"?: number;
};

function toPlayerRecord(raw: RawPlayerFact): PlayerRecord {
  const record: PlayerRecord = {};
  if (raw.height_cm != null) record["身長cm"] = raw.height_cm;
  if (raw.position != null) record["登録ポジション"] = raw.position;
  if (raw.country != null) record["出身国"] = raw.country;
  if (raw.birth_year != null) record["生年"] = raw.birth_year;
  if (raw.from_year != null) record["NBA初シーズンの開始年"] = raw.from_year;
  if (raw.to_year != null) {
    record["最終シーズンの開始年"] = raw.to_year;
    record["記録の基準日時点で現役か"] = raw.to_year >= AS_OF_SEASON;
  }
  if (raw.mvp != null) record["レギュラーシーズンMVP受賞回数"] = raw.mvp;
  if (raw.titles != null) record["優勝回数"] = raw.titles;
  if (raw.all_star != null) record["オールスター選出回数"] = raw.all_star;
  return record;
}

// 選手名（PLAYERS 配列と同じ表記）からファクトを引く。無ければ null。
export function getFacts(playerName: string): PlayerRecord | null {
  const raw = DATA.players[playerName];
  if (!raw) return null;
  const record = toPlayerRecord(raw);
  if (Object.keys(record).length === 0) return null;
  return record;
}
