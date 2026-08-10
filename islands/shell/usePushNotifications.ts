import { signal } from "@preact/signals";

export type PushState =
  | "unsupported"
  | "needs-install"
  | "default"
  | "denied"
  | "granted";

const SW_PATH = "/push-sw.js";

/** Per-tab marker so syncIfGranted re-registers once, not on every navigation. */
const SYNCED_KEY = "happie:push-synced";

// The marker is an optimisation and must never gate correctness: sessionStorage
// throws outright in some privacy modes, and a device that fails to unsubscribe
// because it could not write a cache key would be a much worse bug than
// re-registering more often than necessary. Hence every access is swallowed,
// and "unknown" always degrades to doing the work.
function hasSyncMarker(): boolean {
  try {
    return sessionStorage.getItem(SYNCED_KEY) !== null;
  } catch {
    return false;
  }
}
function setSyncMarker(): void {
  try {
    sessionStorage.setItem(SYNCED_KEY, "1");
  } catch { /* storage unavailable — we simply re-register next time */ }
}
function clearSyncMarker(): void {
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
 * Removes this device's subscription: server-side first, then locally.
 *
 * Module-level rather than part of the hook because logout needs it without the
 * hook's signals, and **it must never throw** — a member who cannot reach the
 * push service still has to be able to log out. Every failure path returns
 * false instead.
 *
 * The DELETE is `keepalive` so that a caller which gives up waiting can navigate
 * away while the request still completes; without it, logging out on a slow
 * connection would leave the device subscribed.
 *
 * Returns true only if a subscription was actually removed.
 */
export async function unsubscribeThisDevice(): Promise<boolean> {
  try {
    // Cleared unconditionally and first: leaving it set would make
    // syncIfGranted skip re-registering after a log out / log back in within
    // the same tab, which is exactly the case this whole path exists for.
    clearSyncMarker();

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return false;
    }
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return false;

    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true,
    });
    await sub.unsubscribe();
    return true;
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
    return false;
  }
}

/** iOS only allows push in an installed PWA (16.4+). */
function iosNeedsInstall(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    matchMedia("(display-mode: standalone)").matches;
  return !standalone;
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
    if (Notification.permission === "granted") return "granted";
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

  const subscribe = async (): Promise<boolean> => {
    const keyRes = await fetch("/api/push/vapid-key");
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();

    const reg = await register();
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    return await postSubscription(sub);
  };

  const enable = async (): Promise<boolean> => {
    busy.value = true;
    try {
      // Called synchronously inside the tap handler — see the note above.
      const permission = await Notification.requestPermission();
      state.value = detect();
      if (permission !== "granted") return false;
      return await subscribe();
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
      // Shares the logout path's implementation so there is one way to remove a
      // device, not two that can drift apart. "Nothing to remove" is success
      // here: the member asked for reminders off, and they are off.
      await unsubscribeThisDevice();
      return true;
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
    if (detect() !== "granted") return;
    if (hasSyncMarker()) return;
    try {
      await subscribe();
      setSyncMarker();
    } catch (err) {
      // Never let re-registration break rendering the shell it runs from.
      console.error("[push] sync failed", err);
    }
  };

  const sendTest = async () => {
    busy.value = true;
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) return null;
      return await res.json() as { sent: number; failed: number };
    } finally {
      busy.value = false;
    }
  };

  return { state, busy, enable, disable, sendTest, syncIfGranted };
}
