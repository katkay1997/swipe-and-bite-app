// Apply color-blind + reduce-motion preferences from localStorage to <html>.
// Pre-auth toggles persist locally; after sign-in we sync to the profile.

export const A11Y_KEYS = {
  colorBlind: "sb_color_blind",
  reduceMotion: "sb_reduce_motion",
} as const;

export function applyA11y() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const cb = localStorage.getItem(A11Y_KEYS.colorBlind) === "1";
  const rm = localStorage.getItem(A11Y_KEYS.reduceMotion) === "1";
  root.classList.toggle("cb", cb);
  root.classList.toggle("rm", rm);
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sb:a11y"));
}

export function setColorBlind(on: boolean) {
  localStorage.setItem(A11Y_KEYS.colorBlind, on ? "1" : "0");
  applyA11y();
  notify();
}

export function setReduceMotion(on: boolean) {
  localStorage.setItem(A11Y_KEYS.reduceMotion, on ? "1" : "0");
  applyA11y();
  notify();
}

export function getA11y() {
  if (typeof window === "undefined") return { colorBlind: false, reduceMotion: false };
  return {
    colorBlind: localStorage.getItem(A11Y_KEYS.colorBlind) === "1",
    reduceMotion: localStorage.getItem(A11Y_KEYS.reduceMotion) === "1",
  };
}
