# Running data migrations

`scripts/migrate.ts` (`deno task db:migrate`) is a **one-off, idempotent** data
migration. It currently:

1. rehashes legacy SHA-256 passwords to PBKDF2,
2. back-fills a household per user and moves legacy shopping-list items, and
3. scopes the previously-global catalogue (`items`, `categories`, `dishes`,
   `dish_tag_groups`) under a single **primary household** (issue #42).

It is safe to re-run: already-migrated data is skipped, and it is a **no-op when
there is nothing to migrate** (an empty or already-scoped KV).

## ⚠️ Never run it from the Deno Deploy build / pre-deploy command

The build/pre-deploy step runs on **every** deployment (including PR previews),
and in that build sandbox `DENO_DEPLOYMENT_ID` is not the runtime one — so
`getKv()` falls back to an **empty local `data/kv.db`**, not the production KV.
Running the migration there migrates a throwaway empty database (and previously
crashed with `Cannot infer primary household (0 found)`). Run it manually,
against production, once.

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `SEED_PASSWORD` | yes | Shared legacy password used to rehash pre-PBKDF2 users. |
| `PRIMARY_USERNAME` | when >1 household exists | Username whose household inherits the global catalogue. Unset → the migration only proceeds if exactly one household exists; otherwise it fails fast **before** mutating anything. |
| `KV_PATH` | for remote runs | Selects the database when running outside Deno Deploy. An `https://…` value connects to a remote KV via **KV Connect**. |
| `DENO_KV_ACCESS_TOKEN` | for remote runs | Auth for KV Connect (a Deno Deploy access token). |

## Running against production — GitHub Actions (preferred)

Use the **Migrate production KV** workflow
(`.github/workflows/migrate-prod-kv.yml`). It is `workflow_dispatch`-only (no
push/PR triggers).

One-time setup — add these under **Settings → Secrets and variables → Actions**
(ideally scoped to a `production` **Environment**, where you can also require a
reviewer's approval). Store credentials as **Secrets** and the non-sensitive id
as a **Variable**:

| Name | Kind | Where to get it |
|------|------|-----------------|
| `DENO_KV_DATABASE_ID` | **Variable** | Deno Deploy dashboard → project → **KV** → database id. Not sensitive on its own (useless without the token). |
| `DENO_KV_ACCESS_TOKEN` | **Secret** | dashboard → account settings → **Access Tokens** |
| `SEED_PASSWORD` | **Secret** | the shared legacy password |

The workflow reads the id from `vars.DENO_KV_DATABASE_ID` and the two
credentials from `secrets.*`, so store each on the matching side — a value put
on the wrong side reads back empty.

To run: **Actions → Migrate production KV → Run workflow**, enter
`primary_username`, and type `MIGRATE` in the confirm field.

> The "Run workflow" button only appears once the workflow file is on the
> default branch (`main`), so merge it before triggering.

## Running against production — locally via KV Connect

```bash
KV_PATH="https://api.deno.com/databases/<DB_ID>/connect" \
DENO_KV_ACCESS_TOKEN="<deno-deploy-access-token>" \
PRIMARY_USERNAME="<username whose household owns the catalogue>" \
SEED_PASSWORD="<shared legacy password>" \
deno task db:migrate
```

Locally `getKv()` honors `KV_PATH`; the `https://` value connects to the remote
production KV. A successful run logs `Migration complete … Catalogue: scoped to
household …`; a re-run logs `no global entries to scope (skipped)`.

## Local development

Against the local file KV, `deno task db:migrate` reads `.env`. For a fresh dev
database you normally just reseed instead: `deno task db:seed`.
