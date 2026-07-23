import { signal } from "@preact/signals";

/**
 * Cross-island loading state. Module-scope signals are the sanctioned shared-state
 * channel in this app (see utils/app-bar.ts). A full-page navigation resets them for free.
 */

/** True while a full-page navigation is in flight. */
export const navPending = signal(false);

/** Number of in-flight background mutations (optimistic CRUD). */
export const busyCount = signal(0);

/** Increment the in-flight mutation counter. */
export function beginBusy(): void {
  busyCount.value++;
}

/** Decrement the in-flight mutation counter (never below zero). */
export function endBusy(): void {
  busyCount.value = Math.max(0, busyCount.value - 1);
}

/** Show the nav indicator, then navigate. Nav is skipped when there is no DOM (tests). */
export function navigateTo(url: string): void {
  navPending.value = true;
  if (typeof location !== "undefined" && location) location.href = url;
}

/** Show the nav indicator, then reload. */
export function reloadPage(): void {
  navPending.value = true;
  if (typeof location !== "undefined" && location) location.reload();
}

/** Pure decision: should a link click show the navigation indicator? */
export function shouldInterceptNav(opts: {
  href: string | null;
  target?: string | null;
  download?: boolean;
  modified?: boolean;
  currentHref: string;
}): boolean {
  const { href, target, download, modified, currentHref } = opts;
  if (!href) return false;
  if (modified) return false;
  if (download) return false;
  if (target && target !== "_self") return false;
  let url: URL;
  let cur: URL;
  try {
    cur = new URL(currentHref);
    url = new URL(href, currentHref);
  } catch {
    return false;
  }
  if (url.origin !== cur.origin) return false; // external
  if (url.href === cur.href) return false; // no-op
  // same page, only a hash change → let the browser handle it, no full load
  if (url.pathname === cur.pathname && url.search === cur.search && url.hash) {
    return false;
  }
  return true;
}
