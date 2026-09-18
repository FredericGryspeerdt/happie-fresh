// hooks/useSnack.ts
import { type ReadonlySignal, signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

/** Payload `<Snackbar>` renders; the one definition every call site shares. */
export interface SnackData {
  msg: string;
  action?: string;
  onAction?: () => void;
}

/** How long a plain message stays up. */
export const SNACK_MS = 3000;

/** An Undo/retry affordance has to outlive reading the message it sits next to. */
export const SNACK_ACTION_MS = 10_000;

export interface SnackTiming {
  /** The hook's `defaultMs`. */
  defaultMs: number;
  /** The action label attached to this snack, if any. */
  action?: string;
  /** Per-call override; wins over everything else. */
  overrideMs?: number;
}

/** Pure duration policy — exported for unit tests. */
export function snackDuration(timing: SnackTiming): number {
  if (timing.overrideMs !== undefined) return timing.overrideMs;
  return timing.action ? SNACK_ACTION_MS : timing.defaultMs;
}

export interface SnackController {
  snack: ReadonlySignal<SnackData | null>;
  /** `ms` overrides this snack's lifetime only, not the hook's default. */
  showSnack: (
    msg: string,
    action?: string,
    onAction?: () => void,
    ms?: number,
  ) => void;
  hideSnack: () => void;
  /** Cancel the pending dismiss timer. `useSnack` wires this to unmount. */
  dispose: () => void;
}

/**
 * The signal + dismiss timer behind a snackbar, free of hook context and the
 * DOM so it can be driven directly from a test (see useSnack.test.ts).
 *
 * The timer is cleared *before* every new snack, never re-derived from the
 * signal in an effect: an effect keyed on the snack value cannot tell a
 * replacement from a re-render, so a second `showSnack` would inherit the
 * first snack's deadline. Call sites rely on replacing a live snack restarting
 * the countdown (`WeeklyMenu` undo, `MoveItems` "Undoing move…").
 */
export function createSnackController(defaultMs = SNACK_MS): SnackController {
  const snack = signal<SnackData | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const showSnack = (
    msg: string,
    action?: string,
    onAction?: () => void,
    ms?: number,
  ) => {
    cancel();
    snack.value = { msg, action, onAction };
    const life = snackDuration({ defaultMs, action, overrideMs: ms });
    timer = setTimeout(() => {
      snack.value = null;
      timer = null;
    }, life);
  };

  const hideSnack = () => {
    cancel();
    snack.value = null;
  };

  return { snack, showSnack, hideSnack, dispose: cancel };
}

/**
 * Self-dismissing snackbar state for one island. Replaces the per-site
 * `snack` signal + `snackTimer` ref pair (docs/ui-ux-patterns.md §6).
 *
 * The dismiss timer is cancelled on unmount, so a timer can never fire against
 * a torn-down island (#112).
 */
export function useSnack(defaultMs = SNACK_MS): {
  snack: ReadonlySignal<SnackData | null>;
  showSnack: SnackController["showSnack"];
  hideSnack: () => void;
} {
  const ref = useRef<SnackController | null>(null);
  if (ref.current === null) ref.current = createSnackController(defaultMs);
  const controller = ref.current;

  useEffect(() => () => controller.dispose(), [controller]);

  return {
    snack: controller.snack,
    showSnack: controller.showSnack,
    hideSnack: controller.hideSnack,
  };
}
