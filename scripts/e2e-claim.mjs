// Manual E2E check for phase 3 (/claim, account linking, CSP headers).
// Usage: node scripts/e2e-claim.mjs  (site on :3100 with BOT_INTERNAL_SECRET=s3cret-internal)
import pg from "pg";

const B = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const SECRET = process.env.BOT_INTERNAL_SECRET ?? "s3cret-internal";
const H = { "content-type": "application/json" };

let r = await fetch(B + "/api/auth/register", {
  method: "POST",
  headers: H,
  body: JSON.stringify({ name: "Email Buyer", email: `buyer${Date.now()}@test.com`, password: "secret123" }),
});
const cookie = r.headers.get("set-cookie").split(";")[0];
const c = new pg.Client(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db");
await c.connect();
const pid = (await c.query("select id from products where slug='supergrok'")).rows[0].id;
const o = (await (await fetch(B + "/api/order", { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ productId: pid, networkId: "usdt-trc20" }) })).json()).order;
r = await fetch(B + "/api/order/pay", { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ secret: o.secret, txHash: "feedbeef12345678" }) });
console.log("email pay: sentToTelegram =", (await r.json()).sentToTelegram, "(expected false)");

const before = Number((await c.query("select count(*) from site_users")).rows[0].count);
const S = { ...H, "x-internal-secret": SECRET };
r = await fetch(B + "/api/internal/orders/claim", { method: "POST", headers: S, body: JSON.stringify({ secret: o.secret, telegramId: "555111", username: "linked_user" }) });
const j = await r.json();
console.log("claim by tg 555111:", r.status, "sent =", j.sentToTelegram, "credentials:", !!j.order?.credentials);
const me = await (await fetch(B + "/api/auth/me", { headers: { cookie } })).json();
console.log("e-mail account linked:", me.user.telegramId, me.user.telegramUsername, "bot profile:", !!me.bot);
r = await fetch(B + "/api/internal/orders/claim", { method: "POST", headers: S, body: JSON.stringify({ secret: o.secret, telegramId: "888" }) });
console.log("claim by other tg:", r.status, await r.text());
console.log("accounts created by claims:", Number((await c.query("select count(*) from site_users")).rows[0].count) - before, "(expected 0)");
r = await fetch(B + "/miniapp");
console.log("/miniapp CSP:", r.headers.get("content-security-policy"));
r = await fetch(B + "/");
console.log("/ CSP:", r.headers.get("content-security-policy"));
await c.end();
