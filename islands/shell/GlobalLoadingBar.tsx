import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { busyCount, navPending, shouldInterceptNav } from "@/utils/loading.ts";

const SHOW_DELAY_MS = 200; // don't flash the bar for fast optimistic writes
const MIN_VISIBLE_MS = 400; // once shown, stay up long enough to be seen

/**
 * The app's single global loading indicator. Shows immediately for navigation
 * (navPending) and, after a short delay, for background CRUD (busyCount) — with a
 * minimum visible duration so quick writes don't flicker. Mounted once by AppChrome.
 */
export default function GlobalLoadingBar() {
  const busyVisible = useSignal(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const shownAt = useRef(0);

  // Map busyCount → busyVisible with the show-delay / min-visible timing.
  useSignalEffect(() => {
    const active = busyCount.value > 0;
    if (active) {
      if (hideTimer.current !== undefined) {
        clearTimeout(hideTimer.current);
        hideTimer.current = undefined;
      }
      if (!busyVisible.peek() && showTimer.current === undefined) {
        showTimer.current = setTimeout(() => {
          busyVisible.value = true;
          shownAt.current = Date.now();
          showTimer.current = undefined;
        }, SHOW_DELAY_MS);
      }
    } else {
      if (showTimer.current !== undefined) {
        clearTimeout(showTimer.current);
        showTimer.current = undefined;
      }
      if (busyVisible.peek() && hideTimer.current === undefined) {
        const wait = Math.max(
          0,
          MIN_VISIBLE_MS - (Date.now() - shownAt.current),
        );
        hideTimer.current = setTimeout(() => {
          busyVisible.value = false;
          hideTimer.current = undefined;
        }, wait);
      }
    }
  });

  // Centralized navigation interception (internal links) + bfcache reset.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
        e.button !== 0;
      if (
        shouldInterceptNav({
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          modified,
          currentHref: location.href,
        })
      ) {
        navPending.value = true;
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) navPending.value = false; // restored from bfcache
    };
    document.addEventListener("click", onClick);
    globalThis.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      globalThis.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const visible = navPending.value || busyVisible.value;

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-hidden={visible ? undefined : "true"}
      class="fixed left-0 right-0 z-50 pointer-events-none"
      style={{
        top: 0,
        paddingTop: "env(safe-area-inset-top)",
        opacity: visible ? 1 : 0,
        transition: "opacity .2s var(--md-emphasized)",
      }}
    >
      <div class="md-loadbar-track">
        <div class="md-loadbar-wave" />
      </div>
    </div>
  );
}
