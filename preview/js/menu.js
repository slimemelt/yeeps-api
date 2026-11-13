import { $ } from "./dom.js";
import { MENU_UNDERLINE } from "./config.js";

const menu = $("menu");
const button = $("menu-button");
const toggle = $("site-toggle");
const underline = $("menu-underline");

export function setMenuOpen(open) {
  menu.classList.toggle("open", open);
  button.classList.toggle("open", open);
  toggle.classList.toggle("hide", open);
  button.setAttribute("aria-expanded", open);
  button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.setAttribute("aria-hidden", !open);
}

export function placeUnderline(view) {
  const spot = MENU_UNDERLINE[view];
  underline.style.display = spot ? "block" : "none";
  if (spot) [underline.style.left, underline.style.top, underline.style.width] = spot.map((n) => `${n}%`);
}

export function initMenu() {
  button.addEventListener("click", () => setMenuOpen(!menu.classList.contains("open")));
  menu.querySelectorAll("[data-close]").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenuOpen(false));
}
