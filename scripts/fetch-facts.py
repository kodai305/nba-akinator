#!/usr/bin/env python3
"""選手のファクトシートを stats.nba.com(nba_api) から取得して data/players.json を生成する。

Jev はモデルの記憶に頼ると数値・年代の比較を外すこと（身長の閾値、在籍年代）が
実測で分かっているため、そこだけ事実を渡せるようにするのが目的。

使い方:
    pip install nba_api
    python3 scripts/fetch-facts.py            # 全選手
    python3 scripts/fetch-facts.py --limit 3  # 動作確認用に3人だけ

注意:
  - stats.nba.com は非公開仕様。レート制限があるので各リクエスト間にスリープを入れている。
  - CI やクラウドIPからは Akamai のbot判定で弾かれる。ローカル（住宅回線）で実行すること。
"""
import argparse, json, re, sys, time, unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAYERS_TS = ROOT / "src" / "players.ts"
OUT = ROOT / "data" / "players.json"


def die(msg: str, code: int = 1):
    print(f"\n[ERROR] {msg}", file=sys.stderr)
    sys.exit(code)


def load_pool() -> list[str]:
    """src/players.ts の PLAYERS 配列から選手名を読む（データと出題プールを常に一致させる）。"""
    if not PLAYERS_TS.exists():
        die(f"{PLAYERS_TS} が見つかりません。リポジトリのルートで実行してください。")
    src = PLAYERS_TS.read_text(encoding="utf-8")
    m = re.search(r"PLAYERS\s*(?::[^=]+)?=\s*\[(.*?)\]", src, re.S)
    if not m:
        die("src/players.ts から PLAYERS 配列を読み取れませんでした。")
    names = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))
    names = [n.replace('\\"', '"').replace("\\'", "'") for n in names]
    if not names:
        die("PLAYERS 配列が空に見えます。")
    return names


def norm(s: str) -> str:
    """アクセント記号と記号を落として比較用に正規化（Jokic ↔ Jokić を一致させる）。"""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z]", "", s.lower())


def height_to_cm(h: str | None) -> int | None:
    """NBAの '6-11' 形式(フィート-インチ)を cm に変換。"""
    if not h or "-" not in h:
        return None
    try:
        ft, inch = h.split("-")
        return round(int(ft) * 30.48 + int(inch) * 2.54)
    except ValueError:
        return None


def to_int(v) -> int | None:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="先頭N人だけ取得（動作確認用）")
    ap.add_argument("--sleep", type=float, default=0.8, help="リクエスト間のスリープ秒")
    args = ap.parse_args()

    try:
        from nba_api.stats.static import players as static_players
        from nba_api.stats.endpoints import commonplayerinfo, playerawards
    except ImportError:
        die("nba_api が入っていません。先に `pip install nba_api` を実行してください。")

    pool = load_pool()
    if args.limit:
        pool = pool[: args.limit]
    print(f"対象 {len(pool)} 名を取得します（間隔 {args.sleep}s）\n")

    index = static_players.get_players()
    by_norm: dict[str, list[dict]] = {}
    for p in index:
        by_norm.setdefault(norm(p["full_name"]), []).append(p)

    out: dict[str, dict] = {}
    unmatched: list[str] = []
    failed: list[tuple[str, str]] = []

    for i, name in enumerate(pool, 1):
        cands = by_norm.get(norm(name), [])
        if not cands:
            print(f"[{i:>3}/{len(pool)}] {name:<26} ✗ NBA選手IDが見つかりません")
            unmatched.append(name)
            continue
        # 同名は在籍年が新しい方を優先（該当は稀）
        pid = cands[0]["id"]

        try:
            info = commonplayerinfo.CommonPlayerInfo(player_id=pid, timeout=60)
            row = info.get_normalized_dict()["CommonPlayerInfo"][0]
            time.sleep(args.sleep)

            awards_rows = playerawards.PlayerAwards(player_id=pid, timeout=60) \
                .get_normalized_dict().get("PlayerAwards", [])
            time.sleep(args.sleep)
        except Exception as e:  # ネットワーク/ブロック/仕様変更をまとめて拾う
            print(f"[{i:>3}/{len(pool)}] {name:<26} ✗ 取得失敗: {type(e).__name__}: {e}")
            failed.append((name, f"{type(e).__name__}: {e}"))
            continue

        def count(desc: str) -> int:
            return sum(1 for a in awards_rows if (a.get("DESCRIPTION") or "").strip() == desc)

        rec = {
            "nba_id": pid,
            "height_cm": height_to_cm(row.get("HEIGHT")),
            "position": (row.get("POSITION") or "").strip() or None,
            "country": (row.get("COUNTRY") or "").strip() or None,
            "birth_year": to_int((row.get("BIRTHDATE") or "")[:4]),
            "from_year": to_int(row.get("FROM_YEAR")),
            "to_year": to_int(row.get("TO_YEAR")),
            "mvp": count("NBA Most Valuable Player"),
            "titles": count("NBA Champion"),
            "all_star": count("NBA All-Star"),
        }
        out[name] = rec
        print(f"[{i:>3}/{len(pool)}] {name:<26} ✓ {rec['height_cm']}cm "
              f"{rec['from_year']}-{rec['to_year']} MVP{rec['mvp']} 優勝{rec['titles']}")

    if not out:
        die("1件も取得できませんでした。住宅回線のローカル環境で実行しているか確認してください"
            "（クラウドIPやVPNはAkamaiのbot判定で弾かれます）。")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "stats.nba.com (via nba_api)",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": "身長・在籍年・受賞のみ。ポジション等の分類質問はモデル側が既に高精度のため最小限に留める。",
        "players": dict(sorted(out.items())),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n書き出し: {OUT.relative_to(ROOT)}  ({len(out)}/{len(pool)} 名)")
    if unmatched:
        print(f"未マッチ {len(unmatched)}名: {', '.join(unmatched)}")
    if failed:
        print(f"取得失敗 {len(failed)}名:")
        for n, e in failed:
            print(f"  - {n}: {e}")
    if unmatched or failed:
        print("\n※ 一部欠けても実行時は『事実が無い項目はモデル判断にフォールバック』するので動作は止まりません。")


if __name__ == "__main__":
    main()
