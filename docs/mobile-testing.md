# Testing on a real mobile device

The app is mobile-first and meant to run as a PWA, so some things can only be
verified on an actual phone: touch gestures, the on-screen keyboard, safe-area
insets, Add to Home Screen, and standalone-mode chrome.

This guide sets up `deno task dev:mobile`, which serves the dev server over
HTTPS on your local network so your phone can reach it.

## Why HTTPS is required

Two independent reasons — neither has a plain-HTTP workaround:

1. **The session cookie is `Secure`** (`routes/login.tsx`). Browsers refuse to
   store or send `Secure` cookies over `http://` on any origin other than
   `localhost`. Over plain HTTP on the LAN you cannot log in at all.
2. **PWA features need a secure context.** Service workers, installability and
   push are unavailable outside one. `localhost` counts as secure by special
   case; `http://192.168.x.x` does not.

## One-time setup

### 1. Install mkcert and its local CA

```bash
brew install mkcert
```

```bash
mkcert -install
```

`mkcert -install` adds a local certificate authority to the macOS system trust
store, so it will ask for your password.

### 2. Generate the dev certificate

Run this from the repository root. Substitute your own machine name and current
LAN IP:

```bash
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem "$(scutil --get LocalHostName).local" localhost 127.0.0.1 "$(ipconfig getifaddr en0)"
```

`certs/` is gitignored — these certificates are machine-specific and must never
be committed.

Prefer the `.local` hostname over the raw IP when you connect: iOS resolves
`.local` names over Bonjour with no configuration, and it survives DHCP lease
changes. Re-run the command above if your LAN IP changes and you want the IP
form to keep working.

### 3. Trust the CA on the iPhone

This is two separate steps in two different places in Settings. Doing only the
first is the most common failure — Safari will still show a certificate warning,
and it will refuse to register a service worker even if you tap through it.

1. Find the root CA on your Mac:

   ```bash
   open "$(mkcert -CAROOT)"
   ```

2. AirDrop `rootCA.pem` to the iPhone and accept it.
3. **Install the profile:** Settings → General → VPN & Device Management →
   tap the downloaded profile → Install.
4. **Enable full trust:** Settings → General → About → Certificate Trust
   Settings → toggle on the `mkcert` root certificate.

Step 4 is not optional and is not reachable from step 3.

## Running it

```bash
deno task dev:mobile
```

Then on the phone, using your own machine name:

```
https://LM26011.local:5173
```

Both devices must be on the same network. Some routers and most corporate or
guest Wi-Fi networks block client-to-client traffic ("AP isolation"); if the
page never loads, that is the usual cause — a personal hotspot from the phone,
with the Mac joined to it, is the quickest way around it.

`deno task dev` is unaffected and still serves plain HTTP on `localhost`. The
HTTPS behaviour is gated on the `MOBILE_HTTPS=1` environment variable that
`dev:mobile` sets, not on the mere presence of `certs/`, so the normal dev flow
and the Browser-pane preview config keep working without certificates.

You need an account to log in with on the phone — see `deno task db:seed` and
the `SEED_USERNAME` / `SEED_PASSWORD` variables in `.env`.

## Troubleshooting

**Login succeeds but immediately bounces back to `/login`.** The session cookie
was rejected. This is what happens when the `Set-Cookie` `Domain` attribute does
not match the host in the address bar. Check the response header:

```bash
curl -sk -i -X POST https://YOUR-HOST:5173/login -d "username=U&password=P" | grep -i set-cookie
```

There should be **no** `Domain=` attribute — the cookie is deliberately
host-only so it works unchanged on `localhost`, a `.local` name, a LAN IP, and
production. Do not reintroduce `domain: ctx.url.hostname` in `routes/login.tsx`:
behind the Fresh Vite plugin the inner request URL is always `localhost`, so
that pins the cookie to `Domain=localhost` and every non-localhost origin
silently fails to store it.

**Certificate warning that will not go away.** You almost certainly did step 3
but not step 4 of the trust setup above. Full trust is a separate toggle.

**The page never loads at all.** AP isolation on the network — see above.

## Testing on a Deno Deploy preview URL

Deno Deploy gives **every preview deployment its own isolated KV database**, so a
preview starts with no accounts at all and your production credentials will not
work there. Passwords are PBKDF2-hashed and cannot be read back, so an unknown
one can only be reset, never recovered.

`deno task db:login` provisions a login against whichever database `KV_PATH`
points at. Unlike `deno task db:seed` it never deletes anything, which is why it
is allowed to target a remote database at all.

```bash
KV_PATH="https://api.deno.com/v2/databases/<PREVIEW_DB_ID>/connect" \
DENO_KV_ACCESS_TOKEN="<deno-deploy-org-access-token>" \
LOGIN_PASSWORD="<a password you choose>" \
deno task db:login --username tester --confirm-remote
```

Find `<PREVIEW_DB_ID>` in the Deno Deploy console under **Databases**, choosing
the entry for this branch or preview timeline — **not** production. The script
echoes the database id it is about to write to, and refuses any remote target
without `--confirm-remote`, because a preview URL and a production URL differ
only by that id. `--list` shows which usernames already exist.

The same command works locally (omit `--confirm-remote`), and re-running it for
an existing username just resets that password.

> For push notifications specifically, the preview also needs `VAPID_PUBLIC_KEY`,
> `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` set for the **preview** environment in
> Deno Deploy, not only production. Without them `/api/push/vapid-key` returns
> `503` and the notifications sheet cannot subscribe.

## What you can and cannot test today

Working now: the web manifest, Add to Home Screen, app icons, standalone
chrome, `viewport-fit=cover` safe-area insets, real touch and scroll behaviour,
and the on-screen keyboard.

Not working yet: **offline and caching.** No caching service worker exists —
the only worker is the push-only `static/push-sw.js`, registered on demand
when notifications are enabled. Offline support is roadmapped as issue #74
(see `docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md`).
