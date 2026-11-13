import { $, stage } from "./dom.js";
import { SITES } from "./config.js";
import { state, rememberSite } from "./state.js";
import { loadContent, onContentChange } from "./content.js";
import { initMenu, setMenuOpen } from "./menu.js";
import { route, updateTitle } from "./router.js";
import { whileLoading } from "./loader.js";
import { renderHome, resetFeatured, fitAboutText } from "./views/home.js";
import { renderSchedulePage } from "./views/schedule.js";
import { fitFundingsText } from "./views/fundings.js";

const toggle = $("site-toggle");

function renderSite() {
  stage.dataset.site = state.site;
  document.documentElement.dataset.site = state.site;
  const other = state.site === "ch" ? SITES.ds.name : SITES.ch.name;
  toggle.setAttribute("aria-pressed", state.site === "ds");
  toggle.setAttribute("aria-label", `Switch to ${other}`);
  renderHome();
  renderSchedulePage();
  updateTitle();
}

toggle.addEventListener("click", () => {
  state.site = state.site === "ch" ? "ds" : "ch";
  rememberSite();
  resetFeatured();
  setMenuOpen(false);
  renderSite();
});

// The admin saves new content; refresh whatever is on screen.
onContentChange((site) => site === state.site && renderSite());

addEventListener("hashchange", () => route());
addEventListener("resize", () => {
  fitAboutText();
  fitFundingsText();
});

async function boot() {
  initMenu();
  whileLoading(new Promise((done) => (document.readyState === "complete" ? done() : addEventListener("load", done))));
  await whileLoading(loadContent());
  renderSite();
  await route({ first: true });
  document.fonts?.ready.then(() => {
    fitAboutText();
    fitFundingsText();
  });
  addEventListener("load", fitAboutText);
}

boot();
