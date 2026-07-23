import type { ComponentChildren, VNode } from "preact";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { usePullToRefresh } from "@/hooks/usePullToRefresh.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface PullToRefreshProps {
  /** The page's refresh action. Rejection surfaces the error Snackbar. */
  onRefresh: () => Promise<unknown> | unknown;
  /** When true, the gesture is inert (e.g. a sheet/overlay is open). */
  disabled?: boolean;
  /** Classes forwarded to the content root (so it can host the page's layout). */
  class?: string;
  children?: ComponentChildren;
}

const THRESHOLD = 72;

/**
 * Reusable pull-to-refresh wrapper. Overlay-style (content is NOT transformed),
 * so it can safely enclose fixed FABs/sheets/overlays. Touch only.
 *
 * Usage:
 *   <PullToRefresh onRefresh={refresh} disabled={sheetOpen} class="flex flex-col gap-4">
 *     ...page content...
 *   </PullToRefresh>
 */
export function PullToRefresh(
  { onRefresh, disabled, class: className, children }: PullToRefreshProps,
): VNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest props for the once-bound listeners / memoized controller to read.
  const latest = useRef({ onRefresh, disabled });
  latest.current = { onRefresh, disabled };

  const showError = () => {
    snack.value = { msg: "Couldn't refresh — try again" };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 3000);
  };

  // useMemo with [] ensures usePullToRefresh is called only once.
  // usePullToRefresh uses plain signal() (not useSignal), so calling it on every
  // re-render would recreate all signals from SSR props, discarding local state.
  const { status: statusSignal, pull: pullSignal, begin, move, end, cancel } =
    useMemo(
      () =>
        usePullToRefresh({
          threshold: THRESHOLD,
          onRefresh: () => latest.current.onRefresh(),
          onError: () => showError(),
        }),
      [], // intentionally empty — signals are initialized once from SSR data
    );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;

    const onStart = (e: TouchEvent) => {
      if (latest.current.disabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      begin(t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (latest.current.disabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      // Bail on a predominantly-horizontal drag before we've engaged.
      if (Math.abs(t.clientX - startX) > 40 && pullSignal.value === 0) {
        cancel();
        return;
      }
      const atTop = (globalThis.scrollY ?? 0) <= 0;
      const engaged = move(t.clientY, atTop);
      if (engaged && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      // end() is a no-op when no gesture is engaged; always call it so a
      // gesture in progress when `disabled` flips still resolves (never strands).
      end();
    };
    const onCancel = () => cancel();

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      if (snackTimer.current) clearTimeout(snackTimer.current);
    };
  }, []);

  const status = statusSignal.value;
  const pull = pullSignal.value;
  const dragging = status === "pulling" || status === "armed";
  const active = status !== "idle" && status !== "error";
  const progress = Math.min(pull / THRESHOLD, 1);

  const offset = dragging ? pull * 0.6 : active ? 16 : -24;
  const opacity = status === "idle" || status === "error"
    ? 0
    : dragging
    ? progress
    : 1;
  const scale = 0.8 + 0.2 * (dragging ? progress : 1);
  const spinDeg = dragging ? pull * 2.5 : 0;

  return (
    <>
      <div ref={rootRef} class={className}>{children}</div>

      {/* Decorative pull indicator */}
      <div
        aria-hidden="true"
        class="fixed left-0 right-0 z-[250] flex justify-center pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      >
        <div
          class="grid place-items-center bg-surface-c text-primary md-elevation-3 rounded-[var(--md-shape-full)]"
          style={{
            width: 40,
            height: 40,
            opacity,
            transform: `translateY(${offset}px) scale(${scale})`,
            transition: dragging ? "none" : "all .3s var(--md-emphasized)",
          }}
        >
          {status === "success"
            ? <Icon name="check" size={22} stroke={2.5} />
            : (
              <span
                class={status === "refreshing" ? "pull-spin" : ""}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2.5px solid currentColor",
                  borderTopColor: "transparent",
                  transform: status === "refreshing"
                    ? undefined
                    : `rotate(${spinDeg}deg)`,
                }}
              />
            )}
        </div>
      </div>

      {/* Screen-reader status */}
      <span class="sr-only" aria-live="polite">
        {status === "refreshing"
          ? "Refreshing"
          : status === "success"
          ? "Refreshed"
          : status === "error"
          ? "Couldn't refresh"
          : ""}
      </span>

      <Snackbar data={snack.value} />
    </>
  );
}
