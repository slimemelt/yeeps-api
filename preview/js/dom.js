export const $ = (id) => document.getElementById(id);
export const stage = $("stage");

export const clone = (value) => JSON.parse(JSON.stringify(value));

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeHtml = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ENTITIES[c]);

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
