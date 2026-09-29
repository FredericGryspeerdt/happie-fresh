import { effect, signal } from "@preact/signals";
import { api } from "@/services/api.ts";

/** Cross-island invalidation after a to-do write/refresh settles. */
export const todoBadgeRevision = signal(0);
let stopActiveSync: (() => void) | undefined;

type BadgingNavigator = Navigator & {
  setAppBadge?: (count: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** One worker owns both push and foreground writes, avoiding cross-context races.
 * Older active workers ignore this message, so require an acknowledgement.
 */
function refreshInWorker(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (handled: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(handled);
    };
    const timer = setTimeout(() => finish(false), 500);
    channel.port1.onmessage = (event) =>
      finish(event.data === "app-badge-ready");
    try {
      worker.postMessage({ type: "refresh-app-badge" }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

/** Mounted by AppChrome on every authenticated page, including full-screen ones. */
export function startAppBadgeSync(): () => void {
  stopActiveSync?.();
  if (typeof document === "undefined") return () => {};
  const nav: BadgingNavigator = navigator;
  if (typeof nav.setAppBadge !== "function") return () => {};

  let stopped = false;
  let generation = 0;
  let midnightTimer: ReturnType<typeof setTimeout>;
  const refresh = async () => {
    const current = ++generation;
    if ("serviceWorker" in nav) {
      try {
        const reg = await nav.serviceWorker.getRegistration("/push-sw.js");
        if (stopped || current !== generation) return;
        if (reg?.active && await refreshInWorker(reg.active)) return;
      } catch { /* no usable worker: the window can still badge */ }
    }
    if (stopped || current !== generation) return;
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const count = await api.todos.getBadgeCount(tomorrow);
    if (stopped || current !== generation || count === null) return;
    try {
      if (count === 0) await nav.clearAppBadge?.();
      else await nav.setAppBadge!(count);
    } catch { /* progressive enhancement: OS permission/support may change */ }
  };
  const scheduleMidnight = () => {
    clearTimeout(midnightTimer);
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    midnightTimer = setTimeout(() => {
      if (document.visibilityState === "visible") void refresh();
      scheduleMidnight();
    }, tomorrow.getTime() - now.getTime());
  };
  const onResume = () => {
    if (document.visibilityState !== "visible") return;
    scheduleMidnight();
    void refresh();
  };
  const dispose = effect(() => {
    todoBadgeRevision.value;
    void refresh();
  });
  scheduleMidnight();
  document.addEventListener("visibilitychange", onResume);
  globalThis.addEventListener("focus", onResume);
  globalThis.addEventListener("online", onResume);
  globalThis.addEventListener("pageshow", onResume);

  const stop = () => {
    stopped = true;
    dispose();
    clearTimeout(midnightTimer);
    document.removeEventListener("visibilitychange", onResume);
    globalThis.removeEventListener("focus", onResume);
    globalThis.removeEventListener("online", onResume);
    globalThis.removeEventListener("pageshow", onResume);
    if (stopActiveSync === stop) stopActiveSync = undefined;
  };
  stopActiveSync = stop;
  return stop;
}

/** Stop pending reads before clearing, so a late response cannot restore a badge. */
export async function clearAppBadgeOnLogout(): Promise<void> {
  stopActiveSync?.();
  if (typeof navigator === "undefined") return;
  const nav: BadgingNavigator = navigator;
  await Promise.allSettled([
    (async () => {
      await nav.clearAppBadge?.();
    })(),
    (async () => {
      if (!("serviceWorker" in nav)) return;
      const reg = await nav.serviceWorker.getRegistration("/push-sw.js");
      reg?.active?.postMessage({ type: "clear-app-badge" });
    })(),
  ]);
}
