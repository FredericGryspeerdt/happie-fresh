// Client-only device probes shared by the shell hooks. These read browser
// globals directly — callers must not run them during SSR (guard on
// `typeof document`, not `navigator`: Deno defines a server-side navigator).

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Launched from the home screen (installed) rather than in a browser tab. */
export function isStandaloneDisplay(): boolean {
  return (navigator as unknown as { standalone?: boolean }).standalone ===
      true ||
    matchMedia("(display-mode: standalone)").matches;
}
