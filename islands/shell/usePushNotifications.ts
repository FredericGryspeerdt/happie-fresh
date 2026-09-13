import { signal } from "@preact/signals";
import { isIosDevice, isStandaloneDisplay } from "@/islands/shell/platform.ts";

export type PushState =
  | "unsupported"
  | "needs-install"
  | "default"
  | "disabled"
  | "denied"
  | "granted";

const SW_PATH = "/push-sw.js";

/** Per-tab marker so syncIfGranted re-registers once, not on every navigation. */
const SYNCED_KEY = "happie:push-synced";
// Browser subscriptions are shared across tabs; logout invalidates every marker.
const RESET_KEY = "happie:push-reset";

// Explicit reminder opt-out survives navigation; logout only removes the endpoint.
const DISABLED_KEY = "happie:push-disabled";
let generation = 0;
let pendingSync: Promise<void> | undefined;

function remindersDisabled(): boolean {
  try {
    return localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    // Without readable preferences, require an explicit tap to enable.
    return true;
  }
}

function setRemindersDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(DISABLED_KEY, "1");
    else localStorage.removeItem(DISABLED_KEY);
  } catch { /* explicit actions still work without storage */ }
}

// The marker is an optimisation and must never gate correctness: sessionStorage
// throws outright in some privacy modes, and a device that fails to unsubscribe
// because it could not write a cache key would be a much worse bug than
// re-registering more often than necessary. Hence every access is swallowed,
// and "unknown" always degrades to doing the work.
function hasSyncMarker(): boolean {
  try {
    return sessionStorage.getItem(SYNCED_KEY) ===
      (localStorage.getItem(RESET_KEY) ?? "1");
  } catch {
    return false;
  }
}
function setSyncMarker(): void {
  try {
    sessionStorage.setItem(SYNCED_KEY, localStorage.getItem(RESET_KEY) ?? "1");
  } catch { /* storage unavailable — we simply re-register next time */ }
}
function clearSyncMarker(): void {
  try {
    localStorage.setItem(RESET_KEY, crypto.randomUUID());
  } catch { /* unavailable preferences already disable automatic recovery */ }
  try {
    sessionStorage.removeItem(SYNCED_KEY);
  } catch { /* storage unavailable — nothing was cached anyway */ }
}

// Returns Uint8Array<ArrayBuffer> rather than a bare Uint8Array: since TS 5.7 the
// type is generic over its buffer, and `applicationServerKey` only accepts a view
// backed by a real ArrayBuffer — so the array is built over one explicitly.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Revoke this browser endpoint and remove its household registration independently.
 * Never throws: logout must proceed even when either push service is unreachable.
 * The caller bounds its wait; keepalive lets the DELETE continue after navigation.
 */
export async function unsubscribeThisDevice(): Promise<boolean> {
  generation++;
  clearSyncMarker();
  const syncing = pendingSync;
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return false;
    }
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    const results = await Promise.allSettled([
      // Capture the endpoint first; revoking locally does not lose the server key.
      sub.unsubscribe(),
      (async () => {
        // A POST already in flight must settle before its corresponding DELETE.
        await syncing;
        const res = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
          keepalive: true,
        });
        return res.ok || res.status === 404;
      })(),
    ]);
    return results.every((result) =>
      result.status === "fulfilled" && result.value
    );
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
    return false;
  }
}

/** iOS only allows push in an installed PWA (16.4+). */
function iosNeedsInstall(): boolean {
  return isIosDevice() && !isStandaloneDisplay();
}

/**
 * Client side of push notifications.
 *
 * `enable()` MUST be called from a user gesture: Safari requires it for
 * `Notification.requestPermission()`, and a denial is near-unrecoverable (it takes
 * digging through browser site settings), so we only ever ask on an explicit tap.
 */
export function usePushNotifications() {
  const state = signal<PushState>("default");
  const busy = signal(false);

  const detect = (): PushState => {
    if (!("serviceWorker" in navigator) || !("PushManager" in globalThis)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") {
      return remindersDisabled() ? "disabled" : "granted";
    }
    if (iosNeedsInstall()) return "needs-install";
    return "default";
  };

  // detect() must not run during SSR — it reaches for Notification and
  // PushManager, and would report "unsupported" for every visitor. The guard is
  // `document`, NOT `navigator`: Deno defines a `navigator` global on the server
  // (with no serviceWorker), so a navigator check silently takes the browser
  // branch and server-renders every device as unsupported.
  //
  // Rendering "default" also keeps SSR output deterministic and testable;
  // hydration immediately replaces it with the device's real state.
  state.value = typeof document === "undefined" ? "default" : detect();

  const register = () =>
    navigator.serviceWorker.register(SW_PATH, { scope: "/" });

  const postSubscription = async (sub: PushSubscription): Promise<boolean> => {
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
    return res.ok;
  };

  const subscribe = async (started = generation): Promise<boolean> => {
    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok || started !== generation) return false;
    const { publicKey } = await keyRes.json();

    const reg = await register();
    if (started !== generation) return false;
    const existing = await reg.pushManager.getSubscription();
    if (started !== generation) return false;
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    if (started !== generation) {
      await sub.unsubscribe();
      return false;
    }
    return await postSubscription(sub);
  };

  const enable = async (): Promise<boolean> => {
    const started = generation;
    busy.value = true;
    try {
      // Called synchronously inside the tap handler — see the note above.
      const permission = await Notification.requestPermission();
      state.value = detect();
      if (permission !== "granted") return false;
      const ok = await subscribe(started);
      if (ok) {
        setRemindersDisabled(false);
        state.value = "granted";
      }
      return ok;
    } catch (err) {
      console.error("[push] enable failed", err);
      return false;
    } finally {
      busy.value = false;
    }
  };

  const disable = async (): Promise<boolean> => {
    busy.value = true;
    try {
      setRemindersDisabled(true);
      const ok = await unsubscribeThisDevice();
      if (ok) state.value = "disabled";
      return ok;
    } finally {
      busy.value = false;
    }
  };

  /**
   * Re-registers this device when permission is already granted but the server
   * has no subscription for it — after site data was cleared, or after a logout
   * removed it. Silent by design: permission is already granted, so nothing is
   * prompted for and there is no second chance to spend.
   *
   * Runs at most once per tab (see SYNCED_KEY): the endpoint-hash upsert makes a
   * repeat harmless, but re-POSTing on every navigation is pure waste.
   */
  const syncIfGranted = async (): Promise<void> => {
    if (detect() !== "granted" || remindersDisabled() || hasSyncMarker()) {
      return;
    }
    if (pendingSync) return await pendingSync;
    const started = generation;
    pendingSync = (async () => {
      try {
        if (await subscribe(started) && started === generation) setSyncMarker();
      } catch (err) {
        console.error("[push] sync failed", err);
      }
    })();
    try {
      await pendingSync;
    } finally {
      pendingSync = undefined;
    }
  };

  /**
   * Registers this device first, then asks the server to send. The server fans
   * out to every device in the household, so without this step the test can
   * "succeed" (someone else's phone buzzes) while the device in hand was never
   * registered — exactly what happens after restoring a phone from backup: the
   * granted permission survives the restore, the device-bound endpoint does not.
   */
  const sendTest = async () => {
    busy.value = true;
    try {
      if (!(await subscribe())) return null;
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) return null;
      return await res.json() as { sent: number; failed: number };
    } finally {
      busy.value = false;
    }
  };

  return { state, busy, enable, disable, sendTest, syncIfGranted };
}
