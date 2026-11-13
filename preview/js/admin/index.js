import { $, clone } from "../dom.js";
import { API_BASE } from "../config.js";
import { store } from "../store.js";
import { getContent, getDefaults, setContent } from "../content.js";
import { TABS } from "./templates.js";
import { pickImage, imageToUrl } from "./images.js";
import { loadRedirects, onRedirectInput, onRedirectClick } from "./redirects.js";
import { onPasswordSubmit } from "./password.js";

const BANNER_WIDTH = 1840;
const CARD_WIDTH = 1100;

const loginForm = $("admin-login");
const editor = $("admin-editor");
const body = $("admin-body");

let site = "ch";
let tab = "banners";
let draft = null;
let dirty = false;
let wired = false;

function toast(message) {
  const el = $("admin-toast");
  el.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.textContent = ""), 6000);
}

function markDirty() {
  dirty = true;
}

function loadDraft() {
  draft = clone(getContent(site));
  dirty = false;
}

function render() {
  document.querySelectorAll("#admin-site button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.site === site));
  $("admin-tabs").innerHTML = TABS.map(
    ([key, label]) => `<button data-tab="${key}" aria-pressed="${key === tab}">${label}</button>`
  ).join("");
  body.innerHTML = TABS.find(([key]) => key === tab)[2](draft);
  // Redirects and the password apply to every site and have their own buttons.
  const sharedTab = tab === "redirects" || tab === "password";
  $("admin-site").hidden = sharedTab;
  document.querySelector(".admin .savebar").hidden = sharedTab;
}

function showSignedIn(signedIn) {
  loginForm.hidden = signedIn;
  editor.hidden = !signedIn;
  $("admin-signout").hidden = !API_BASE;
  $("admin-status").innerHTML = API_BASE
    ? signedIn
      ? '<span class="tag ok">Signed in</span><span class="tag">Saving updates the live site</span>'
      : '<span class="tag">Sign in to edit</span>'
    : '<span class="tag">No backend connected</span><span class="tag">Changes stay in this browser</span>';
  if (signedIn) {
    loadDraft();
    loadRedirects().then(render);
    render();
  }
}

/* ---------- edits ---------- */

function newEntry(type) {
  if (type === "show") return { type, time: "", title: "", by: "", desc: "", mature: false, flash: false };
  return { type, text: type === "recap" ? "in case you missed it!" : "NEW SECTION" };
}

async function addImage(button) {
  const file = await pickImage();
  if (!file) return;
  toast("Working…");
  const list = button.dataset.k;
  const url = await imageToUrl(file, list === "banners" ? BANNER_WIDTH : CARD_WIDTH);
  if (list === "banners") draft.banners.push({ src: url, alt: "" });
  else draft.shows.push({ title: "New show", desc: "", img: url });
  markDirty();
  render();
  toast("Added. Press Save changes when you’re done.");
}

async function replaceImage(row) {
  const file = await pickImage();
  if (!file) return;
  toast("Working…");
  draft[row.dataset.k][Number(row.dataset.i)].img = await imageToUrl(file, CARD_WIDTH);
  markDirty();
  render();
  toast("Image replaced.");
}

function moveOrDelete(action, row) {
  const list = draft[row.dataset.k];
  const index = Number(row.dataset.i);
  if (action === "del") {
    if (!confirm("Delete this item?")) return;
    list.splice(index, 1);
  } else {
    const target = action === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
  }
  markDirty();
  render();
}

async function copyBackup() {
  const field = $("admin-backup");
  try {
    await navigator.clipboard.writeText(field.value);
    toast("Copied.");
  } catch {
    field.select();
    toast("Press Ctrl+C to copy.");
  }
}

function importBackup() {
  try {
    draft = clone({ ...getDefaults(site), ...JSON.parse($("admin-backup").value) });
    markDirty();
    render();
    toast("Imported. Press Save changes to keep it.");
  } catch {
    toast("That doesn’t look like a valid backup.");
  }
}

const actions = {
  up: (_, row) => moveOrDelete("up", row),
  down: (_, row) => moveOrDelete("down", row),
  del: (_, row) => moveOrDelete("del", row),
  "add-entry": (button) => {
    draft.schedule.push(newEntry(button.dataset.type));
    markDirty();
    render();
  },
  "add-image": (button) => addImage(button),
  "replace-image": (_, row) => replaceImage(row),
  copy: copyBackup,
  import: importBackup,
  reset: () => {
    if (!confirm("Reset this site’s content to the original?")) return;
    draft = getDefaults(site);
    markDirty();
    render();
  },
};

async function save() {
  const data = clone(draft);
  data.schedule = data.schedule.filter((entry) => entry.type !== "show" || entry.title || entry.time);
  try {
    await store.save(site, data);
  } catch (error) {
    if (error.status === 401) {
      signedOut();
    } else {
      toast(`Couldn’t save (${error.message}).`);
    }
    return;
  }
  setContent(site, data);
  loadDraft();
  render();
  toast(API_BASE ? "Saved. The live site is updated." : "Saved in this browser.");
}

function signedOut() {
  showSignedIn(false);
  toast("Your session ended. Sign in again.");
}

/* ---------- wiring ---------- */

const LOGIN_MESSAGES = {
  401: "That password didn’t work.",
  429: "Too many tries. Wait a few minutes.",
};

function wire() {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = $("admin-login-error");
    error.textContent = "";
    try {
      await store.login(new FormData(loginForm).get("password"));
      loginForm.reset();
      showSignedIn(true);
    } catch (failure) {
      error.textContent = LOGIN_MESSAGES[failure.status] ?? "Couldn’t reach the server. Check your connection and try again.";
    }
  });

  $("admin-signout").addEventListener("click", async () => {
    await store.logout();
    showSignedIn(false);
  });

  $("admin-site").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (dirty && !confirm("Discard unsaved changes?")) return;
    site = button.dataset.site;
    loadDraft();
    render();
  });

  $("admin-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    tab = button.dataset.tab;
    render();
  });

  body.addEventListener("input", (event) => {
    const field = event.target;
    if (field.closest(".redirects")) return onRedirectInput(field);
    markDirty();
    if (field.dataset.set) {
      draft.settings[field.dataset.set] = field.value;
      return;
    }
    const row = field.closest("[data-i]");
    if (row && field.dataset.f) {
      draft[row.dataset.k][Number(row.dataset.i)][field.dataset.f] =
        field.type === "checkbox" ? field.checked : field.value;
    }
  });

  body.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "admin-password") onPasswordSubmit(event.target, { signedOut });
  });

  body.addEventListener("click", (event) => {
    const redirect = event.target.closest("[data-redirect]");
    if (redirect) {
      onRedirectClick(redirect, { render, toast, signedOut });
      return;
    }
    const button = event.target.closest("button[data-act]");
    if (button) actions[button.dataset.act]?.(button, button.closest("[data-i]"));
  });

  $("admin-save").addEventListener("click", save);
  $("admin-revert").addEventListener("click", () => {
    loadDraft();
    render();
    toast("Changes discarded.");
  });

  addEventListener("beforeunload", (event) => {
    if (dirty) event.preventDefault();
  });
}

export async function openAdmin() {
  if (!wired) {
    wire();
    wired = true;
  }
  showSignedIn(await store.session());
}
