import { signal } from "@preact/signals";

export type PushState =
  | "unsupported"
  | "needs-install"
  | "default"
  | "denied"
  | "granted";

const SW_PATH = "/push-sw.js";

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

  // `navigator` does not exist during SSR, so detect() must not run there — it
  // would throw and take the whole page down. Server-rendering as "default" also
  // keeps SSR output deterministic and testable; hydration immediately replaces
  // it with the device's real state.
  state.value = typeof navigator === "undefined" ? "default" : detect();

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
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return true;
      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      return true;
    } finally {
      busy.value = false;
    }
  };

  /** Permission already granted but nothing stored — after clearing site data. */
  const syncIfGranted = async (): Promise<void> => {
    if (detect() !== "granted") return;
    await subscribe();
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
