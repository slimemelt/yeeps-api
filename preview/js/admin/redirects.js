import { escapeHtml as e } from "../dom.js";
import { REDIRECT_HOSTS } from "../config.js";
import { store } from "../store.js";

let rows = [];

export async function loadRedirects() {
  rows = await store.loadRedirects();
}

const shortLink = (row) => `${row.host}/${row.path.trim().replace(/^\/+|\/+$/g, "").toLowerCase()}`;

function rowHtml(row, i) {
  const hosts = REDIRECT_HOSTS.map((h) => `<option value="${h}" ${h === row.host ? "selected" : ""}>${h}</option>`).join("");
  return `<div class="item" data-r="${i}">
    <div class="fields">
      <label class="wide">Site<select data-rf="host">${hosts}</select></label>
      <label class="wide">Path<input type="text" data-rf="path" value="${e(row.path)}" placeholder="discord" autocapitalize="off" spellcheck="false"></label>
      <label class="wide">Sends visitors to<input type="text" data-rf="url" value="${e(row.url)}" placeholder="https://discord.gg/…" autocapitalize="off" spellcheck="false"></label>
      <div class="wide"><span class="tag" data-preview>${e(shortLink(row))}</span></div>
    </div>
    <div class="item-actions"><button data-redirect="del" aria-label="Delete">✕</button></div>
  </div>`;
}

export function redirectsHtml() {
  return `<div class="panel redirects">
    <p class="note">Short links for any of the three sites. For example, a redirect from <b>bloomnetworks.net</b> with the path <b>discord</b> makes bloomnetworks.net/discord open your Discord invite. Letters, numbers, - and _ only. Real pages on a site always win over a redirect with the same path.</p>
    ${rows.map(rowHtml).join("") || '<p class="note">No redirects yet.</p>'}
    <p>
      <button class="btn" data-redirect="add">+ Add redirect</button>
      <button class="btn-primary" data-redirect="save">Save redirects</button>
    </p>
  </div>`;
}

export function onRedirectInput(field) {
  const item = field.closest("[data-r]");
  if (!item || !field.dataset.rf) return;
  const row = rows[Number(item.dataset.r)];
  row[field.dataset.rf] = field.value;
  item.querySelector("[data-preview]").textContent = shortLink(row);
}

/** Handles the add / delete / save buttons. `ui` gives it the page's render and toast. */
export async function onRedirectClick(button, ui) {
  const action = button.dataset.redirect;
  if (action === "add") {
    rows.push({ host: REDIRECT_HOSTS[0], path: "", url: "" });
    ui.render();
  } else if (action === "del") {
    if (!confirm("Delete this redirect?")) return;
    rows.splice(Number(button.closest("[data-r]").dataset.r), 1);
    ui.render();
  } else if (action === "save") {
    const filled = rows.filter((row) => row.path.trim() || row.url.trim());
    try {
      await store.saveRedirects(filled);
    } catch (error) {
      if (error.status === 401) ui.signedOut();
      else ui.toast(`Couldn’t save (${error.message}).`);
      return;
    }
    await loadRedirects();
    ui.render();
    ui.toast(store.persistent ? "Saved. The links are live." : "Saved in this browser.");
  }
}
