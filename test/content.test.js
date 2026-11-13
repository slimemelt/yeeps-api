import test from "node:test";
import assert from "node:assert/strict";
import { validateContent } from "../src/content.js";

const valid = () => ({
  banners: [{ src: "assets/img/banner.webp", alt: "A banner" }],
  schedule: [
    { type: "show", time: "6PM", title: "Show", by: "", desc: "", mature: false, flash: true },
    { type: "heading", text: "LATER" },
    { type: "recap", text: "in case you missed it!" },
  ],
  shows: [{ title: "Show", desc: "About it", img: "https://api.example.net/media/abc.webp" }],
  settings: { date: "", tz: "EST", notes: "", closing: "GOOD NIGHT" },
});

test("accepts well-formed content", () => {
  assert.deepEqual(validateContent(valid()).schedule[0].flash, true);
});

test("drops fields it does not know about", () => {
  const input = valid();
  input.shows[0].onclick = "alert(1)";
  assert.equal("onclick" in validateContent(input).shows[0], false);
});

test("rejects non-http image sources", () => {
  const input = valid();
  input.banners[0].src = "javascript:alert(1)";
  assert.throws(() => validateContent(input), /banner image/);
});

test("rejects unknown schedule entry types and oversized lists", () => {
  const input = valid();
  input.schedule.push({ type: "script" });
  assert.throws(() => validateContent(input), /entry type/);
  const big = valid();
  big.banners = Array(21).fill(big.banners[0]);
  assert.throws(() => validateContent(big), /banners/);
});

test("banner links are kept only when they are web addresses or site pages", () => {
  const withLinks = (...links) => {
    const data = valid();
    data.banners = links.map((link) => ({ src: "assets/img/banner.webp", alt: "", link }));
    return validateContent(data).banners.map((b) => b.link);
  };
  assert.deepEqual(withLinks("https://example.com/show", "#schedule", "javascript:alert(1)", "", undefined), [
    "https://example.com/show",
    "#schedule",
    undefined,
    undefined,
    undefined,
  ]);
});

const post = (extra = {}) => ({ id: "hello", title: "Hello", date: "2026-11-13", img: "", summary: "", body: "Hi", published: true, ...extra });

test("posts are cleaned and bad ones are rejected", () => {
  const data = valid();
  data.posts = [post({ extra: "dropped" })];
  assert.deepEqual(Object.keys(validateContent(data).posts[0]).sort(), ["body", "date", "id", "img", "published", "summary", "title"]);
  for (const bad of [post({ id: "Has Spaces" }), post({ date: "soon" }), post({ img: "javascript:alert(1)" })]) {
    const broken = valid();
    broken.posts = [bad];
    assert.throws(() => validateContent(broken));
  }
  const twice = valid();
  twice.posts = [post(), post()];
  assert.throws(() => validateContent(twice), /share the web address/);
});

test("content without posts still works", () => {
  assert.deepEqual(validateContent(valid()).posts, []);
});
