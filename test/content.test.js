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
