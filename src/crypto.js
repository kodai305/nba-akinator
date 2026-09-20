// 隠し選手を AES-GCM で暗号化したトークンにする（KV不要のステートレス秘匿）。
// クライアントはトークンを保持して毎リクエスト送り返すが、中身（選手名）は復号できない。
// 鍵は env.GAME_SECRET から SHA-256 で導出。本番は `wrangler secret put GAME_SECRET` で設定。

const DEV_SECRET = "dev-insecure-secret-change-me";

async function getKey(env) {
  const secret = env.GAME_SECRET || DEV_SECRET;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function seal(env, obj) {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toBase64Url(out);
}

export async function open(env, token) {
  const key = await getKey(env);
  const buf = fromBase64Url(token);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
