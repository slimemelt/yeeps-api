// Where site content is kept. With an API configured it lives in the Cloudflare Worker;
// without one (local development, previews) it falls back to this browser's localStorage.
import { API_BASE } from "./config.js";

const draftKey = (site) => `ypch-draft-${site}`;

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, { credentials: "include", ...options });
  if (!response.ok) {
    const error = new Error(`${options.method || "GET"} ${path} failed (${response.status})`);
    error.status = response.status;
    error.message = (await response.json().catch(() => null))?.error ?? error.message;
    throw error;
  }
  return response;
}

const remote = {
  persistent: true,
  async load(site) {
    try {
      return await (await request(`/content/${site}`)).json();
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  },
  async save(site, data) {
    await request(`/content/${site}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async loadRedirects() {
    return (await (await request("/redirects")).json()).redirects;
  },
  async saveRedirects(redirects) {
    await request("/redirects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirects }),
    });
  },
  async uploadImage(blob) {
    const response = await request("/media", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    return (await response.json()).url;
  },
  async session() {
    try {
      return (await (await request("/session")).json()).admin === true;
    } catch {
      return false;
    }
  },
  async login(password) {
    await request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  async logout() {
    await request("/logout", { method: "POST" });
  },
  async changePassword(current, next) {
    await request("/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
  },
};

const local = {
  persistent: false,
  async load(site) {
    try {
      return JSON.parse(localStorage.getItem(draftKey(site)));
    } catch {
      return null;
    }
  },
  async save(site, data) {
    localStorage.setItem(draftKey(site), JSON.stringify(data));
  },
  async loadRedirects() {
    try {
      return JSON.parse(localStorage.getItem("ypch-redirects")) ?? [];
    } catch {
      return [];
    }
  },
  async saveRedirects(redirects) {
    localStorage.setItem("ypch-redirects", JSON.stringify(redirects));
  },
  uploadImage(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  },
  session: async () => true,
  login: async () => {},
  logout: async () => {},
  changePassword: async () => {},
};

export const store = API_BASE ? remote : local;
