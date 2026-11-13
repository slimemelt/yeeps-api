import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { hashPassword } from "../src/auth.js";

const ORIGIN = "https://yeeps.bloomnetworks.net";

function memoryKv() {
  const data = new Map();
  const meta = new Map();
  return {
    get: async (k) => data.get(k) ?? null,
    put: async (k, v, o) => {
      data.set(k, v instanceof ArrayBuffer ? v : String(v));
      if (o?.metadata) meta.set(k, o.metadata);
    },
    getWithMetadata: async (k) => ({ value: data.get(k) ?? null, metadata: meta.get(k) ?? null }),
    delete: async (k) => void data.delete(k),
  };
}

async function setup() {
  return {
    CONTENT: memoryKv(),
    ALLOWED_ORIGINS: ORIGIN,
    SESSION_SECRET: "test-secret",
    ADMIN_PASSWORD_HASH: await hashPassword("open sesame", 1000),
  };
}

const call = (env, path, init = {}) =>
  worker.fetch(new Request(`https://api.bloomnetworks.net${path}`, { ...init, headers: { Origin: ORIGIN, ...init.headers } }), env);

async function signIn(env) {
  const response = await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "open sesame" }) });
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}

const content = {
  banners: [],
  schedule: [{ type: "show", time: "6PM", title: "Show", by: "", desc: "", mature: false, flash: false }],
  shows: [],
  settings: { date: "", tz: "EST", notes: "", closing: "BYE" },
};

test("wrong password is refused, right one signs in", async () => {
  const env = await setup();
  assert.equal((await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "nope" }) })).status, 401);
  const cookie = await signIn(env);
  const session = await call(env, "/session", { headers: { Cookie: cookie } });
  assert.deepEqual(await session.json(), { admin: true });
});

test("login is rate limited", async () => {
  const env = await setup();
  for (let i = 0; i < 8; i++) await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "nope" }) });
  assert.equal((await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "open sesame" }) })).status, 429);
});

test("content can be read by anyone but only written by an admin", async () => {
  const env = await setup();
  assert.equal((await call(env, "/content/ch")).status, 404);
  const put = (headers) => call(env, "/content/ch", { method: "PUT", headers, body: JSON.stringify(content) });
  assert.equal((await put({})).status, 401);
  assert.equal((await put({ Cookie: await signIn(env) })).status, 200);
  const read = await call(env, "/content/ch");
  assert.equal((await read.json()).schedule[0].title, "Show");
});

test("requests from other origins cannot change anything", async () => {
  const env = await setup();
  const response = await worker.fetch(
    new Request("https://api.bloomnetworks.net/login", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }),
    env
  );
  assert.equal(response.status, 403);
});

test("images upload for admins and are served back", async () => {
  const env = await setup();
  const cookie = await signIn(env);
  const upload = await call(env, "/media", { method: "POST", headers: { Cookie: cookie, "Content-Type": "image/webp" }, body: new Uint8Array([1, 2, 3]) });
  assert.equal(upload.status, 201);
  const { url } = await upload.json();
  const served = await worker.fetch(new Request(url), env);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("Content-Type"), "image/webp");
  assert.equal((await call(env, "/media", { method: "POST", headers: { "Content-Type": "image/webp" }, body: new Uint8Array([1]) })).status, 401);
});

test("redirects are public to read and need a sign-in to change", async () => {
  const env = await setup();
  const empty = await call(env, "/redirects", { headers: { Origin: "https://bloomnetworks.net" } });
  assert.equal(empty.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(await empty.json(), { redirects: [] });

  const body = JSON.stringify({ redirects: [{ host: "bloomnetworks.net", path: "/Discord/", url: "https://discord.gg/example" }] });
  assert.equal((await call(env, "/redirects", { method: "PUT", body })).status, 401);

  const cookie = await signIn(env);
  assert.equal((await call(env, "/redirects", { method: "PUT", headers: { Cookie: cookie }, body })).status, 200);
  const saved = await (await call(env, "/redirects")).json();
  assert.deepEqual(saved.redirects, [{ host: "bloomnetworks.net", path: "discord", url: "https://discord.gg/example" }]);
});

test("bad redirects are rejected", async () => {
  const env = await setup();
  const cookie = await signIn(env);
  const put = (redirects) => call(env, "/redirects", { method: "PUT", headers: { Cookie: cookie }, body: JSON.stringify({ redirects }) });
  const ok = { host: "monarch.bloomnetworks.net", path: "x", url: "https://example.com" };
  assert.equal((await put([{ ...ok, host: "evil.example" }])).status, 400);
  assert.equal((await put([{ ...ok, path: "has space" }])).status, 400);
  assert.equal((await put([{ ...ok, url: "javascript:alert(1)" }])).status, 400);
  assert.equal((await put([{ ...ok, url: "discord.gg/example" }])).status, 400);
  assert.equal((await put([ok, ok])).status, 400);
});

test("changing the password replaces the old one and ends other sessions", async () => {
  const env = await setup();
  const cookie = await signIn(env);
  const post = (body, headers = { Cookie: cookie }) =>
    call(env, "/password", { method: "POST", headers, body: JSON.stringify(body) });

  assert.equal((await post({ current: "open sesame", next: "short" })).status, 400);
  assert.equal((await post({ current: "not it", next: "a much longer password" })).status, 401);
  assert.equal((await post({ current: "open sesame", next: "a much longer password" }, {})).status, 401);

  const changed = await post({ current: "open sesame", next: "a much longer password" });
  assert.equal(changed.status, 200);
  const fresh = changed.headers.get("Set-Cookie").split(";")[0];

  assert.equal((await (await call(env, "/session", { headers: { Cookie: cookie } })).json()).admin, false);
  assert.equal((await (await call(env, "/session", { headers: { Cookie: fresh } })).json()).admin, true);
  assert.equal((await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "open sesame" }) })).status, 401);
  assert.equal((await call(env, "/login", { method: "POST", body: JSON.stringify({ password: "a much longer password" }) })).status, 200);
});

test("the preview needs an admin session", async () => {
  const env = await setup();
  env.ASSETS = { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) };

  const locked = await call(env, "/preview/");
  assert.equal(locked.status, 401);
  assert.doesNotMatch(await locked.text(), /asset:/);
  assert.equal((await call(env, "/preview/css/base.css")).status, 401);

  const cookie = await signIn(env);
  const home = await call(env, "/preview/", { headers: { Cookie: cookie } });
  assert.equal(await home.text(), "asset:/index.html");
  assert.equal(home.headers.get("Cache-Control"), "private, no-store");
  const file = await call(env, "/preview/css/base.css", { headers: { Cookie: cookie } });
  assert.equal(await file.text(), "asset:/css/base.css");
});
