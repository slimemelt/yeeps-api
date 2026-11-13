import { $, stage, prefersReducedMotion } from "../dom.js";
import { DESIGN_WIDTH } from "../config.js";
import { state } from "../state.js";
import { getContent } from "../content.js";
import { renderScheduleRows } from "./schedule.js";

const SLIDE_MS = 6000;
const SWIPE_PX = 40;

const bannerImage = $("banner-image");
const dots = $("dots");
const featuredCard = $("featured-card");
let slideIndex = 0;
let showIndex = 0;
let slideTimer = 0;

/* ---------- banner carousel ---------- */

function showSlide(index) {
  const banners = getContent(state.site).banners;
  if (!banners.length) {
    bannerImage.removeAttribute("src");
    return;
  }
  slideIndex = (index + banners.length) % banners.length;
  clearInterval(slideTimer);
  bannerImage.src = banners[slideIndex].src;
  bannerImage.alt = banners[slideIndex].alt || "";
  [...dots.children].forEach((dot, i) => dot.setAttribute("aria-current", i === slideIndex));
  if (bannerImage.complete) restartAutoplay();
}

function restartAutoplay() {
  clearInterval(slideTimer);
  if (!prefersReducedMotion() && getContent(state.site).banners.length > 1) {
    slideTimer = setInterval(() => showSlide(slideIndex + 1), SLIDE_MS);
  }
}

function renderBanner() {
  const banners = getContent(state.site).banners;
  dots.replaceChildren(
    ...banners.map((_, i) => {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", `Slide ${i + 1}`);
      dot.addEventListener("click", () => showSlide(i));
      return dot;
    })
  );
  dots.style.display = banners.length > 1 ? "flex" : "none";
  showSlide(0);
}

// Count the slide's time from when its image is actually on screen, so a slow first
// banner is never skipped before anyone has seen it.
bannerImage.addEventListener("load", restartAutoplay);
bannerImage.addEventListener("error", restartAutoplay);

/* ---------- featured shows ---------- */

function renderFeatured() {
  const shows = getContent(state.site).shows;
  if (!shows.length) {
    $("featured-name").textContent = "";
    $("featured-blurb").textContent = "";
    $("featured-image").removeAttribute("src");
    return;
  }
  showIndex = Math.min(showIndex, shows.length - 1);
  const show = shows[showIndex];
  $("featured-image").src = show.img;
  $("featured-image").alt = show.title;
  $("featured-name").textContent = show.title;
  $("featured-blurb").textContent = show.desc || "";
}

function stepFeatured(direction) {
  const count = getContent(state.site).shows.length;
  if (count < 2) return;
  showIndex = (showIndex + direction + count) % count;
  renderFeatured();
}

export function resetFeatured() {
  showIndex = 0;
}

// Swipe or drag the card, or use the arrow keys when it has focus.
function enableFeaturedNavigation() {
  let startX = null;
  featuredCard.style.touchAction = "pan-y";
  featuredCard.addEventListener("pointerdown", (e) => (startX = e.clientX));
  addEventListener("pointercancel", () => (startX = null));
  addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX && state.view === "home") stepFeatured(dx < 0 ? 1 : -1);
  });
  featuredCard.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") stepFeatured(1);
    if (e.key === "ArrowLeft") stepFeatured(-1);
  });
}

/* ---------- intro paragraph ---------- */

// The intro is sized to the artboard; shrink it a touch if a narrow font makes it wrap to a fourth line.
export function fitAboutText() {
  const paragraph = document.querySelector(".about-text");
  if (!paragraph) return;
  const unit = stage.clientWidth / DESIGN_WIDTH;
  const maxHeight = 42.5 * unit * 3.2;
  let scale = 1;
  paragraph.style.fontSize = "";
  while (paragraph.getBoundingClientRect().height > maxHeight && scale > 0.5) {
    scale -= 0.03;
    paragraph.style.fontSize = `calc(${(38 * scale).toFixed(2)} * var(--u))`;
  }
}

export function renderHome() {
  renderBanner();
  renderFeatured();
  renderScheduleRows();
}

enableFeaturedNavigation();
