import { SITES, SITE_STORAGE_KEY } from "./config.js";

// Which site (Channel or Don't Sleep) and which view are showing. Nothing else is global.
export const state = { site: "ch", view: "home" };

try {
  if (localStorage.getItem(SITE_STORAGE_KEY) === "ds") state.site = "ds";
} catch {
  /* storage can be blocked; the default site is fine */
}

export function rememberSite() {
  try {
    localStorage.setItem(SITE_STORAGE_KEY, state.site);
  } catch {
    /* ignore */
  }
}

export const siteName = () => SITES[state.site].name;
