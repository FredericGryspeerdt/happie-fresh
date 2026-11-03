# Angular's service worker and Happie's push, badge and notification clicks

Checked 3 November 2026 for
[#165](https://github.com/FredericGryspeerdt/happie-fresh/issues/165), part of
[#142](https://github.com/FredericGryspeerdt/happie-fresh/issues/142). I used
primary sources only: Angular source and docs at tag `v22.2.4`, MDN and MDN
browser-compat-data, and the WebKit blog. Nothing here was built or run on a
device.

## Answer

**`@angular/service-worker` on its own can't do what Happie needs.** Use a
small custom worker that calls `importScripts('./ngsw-worker.js')` and then
adds Happie's own `push`, `notificationclick` and `message` handlers. Angular
documents this as the supported extension point. ngsw then handles caching and
`SwUpdate`, and our code keeps handling notifications and the badge, which is
what `static/push-sw.js` does today.

The reasons, in short:

- ngsw only shows a notification when the payload is
  `{ notification: { title, … } }`. Happie sends a flat `{ title, body, tag, url }`.
- ngsw has no Badging API code at all.
- ngsw's click handling is a fixed set of operations. None of them is "focus an
  existing window *and* navigate it, including uncontrolled windows", which is
  what Happie does now.

## What Happie does today (the requirements)

From [`static/push-sw.js`](../../static/push-sw.js),
[`utils/app-badge.ts`](../../utils/app-badge.ts),
[`services/notification-sweep.ts`](../../services/notification-sweep.ts) and
`docs/ui-ux-patterns.md` ("App-icon badge", "Push logout and recovery"):

1. **Payload** `{ title, body: "Nu te doen", tag: "todo-<id>", url: "/todos" }`.
   A non-JSON payload falls back to text. Each to-do gets its own `tag`, so a
   re-send replaces that to-do's notification instead of stacking a new one.
2. **Push handling.** Show the notification with icon and badge images, and
   refresh the app badge **in parallel** (`Promise.allSettled`), so a badge
   failure never blocks the notification.
3. **Badge refresh.** Fetch `/api/todos/badge?before=<next local midnight>`
   with `cache: "no-store"`, then call `setAppBadge(n)` or `clearAppBadge()`. A
   non-OK response keeps the last badge. A generation counter drops stale
   responses.
4. **Messages.** The window posts `{type: "refresh-app-badge"}` (acknowledged
   over a `MessagePort`) and `{type: "clear-app-badge"}` (on logout). One worker
   owns every badge write, so writes can't race.
5. **Click.** `clients.matchAll({type: "window", includeUncontrolled: true})`.
   Focus and `navigate(url)` the first window, or call `openWindow(url)` if
   there is none.
6. **No caching.** The worker deliberately has no fetch handler.

The Firebase spike's
[`prototypes/firebase/public/sw.js`](https://github.com/FredericGryspeerdt/happie-fresh/blob/prototype/firebase-spike/prototypes/firebase/public/sw.js)
(branch `prototype/firebase-spike`) is a stripped-down version: `push` →
`showNotification`, and click → `openWindow`. It proved delivery to a closed
iOS home-screen PWA (spike README, "Scheduled push"). It did not test the
click target, the badge or ngsw.

## How ngsw handles push and clicks (Angular 22 source)

All references are to
[`packages/service-worker/worker/src/driver.ts` @ v22.2.4](https://github.com/angular/angular/blob/v22.2.4/packages/service-worker/worker/src/driver.ts).

- **Listeners.** The constructor registers `fetch`, `message`, `push`,
  `notificationclick`, `notificationclose`, `pushsubscriptionchange`,
  `messageerror` and `unhandledrejection` on `self` (lines ~209–218).
- **Push** (`onPush`/`handlePush`, ~331–424). A push with no data is ignored.
  Otherwise ngsw calls `msg.data.json()`, broadcasts `{type: 'PUSH', data}` to
  clients (this feeds `SwPush.messages`), and then **returns without showing
  anything unless `data.notification.title` exists**. When it does show one,
  it copies only the whitelisted `NOTIFICATION_OPTION_NAMES` (`actions`,
  `badge`, `body`, `data`, `dir`, `icon`, `image`, `lang`, `renotify`,
  `requireInteraction`, `silent`, `tag`, `timestamp`, `title`, `vibrate`). The
  payload format is the one the
  [Push notifications guide](https://angular.dev/ecosystem/service-workers/push-notifications)
  documents.
- **Click** (`handleClick`, ~426–475). ngsw closes the notification, then
  reads `notification.data.onActionClick[action || 'default']` and runs one of
  `openWindow`, `focusLastFocusedOrOpen`, `navigateLastFocusedOrOpen` or
  `sendRequest`, with the URL resolved against the registration scope. If no
  `onActionClick` entry exists it does nothing beyond broadcasting
  `NOTIFICATION_CLICK` to open clients, so a closed app would never open. The
  "last focused client" comes from `clients.matchAll({type: 'window'})`
  **without `includeUncontrolled`** (~533–540), so ngsw can miss a window the
  worker doesn't control yet. Happie's handler includes uncontrolled windows.
- **Badging.** `driver.ts` never mentions `setAppBadge` or `clearAppBadge`.
  The only badge in it is the `badge` notification *option*, which sets the
  small notification icon and has nothing to do with the app-icon count.
- **Messages.** `onMessage` ignores any message without `data.action`
  (~296–330). Happie's `{type: …}` messages therefore don't collide with ngsw's
  `CHECK_FOR_UPDATES` / `ACTIVATE_UPDATE`.

On the client side, `SwPush` (`requestSubscription`, `unsubscribe`,
`subscription`, `messages`, `notificationClicks`, `notificationCloses`,
`pushSubscriptionChanges`) works against whatever script `provideServiceWorker`
registered, custom wrapper included
([`src/push.ts`](https://github.com/angular/angular/blob/v22.2.4/packages/service-worker/src/push.ts)).
`SwPush` reports itself disabled whenever the worker is disabled, for example
with `enabled: !isDevMode()` under `ng serve`.

## The platform side (iOS/iPadOS home-screen PWA)

- **Web Push** works only for web apps on the Home Screen, and permission must
  be requested from a user gesture
  ([WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
  Our existing `ui-ux-patterns.md` rule already covers this.
- **Badging** has been in iOS/iPadOS 16.4+, for Home Screen web apps only. It
  is exposed in workers, so a service worker can update the badge while
  handling `push`. A badge update alone does not meet the "user visible"
  requirement, so every push must still call `showNotification`. The badge
  shows only after notification permission is granted
  ([WebKit: Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/);
  [MDN BCD `Navigator.setAppBadge`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json):
  Safari iOS 16.4, where `0` clears the badge; not supported on Chrome Android).
  The push handler must therefore always show a notification, whatever happens
  to the badge. That is the current design, and the wrapper keeps it.
- **Click APIs.** `Clients.openWindow`, `Clients.matchAll` and
  `WindowClient.focus` have been in Safari since 11.1. `WindowClient.navigate`
  is real only since Safari 16; before that it threw `NotSupportedError`
  ([MDN BCD `WindowClient`](https://github.com/mdn/browser-compat-data/blob/main/api/WindowClient.json)).
  Every iOS version with Web Push (16.4+) has it.
- **Declarative Web Push** (iOS/iPadOS 18.4+): a payload with
  `"web_push": 8030`, a `notification` object with a required `navigate` URL,
  and an optional `app_badge`. The browser can display it without a service
  worker. When a worker exists it still receives the `push` event first and
  can replace the notification. If it doesn't do so in time, the declarative
  one is shown
  ([WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).
  **This clashes with ngsw.** A declarative payload carries a
  `notification.title`, so ngsw would show its own copy (`navigate` is not on
  its whitelist) with no `onActionClick`, and tapping it would do nothing. Do
  not adopt the declarative format without handling it in our own code.
- **Storage eviction.** The ITP 7-day cap on script-writable storage covers
  service worker registrations and caches. Home Screen web apps use their own
  usage counter, and WebKit says it does not expect their first-party data to
  be deleted
  ([WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).

## Update flow and the caching it brings

From the
[communications](https://angular.dev/ecosystem/service-workers/communications),
[configuration](https://angular.dev/ecosystem/service-workers/config) and
[devops](https://angular.dev/ecosystem/service-workers/devops) guides:

- **`SwUpdate.versionUpdates`** emits `VersionDetectedEvent`,
  `NoNewVersionDetectedEvent`, `VersionReadyEvent` and
  `VersionInstallationFailedEvent`. ngsw checks `ngsw.json` on initialisation
  and on every navigation request. `checkForUpdate()` triggers a manual check.
  The recommended way to apply an update is to reload on `VersionReadyEvent`,
  ideally after asking the member. `activateUpdate()` without a reload can mix
  versions of lazy chunks. `SwUpdate.unrecoverable` fires when an evicted,
  hashed asset can't be served, and the only recovery is a reload.
- **Registration** waits for app stability, up to 30 s by default
  (`registerWhenStable:30000`). Polling with `setInterval` delays it, so start
  any polling only after the app is stable.
- **Caching.** ngsw caches the app shell and hashed assets (`assetGroups`).
  Navigation requests that match no group get `index.html`, and with the
  default `navigationRequestStrategy: 'performance'` that comes from cache.
  It caches only `GET`/`HEAD` responses, and only for groups that are
  configured. **Requests that match no group, such as `/api/**` with no
  `dataGroups` entry, go to the network and are never stored.** ngsw still
  calls `respondWith` for them, though: its `onFetch` reaches
  `event.respondWith(this.handleFetch(event))` for everything except
  `ngsw-bypass`, safe mode, mixed content and the DevTools edge case. So API
  traffic passes through the worker without being cached. Steps that keep
  `/api/**` uncached:
  - Do not add a `dataGroups` entry for `/api/**`.
  - Add `"!/api/**"` to `navigationUrls`. Then a top-level navigation to an
    API URL (a download or redirect link, say) reaches Cloud Run instead of
    getting the cached shell.
  - Keep `Cache-Control: private, no-store` on API responses. The spike does
    this already, and
    [Firebase Hosting](https://firebase.google.com/docs/hosting/manage-cache)
    does not CDN-cache backend responses unless they are marked `public`.
- **Script updates.** Browsers install a new worker only when the script
  bytes change, and ngsw resolves its caches relative to the scope, not the
  script URL (devops guide). Under the default `updateViaCache: 'imports'`,
  scripts loaded with `importScripts` **are** read from the HTTP cache
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache)).
  A cached `ngsw-worker.js` could therefore hide an Angular upgrade from the
  wrapper. `provideServiceWorker` accepts `updateViaCache`
  ([`src/provider.ts`](https://github.com/angular/angular/blob/v22.2.4/packages/service-worker/src/provider.ts)).
  Set it to `'none'`, and/or serve `custom-sw.js`, `ngsw-worker.js`,
  `ngsw.json` and `index.html` with `Cache-Control: no-cache` from
  `firebase.json` `headers`.
- **Kill switches.** Deleting or renaming `ngsw.json` (so it returns 404) makes
  ngsw clear its caches and unregister itself. `safety-worker.js` has to be
  served at the *old* worker's URL (devops guide). Service workers also break
  behind redirects, so pick the final Firebase/custom domain before launch.

## Extending ngsw: options and pitfalls

| Option | Verdict |
| --- | --- |
| **A. ngsw alone**, server sends `{notification: {title, body, tag, icon, badge, data: {url, onActionClick: {default: {operation: 'navigateLastFocusedOrOpen', url}}}}}` | Covers display and a basic click. **No badge while the app is closed** (no `setAppBadge` in the worker). The click misses uncontrolled windows. No text fallback: `data.json()` on a non-JSON payload throws before any notification is shown. Doesn't meet the requirements. |
| **B. Custom wrapper** `custom-sw.js` = `importScripts('./ngsw-worker.js')` + Happie's handlers, registered with `provideServiceWorker('custom-sw.js', …)` and added to `angular.json` `assets` | **Recommended.** This is the documented pattern ([Custom service worker scripts](https://angular.dev/ecosystem/service-workers/custom-service-worker-scripts)). We keep the push, badge, message and click code from `push-sw.js` almost unchanged, and ngsw adds caching and `SwUpdate`. |
| **C. Two workers** (ngsw at `/`, push worker elsewhere) | Not viable. A scope has exactly one active worker, and push subscriptions belong to a registration, so the push worker would need a narrower scope. Its `openWindow` and client matching would then not cover the app. |
| **D. Hand-written worker, no ngsw** (the spike's approach) | Viable and simplest, but we lose `SwUpdate`, the offline shell and integrity checks. It's a fallback if ngsw turns out to cause trouble, or if offline support stays out of scope as it is today (issue #74 in the PWA roadmap). |

Pitfalls for option B:

1. **Keep the payload flat. Never put a `notification` key in it.** ngsw's
   `push` listener runs too. If the payload ever had `notification.title`, the
   member would get two notifications (ours and ngsw's). With the flat shape
   ngsw only broadcasts `PUSH`, which is harmless and even lets the open app
   react through `SwPush.messages`. The same applies to Declarative Web Push
   (see above).
2. **Both click handlers run.** ngsw's handler closes the notification and,
   with no `onActionClick`, only broadcasts. Ours does the focus/navigate. Do
   not also add `onActionClick` to `data`, or ngsw will open or navigate a
   second time.
3. **Don't add a `fetch` listener.** ngsw calls `respondWith` for nearly every
   request, and a second `respondWith` throws `InvalidStateError`. Use
   `ngsw-bypass` for anything ngsw must not handle. The badge fetch from inside
   the worker doesn't fire a `fetch` event, so it is unaffected.
4. **Messages.** Keep Happie's messages keyed on `type`, never `action`.
   ngsw ignores anything without `data.action`, and ignores every message in
   safe mode, so our listener still works when ngsw is broken.
5. **Order and isolation.** Import ngsw first and wrap our code in an IIFE
   (Angular's own best-practice list). An exception thrown in ngsw's listener
   doesn't stop ours from running, but keep our own `try/catch` around badge
   work so it can never block `showNotification`.
6. **Registration path.** `utils/app-badge.ts` and `usePushNotifications.ts`
   look the registration up by script path (`/push-sw.js`). In Angular,
   use `navigator.serviceWorker.ready` / `getRegistration('/')` or `SwPush`
   instead of a hard-coded script name.
7. **Dev mode.** With `enabled: !isDevMode()`, push and badge can't be tried
   under `ng serve`. Test against `ng build` output served over HTTPS or
   localhost, and on a real installed iOS app.
8. **`custom-sw.js` in `ngsw.json`.** A default `"/*.js"` asset glob would make
   ngsw cache the wrapper as an app file. The browser's own update check doesn't
   go through the worker, so this is untidy rather than broken. Excluding it
   (`"!/custom-sw.js"`) is cleaner. *(I reasoned this from the config docs and
   did not test it.)*

## Uncertain / to verify on device

- **Where a notification tap lands on iOS when the app is closed.** The spike
  only tested `openWindow` delivery, not the target. WebKit's posts don't say
  whether `openWindow` from a Home Screen app's worker opens the standalone app
  or Safari.
- **Badge updates from `push` while the app is fully closed on iOS.** WebKit
  says they work. The current app documents them as still needing on-device
  checks.
- **Push subscriptions after the move.** The origin changes from Deno Deploy
  to Firebase Hosting, so every device must re-subscribe on the new origin
  whatever we choose here. Existing subscriptions can't be carried over.
