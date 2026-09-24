// Integration test for src/lib/miniapp.ts against a LOCAL MOCK of the bot
// backend: real HTTP requests over loopback, no Telegram, no real backend,
// no bot token. The mock only checks what the client sends and replays the
// documented responses; it does not validate signatures or IPs.
//
// Run: node scripts/test-miniapp-verify.mjs   (Node >= 22.18, type stripping)
import http from "node:http";
import assert from "node:assert/strict";
import { once } from "node:events";
import {
  VERIFY_PATH,
  buildVerifyUrl,
  classifyResponse,
  normalizeBackendBase,
  verifyIp,
} from "../src/lib/miniapp.ts";

// Opaque placeholder: the client must forward it byte-for-byte. In the app the
// value only ever comes from Telegram.WebApp.initData.
const INIT_DATA = "opaque%20placeholder&not=real-initdata&\"quoted\"";

const json = (value) => JSON.stringify(value);
const CASES = {
  // 192.0.2.10 is an RFC 5737 documentation address, used only by this mock.
  verified: [200, json({ ok: true, status: "verified", message_key: "ip.verified", ip: "192.0.2.10", referral_qualified: true })],
  vpn: [200, json({ ok: false, status: "vpn_detected", message_key: "ip.vpn_detected" })],
  datacenter: [403, json({ ok: false, status: "datacenter", message_key: "ip.datacenter" })],
  duplicate: [409, json({ ok: false, status: "duplicate", message_key: "ip.duplicate" })],
  duplicate_bare: [409, ""],
  registration: [403, json({ ok: false, status: "error", message_key: "verification.required" })],
  common_error: [200, json({ ok: false, status: "error", message_key: "common.error" })],
  bad_request: [400, json({ ok: false, status: "error", message_key: "common.error" })],
  session: [401, json({ ok: false, status: "error", message_key: "common.error" })],
  forbidden: [403, "<html>Forbidden</html>"],
  not_found: [404, "<!DOCTYPE html><html><body>404</body></html>"],
  rate_limited: [429, json({ ok: false })],
  server_error: [500, json({ ok: false, status: "error", message_key: "common.error" })],
  bad_gateway: [502, "<html>502 Bad Gateway</html>"],
  unavailable: [503, json({ ok: false, status: "error", message_key: "common.error" })],
  invalid_json: [200, "<html>not json</html>"],
  ok_without_status: [200, json({ ok: true })],
  slow: [200, json({ ok: true, status: "verified", message_key: "ip.verified" })],
};

const seen = [];
const server = http.createServer(async (req, res) => {
  const name = req.url.split("/")[1];
  let raw = "";
  for await (const chunk of req) raw += chunk;
  seen.push({
    name,
    method: req.method,
    path: req.url.slice(name.length + 1),
    type: req.headers["content-type"] ?? "",
    cookie: req.headers.cookie,
    raw,
  });
  if (name === "slow") await new Promise((r) => setTimeout(r, 1500));
  const [status, body] = CASES[name] ?? [500, ""];
  res.writeHead(status, { "Content-Type": body.startsWith("{") ? "application/json" : "text/html" });
  res.end(body);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const failed = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed.push(name);
    console.log(`  ✗ ${name}\n      ${error.message.split("\n").join("\n      ")}`);
  }
}
const call = (name, extra = {}) =>
  verifyIp({ url: buildVerifyUrl(`${origin}/${name}`), initData: INIT_DATA, ...extra });

console.log("HTTP responses → UI state");
const expected = [
  ["verified", "verified"],
  ["vpn", "vpn"],
  ["datacenter", "datacenter"],
  ["duplicate", "duplicate"],
  ["duplicate_bare", "duplicate"],
  ["registration", "registration"],
  ["common_error", "error"],
  ["bad_request", "bad_request"],
  ["session", "session"],
  ["forbidden", "forbidden"],
  ["not_found", "unavailable"],
  ["rate_limited", "rate_limited"],
  ["server_error", "error"],
  ["bad_gateway", "unavailable"],
  ["unavailable", "unavailable"],
  ["invalid_json", "unavailable"],
  ["ok_without_status", "error"],
];
for (const [name, state] of expected) {
  await check(`${name} (HTTP ${CASES[name][0]}) → ${state}`, async () => {
    assert.equal((await call(name)).state, state);
  });
}

console.log("Payload details");
await check("verified keeps backend ip + referral flag", async () => {
  const r = await call("verified");
  assert.equal(r.ip, "192.0.2.10");
  assert.equal(r.referralQualified, true);
  assert.equal(r.messageKey, "ip.verified");
});
await check("404 HTML is reported as HTTP 404 · invalid_json", async () => {
  assert.equal((await call("not_found")).detail, "HTTP 404 · invalid_json");
});
await check("200 non-JSON is reported as HTTP 200 · invalid_json", async () => {
  assert.equal((await call("invalid_json")).detail, "HTTP 200 · invalid_json");
});
await check("ok:true on non-2xx is never a success", () => {
  assert.equal(classifyResponse(500, json({ ok: true, status: "verified" })).state, "error");
});
await check("ok:false + status verified is not a success", () => {
  assert.notEqual(classifyResponse(200, json({ ok: false, status: "verified" })).state, "verified");
});

console.log("Transport failures");
await check("timeout → timeout", async () => {
  const r = await call("slow", { timeoutMs: 300 });
  assert.equal(r.state, "timeout");
  assert.equal(r.detail, "timeout");
});
await check("connection refused → unavailable (network)", async () => {
  const closed = http.createServer();
  closed.listen(0, "127.0.0.1");
  await once(closed, "listening");
  const port = closed.address().port;
  closed.close();
  await once(closed, "close");
  const r = await verifyIp({ url: buildVerifyUrl(`http://127.0.0.1:${port}`), initData: INIT_DATA });
  assert.equal(r.state, "unavailable");
  assert.equal(r.detail, "network");
});
await check("no network (navigator.onLine=false) → offline", async () => {
  const r = await verifyIp({
    url: buildVerifyUrl(origin),
    initData: INIT_DATA,
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
    isOnline: () => false,
  });
  assert.equal(r.state, "offline");
});

console.log("Request shape (every request the mock received)");
await check(`${seen.length} requests: POST ${VERIFY_PATH}, JSON, body is exactly { initData }, no cookies`, () => {
  assert.ok(seen.length >= expected.length);
  for (const r of seen) {
    assert.equal(r.method, "POST", `${r.name}: method`);
    assert.equal(r.path, VERIFY_PATH, `${r.name}: path`);
    assert.match(r.type, /^application\/json/, `${r.name}: content-type`);
    assert.equal(r.cookie, undefined, `${r.name}: cookie header`);
    assert.deepEqual(JSON.parse(r.raw), { initData: INIT_DATA }, `${r.name}: body`);
  }
});

console.log("Backend URL configuration");
await check("empty → same origin /miniapp/api/verify-ip", () => {
  assert.deepEqual(normalizeBackendBase(""), { base: "", error: null });
  assert.equal(buildVerifyUrl(""), "/miniapp/api/verify-ip");
});
await check("https origin with trailing slash and path prefix", () => {
  assert.equal(normalizeBackendBase("https://bot.example.com/").base, "https://bot.example.com");
  assert.equal(
    buildVerifyUrl(normalizeBackendBase("https://bot.example.com/api/").base),
    "https://bot.example.com/api/miniapp/api/verify-ip",
  );
});
await check("rejects http (non-local), credentials, query, garbage", () => {
  assert.notEqual(normalizeBackendBase("http://bot.example.com").error, null);
  assert.notEqual(normalizeBackendBase("https://user:pass@bot.example.com").error, null);
  assert.notEqual(normalizeBackendBase("https://bot.example.com/?token=1").error, null);
  assert.notEqual(normalizeBackendBase("not a url").error, null);
  assert.equal(normalizeBackendBase("http://localhost:8080").error, null);
});

server.closeAllConnections?.();
server.close();
console.log(`\n${passed} passed, ${failed.length} failed`);
process.exitCode = failed.length ? 1 : 0;
