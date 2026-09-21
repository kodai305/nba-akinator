# Ballerdle

毎日ひとり、NBA選手を当てる日次チャレンジ。Yes/No 質問を最大20問重ねて、AI が「隠し持つ」その日の選手を当てる Web ゲーム。

**公開URL: https://nba-akinator.takagi-305216.workers.dev**

## 構成

- **Cloudflare Workers** 単体でフロント配信と API を兼ねる。
- 推論は `BACKEND=jev` かつ `TYPESAFE_API_KEY`（Worker Secret）設定時、**typesafe.ai の REST API を直接呼び出す**（`POST https://api.typesafe.ai/v1/systemone`, `model: "jev-latest"`）。ユーザーの質問は Jev の **Noul**（真偽の確率）で評価し、はい / いいえ / たぶん にマッピング。
  - `BACKEND` 未設定 or `TYPESAFE_API_KEY` 未設定時は **Cloudflare Workers AI の無料モデル `@cf/meta/llama-3.3-70b-instruct-fp8-fast`**（`env.AI.run`）にフォールバック（較正済み確率が無いためゲージは非表示）。
- **その日の隠し選手**は JST基準の通し日数から決定論的に選出（`src/daily.js`）。全員が同じ日に同じ選手を引く（Wordle方式）。選手名はサーバ内でのみ算出し、正解/降参時以外はレスポンスに含めない。トークンやKVは不要なステートレス構成。
- 同じ質問/推測の重複呼び出しは Cache API（`caches.default`）で1日キャッシュし、Jev 呼び出しを節約する。
- 進捗（質問ログ・残数・勝敗）とストリークはクライアントの `localStorage` に保存し、1日1回のプレイを担保する。

## 開発

```bash
npm install
npx wrangler login      # 初回のみ
npm run dev             # ローカル起動（Workers AI は実体が Cloudflare 側のため要ログイン）
```

## デプロイ

```bash
npm run deploy
```
