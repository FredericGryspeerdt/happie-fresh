# Firebase feasibility spike

THROWAWAY. Answers
[Spike: does the chosen stack pass the prototype's checks?](https://github.com/FredericGryspeerdt/happie-fresh/issues/151)
for the stack chosen in #149/#150: Firebase Hosting rewriting `/api/**` to Hono
on Node 24 / Cloud Run `europe-west1`, with Firestore `(default)` in
`europe-west1`. Ports the checks of `prototypes/cloudflare` (branch
`codex/prototype-cloudflare`). Never merge into main.

## What is probed

| Check | How |
| --- | --- |
| PBKDF2-SHA256 310k | `/api/prototype/login` runs an unchanged copy of `utils/security.ts` (WebCrypto); `login-node` uses `node:crypto` for comparison |
| `__session` through the rewrite | `/api/session/login` sets `__session` **and** `other`; `/api/session/me` reads it via Hosting; `/api/cookies` shows which cookies arrived |
| Firestore transactions | competing moves (one winner), rollback, atomic claim (`create()`), stale renewal must not recreate a deleted doc |
| 5-minute sweep | Cloud Scheduler → `POST /api/sweep` on the run.app URL (header `x-sweep-token`); work completes before the response; one claim per device per five-minute slot |
| Push to a closed app | `public/` is an installable PWA with a push service worker |
| Cold start | `/api/health` reports `cold` on the first request of an instance; smoke measures client time (bar ≈ 2 s) |
| API not cached by CDN | every `/api/*` response sends `Cache-Control: private, no-store` |

The image runs an esbuild bundle (`npm run build`) of our code, Hono and
web-push; firebase-admin stays in `node_modules` and is imported on the first
Firestore call, using the REST transport (`preferRest: true`).

## Local evidence

`results/local-results.json`: health, probe auth, both PBKDF2 paths (right and
wrong password) and push encryption pass on local Node; Firestore, session and
scheduled checks fail locally because there is no emulator (no Java) or
credentials. Firestore is only tested deployed.

## Deployed evidence (2026-10-16 → 2026-10-19)

Project `happie-spike`, Firestore `(default)` and Cloud Run in `europe-west1`,
Hosting at `happie-spike.web.app`. `results/deployed-results.json`: all 12
functional probes pass through the Hosting rewrite, on every revision.

- **PBKDF2-SHA256 310k:** verifies right/wrong passwords in 55–80 ms server-side
  (WebCrypto and `node:crypto` alike).
- **`__session`:** Hosting forwards only `__session` (`other` is stripped); the
  session round trip works; API responses carry `Cache-Control: private,
  no-store`.
- **Firestore:** one winner for competing moves, rollback leaves no partial
  write, `create()` claims are atomic, a stale renewal cannot recreate a
  deleted document. Also passes over the REST transport.
- **Scheduled push:** `results/scheduled-results.json`. The 5-minute Cloud
  Scheduler sweep completes in the request (0.05–0.8 s) and delivered a
  notification to the iOS home-screen PWA with the app swiped closed
  (confirmed by the user, 2026-10-16).
- **Cold start** (`results/cold-*.json`, first request after ≥ 22 min idle, via
  Hosting):

  | Revision | First request | Client time |
  | --- | --- | --- |
  | 1: `.ts` sources, eager firebase-admin | health | 2.40 s |
  | 2: esbuild bundle, lazy firebase-admin | health | 1.11 s |
  | 2 | session lookup (Firestore) | 2.49 s, 2.61 s |
  | 3: as 2 + `preferRest` | session lookup | 2.36 s, 2.89 s |

  Cloud Run logs for a revision 3 cold request: ~0.65 s container start to
  listening, ~1.4 s for the first Firestore call (firebase-admin load, token,
  request), ~0.3 s Hosting/network. The bundle halves module load but moves the
  cost to the first Firestore call; `preferRest` makes no measurable
  difference. The owner **accepted ~2.5 s** for the first request after idle
  (2026-10-19) rather than replace firebase-admin with a hand-written REST
  client; `min-instances` stays 0. With the 5-minute sweep an instance usually
  stays warm between requests.

## Deploy checklist (human)

Run from `prototypes/firebase/`. Use **disposable** credentials only.

1. Install CLIs: `brew install --cask google-cloud-sdk` and
   `npm i -g firebase-tools`; then `gcloud auth login` and `firebase login`.
2. In the Firebase console create a new project (e.g. `happie-spike`), switch it
   to **Blaze**, and in Google Cloud Billing add a **budget alert of €1**.
3. Create Firestore `(default)` database: Native mode, location
   `europe-west1`, production rules (the Admin SDK bypasses rules).
4. Put the project id in `.firebaserc`, then
   `gcloud config set project <id>`.
5. Enable APIs:
   `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com`
6. `npm install && npm run init` (creates ignored `.env.spike` and `env.yaml`).
7. Deploy the API:
   `gcloud run deploy happie-spike --source . --region europe-west1 --allow-unauthenticated --min-instances 0 --cpu-boost --env-vars-file env.yaml`
   (note the run.app URL).
8. Deploy Hosting: `firebase deploy --only hosting` (note the `web.app` URL).
9. Smoke via Hosting:
   `node --env-file=.env.spike src/smoke.ts https://<id>.web.app`
   → `results/deployed-results.json`.
10. Scheduler:
    `gcloud scheduler jobs create http happie-spike-sweep --location europe-west1 --schedule "*/5 * * * *" --uri https://<run-url>/api/sweep --http-method POST --headers x-sweep-token=<SWEEP_TOKEN from .env.spike>`
11. Push: on iPhone/iPad open the `web.app` URL in Safari, add to home screen,
    open the installed app, paste the token, **Enrol**, **Send a test push**.
    Close the app; within 5 minutes a scheduled notification should arrive.
    **Show scheduled runs** lists the sweep outcomes.
12. Cold start: **pause the scheduler** (it keeps the instance warm),
    `gcloud scheduler jobs pause happie-spike-sweep --location europe-west1`,
    wait ≥ 20 minutes, then
    `node --env-file=.env.spike src/smoke.ts https://<id>.web.app --cold`.
    Repeat 3×, then `gcloud scheduler jobs resume …`.
13. Free tier: after ≥ 24 h with the sweep running, read Billing → Reports
    (filter the project) and Cloud Run → Metrics (billable instance time,
    requests). Note Firestore reads/writes per day against the 50k/20k free
    quota.

## Cleanup

Delete the installed PWA on the device, then
`gcloud scheduler jobs delete happie-spike-sweep --location europe-west1`,
`gcloud run services delete happie-spike --region europe-west1`, and finally
shut down the whole project in the console (removes Firestore, Hosting and
the Artifact Registry image).
