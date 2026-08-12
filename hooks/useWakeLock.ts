import { type ReadonlySignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface WakeLockProbes {
  supported: boolean;
  visible: boolean;
  wanted: boolean;
}

/** Pure decision — exported for unit tests. */
export function shouldRequestLock(probes: WakeLockProbes): boolean {
  return probes.supported && probes.visible && probes.wanted;
}

/**
 * Holds a screen wake lock while `shouldHold` is true and the tab is
 * visible. Invisible enhancement (docs/ui-ux-patterns.md §11): unsupported
 * browsers and rejected requests degrade silently — the screen simply times
 * out like it always did.
 *
 * The browser force-releases the lock whenever the tab hides (and may
 * release it on its own for battery saving); the `release` listener drops
 * the stale sentinel so the next visibility/signal change re-requests.
 */
export function useWakeLock(shouldHold: ReadonlySignal<boolean>): void {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let requesting = false;
    let disposed = false;

    const sync = async () => {
      const wanted = shouldRequestLock({
        supported: true,
        visible: document.visibilityState === "visible",
        wanted: shouldHold.value,
      });
      if (wanted && !sentinel && !requesting) {
        requesting = true;
        try {
          const s = await navigator.wakeLock.request("screen");
          if (disposed || !shouldHold.value) {
            await s.release();
            return;
          }
          sentinel = s;
          s.addEventListener("release", () => {
            if (sentinel === s) sentinel = null;
          });
        } catch (err) {
          console.debug("[wake-lock] request failed", err);
        } finally {
          requesting = false;
        }
      } else if (!wanted && sentinel) {
        const s = sentinel;
        sentinel = null;
        await s.release();
      }
    };

    // subscribe() runs the callback immediately with the current value, so
    // the initial acquisition needs no separate kick-off.
    const unsubscribe = shouldHold.subscribe(() => {
      void sync();
    });
    const onVisibility = () => {
      void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
      sentinel = null;
    };
  }, [shouldHold]);
}
