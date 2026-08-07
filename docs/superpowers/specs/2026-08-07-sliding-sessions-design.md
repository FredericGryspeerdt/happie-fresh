# Sliding Sessions Design

**Date:** 2026-08-07
**Status:** Approved

## Problem

Sessions live in KV with a fixed 24-hour TTL (`database/session.repo.ts`) and
are never renewed — the middleware only checks expiry. Even a household member
who uses the app every day is forced to log in again every 24 hours. For a
mobile-first PWA used on the go (checking off items in the supermarket), this
is the top complaint.

A secondary finding: the session cookie set in `routes/login.tsx` is missing
`HttpOnly`. Any XSS can read the session ID from `document.cookie`. It also
matters for iOS: Safari's ITP purges script-writable cookies after 7 days of
non-use, but server-set `HttpOnly` cookies are exempt — so the flag is both a
security fix and a login-frequency fix on iOS PWAs.

## Decision

Sliding expiration with an absolute cap:

- **Idle window: 30 days.** Every authenticated request slides the session
  expiry to now + 30 days. A session only dies after 30 consecutive days
  without any activity.
- **Absolute cap: 90 days.** No session may live past 90 days from login,
  regardless of activity. This bounds the damage of a stolen cookie or a
  forgotten device.
- **No session ID rotation.** Rotation on renewal creates races with the PWA's
  concurrent and offline-retried requests. Server-side sessions in KV already
  give instant revocation (logout deletes the session), which covers the theft
  scenario rotation would address.

A user active every other day never sees the idle expiry; they log in roughly
four times a year (the cap). Alternatives considered: a fixed 30-day lifetime
(simpler, but inactive devices stay valid the full window) and a refresh-token
rotation scheme (theft detection, but complexity disproportionate to a
household app's threat model).

## Design

### Session model (`models/session/session.interface.ts`)

Add one field:

```ts
export interface SessionInterface {
  id: string;
  userId: string;
  expiresAt: Date; // sliding idle expiry: now + 30d, capped at absoluteExpiresAt
  absoluteExpiresAt: Date; // fixed at login: login time + 90d
}
```

### SessionRepo (`database/session.repo.ts`)

Constants: `IDLE_TTL_MS` (30 days), `ABSOLUTE_TTL_MS` (90 days),
`RENEWAL_THRESHOLD_MS` (1 day).

- `create(userId)` — sets `expiresAt = now + IDLE_TTL_MS`,
  `absoluteExpiresAt = now + ABSOLUTE_TTL_MS`, and KV `expireIn = IDLE_TTL_MS`.
- `touch(session)` (new) — computes
  `newExpiresAt = min(now + IDLE_TTL_MS, absoluteExpiresAt)`. If that extends
  the current `expiresAt` by **more than one day**, re-writes the session with
  `expireIn = newExpiresAt - now` and returns the updated session; otherwise
  returns `null` (no write). Sessions without `absoluteExpiresAt` (legacy 24h
  sessions) are never touched and drain out naturally within a day.

The one-day threshold throttles writes only — at most one KV write per session
per day. It never causes a logout: renewal is skipped only when the expiry was
already slid within the last day.

### Middleware (`routes/_middleware.ts`)

After the existing session validity check, call `SessionRepo.touch(session)`.
When it returns a renewed session, re-issue the `sessionId` cookie on the
response from `ctx.next()` with `Max-Age` matching the time until the new
`expiresAt`, so the browser cookie slides in step with the server. Cookie
attributes mirror login: host-only (no `domain`), `path: "/"`, `secure`,
`sameSite: "Lax"`, `httpOnly`.

Static/public paths are allowlisted before the session check and are never
touched. API responses get the renewed cookie too — for a PWA, background
fetches are often the only traffic for days.

### Login (`routes/login.tsx`)

Cookie `maxAge` changes from 24 hours to 30 days, and gains `httpOnly: true`.
Logout (`routes/logout.ts`) is unchanged — it already deletes the session
server-side and clears the cookie with mirrored attributes.

## Error handling

Nothing new. An expired or capped session falls through the existing
unauthorized path: 401 for `/api/*`, 303 redirect to `/login` for pages. If a
`touch` write fails, the request still succeeds with the un-renewed session —
renewal is best-effort.

## Rollout

No migration. Existing 24h sessions lack `absoluteExpiresAt`, are never
renewed, and expire within a day; users log in once more and land on the new
regime.

## Testing

New `database/session.repo.test.ts` (KV-backed, runs under
`deno task test`):

- `create` sets both expiry fields 30/90 days out and persists the session.
- `touch` extends `expiresAt` when more than a day has passed since renewal.
- `touch` never extends past `absoluteExpiresAt` (cap).
- `touch` returns `null` and writes nothing when less than a day would be
  gained (throttle).
- `touch` returns `null` for legacy sessions without `absoluteExpiresAt`.
