# Fresh project

Your new Fresh project is ready to go. You can follow the Fresh "Getting
Started" guide here: https://fresh.deno.dev/docs/getting-started

### Usage

Make sure to install Deno:
https://docs.deno.com/runtime/getting_started/installation

Then start the project in development mode:

```
deno task dev
```

This will watch the project directory and restart as necessary.

## Development seed data

Populate your local database with a realistic, production-like dataset:

```
deno task db:seed
```

This **resets** the seed-owned collections (users, households, shopping lists
and their items, categories, the item catalogue, and sessions) and rebuilds them
from hand-authored fixtures in `scripts/seed/fixtures.ts`. It is **destructive**
and **dev-only** — it refuses to run when `DENO_DEPLOYMENT_ID` is set (Deno
Deploy) or when `KV_PATH` points at a remote (`https://`) database. Because
sessions are cleared, everyone is logged out on reseed — you'll need to log in
again afterwards.

What it creates:

- ~8 categories and a ~58-item global catalogue.
- 3 demo users, each with their own household and 1–3 populated shopping lists,
  including deliberate edge cases (a fully-checked list, an empty list, a long
  list spanning every category, long notes/names, high quantities, emoji, and
  uncategorized items).

Demo credentials:

| User    | Username                         | Password                             |
| ------- | -------------------------------- | ------------------------------------ |
| Primary | `SEED_USERNAME` (default `demo`) | `SEED_PASSWORD` (default `password`) |
| Second  | `alex`                           | `happie123`                          |
| Third   | `sam`                            | `happie123`                          |

Set `SEED_USERNAME` / `SEED_PASSWORD` in your `.env` to control the primary
account. To edit the dataset, change `scripts/seed/fixtures.ts` and re-run
`deno task db:seed`.

## Development auto-login

In local development the app **skips the login screen by default**: the
middleware auto-authenticates as a seeded user, and `/login` redirects to the
app. This never happens in production (it's disabled whenever
`DENO_DEPLOYMENT_ID` is set, i.e. on Deno Deploy).

- The dev user is `SEED_USERNAME` (defaults to `demo`). Seed it first (e.g. via
  `deno task db:seed`); if the user doesn't exist yet, the normal login page is
  shown instead.
- To test the real login/session flow, set `DEV_AUTOLOGIN=false` in your `.env`.
- Auto-login populates the request from the user record directly and sets no
  cookie, so it also works when testing on a device over plain HTTP.
