import { $ } from "./dom.js";

// The loading screen only appears when something is actually slow.
const SLOW_MS = 400;

const loader = $("loader");
let pending = 0;
let timer;

/** Runs a task and shows the loading screen if it is still going after SLOW_MS. */
export async function whileLoading(task) {
  if (pending++ === 0) timer = setTimeout(() => loader.classList.remove("off"), SLOW_MS);
  try {
    return await task;
  } finally {
    if (--pending === 0) {
      clearTimeout(timer);
      loader.classList.add("off");
    }
  }
}
