import { whileLoading } from "../loader.js";
import { $ } from "../dom.js";
import { STREAM_URL, HLSJS_URL } from "../config.js";

const box = $("player");
const video = $("stream-video");

let hls = null;
let started = false;

function loadHlsJs() {
  return new Promise((resolve) => {
    if (window.Hls) return resolve(true);
    const script = document.createElement("script");
    script.src = HLSJS_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

function fail() {
  box.classList.add("has-error");
}

// hls.js where the browser has Media Source Extensions; otherwise (iPhone Safari) the native HLS player.
export async function ensurePlayer() {
  if (started) return;
  started = true;
  const loaded = await whileLoading(loadHlsJs());
  if (loaded && window.Hls?.isSupported()) {
    hls = new window.Hls();
    hls.on(window.Hls.Events.ERROR, (_, data) => data.fatal && fail());
    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = STREAM_URL;
  } else {
    started = false;
    fail();
  }
}

export function pausePlayer() {
  video.pause();
}

video.addEventListener("play", () => {
  ensurePlayer();
  box.classList.remove("has-error");
});
video.addEventListener("error", fail);
