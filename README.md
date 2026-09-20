# NBA Akinator（逆アキネータ）

AI が NBA 選手を1人「隠し持ち」、ユーザーが Yes/No 質問を重ねて誰かを当てる Web ゲーム。

**公開URL: https://nba-akinator.takagi-305216.workers.dev**

## 構成

- **Cloudflare Workers** 単体でフロント配信と API を兼ねる。
- 推論は **Cloudflare Workers AI の [`typesafe/jev`](https://developers.cloudflare.com/ai/models/typesafe/jev/)**（TypeSafe の Jev モデル）を `env.AI.run` で利用。typesafe.ai の別 API キーは不要（課金は Cloudflare 経由）。
  - ユーザーの質問は Jev の **Noul**（真偽の確率）で評価し、はい / いいえ / たぶん にマッピング。
- **隠し選手**はサーバ側で名前プールからランダム選択し、AES-GCM（WebCrypto）で暗号化したトークンとしてクライアントに保持させる（KV 不要のステートレス構成、DevTools からは答えが読めない）。

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
