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
