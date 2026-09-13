# PWA Foundation Implementation Plan (issue #71)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Happie's install experience correct — an honest manifest
(standalone display, MD3 colors, id, description, complete icons, shortcuts),
platform meta tags, and zero dead service-worker code.

**Architecture:** Pure static/config changes: rewrite
`static/manifest.webmanifest`, adjust the `<Head>` in `routes/_app.tsx`,
delete three unreferenced files. Two new test files pin the manifest's shape
and the head's contents so regressions fail `deno task test`.

**Tech Stack:** Deno + Fresh 2, `jsr:@std/assert@^1.0.19`,
`npm:preact-render-to-string@^6.6.3` (both already used by existing tests).

**Branch note:** This plan lives on `feature/pwa-features-assessment-b33239`
(PR #79, the roadmap). Cut the implementation branch from main once #79 is
merged; if #79 is still open, cut from the assessment branch and mark the PR
stacked on #79. The implementation PR closes #71.

## Global Constraints

- **No caching, no service-worker registration.** This iteration only removes
  dead code. Scope `/` stays owned by `static/push-sw.js` alone (registered on
  demand by `islands/shell/usePushNotifications.ts`). Offline is issue #74.
- **Colors are exact:** `#fdfcf9` everywhere a manifest/meta color appears. It
  is `--md-surface` / `--md-background` (`oklch(99% 0.0034 84.7)` in
  `assets/styles.css`) converted to sRGB hex — manifest colors can't reference
  CSS variables.
- **`name`/`short_name` stay `"Happie Home"`/`"Happie"`** — renaming the
  product is out of scope.
- **Spec deviation (agreed):** the roadmap sketched shortcuts as "Shopping
  list / Add items / To-dos". Add-items is only addressable per list
  (`/shopping/[id]/add`), so a static shortcut can't reach it. Ship
  **Shop → `/shopping`, To-dos → `/todos`, Menu → `/menu`** instead (names
  match `NAV_CONFIG` labels).
- Commits follow Conventional Commits. `deno task check` must pass before
  every commit.
- Tests run with `deno task test` (wraps `deno test --unstable-kv -A`).

---

### Task 1: Manifest — test + rewrite

**Files:**

- Test: `tests/manifest.test.ts` (create)
- Modify: `static/manifest.webmanifest` (full rewrite)

**Interfaces:**

- Consumes: `NAV_CONFIG` from `@/config/navigation.ts`
  (`NavItem[]`, each with `defaultRoute: string`).
- Produces: the manifest shape Task 2's theme-color meta must match
  (`theme_color: "#fdfcf9"`), and the shortcut URLs `/shopping`, `/todos`,
  `/menu`.

- [ ] **Step 1: Write the failing test**

Create `tests/manifest.test.ts`:

```ts
import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { NAV_CONFIG } from "@/config/navigation.ts";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface ManifestShortcut {
  name: string;
  url: string;
  icons?: ManifestIcon[];
}

interface Manifest {
  name: string;
  short_name: string;
  id: string;
  description: string;
  display: string;
  theme_color: string;
  background_color: string;
  scope: string;
  start_url: string;
  icons: ManifestIcon[];
  shortcuts: ManifestShortcut[];
}

const manifest: Manifest = JSON.parse(
  await Deno.readTextFile("static/manifest.webmanifest"),
);

Deno.test("manifest — standalone display (fullscreen hides the status bar)", () => {
  assertEquals(manifest.display, "standalone");
});

Deno.test("manifest — MD3 surface color for theme and splash background", () => {
  assertEquals(manifest.theme_color, "#fdfcf9");
  assertEquals(manifest.background_color, "#fdfcf9");
});

Deno.test("manifest — stable identity and install metadata", () => {
  assertEquals(manifest.id, "/");
  assertEquals(manifest.scope, "/");
  assertEquals(manifest.start_url, "/");
  assert(manifest.description.length > 0, "description missing");
});

Deno.test("manifest — icons cover 192, 512 and maskable, all files exist", async () => {
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert(sizes.includes("192x192"), "192x192 icon missing");
  assert(sizes.includes("512x512"), "512x512 icon missing");
  assert(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    "maskable icon missing",
  );
  const all = [
    ...manifest.icons,
    ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons ?? []),
  ];
  for (const icon of all) {
    const stat = await Deno.stat(`static${icon.src}`);
    assert(stat.isFile, `icon file missing: ${icon.src}`);
  }
});

Deno.test("manifest — every shortcut targets a navigation route", () => {
  assert(manifest.shortcuts.length >= 3, "expected at least 3 shortcuts");
  const routes = NAV_CONFIG.map((item) => item.defaultRoute);
  for (const shortcut of manifest.shortcuts) {
    assert(
      routes.includes(shortcut.url),
      `shortcut "${shortcut.name}" targets unknown route ${shortcut.url}`,
    );
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A tests/manifest.test.ts`

Expected: FAIL — "standalone display" fails (current value `"fullscreen"`),
"MD3 surface color" fails (current `"#000000"`), "stable identity" fails (no
`id`), icons test fails (no 192 entry), shortcuts test fails (no `shortcuts`
key → TypeError on `.flatMap`/`.length` of `undefined` is acceptable as the
failure mode).

- [ ] **Step 3: Rewrite the manifest**

Replace the entire contents of `static/manifest.webmanifest` (keep 4-space
indent, matching the current file):

```json
{
    "name": "Happie Home",
    "short_name": "Happie",
    "id": "/",
    "description": "Your household's shared home for shopping, meals and to-dos — plan together and check things off on the go.",
    "theme_color": "#fdfcf9",
    "background_color": "#fdfcf9",
    "display": "standalone",
    "scope": "/",
    "start_url": "/",
    "orientation": "any",
    "icons": [
        {
            "src": "/web-app-manifest-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/web-app-manifest-512x512.png",
            "sizes": "512x512",
            "type": "image/png"
        },
        {
            "src": "/web-app-manifest-512x512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
        }
    ],
    "shortcuts": [
        {
            "name": "Shop",
            "url": "/shopping",
            "icons": [
                {
                    "src": "/web-app-manifest-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                }
            ]
        },
        {
            "name": "To-dos",
            "url": "/todos",
            "icons": [
                {
                    "src": "/web-app-manifest-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                }
            ]
        },
        {
            "name": "Menu",
            "url": "/menu",
            "icons": [
                {
                    "src": "/web-app-manifest-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                }
            ]
        }
    ]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --unstable-kv -A tests/manifest.test.ts`

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Check and commit**

```bash
deno task check
git add tests/manifest.test.ts static/manifest.webmanifest
git commit -m "feat(pwa): standalone display, MD3 colors, id and shortcuts in manifest"
```

---

### Task 2: App head — remove broken pwa-update, add theme-color + touch icon

**Files:**

- Test: `tests/app-head.test.ts` (create)
- Modify: `routes/_app.tsx`

**Interfaces:**

- Consumes: `App` default export of `routes/_app.tsx`
  (`(props: PageProps<unknown, StateInterface>) => VNode`); the manifest's
  `theme_color` `#fdfcf9` from Task 1.
- Produces: nothing later tasks depend on.

**Background for the implementer:** the `<script type="module">` block in the
head loads PWABuilder's `pwa-update` web component from a CDN. That component
registers `/pwabuilder-sw.js` — a file this app has never had — so its
registration 404s on every page load and the component does nothing. Removing
it is a pure fix. `App` renders fine outside the Fresh runtime (verified):
Fresh 2's `<Head>` degrades to plain rendering, and `AppChrome` is skipped
when `state.userId` is absent — which is what makes the render-to-string test
below possible.

- [ ] **Step 1: Write the failing test**

Create `tests/app-head.test.ts`:

```ts
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import App from "@/routes/_app.tsx";

// Renders the app shell logged-out (no userId → no AppChrome island).
function renderApp(): string {
  const props = {
    Component: () => null,
    state: {},
    url: new URL("http://localhost/shopping"),
  } as unknown as Parameters<typeof App>[0];
  return render(h(App, props));
}

Deno.test("app head — no PWABuilder update loader (its SW registration 404s)", () => {
  const html = renderApp();
  assert(!html.includes("pwaupdate"), "pwa-update script should be gone");
  assert(!html.includes("pwabuilder"), "PWABuilder CDN reference should be gone");
});

Deno.test("app head — theme-color meta matches the manifest color", () => {
  const html = renderApp();
  assertStringIncludes(html, 'name="theme-color"');
  assertStringIncludes(html, "#fdfcf9");
});

Deno.test("app head — apple-touch-icon linked explicitly", () => {
  const html = renderApp();
  assertStringIncludes(html, 'rel="apple-touch-icon"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --unstable-kv -A tests/app-head.test.ts`

Expected: FAIL — all three tests (loader still present, no theme-color meta,
no apple-touch-icon link).

- [ ] **Step 3: Edit `routes/_app.tsx`**

Two edits inside the `<Head>` block.

**Edit A** — after the viewport `<meta>` and before `<title>`, add:

```tsx
        {/* Kept in sync with manifest theme_color and --md-surface (assets/styles.css) */}
        <meta name="theme-color" content="#fdfcf9" />
```

**Edit B** — replace the manifest link + pwa-update script block. Remove:

```tsx
        <script type="module">
          {`import "https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate/dist/pwa-update.js"; const el = document.createElement("pwa-update"); document.body.appendChild(el);`}
        </script>
```

and directly under the existing manifest `<link>`, add:

```tsx
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

The full `<Head>` afterwards:

```tsx
      <Head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        {/* Kept in sync with manifest theme_color and --md-surface (assets/styles.css) */}
        <meta name="theme-color" content="#fdfcf9" />
        <title>Happie</title>
        <link
          crossorigin="use-credentials"
          rel="manifest"
          href="/manifest.webmanifest"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Google Fonts link from Task 0.3 stays here */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --unstable-kv -A tests/app-head.test.ts`

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Check and commit**

```bash
deno task check
git add tests/app-head.test.ts routes/_app.tsx
git commit -m "fix(pwa): drop broken pwa-update loader, add theme-color and touch icon"
```

---

### Task 3: Delete dead service-worker files, update the mobile-testing doc

**Files:**

- Delete: `static/pwa-sw.js`, `static/pwa-sw-register.ts`,
  `static/site.webmanifest`
- Modify: `docs/mobile-testing.md:158-164`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing — pure removal. `static/push-sw.js` MUST remain.

- [ ] **Step 1: Verify the files are unreferenced (guard against drift)**

Run:

```bash
grep -rn "pwa-sw\|site.webmanifest" --include="*.ts" --include="*.tsx" --include="*.json" routes/ islands/ components/ hooks/ utils/ services/ config/ static/ main.ts client.ts vite.config.ts
```

Expected: **only** `islands/shell/usePushNotifications.ts` matching on
`push-sw.js` (the `pwa-sw` pattern matches its `SW_PATH = "/push-sw.js"`
string). No hits for `pwa-sw.js` as a registration target, none for
`site.webmanifest`. If anything else matches, STOP — the codebase has drifted
from this plan; investigate before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm static/pwa-sw.js static/pwa-sw-register.ts static/site.webmanifest
```

- [ ] **Step 3: Update `docs/mobile-testing.md`**

Replace this block (currently at lines ~158-164):

```markdown
Not working yet: **offline, caching and the update prompt.** `static/pwa-sw.js`
and `static/pwa-sw-register.ts` exist but nothing imports them, so no service
worker is registered. `routes/_app.tsx` links the manifest only.

Also note the manifest requests `"display": "fullscreen"`, which iOS does not
implement; it falls back to standalone.
```

with:

```markdown
Not working yet: **offline and caching.** No caching service worker exists —
the only worker is the push-only `static/push-sw.js`, registered on demand
when notifications are enabled. Offline support is roadmapped as issue #74
(see `docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md`).
```

- [ ] **Step 4: Run the full test suite**

Run: `deno task test`

Expected: PASS — all tests, including the two new files from Tasks 1–2.

- [ ] **Step 5: Check and commit**

```bash
deno task check
git add -A
git commit -m "chore(pwa): remove dead service-worker files, update mobile-testing doc"
```

---

### Task 4: End-to-end verification in the browser

**Files:** none (verification only).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Start the dev server and load the app**

Seed an isolated KV, then start the dev server (never via plain Bash — use
the preview tools with a launch.json entry):

```bash
# .env (gitignored): SEED_USERNAME=..., SEED_PASSWORD=..., KV_PATH=data/kv.db
deno task db:seed
```

Launch config for a worktree (the user's own server usually holds 5173):
`runtimeExecutable: "deno"`, `runtimeArgs: ["task", "dev", "--port", "5178"]`,
`port: 5178`. Log in with the seeded credentials (POST `username`/`password`
to `/login`; a reliable path is `curl -i` to grab the `sessionId` cookie, then
set it via `document.cookie` in the tab). Verification needs an authenticated
page because unauthenticated page requests redirect to `/login` — which still
exercises the same `_app.tsx` head, so the login page suffices for Step 3 if
seeding is unavailable.

- [ ] **Step 2: Verify the manifest over HTTP**

Fetch `http://localhost:<port>/manifest.webmanifest` (browser network panel
or `read_network_requests`). Expected: HTTP 200; JSON with
`"display": "standalone"`, `"theme_color": "#fdfcf9"`, three `shortcuts`.

- [ ] **Step 3: Verify the head and the absence of the dead loader**

In the browser console (or `javascript_tool`):

```js
({
  themeColor: document.querySelector('meta[name="theme-color"]')?.content,
  touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href,
  pwaUpdate: document.querySelector("pwa-update") === null,
  regs: (await navigator.serviceWorker.getRegistrations()).map((r) =>
    r.active?.scriptURL
  ),
})
```

Expected: `themeColor: "#fdfcf9"`, `touchIcon` ending in
`/apple-touch-icon.png`, `pwaUpdate: true`, `regs: []` (no service worker —
push registers only when notifications are enabled). Also check the network
log: **no request for `/pwabuilder-sw.js`**, no 404s.

- [ ] **Step 4: Screenshot as proof**

Take a screenshot of the loaded app for the PR/summary.

- [ ] **Step 5: Wrap up the branch**

Use the superpowers:finishing-a-development-branch skill. The PR closes #71:

```bash
gh pr create --title "feat(pwa): correct install foundation — manifest, head, dead SW cleanup" --body "Closes #71. Iteration 1 of the PWA roadmap (docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md)."
```
