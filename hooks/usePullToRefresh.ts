import { type Signal, signal } from "@preact/signals";

export type PullStatus =
  | "idle"
  | "pulling"
  | "armed"
  | "refreshing"
  | "success"
  | "error";

export interface UsePullToRefreshOptions {
  /** The page's refresh action. May return a promise; rejection → error state. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Damped pull distance (px) required to arm a refresh. Default 72. */
  threshold?: number;
  /** Fraction of raw finger travel applied to the pull. Default 0.5. */
  resistance?: number;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}

export interface PullToRefreshController {
  status: Signal<PullStatus>;
  pull: Signal<number>;
  /** Record the touch origin. */
  begin(startY: number): void;
  /** Update from a move; returns true when engaged (caller should preventDefault). */
  move(currentY: number, atTop: boolean): boolean;
  /** Release: refresh if armed, else spring back. */
  end(): void;
  /** Abort an in-progress (non-refreshing) pull. */
  cancel(): void;
}

const ENGAGE_SLOP = 6; // px of downward travel before we hijack the gesture
const SUCCESS_MS = 600; // how long the success check lingers
const ERROR_MS = 400; // how long the error state lingers before reset

/**
 * Gesture state machine for pull-to-refresh. DOM-free and signal-based so it can
 * be unit-tested by calling its methods directly (see usePullToRefresh.test.ts).
 * Created once per consumer via `useMemo(() => usePullToRefresh(...), [])`.
 */
export function usePullToRefresh(
  opts: UsePullToRefreshOptions,
): PullToRefreshController {
  const { onRefresh, threshold = 72, resistance = 0.5, onError, onSuccess } =
    opts;

  const status = signal<PullStatus>("idle");
  const pull = signal(0);
  const maxPull = threshold + 48;

  let startY = 0;
  let engaged = false;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const busy = () =>
    status.value === "refreshing" || status.value === "success";

  const scheduleIdle = (ms: number) => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      status.value = "idle";
      pull.value = 0;
    }, ms);
  };

  const begin = (y: number) => {
    if (busy()) return;
    startY = y;
    engaged = false;
  };

  const move = (currentY: number, atTop: boolean): boolean => {
    if (busy()) return false;
    if (!engaged) {
      if (atTop && currentY - startY > ENGAGE_SLOP) engaged = true;
      else return false;
    }
    const raw = currentY - startY;
    if (raw <= 0) {
      pull.value = 0;
      status.value = "idle";
      engaged = false;
      return false;
    }
    const damped = Math.min(raw * resistance, maxPull);
    pull.value = damped;
    status.value = damped >= threshold ? "armed" : "pulling";
    return true;
  };

  const end = () => {
    if (!engaged) return;
    engaged = false;
    if (status.value !== "armed") {
      pull.value = 0;
      status.value = "idle";
      return;
    }
    status.value = "refreshing";
    pull.value = threshold;
    const result = onRefresh();
    Promise.resolve(result).then(
      () => {
        status.value = "success";
        onSuccess?.();
        scheduleIdle(SUCCESS_MS);
      },
      (error) => {
        status.value = "error";
        pull.value = 0;
        onError?.(error);
        scheduleIdle(ERROR_MS);
      },
    );
  };

  const cancel = () => {
    if (busy()) return;
    pull.value = 0;
    status.value = "idle";
    engaged = false;
  };

  return { status, pull, begin, move, end, cancel };
}
