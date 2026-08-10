import { signal } from "@preact/signals";
import { isIosDevice, isStandaloneDisplay } from "@/islands/shell/platform.ts";

export type InstallState =
  | "installed"
  | "promptable"
  | "ios-browser"
  | "manual";

export type PromptOutcome = "accepted" | "dismissed" | "failed";

/** Chromium's install prompt event — not part of TS's lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Contract with the inline stash script in routes/_app.tsx: the script
// stashes the event under this window property and announces it with this
// event name. Keep all three in sync.
const STASH_KEY = "__happieInstallPrompt";
export const INSTALL_READY_EVENT = "happie:install-ready";

interface InstallProbes {
  isIos: boolean;
  isStandalone: boolean;
  hasStashedPrompt: boolean;
}

/** Pure state derivation — exported for unit tests. */
export function detectInstallState(probes: InstallProbes): InstallState {
  if (probes.isStandalone) return "installed";
  if (probes.hasStashedPrompt) return "promptable";
  if (probes.isIos) return "ios-browser";
  return "manual";
}

function stashedPrompt(): BeforeInstallPromptEvent | undefined {
  return (globalThis as Record<string, unknown>)[STASH_KEY] as
    | BeforeInstallPromptEvent
    | undefined;
}

/**
 * Client side of install guidance. Create once per island via
 * `useMemo(() => useInstallPrompt(), [])` — the same pattern as
 * usePushNotifications.
 */
export function useInstallPrompt() {
  const state = signal<InstallState>("manual");
  const busy = signal(false);

  const detect = (): InstallState =>
    detectInstallState({
      isIos: isIosDevice(),
      isStandalone: isStandaloneDisplay(),
      hasStashedPrompt: stashedPrompt() !== undefined,
    });

  // SSR renders "manual" deterministically; hydration replaces it with the
  // device's real state. Guard on `document`, NOT `navigator` — Deno
  // defines a navigator global on the server.
  state.value = typeof document === "undefined" ? "manual" : detect();

  if (typeof document !== "undefined") {
    addEventListener(INSTALL_READY_EVENT, () => (state.value = detect()));
    addEventListener("appinstalled", () => (state.value = "installed"));
  }

  const promptInstall = async (): Promise<PromptOutcome> => {
    const ev = stashedPrompt();
    if (!ev) return "failed";
    busy.value = true;
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      // The event is single-use — drop the stash whatever the outcome.
      delete (globalThis as Record<string, unknown>)[STASH_KEY];
      state.value = choice.outcome === "accepted" ? "installed" : detect();
      return choice.outcome;
    } catch (err) {
      console.error("[install] prompt failed", err);
      return "failed";
    } finally {
      busy.value = false;
    }
  };

  return { state, busy, promptInstall };
}
