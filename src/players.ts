// 隠し選手プール（名前のみ）。属性は持たず、真偽判定はモデルの知識に任せる。
// モデルが確実に知っている有名選手に絞る（ゲームを成立させるため）。
export const PLAYERS: string[] = [
  // レジェンド
  "Michael Jordan", "Magic Johnson", "Larry Bird", "Kareem Abdul-Jabbar",
  "Wilt Chamberlain", "Bill Russell", "Hakeem Olajuwon", "Shaquille O'Neal",
  "Tim Duncan", "Kobe Bryant", "Allen Iverson", "Charles Barkley",
  "Karl Malone", "John Stockton", "Scottie Pippen", "David Robinson",
  "Patrick Ewing", "Dennis Rodman", "Reggie Miller", "Gary Payton",
  "Isiah Thomas", "Dominique Wilkins", "Clyde Drexler", "Kevin Garnett",
  "Dirk Nowitzki", "Steve Nash", "Jason Kidd", "Ray Allen",
  "Paul Pierce", "Tracy McGrady", "Vince Carter", "Yao Ming",
  "Tony Parker", "Manu Ginobili", "Pau Gasol", "Grant Hill",
  "Dwyane Wade", "Carmelo Anthony", "Dwight Howard", "Blake Griffin",
  // 現代〜現役
  "LeBron James", "Stephen Curry", "Kevin Durant", "Kawhi Leonard",
  "Giannis Antetokounmpo", "James Harden", "Russell Westbrook", "Chris Paul",
  "Damian Lillard", "Klay Thompson", "Draymond Green", "Anthony Davis",
  "Nikola Jokic", "Joel Embiid", "Luka Doncic", "Jimmy Butler",
  "Paul George", "Kyrie Irving", "DeMar DeRozan", "Rudy Gobert",
  "Jayson Tatum", "Jaylen Brown", "Devin Booker", "Donovan Mitchell",
  "Trae Young", "Ja Morant", "Zion Williamson", "Karl-Anthony Towns",
  "Kyle Lowry", "Al Horford", "Bam Adebayo", "Pascal Siakam",
  "Domantas Sabonis", "Shai Gilgeous-Alexander", "Anthony Edwards",
  "Tyrese Haliburton", "Jalen Brunson", "De'Aaron Fox", "Jaren Jackson Jr.",
  "Victor Wembanyama", "Paolo Banchero", "Andre Iguodala", "Ben Simmons",
];

// index を渡して選手名を返す（乱数は呼び出し側で生成）
export function pickPlayer(rand: number = Math.random()): string {
  return PLAYERS[Math.floor(rand * PLAYERS.length)];
}

// FNV-1a による簡易ハッシュ。配列順からの予測を避けるために日次選出で使う。
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 通し日数（dayNumber）から、その日の隠し選手を決定論的に選ぶ。
// 全プレイヤーが同じ日に同じ選手を引く（Wordle 方式）。
export function dailyPlayer(dayNumber: number): string {
  return PLAYERS[hash(String(dayNumber)) % PLAYERS.length];
}
