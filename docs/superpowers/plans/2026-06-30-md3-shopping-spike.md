# MD3 Foundation + Shopping Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Happie's existing Shopping feature (Lists overview + List detail) on a reusable Material Design 3 design-system foundation, visually faithful to the prototype, with no change to the data layer or REST API.

**Architecture:** A baked MD3 token layer in `assets/styles.css` (CSS variables from the amber seed `#FFC21E`, surfaced to Tailwind v4 via `@theme`); a scoped library of ~15 MD3 primitive components in `components/md3/` (ordinary Preact components — ripple/press behavior activates when hydrated inside an island, CSS state layer works in pure SSR); an MD3 app shell (TopAppBar, NavigationBar, Fab) wired into `routes/_app.tsx`; and the two existing shopping islands (`islands/shopping-lists.tsx`, `islands/items.tsx`) restyled to compose those primitives while reusing `useShoppingList` unchanged.

**Tech Stack:** Deno + Fresh 2 (`jsr:@fresh/core@^2.2.0`) + Preact 10 + `@preact/signals@^2.5.0` + Deno KV + Tailwind CSS v4 (`npm:tailwindcss@^4.1.10`, `@tailwindcss/vite`). Tests: `preact-render-to-string@^6.6.3` + `jsr:@std/assert@^1.0.19`, run with `deno test`.

## Global Constraints

- **No data-model or API changes.** Do not modify `models/`, `database/`, or `routes/api/`. Both screens use `hooks/useShoppingList.ts` and `services/api.ts` exactly as they exist today.
- **Assignees/members are deferred.** No avatars, no Assign sheet, no "needs an owner" nudge anywhere. When porting prototype code that references `it.assignee` / `l.people` / `AvatarStack` / `Avatar`, **omit those elements**.
- **Catalogue & Categories management screens are out of scope.** Do not touch `islands/item-catalog.tsx`, `islands/category-management.tsx`, `islands/search-box.tsx`, or `routes/shopping/catalogue/**`, `routes/shopping/categories/**`.
- **Styling = Tailwind utility classes in `class`** (Preact `jsx: "precompile"` — always `class`, never `className`). Use inline `style` only for genuinely dynamic/custom values (progress width %, ripple coordinates, sheet transform).
- **Signals in islands:** local island state uses `useSignal()`; `useShoppingList` must keep being called via `useMemo(() => useShoppingList(...), [])` (it uses module-scope `signal()` internally and must initialize once).
- **Imports:** use the `@/` alias (e.g. `@/components/md3/Button.tsx`).
- **Commits:** Conventional Commits. Each task ends with a commit. Co-author trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Color space:** OKLCH (modern-browser target; no fallback).
- **Prototype source of truth** (read-only reference, already in repo): `docs/happie/project/md3-ui.jsx` (primitives), `md3-nav.jsx` (shell), `md3-screens.jsx` (screens/sheets), `md3-tokens.jsx` (tokens), and `mocks/0{1-9}-*.png`. Recreate the **visual output**, not the prototype's React structure or its inline-style approach.

---

## File Structure

**Create:**
- `scripts/gen-md3-theme.ts` — one-off: prints the baked `:root` CSS-var block for a seed.
- `components/md3/tokens.ts` — shared TS constants (MD3 type-role class names, member-free helpers) + the `cn()` class-join helper.
- `components/md3/Icon.tsx`, `Pressable.tsx`, `Card.tsx`, `Button.tsx`, `IconButton.tsx`, `Chip.tsx`, `ListItem.tsx`, `Progress.tsx`, `SearchBar.tsx`, `Segmented.tsx`, `RoundCheck.tsx`, `Stepper.tsx`, `Sheet.tsx`, `Snackbar.tsx` — the primitive library.
- `components/md3/*.test.tsx` — render-to-string tests for the SSR-testable primitives.
- `islands/shell/NavigationBar.tsx`, `islands/shell/TopAppBar.tsx`, `islands/shell/Fab.tsx` — app shell islands.
- `components/md3/ComingSoon.tsx` — placeholder screen body.
- `routes/home/index.tsx`, `routes/todos/index.tsx`, `routes/menu/index.tsx` — placeholder routes.
- `islands/shell/MoreSheet.tsx` — household/More bottom sheet (opened from the More tab).

**Modify:**
- `assets/styles.css` — token layer, fonts, type/state/ripple utilities, `@theme` mapping.
- `routes/_app.tsx` — swap `AppBar`/`TabBar` for the MD3 shell.
- `config/navigation.ts` — 5-tab nav config with MD3 icon names.
- `routes/_app.tsx` head — add Google Fonts link.
- `islands/shopping-lists.tsx` — MD3 Lists overview.
- `islands/items.tsx` — MD3 List detail (Plan/Shop) + sheets.
- `routes/shopping/index.tsx` — title moves into shell; pass through.
- `routes/shopping/[id]/index.tsx` — already sets `state.appBar`; keep.

**Delete (Phase 6, once unused):**
- `islands/AppBar.tsx`, `islands/AppBar.test.tsx`, `components/TabBar.tsx`.
- `components/shopping-list-item.tsx`, `components/done-list-item.tsx`, `components/quantity-stepper.tsx` (replaced by MD3 rows + `Stepper`), and `components/BottomSheet.tsx` if no longer imported.

---

## Phase 0 — Branch & token foundation

### Task 0.1: Create the feature branch

- [ ] **Step 1: Branch off the current HEAD** (the spec commit already lives on `feat/md3-shopping-spike`; confirm you're on it)

Run: `git checkout feat/md3-shopping-spike 2>/dev/null || git checkout -b feat/md3-shopping-spike`
Expected: `Switched to ... 'feat/md3-shopping-spike'`

- [ ] **Step 2: Confirm baseline is green**

Run: `deno task check`
Expected: exits 0 (fmt/lint/type clean).

### Task 0.2: Generate the baked MD3 palette

**Files:**
- Create: `scripts/gen-md3-theme.ts`

**Interfaces:**
- Produces: a CSS `:root { --md-*: …; }` block printed to stdout, pasted into `assets/styles.css` in Task 0.3. Token names exactly match `schemeToVars()` in `docs/happie/project/md3-tokens.jsx:107-145`.

- [ ] **Step 1: Write the generator** (direct TS port of `hexToOklch`/`buildScheme`/`schemeToVars` from `md3-tokens.jsx:6-145`)

```ts
// scripts/gen-md3-theme.ts
// One-off: prints the baked MD3 :root CSS-var block for a seed hex.
// Usage: deno run scripts/gen-md3-theme.ts "#FFC21E"
function hexToOklch(hex: string) {
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16) / 255;
  let g = parseInt(h.slice(2, 4), 16) / 255;
  let b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  r = lin(r); g = lin(g); b = lin(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { C, H };
}
function buildScheme(seedHex: string) {
  const seed = hexToOklch(seedHex);
  const Hp = seed.H;
  const Ht = (Hp + 50) % 360;
  const Cp = Math.min(Math.max(seed.C, 0.10), 0.16);
  const Cs = 0.045, Ct = 0.085, Cn = 0.006, Cnv = 0.018;
  const damp = (t: number) => 1 - Math.pow(Math.abs(t - 50) / 50, 1.6) * 0.45;
  const T = (t: number, c: number, hue: number) => `oklch(${t}% ${(c * damp(t)).toFixed(4)} ${hue.toFixed(1)})`;
  const P = (t: number) => T(t, Cp, Hp), Sc = (t: number) => T(t, Cs, Hp),
    Tc = (t: number) => T(t, Ct, Ht), N = (t: number) => T(t, Cn, Hp), NV = (t: number) => T(t, Cnv, Hp);
  return {
    primary: P(46), onPrimary: "#ffffff", primaryContainer: P(90), onPrimaryContainer: P(26), primaryFixedDim: P(82),
    secondary: Sc(46), onSecondary: "#ffffff", secondaryContainer: Sc(91), onSecondaryContainer: Sc(26),
    tertiary: Tc(46), onTertiary: "#ffffff", tertiaryContainer: Tc(90), onTertiaryContainer: Tc(26),
    error: "oklch(50% 0.18 27)", onError: "#ffffff", errorContainer: "oklch(92% 0.05 25)", onErrorContainer: "oklch(30% 0.12 27)",
    success: T(52, 0.12, 150), successContainer: T(92, 0.05, 150), onSuccessContainer: T(28, 0.09, 150),
    background: N(99), surface: N(99), surfaceDim: N(89), surfaceBright: N(99),
    surfaceContainerLowest: "#ffffff", surfaceContainerLow: N(97), surfaceContainer: N(95),
    surfaceContainerHigh: N(93), surfaceContainerHighest: N(91),
    onSurface: N(17), onSurfaceVariant: NV(38), outline: NV(52), outlineVariant: NV(83),
    inverseSurface: N(24), inverseOnSurface: N(95), inversePrimary: P(80),
  };
}
const map: Record<string, string> = {
  "--md-primary": "primary", "--md-on-primary": "onPrimary", "--md-primary-container": "primaryContainer",
  "--md-on-primary-container": "onPrimaryContainer", "--md-secondary": "secondary", "--md-on-secondary": "onSecondary",
  "--md-secondary-container": "secondaryContainer", "--md-on-secondary-container": "onSecondaryContainer",
  "--md-tertiary": "tertiary", "--md-on-tertiary": "onTertiary", "--md-tertiary-container": "tertiaryContainer",
  "--md-on-tertiary-container": "onTertiaryContainer", "--md-error": "error", "--md-on-error": "onError",
  "--md-error-container": "errorContainer", "--md-on-error-container": "onErrorContainer", "--md-success": "success",
  "--md-success-container": "successContainer", "--md-on-success-container": "onSuccessContainer",
  "--md-background": "background", "--md-surface": "surface", "--md-surface-dim": "surfaceDim",
  "--md-surface-bright": "surfaceBright", "--md-surface-clow": "surfaceContainerLow", "--md-surface-clowest": "surfaceContainerLowest",
  "--md-surface-c": "surfaceContainer", "--md-surface-chigh": "surfaceContainerHigh", "--md-surface-chighest": "surfaceContainerHighest",
  "--md-on-surface": "onSurface", "--md-on-surface-variant": "onSurfaceVariant", "--md-outline": "outline",
  "--md-outline-variant": "outlineVariant", "--md-inverse-surface": "inverseSurface", "--md-inverse-on-surface": "inverseOnSurface",
  "--md-inverse-primary": "inversePrimary",
};
const seed = Deno.args[0] ?? "#FFC21E";
const s = buildScheme(seed) as Record<string, string>;
const lines = Object.entries(map).map(([cssVar, key]) => `  ${cssVar}: ${s[key]};`);
console.log(`/* MD3 scheme baked from seed ${seed} — regenerate with scripts/gen-md3-theme.ts */\n:root {\n${lines.join("\n")}\n}`);
```

- [ ] **Step 2: Run it and capture output**

Run: `deno run scripts/gen-md3-theme.ts "#FFC21E"`
Expected: prints `:root { --md-primary: oklch(46% … ); … }` (≈35 vars). Keep this output for Task 0.3.

- [ ] **Step 3: Commit**

```bash
git add scripts/gen-md3-theme.ts
git commit -m "feat(md3): add baked-theme generator script

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 0.3: Write the token layer in styles.css

**Files:**
- Modify: `assets/styles.css`

**Interfaces:**
- Produces: `--md-*` CSS vars; Tailwind color utilities (`bg-primary`, `text-on-surface`, `border-outline-variant`, `bg-surface-container-high`, …) via `@theme`; shape vars `--md-shape-*`; motion vars `--md-emphasized*`; type-role classes (`md-title-medium`, …); brand class `md-brand`; `.md-press`/`.md-state`/`.md-rip` + `@keyframes md-ripple`; `.md-elevation-1/2`.

- [ ] **Step 1: Replace the contents of `assets/styles.css`** (paste the Task 0.2 `:root{…}` block where indicated)

```css
@import "tailwindcss";

/* ---- PASTE the :root{…} block printed by scripts/gen-md3-theme.ts "#FFC21E" HERE ---- */
/* (≈35 --md-* OKLCH variables) */

:root {
  /* shape scale */
  --md-shape-xs: 4px; --md-shape-sm: 8px; --md-shape-md: 12px;
  --md-shape-lg: 16px; --md-shape-xl: 28px; --md-shape-full: 999px;
  /* motion */
  --md-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-emphasized-decel: cubic-bezier(0.05, 0.7, 0.1, 1);
  --md-emphasized-accel: cubic-bezier(0.3, 0, 0.8, 0.15);
  --md-spring: cubic-bezier(0.2, 0.9, 0.25, 1.2);
}

/* Surface MD3 tokens to Tailwind v4 as color utilities */
@theme {
  --color-primary: var(--md-primary);
  --color-on-primary: var(--md-on-primary);
  --color-primary-container: var(--md-primary-container);
  --color-on-primary-container: var(--md-on-primary-container);
  --color-secondary: var(--md-secondary);
  --color-on-secondary: var(--md-on-secondary);
  --color-secondary-container: var(--md-secondary-container);
  --color-on-secondary-container: var(--md-on-secondary-container);
  --color-tertiary: var(--md-tertiary);
  --color-on-tertiary: var(--md-on-tertiary);
  --color-tertiary-container: var(--md-tertiary-container);
  --color-on-tertiary-container: var(--md-on-tertiary-container);
  --color-error: var(--md-error);
  --color-on-error: var(--md-on-error);
  --color-error-container: var(--md-error-container);
  --color-on-error-container: var(--md-on-error-container);
  --color-background: var(--md-background);
  --color-surface: var(--md-surface);
  --color-surface-dim: var(--md-surface-dim);
  --color-surface-clowest: var(--md-surface-clowest);
  --color-surface-clow: var(--md-surface-clow);
  --color-surface-c: var(--md-surface-c);
  --color-surface-chigh: var(--md-surface-chigh);
  --color-surface-chighest: var(--md-surface-chighest);
  --color-on-surface: var(--md-on-surface);
  --color-on-surface-variant: var(--md-on-surface-variant);
  --color-outline: var(--md-outline);
  --color-outline-variant: var(--md-outline-variant);
  --color-inverse-surface: var(--md-inverse-surface);
  --color-inverse-on-surface: var(--md-inverse-on-surface);
  --color-inverse-primary: var(--md-inverse-primary);
}

/* MD3 type scale (md3-tokens.jsx:149-167) */
.md-display-large  { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:44px; line-height:52px; font-weight:400; letter-spacing:-0.25px; }
.md-headline-large { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:30px; line-height:38px; font-weight:400; }
.md-headline-small { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:23px; line-height:30px; font-weight:400; }
.md-title-large    { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:21px; line-height:28px; font-weight:400; }
.md-title-medium   { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:16px; line-height:24px; font-weight:500; letter-spacing:0.15px; }
.md-title-small    { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:14px; line-height:20px; font-weight:500; letter-spacing:0.1px; }
.md-body-large     { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:16px; line-height:24px; font-weight:400; letter-spacing:0.15px; }
.md-body-medium    { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:14px; line-height:20px; font-weight:400; letter-spacing:0.2px; }
.md-body-small     { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:12px; line-height:16px; font-weight:400; letter-spacing:0.3px; }
.md-label-large    { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:14px; line-height:20px; font-weight:500; letter-spacing:0.1px; }
.md-label-medium   { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:12px; line-height:16px; font-weight:500; letter-spacing:0.5px; }
.md-label-small    { font-family:'Roboto Flex',Roboto,system-ui,sans-serif; font-size:11px; line-height:16px; font-weight:500; letter-spacing:0.5px; }
.md-brand          { font-family:'Baloo 2',system-ui; font-weight:700; }

/* state layer + ripple (md3-ui.jsx:8-16) */
@keyframes md-ripple { from { transform: scale(0); opacity:.30 } to { transform: scale(2.4); opacity:0 } }
.md-press { position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; user-select:none; touch-action:manipulation; }
.md-state { position:absolute; inset:0; opacity:0; transition:opacity .11s linear; pointer-events:none; border-radius:inherit; background:currentColor; }
@media (hover:hover){ .md-press:hover > .md-state { opacity:.08 } }
.md-press:active > .md-state { opacity:.10 }
.md-rip { position:absolute; border-radius:50%; pointer-events:none; background:currentColor; opacity:.22; animation: md-ripple .5s cubic-bezier(0.2,0,0,1) forwards; }

/* MD3 elevation */
.md-elevation-1 { box-shadow: 0 1px 3px rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.04); }
.md-elevation-3 { box-shadow: 0 3px 5px rgba(0,0,0,.2), 0 1px 18px rgba(0,0,0,.08); }

body { background: var(--md-background); color: var(--md-on-surface); }
* { box-sizing: border-box; }
::-webkit-scrollbar { width:0; height:0; }
```

(Delete the old `.fresh-gradient` rule.)

- [ ] **Step 2: Add the font link to `routes/_app.tsx`** — inside `<Head>`, after the `<title>`:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
<link
  href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700&family=Roboto:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 3: Type-check**

Run: `deno check assets/styles.css routes/_app.tsx` (CSS isn't type-checked; this verifies `_app.tsx` still compiles)
Expected: exits 0.

- [ ] **Step 4: Smoke-test the dev server renders with tokens** — use the preview workflow (preview_start, then preview_snapshot of `/login`) to confirm no build error and fonts load. (No assertion beyond "page renders, no console error".)

- [ ] **Step 5: Commit**

```bash
git add assets/styles.css routes/_app.tsx
git commit -m "feat(md3): add baked token layer, type scale, state-layer/ripple css

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 1 — Core primitive library (`components/md3/`)

> Translation rule for every primitive: open the referenced prototype component, reproduce its **visual output** using the Tailwind token utilities + `md-*` type classes from Phase 0. Replace the prototype's `useMd3()` scheme reads (`s.primary`, etc.) with the matching utility (`bg-primary`/`text-primary`/…). Replace `cr(n)` (corner radius) with the fixed `rounded-[var(--md-shape-*)]`. Use inline `style` only for dynamic values. **Omit all `Avatar`/`AvatarStack` usages.**

### Task 1.1: `tokens.ts` helper + `Icon`

**Files:**
- Create: `components/md3/tokens.ts`, `components/md3/Icon.tsx`, `components/md3/Icon.test.tsx`

**Interfaces:**
- Produces: `cn(...classes: (string | false | undefined)[]): string` (class-join). `IconName` union + `Icon` component: `{ name: IconName; size?: number; stroke?: number; class?: string }`.

- [ ] **Step 1: Write `tokens.ts`**

```ts
// components/md3/tokens.ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: Write the failing test** (`Icon.test.tsx`)

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Icon } from "./Icon.tsx";

Deno.test("Icon — renders an svg of the requested size", () => {
  const html = render(h(Icon, { name: "cart", size: 20 }));
  assertStringIncludes(html, "<svg");
  assertStringIncludes(html, 'width="20"');
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `deno test components/md3/Icon.test.tsx`
Expected: FAIL (`Icon` not found / module missing).

- [ ] **Step 4: Implement `Icon.tsx`** — port the 27-icon `paths` map and `<svg>` wrapper verbatim from `docs/happie/project/md3-ui.jsx:65-102`, converting `strokeWidth`→`stroke-width`, `strokeLinecap`→`stroke-linecap`, `strokeLinejoin`→`stroke-linejoin`, `fill`/`stroke` stay. Signature:

```tsx
// components/md3/Icon.tsx
export type IconName =
  | "home" | "cart" | "check" | "checklist" | "plate" | "card" | "plus" | "minus"
  | "bell" | "chevron" | "back" | "search" | "dots" | "tune" | "people" | "bolt"
  | "sparkle" | "edit" | "user" | "swap" | "cog" | "x" | "trash" | "share"
  | "calendar" | "leaf" | "flame" | "tag";

interface IconProps { name: IconName; size?: number; stroke?: number; class?: string; }

export function Icon({ name, size = 24, stroke = 2, class: cls }: IconProps) {
  const p = { fill: "none", stroke: "currentColor", "stroke-width": stroke, "stroke-linecap": "round", "stroke-linejoin": "round" } as const;
  const paths: Record<IconName, preact.JSX.Element> = {
    // ... paste each entry from md3-ui.jsx:68-95, e.g.:
    // cart: (<><circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" /><path d="M3 4h2.2l2 11.5h11l1.8-8H6.4" {...p} /></>),
  } as Record<IconName, preact.JSX.Element>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" class={cls} style={{ display: "block" }}>
      {paths[name] ?? null}
    </svg>
  );
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `deno test components/md3/Icon.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/md3/tokens.ts components/md3/Icon.tsx components/md3/Icon.test.tsx
git commit -m "feat(md3): add cn helper and Icon component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.2: `Pressable` (state layer + ripple)

**Files:**
- Create: `components/md3/Pressable.tsx`, `components/md3/Pressable.test.tsx`

**Interfaces:**
- Consumes: `cn` from `tokens.ts`.
- Produces: `Pressable` — `{ as?: keyof JSX.IntrinsicElements; color?: string; onClick?; class?: string; style?; disabled?: boolean; stop?: boolean; children; ...rest }`. Renders a `.md-press` element containing a `<span class="md-state">` and ripple spans. `useRipple()` exported for reuse.

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Pressable } from "./Pressable.tsx";

Deno.test("Pressable — renders md-press host and a state-layer span", () => {
  const html = render(h(Pressable, { class: "x" }, "Tap"));
  assertStringIncludes(html, "md-press");
  assertStringIncludes(html, "md-state");
  assertStringIncludes(html, "Tap");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test components/md3/Pressable.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — port `useRipple` + `Pressable` from `docs/happie/project/md3-ui.jsx:24-62`, but use a `useSignal<Ripple[]>` and `class` props. (Use `Math.random()` for ripple ids — runs only client-side on real taps, never in SSR/tests.)

```tsx
// components/md3/Pressable.tsx
import { useSignal } from "@preact/signals";
import type { ComponentChildren, JSX } from "preact";
import { cn } from "./tokens.ts";

interface Ripple { id: number; cx: number; cy: number; size: number; }

export function useRipple() {
  const rips = useSignal<Ripple[]>([]);
  const add = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    const host = e.currentTarget;
    const b = host.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    const cx = (e.clientX ?? b.left + b.width / 2) - b.left;
    const cy = (e.clientY ?? b.top + b.height / 2) - b.top;
    const id = Math.random();
    rips.value = [...rips.value, { id, cx, cy, size }];
    setTimeout(() => { rips.value = rips.value.filter((p) => p.id !== id); }, 520);
  };
  return { rips, add };
}

interface PressableProps {
  as?: keyof JSX.IntrinsicElements;
  color?: string;          // ripple/state-layer tint (CSS color), default currentColor
  onClick?: (e: Event) => void;
  class?: string;
  style?: JSX.CSSProperties;
  disabled?: boolean;
  stop?: boolean;          // stopPropagation on click
  type?: string;
  "aria-label"?: string;
  children?: ComponentChildren;
}

export function Pressable(
  { as = "button", color, onClick, class: cls, style, disabled, stop, children, ...rest }: PressableProps,
) {
  const { rips, add } = useRipple();
  const Tag = as as any;
  return (
    <Tag
      class={cn("md-press", cls)}
      disabled={as === "button" ? disabled : undefined}
      type={as === "button" ? (rest.type ?? "button") : undefined}
      onPointerDown={disabled ? undefined : add}
      onClick={disabled ? undefined : (e: Event) => { if (stop) e.stopPropagation(); onClick?.(e); }}
      style={{ border: "none", background: "transparent", font: "inherit", cursor: disabled ? "default" : "pointer", padding: 0, color: "inherit", ...style }}
      {...rest}
    >
      <span class="md-state" style={color ? { color } : undefined} />
      {rips.value.map((r) => (
        <span key={r.id} class="md-rip" style={{ left: r.cx - r.size, top: r.cy - r.size, width: r.size * 2, height: r.size * 2, color }} />
      ))}
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Run the test, expect pass.** Run: `deno test components/md3/Pressable.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add components/md3/Pressable.tsx components/md3/Pressable.test.tsx
git commit -m "feat(md3): add Pressable with state layer and ripple

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.3: `Button` + `IconButton`

**Files:**
- Create: `components/md3/Button.tsx`, `components/md3/IconButton.tsx`, `components/md3/Button.test.tsx`

**Interfaces:**
- Consumes: `Pressable`, `Icon` (+ `IconName`), `cn`.
- Produces:
  - `Button` — `{ variant?: "filled"|"tonal"|"elevated"|"outlined"|"text"; icon?: IconName; full?: boolean; onClick?; disabled?; class?; style?; children }`.
  - `IconButton` — `{ name: IconName; variant?: "standard"|"filled"|"tonal"|"outlined"; onClick?; size?: number; iconSize?: number; "aria-label": string; class?; style? }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Button } from "./Button.tsx";

Deno.test("Button — filled variant uses primary background utility", () => {
  const html = render(h(Button, { variant: "filled" }, "Save"));
  assertStringIncludes(html, "bg-primary");
  assertStringIncludes(html, "Save");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test components/md3/Button.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Button.tsx`** (variant map from `md3-ui.jsx:125-147`; pill height 40, label-large)

```tsx
// components/md3/Button.tsx
import type { ComponentChildren, JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text";
const VARIANT: Record<Variant, string> = {
  filled: "bg-primary text-on-primary",
  tonal: "bg-secondary-container text-on-secondary-container",
  elevated: "bg-surface-clow text-primary md-elevation-1",
  outlined: "bg-transparent text-primary border border-outline-variant",
  text: "bg-transparent text-primary",
};

interface ButtonProps {
  variant?: Variant; icon?: IconName; full?: boolean;
  onClick?: (e: Event) => void; disabled?: boolean; class?: string; style?: JSX.CSSProperties;
  children?: ComponentChildren;
}

export function Button({ variant = "filled", icon, full, onClick, disabled, class: cls, style, children }: ButtonProps) {
  return (
    <Pressable
      onClick={onClick}
      disabled={disabled}
      class={cn(
        "md-label-large inline-flex items-center justify-center gap-2 h-10 rounded-[var(--md-shape-full)] whitespace-nowrap",
        icon ? "pl-4 pr-[22px]" : "px-6",
        full ? "w-full" : "w-auto",
        disabled ? "bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]" : VARIANT[variant],
        cls,
      )}
      style={style}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Pressable>
  );
}
```

- [ ] **Step 4: Implement `IconButton.tsx`** (variant map from `md3-ui.jsx:149-166`)

```tsx
// components/md3/IconButton.tsx
import type { JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

type Variant = "standard" | "filled" | "tonal" | "outlined";
const VARIANT: Record<Variant, string> = {
  standard: "bg-transparent text-on-surface-variant",
  filled: "bg-primary text-on-primary",
  tonal: "bg-secondary-container text-on-secondary-container",
  outlined: "bg-transparent text-on-surface-variant border border-outline-variant",
};

interface IconButtonProps {
  name: IconName; variant?: Variant; onClick?: (e: Event) => void;
  size?: number; iconSize?: number; "aria-label": string; class?: string; style?: JSX.CSSProperties;
}

export function IconButton({ name, variant = "standard", onClick, size = 40, iconSize = 22, class: cls, style, ...rest }: IconButtonProps) {
  return (
    <Pressable onClick={onClick} class={cn("grid place-items-center rounded-[var(--md-shape-full)] shrink-0", VARIANT[variant], cls)}
      style={{ width: size, height: size, ...style }} aria-label={rest["aria-label"]}>
      <Icon name={name} size={iconSize} />
    </Pressable>
  );
}
```

- [ ] **Step 5: Run the test, expect pass.** Run: `deno test components/md3/Button.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add components/md3/Button.tsx components/md3/IconButton.tsx components/md3/Button.test.tsx
git commit -m "feat(md3): add Button and IconButton

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.4: `Card`, `Chip`, `ListItem`

**Files:**
- Create: `components/md3/Card.tsx`, `components/md3/Chip.tsx`, `components/md3/ListItem.tsx`, `components/md3/Card.test.tsx`

**Interfaces:**
- Consumes: `Pressable`, `Icon`, `cn`.
- Produces:
  - `Card` — `{ variant?: "filled"|"elevated"|"outlined"; onClick?; pad?: number; radius?: number; class?; style?; children }`. Default radius var `--md-shape-md` (12). filled→`bg-surface-chigh`, elevated→`bg-surface-clow md-elevation-1`, outlined→`bg-surface border border-outline-variant`.
  - `Chip` — `{ selected?: boolean; onClick?; leadingCheck?: boolean; icon?: IconName; class?; children }` (from `md3-ui.jsx:190-205`).
  - `ListItem` — `{ leading?; headline; supporting?; trailing?; onClick?; class? }` (from `md3-ui.jsx:208-222`).

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Card } from "./Card.tsx";
import { Chip } from "./Chip.tsx";

Deno.test("Card — filled variant uses surface-container-high", () => {
  assertStringIncludes(render(h(Card, {}, "x")), "bg-surface-chigh");
});
Deno.test("Chip — selected chip uses secondary-container and renders check", () => {
  const html = render(h(Chip, { selected: true }, "Produce"));
  assertStringIncludes(html, "bg-secondary-container");
  assertStringIncludes(html, "<svg");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test components/md3/Card.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Card.tsx`**

```tsx
// components/md3/Card.tsx
import type { ComponentChildren, JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { cn } from "./tokens.ts";

type Variant = "filled" | "elevated" | "outlined";
const VARIANT: Record<Variant, string> = {
  filled: "bg-surface-chigh",
  elevated: "bg-surface-clow md-elevation-1",
  outlined: "bg-surface border border-outline-variant",
};

interface CardProps {
  variant?: Variant; onClick?: (e: Event) => void; pad?: number; radius?: number;
  class?: string; style?: JSX.CSSProperties; children?: ComponentChildren;
}

export function Card({ variant = "filled", onClick, pad = 16, radius = 12, class: cls, style, children }: CardProps) {
  const base = cn("text-on-surface", VARIANT[variant], cls);
  const styleAll = { borderRadius: radius, ...style };
  if (onClick) {
    return (
      <Pressable as="div" onClick={onClick} class={cn("block w-full text-left", base)} style={styleAll}>
        <div style={{ padding: pad, position: "relative" }}>{children}</div>
      </Pressable>
    );
  }
  return <div class={base} style={styleAll}><div style={{ padding: pad, position: "relative" }}>{children}</div></div>;
}
```

- [ ] **Step 4: Implement `Chip.tsx`** (port `md3-ui.jsx:190-205`; selected→`bg-secondary-container text-on-secondary-container` + leading check; else→`border border-outline-variant text-on-surface-variant`)

```tsx
// components/md3/Chip.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

interface ChipProps {
  selected?: boolean; onClick?: (e: Event) => void; leadingCheck?: boolean; icon?: IconName;
  class?: string; children?: ComponentChildren;
}

export function Chip({ selected = false, onClick, leadingCheck = true, icon, class: cls, children }: ChipProps) {
  return (
    <Pressable onClick={onClick}
      class={cn(
        "md-label-large inline-flex items-center gap-1.5 h-8 rounded-[var(--md-shape-sm)] whitespace-nowrap shrink-0",
        selected && leadingCheck ? "pl-2 pr-3.5" : "px-3.5",
        selected ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant border border-outline-variant",
        cls,
      )}>
      {selected && leadingCheck && <Icon name="check" size={16} stroke={2.4} />}
      {icon && !selected && <Icon name={icon} size={16} />}
      {children}
    </Pressable>
  );
}
```

- [ ] **Step 5: Implement `ListItem.tsx`** (port `md3-ui.jsx:208-222`)

```tsx
// components/md3/ListItem.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { cn } from "./tokens.ts";

interface ListItemProps {
  leading?: ComponentChildren; headline: ComponentChildren; supporting?: ComponentChildren;
  trailing?: ComponentChildren; onClick?: (e: Event) => void; class?: string;
}

export function ListItem({ leading, headline, supporting, trailing, onClick, class: cls }: ListItemProps) {
  const body = (
    <div class="flex items-center gap-4 px-4 py-2.5 min-h-14 relative">
      {leading && <div class="shrink-0 grid place-items-center text-on-surface-variant">{leading}</div>}
      <div class="flex-1 min-w-0">
        <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">{headline}</div>
        {supporting && <div class="md-body-medium text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">{supporting}</div>}
      </div>
      {trailing && <div class="shrink-0 text-on-surface-variant">{trailing}</div>}
    </div>
  );
  if (onClick) return <Pressable as="div" onClick={onClick} class={cn("block w-full text-left text-on-surface", cls)}>{body}</Pressable>;
  return <div class={cls}>{body}</div>;
}
```

- [ ] **Step 6: Run the test, expect pass.** Run: `deno test components/md3/Card.test.tsx` → PASS.

- [ ] **Step 7: Commit**

```bash
git add components/md3/Card.tsx components/md3/Chip.tsx components/md3/ListItem.tsx components/md3/Card.test.tsx
git commit -m "feat(md3): add Card, Chip, ListItem

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.5: `Progress`, `RoundCheck`, `Stepper`, `SearchBar`

**Files:**
- Create: `components/md3/Progress.tsx`, `components/md3/RoundCheck.tsx`, `components/md3/Stepper.tsx`, `components/md3/SearchBar.tsx`, `components/md3/Progress.test.tsx`

**Interfaces:**
- Consumes: `Pressable`, `Icon`, `cn`.
- Produces:
  - `Progress` — `{ value: number; total: number; height?: number }` (from `md3-ui.jsx:270-282`).
  - `RoundCheck` — `{ checked: boolean }` (from `md3-screens.jsx:34-43`).
  - `Stepper` — `{ value: number; onChange: (v: number) => void; min?: number }` (from `md3-screens.jsx:18-32`; default min 1; buttons `stopPropagation`).
  - `SearchBar` — `{ placeholder: string; onClick?: (e: Event) => void; trailing?: ComponentChildren }` (from `md3-ui.jsx:285-297`).

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Progress } from "./Progress.tsx";
import { RoundCheck } from "./RoundCheck.tsx";

Deno.test("Progress — fills to the correct percentage width", () => {
  assertStringIncludes(render(h(Progress, { value: 3, total: 9 })), "33%");
});
Deno.test("RoundCheck — shows a check glyph only when checked", () => {
  assertStringIncludes(render(h(RoundCheck, { checked: true })), "<svg");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test components/md3/Progress.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Progress.tsx`**

```tsx
// components/md3/Progress.tsx
interface ProgressProps { value: number; total: number; height?: number; }
export function Progress({ value, total, height = 4 }: ProgressProps) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div class="flex items-center gap-1" style={{ height }}>
      <div class="bg-primary rounded-[var(--md-shape-full)]" style={{ width: `${pct}%`, height, transition: "width .45s var(--md-emphasized)" }} />
      {pct < 100 && (
        <>
          <span class="bg-primary rounded-[var(--md-shape-full)] shrink-0" style={{ width: 4, height }} />
          <div class="flex-1 bg-primary-container rounded-[var(--md-shape-full)]" style={{ height }} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `RoundCheck.tsx`**

```tsx
// components/md3/RoundCheck.tsx
import { Icon } from "./Icon.tsx";
import { cn } from "./tokens.ts";
interface RoundCheckProps { checked: boolean; }
export function RoundCheck({ checked }: RoundCheckProps) {
  return (
    <span class={cn("w-6 h-6 rounded-full shrink-0 grid place-items-center transition-colors",
      checked ? "bg-primary text-on-primary" : "border-2 border-outline")}>
      {checked && <Icon name="check" size={16} stroke={2.6} />}
    </span>
  );
}
```

- [ ] **Step 5: Implement `Stepper.tsx`** (buttons call `e.stopPropagation()` so taps inside a clickable row don't open the editor)

```tsx
// components/md3/Stepper.tsx
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
interface StepperProps { value: number; onChange: (v: number) => void; min?: number; }
export function Stepper({ value, onChange, min = 1 }: StepperProps) {
  const btn = (icon: IconName, label: string, fn: () => void) => (
    <Pressable onClick={(e) => { e.stopPropagation(); fn(); }} stop aria-label={label}
      class="w-8 h-8 grid place-items-center rounded-full bg-secondary-container text-on-secondary-container">
      <Icon name={icon} size={18} stroke={2.3} />
    </Pressable>
  );
  return (
    <div class="inline-flex items-center gap-2">
      {btn("minus", "Decrease quantity", () => onChange(Math.max(min, value - 1)))}
      <span class="md-title-medium text-on-surface text-center" style={{ minWidth: 16 }}>{value}</span>
      {btn("plus", "Increase quantity", () => onChange(value + 1))}
    </div>
  );
}
```

- [ ] **Step 6: Implement `SearchBar.tsx`**

```tsx
// components/md3/SearchBar.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon } from "./Icon.tsx";
interface SearchBarProps { placeholder: string; onClick?: (e: Event) => void; trailing?: ComponentChildren; }
export function SearchBar({ placeholder, onClick, trailing }: SearchBarProps) {
  return (
    <Pressable as="div" onClick={onClick}
      class="flex items-center gap-3.5 h-13 px-4 bg-surface-chigh rounded-[var(--md-shape-full)] w-full text-left"
      style={{ height: 52 }}>
      <span class="text-on-surface-variant"><Icon name="search" size={22} /></span>
      <span class="md-body-large text-on-surface-variant flex-1">{placeholder}</span>
      {trailing}
    </Pressable>
  );
}
```

- [ ] **Step 7: Run the test, expect pass.** Run: `deno test components/md3/Progress.test.tsx` → PASS.

- [ ] **Step 8: Commit**

```bash
git add components/md3/Progress.tsx components/md3/RoundCheck.tsx components/md3/Stepper.tsx components/md3/SearchBar.tsx components/md3/Progress.test.tsx
git commit -m "feat(md3): add Progress, RoundCheck, Stepper, SearchBar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.6: `Segmented`, `Sheet`, `Snackbar`

**Files:**
- Create: `components/md3/Segmented.tsx`, `components/md3/Sheet.tsx`, `components/md3/Snackbar.tsx`, `components/md3/Segmented.test.tsx`

**Interfaces:**
- Consumes: `Pressable`, `Icon`, `cn`; `Sheet` reuses the touch-drag/Escape/scroll-lock logic from `components/BottomSheet.tsx:13-110`.
- Produces:
  - `Segmented` — `{ options: [key: string, icon: IconName, label: string][]; value: string; onChange: (k: string) => void }` (from `md3-ui.jsx:248-267`).
  - `Sheet` — `{ open: boolean; onClose: () => void; title?: string; children }` (visual from `md3-ui.jsx:300-320`; behavior — Escape to close, body scroll-lock, touch-drag-to-close — ported from `BottomSheet.tsx`).
  - `Snackbar` — `{ data: { msg: string; action?: string; onAction?: () => void } | null }` (from `md3-ui.jsx:323-340`).

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Segmented } from "./Segmented.tsx";

Deno.test("Segmented — selected option uses secondary-container and a check icon", () => {
  const html = render(h(Segmented, {
    options: [["plan", "edit", "Plan"], ["shop", "cart", "Shop"]],
    value: "plan",
    onChange: () => {},
  }));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
  assertStringIncludes(html, "bg-secondary-container");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test components/md3/Segmented.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Segmented.tsx`**

```tsx
// components/md3/Segmented.tsx
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";
type Option = [key: string, icon: IconName, label: string];
interface SegmentedProps { options: Option[]; value: string; onChange: (k: string) => void; }
export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div class="flex border border-outline rounded-[var(--md-shape-full)] overflow-hidden" style={{ height: 40 }}>
      {options.map(([k, icon, label], i) => {
        const on = value === k;
        return (
          <Pressable key={k} onClick={() => onChange(k)}
            class={cn("flex-1 flex items-center justify-center gap-2 md-label-large",
              on ? "bg-secondary-container text-on-secondary-container" : "text-on-surface",
              i ? "border-l border-outline" : "")}>
            {on ? <Icon name="check" size={18} stroke={2.4} /> : <Icon name={icon} size={18} />} {label}
          </Pressable>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement `Sheet.tsx`** — MD3 visuals (scrim, 28px top radius, slide-up with emphasized-decel, drag handle, optional title) wrapping the **behavior** ported from `components/BottomSheet.tsx` (Escape key, `documentElement.overflow` scroll-lock, touch-drag-to-close at >80px). Structure:

```tsx
// components/md3/Sheet.tsx
import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
interface SheetProps { open: boolean; onClose: () => void; title?: string; children: ComponentChildren; }
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentDelta = useRef(0);
  useEffect(() => { // Escape to close — copied from BottomSheet.tsx:17-24
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => { // scroll-lock — copied from BottomSheet.tsx:29-36
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);
  const onTouchStart = (e: TouchEvent) => { dragStartY.current = e.touches[0].clientY; currentDelta.current = 0; };
  const onTouchMove = (e: TouchEvent) => {
    const el = sheetRef.current; if (!el) return;
    currentDelta.current = e.touches[0].clientY - dragStartY.current;
    if (currentDelta.current > 0) { e.preventDefault(); el.style.transition = "none"; el.style.transform = `translateY(${currentDelta.current}px)`; }
  };
  const reset = () => { const el = sheetRef.current; if (!el) return; el.style.transition = ""; el.style.transform = ""; };
  const onTouchEnd = () => { if (currentDelta.current > 80) { reset(); onClose(); } else reset(); currentDelta.current = 0; };
  return (
    <div class="fixed inset-0 z-[200] flex flex-col justify-end" style={{ pointerEvents: open ? "auto" : "none" }}>
      <div onClick={onClose} aria-hidden="true" class="absolute inset-0"
        style={{ background: "rgba(0,0,0,.32)", opacity: open ? 1 : 0, transition: "opacity .3s var(--md-emphasized)" }} />
      <div ref={sheetRef} role="dialog" aria-modal="true"
        class="relative bg-surface-clow px-6 pb-8 flex flex-col"
        style={{
          borderRadius: "var(--md-shape-xl) var(--md-shape-xl) 0 0", maxHeight: "84%",
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform .4s var(--md-emphasized-decel)", boxShadow: "0 -8px 40px rgba(0,0,0,.22)",
        }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={reset}>
        <div class="pt-4 pb-3 flex justify-center shrink-0">
          <div class="rounded-full bg-on-surface-variant" style={{ width: 32, height: 4, opacity: 0.4 }} />
        </div>
        {title && <div class="md-title-large text-on-surface mb-2 shrink-0">{title}</div>}
        <div class="overflow-y-auto -mx-6 px-6 pt-1" style={{ overscrollBehavior: "contain" }}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `Snackbar.tsx`** (port `md3-ui.jsx:323-340`; `inverse-surface`/`inverse-on-surface`, action in `inverse-primary`)

```tsx
// components/md3/Snackbar.tsx
interface SnackData { msg: string; action?: string; onAction?: () => void; }
interface SnackbarProps { data: SnackData | null; }
export function Snackbar({ data }: SnackbarProps) {
  return (
    <div class="fixed left-4 right-4 z-[300]" style={{
      bottom: "calc(96px + env(safe-area-inset-bottom))",
      transform: `translateY(${data ? 0 : 16}px)`, opacity: data ? 1 : 0,
      transition: "all .3s var(--md-emphasized)", pointerEvents: "none",
    }}>
      {data && (
        <div class="flex items-center gap-3 bg-inverse-surface text-inverse-on-surface rounded-[var(--md-shape-sm)]"
          style={{ padding: "6px 8px 6px 16px", boxShadow: "0 4px 12px rgba(0,0,0,.3)" }}>
          <span class="md-body-medium flex-1">{data.msg}</span>
          {data.action && (
            <button type="button" onClick={data.onAction}
              class="md-label-large text-inverse-primary rounded-[var(--md-shape-full)]"
              style={{ background: "transparent", border: "none", padding: "8px 12px", pointerEvents: "auto" }}>
              {data.action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the test, expect pass.** Run: `deno test components/md3/Segmented.test.tsx` → PASS.

- [ ] **Step 7: Full check + commit**

Run: `deno task check && deno test components/md3/`
Expected: exits 0; all md3 tests pass.

```bash
git add components/md3/Segmented.tsx components/md3/Sheet.tsx components/md3/Snackbar.tsx components/md3/Segmented.test.tsx
git commit -m "feat(md3): add Segmented, Sheet, Snackbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — App shell

### Task 2.1: Nav config → 5 tabs with MD3 icon names

**Files:**
- Modify: `config/navigation.ts`

**Interfaces:**
- Produces: `NavItem` gains `iconName: IconName` (MD3 icon) alongside the existing `icon` emoji (kept for back-compat, unused by the new bar). `NAV_CONFIG` lists 5 tabs: `home`(/home,"home"), `shopping`(/shopping,"cart","Shop"), `todos`(/todos,"checklist","To-dos"), `menu`(/menu,"plate","Menu"), `more`(/more,"dots","More"). `resolveActiveTab` unchanged. **`more` has no real route** — the bar treats it specially (Task 2.2).

- [ ] **Step 1: Update `config/navigation.ts`**

```ts
import type { IconName } from "@/components/md3/Icon.tsx";

export interface SubNavItem { label: string; route: string; }
export interface NavItem {
  id: string; label: string; icon: string; iconName: IconName;
  defaultRoute: string; routes: string[]; subNav: SubNavItem[];
}

export const NAV_CONFIG: NavItem[] = [
  { id: "home", label: "Home", icon: "🏠", iconName: "home", defaultRoute: "/home", routes: ["/home"], subNav: [] },
  { id: "shopping", label: "Shop", icon: "🛒", iconName: "cart", defaultRoute: "/shopping", routes: ["/shopping"], subNav: [] },
  { id: "todos", label: "To-dos", icon: "✅", iconName: "checklist", defaultRoute: "/todos", routes: ["/todos"], subNav: [] },
  { id: "menu", label: "Menu", icon: "🍽️", iconName: "plate", defaultRoute: "/menu", routes: ["/menu"], subNav: [] },
  { id: "more", label: "More", icon: "⋯", iconName: "dots", defaultRoute: "/more", routes: ["/more"], subNav: [] },
];

export function resolveActiveTab(pathname: string): NavItem | undefined {
  return NAV_CONFIG.find((item) =>
    item.routes.some((route) => pathname === route || pathname.startsWith(route + "/"))
  );
}
```

- [ ] **Step 2: Type-check.** Run: `deno check config/navigation.ts` → exits 0.

- [ ] **Step 3: Commit**

```bash
git add config/navigation.ts
git commit -m "feat(shell): expand nav config to 5 MD3 tabs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.2: `NavigationBar` island

**Files:**
- Create: `islands/shell/NavigationBar.tsx`, `islands/shell/NavigationBar.test.tsx`

**Interfaces:**
- Consumes: `NAV_CONFIG`, `NavItem`; `Pressable`, `Icon`.
- Produces: `NavigationBar` — `{ items: NavItem[]; activeId?: string; onMore: () => void }`. Renders a fixed bottom bar (height 80 + safe-area), animated pill on the active tab (port `md3-nav.jsx:5-40`). Each tab navigates via `globalThis.location.href = item.defaultRoute` **except `more`**, which calls `onMore()` (no navigation).

- [ ] **Step 1: Write the failing test** (SSR marks the active tab's label bold)

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import NavigationBar from "./NavigationBar.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";

Deno.test("NavigationBar — renders all five tab labels", () => {
  const html = render(h(NavigationBar, { items: NAV_CONFIG, activeId: "shopping", onMore: () => {} }));
  for (const label of ["Home", "Shop", "To-dos", "Menu", "More"]) assertStringIncludes(html, label);
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test islands/shell/NavigationBar.test.tsx` → FAIL.

- [ ] **Step 3: Implement** (fixed positioning + safe-area; pill via inline style for the animated width)

```tsx
// islands/shell/NavigationBar.tsx
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { cn } from "@/components/md3/tokens.ts";
import type { NavItem } from "@/config/navigation.ts";

interface NavigationBarProps { items: NavItem[]; activeId?: string; onMore: () => void; }

export default function NavigationBar({ items, activeId, onMore }: NavigationBarProps) {
  const go = (it: NavItem) => { if (it.id === "more") onMore(); else globalThis.location.href = it.defaultRoute; };
  return (
    <nav class="fixed bottom-0 left-0 right-0 z-40 flex bg-surface-c"
      style={{ height: 80, paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Main navigation">
      {items.map((it) => {
        const on = activeId === it.id;
        return (
          <Pressable key={it.id} onClick={() => go(it)} class="flex-1 flex flex-col items-center justify-center gap-1 pt-3 pb-4"
            aria-current={on ? "page" : undefined}>
            <span class="relative grid place-items-center" style={{ height: 32 }}>
              <span class="absolute bg-secondary-container rounded-[var(--md-shape-full)]"
                style={{ top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: on ? 64 : 32, opacity: on ? 1 : 0, transition: "width .25s var(--md-emphasized), opacity .2s" }} />
              <span class={cn("relative transition-colors", on ? "text-on-secondary-container" : "text-on-surface-variant")}>
                <Icon name={it.iconName} size={24} stroke={on ? 2.3 : 2} />
              </span>
            </span>
            <span class={cn("md-label-medium", on ? "text-on-surface font-bold" : "text-on-surface-variant")}>{it.label}</span>
          </Pressable>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test, expect pass.** Run: `deno test islands/shell/NavigationBar.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add islands/shell/NavigationBar.tsx islands/shell/NavigationBar.test.tsx
git commit -m "feat(shell): add MD3 NavigationBar island

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.3: `TopAppBar` island

**Files:**
- Create: `islands/shell/TopAppBar.tsx`, `islands/shell/TopAppBar.test.tsx`

**Interfaces:**
- Consumes: `IconButton`, `Icon`.
- Produces: `TopAppBar` — small variant only: `{ title: string; backUrl?: string; trailing?: ComponentChildren }`. When `backUrl` is set, renders a leading back `IconButton` linking to it; title uses `md-brand`; top padding = safe-area (port `md3-nav.jsx:60-68`).

- [ ] **Step 1: Write the failing test**

```tsx
import { assertStringIncludes, assertFalse } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import TopAppBar from "./TopAppBar.tsx";

Deno.test("TopAppBar — renders the title", () => {
  assertStringIncludes(render(h(TopAppBar, { title: "Weekly groceries" })), "Weekly groceries");
});
Deno.test("TopAppBar — renders a back link only when backUrl is set", () => {
  assertStringIncludes(render(h(TopAppBar, { title: "X", backUrl: "/shopping" })), 'href="/shopping"');
  assertFalse(render(h(TopAppBar, { title: "X" })).includes("aria-label=\"Back\""));
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test islands/shell/TopAppBar.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// islands/shell/TopAppBar.tsx
import type { ComponentChildren } from "preact";
import { Icon } from "@/components/md3/Icon.tsx";

interface TopAppBarProps { title: string; backUrl?: string; trailing?: ComponentChildren; }

export default function TopAppBar({ title, backUrl, trailing }: TopAppBarProps) {
  return (
    <header class="bg-surface" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
        {backUrl && (
          <a href={backUrl} aria-label="Back" class="md-press grid place-items-center text-on-surface-variant rounded-full" style={{ width: 40, height: 40 }}>
            <span class="md-state" />
            <Icon name="back" size={22} />
          </a>
        )}
        <div class={`flex-1 min-w-0 md-brand text-on-surface overflow-hidden text-ellipsis whitespace-nowrap ${backUrl ? "" : "ml-3"}`}
          style={{ fontSize: 22, lineHeight: "28px" }}>{title}</div>
        <div class="flex items-center gap-0.5">{trailing}</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test, expect pass.** Run: `deno test islands/shell/TopAppBar.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add islands/shell/TopAppBar.tsx islands/shell/TopAppBar.test.tsx
git commit -m "feat(shell): add MD3 TopAppBar island

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.4: `Fab` island

**Files:**
- Create: `islands/shell/Fab.tsx`

**Interfaces:**
- Consumes: `Pressable`, `Icon`, `IconName`.
- Produces: `Fab` — `{ icon?: IconName; label?: string; onClick?: () => void; "aria-label": string }`. 56px, `primary-container`, rounded 16, elevation-3, sits above the nav bar (port `md3-nav.jsx:72-92`). Positioning is the caller's responsibility via a wrapping class, so `Fab` itself is just the button.

- [ ] **Step 1: Implement** (no separate unit test — verified visually in Phase 5)

```tsx
// islands/shell/Fab.tsx
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";
interface FabProps { icon?: IconName; label?: string; onClick?: () => void; "aria-label": string; }
export default function Fab({ icon = "plus", label, onClick, ...rest }: FabProps) {
  return (
    <Pressable onClick={onClick} aria-label={rest["aria-label"]}
      class="inline-flex items-center justify-center gap-3 bg-primary-container text-on-primary-container md-elevation-3"
      style={{ height: 56, minWidth: 56, borderRadius: "var(--md-shape-lg)", padding: label ? "0 20px" : 0 }}>
      <Icon name={icon} size={24} />
      {label && <span class="md-label-large" style={{ fontSize: 15 }}>{label}</span>}
    </Pressable>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `deno check islands/shell/Fab.tsx` → exits 0.

```bash
git add islands/shell/Fab.tsx
git commit -m "feat(shell): add MD3 Fab island

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.5: `ComingSoon` + placeholder routes

**Files:**
- Create: `components/md3/ComingSoon.tsx`, `routes/home/index.tsx`, `routes/todos/index.tsx`, `routes/menu/index.tsx`

**Interfaces:**
- Consumes: `Icon`, `IconName`.
- Produces: `ComingSoon` — `{ icon: IconName; title: string; blurb: string }` (port `md3-screens.jsx:536-547`). Three routes render it via `define.page`.

- [ ] **Step 1: Implement `ComingSoon.tsx`**

```tsx
// components/md3/ComingSoon.tsx
import { Icon, type IconName } from "./Icon.tsx";
interface ComingSoonProps { icon: IconName; title: string; blurb: string; }
export function ComingSoon({ icon, title, blurb }: ComingSoonProps) {
  return (
    <div class="flex flex-col items-center text-center gap-4" style={{ padding: "48px 28px" }}>
      <div class="grid place-items-center bg-primary-container text-on-primary-container" style={{ width: 88, height: 88, borderRadius: "var(--md-shape-xl)" }}>
        <Icon name={icon} size={44} />
      </div>
      <div class="md-headline-small text-on-surface">{title}</div>
      <div class="md-body-medium text-on-surface-variant" style={{ maxWidth: 280 }}>{blurb}</div>
      <span class="md-label-large text-on-tertiary-container bg-tertiary-container rounded-[var(--md-shape-full)]" style={{ padding: "8px 16px", marginTop: 4 }}>Coming soon</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement the three routes** (each follows the existing `define.page` pattern). Example `routes/home/index.tsx`:

```tsx
import { define } from "@/utils/index.ts";
import { ComingSoon } from "@/components/md3/ComingSoon.tsx";
export default define.page(function Home() {
  return (
    <main class="max-w-md mx-auto">
      <ComingSoon icon="home" title="Home" blurb="Your family dashboard is on the way. For now, jump into Shopping." />
    </main>
  );
});
```

`routes/todos/index.tsx`: `icon="checklist"`, `title="To-dos"`, blurb "Shared to-dos are coming soon — a place for the whole household's tasks." `routes/menu/index.tsx`: `icon="plate"`, `title="Menu planner"`, blurb "Plan the week's meals together, then turn them into a shopping list in one tap. This module is on the way."

- [ ] **Step 3: Type-check.** Run: `deno check routes/home/index.tsx routes/todos/index.tsx routes/menu/index.tsx components/md3/ComingSoon.tsx` → exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/md3/ComingSoon.tsx routes/home/index.tsx routes/todos/index.tsx routes/menu/index.tsx
git commit -m "feat(shell): add ComingSoon and placeholder routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.6: `MoreSheet` + wire the shell into `_app.tsx`

**Files:**
- Create: `islands/shell/MoreSheet.tsx`, `islands/shell/AppChrome.tsx`
- Modify: `routes/_app.tsx`

**Interfaces:**
- `AppChrome` (island) owns the `more`-sheet open signal so the SSR `_app.tsx` (not an island) can stay server-rendered. It renders `TopAppBar` (only when not in detail mode — detail mode bars are rendered per-page via `state.appBar`), `NavigationBar`, and `MoreSheet`.
- `AppChrome` props: `{ activeId?: string; appBar?: { title: string; backUrl: string }; sectionTitle: string }`.
- `MoreSheet` props: `{ open: boolean; onClose: () => void }`. Lists modules (Shopping active; To-dos/Menu/Loyalty "coming soon") + Household (Members/Settings/Switch household — all "coming soon") using `ListItem`. Tapping a coming-soon row shows a `Snackbar` (local signal) "Coming soon".

- [ ] **Step 1: Implement `MoreSheet.tsx`** (uses `Sheet`, `ListItem`, `Icon`, `Snackbar`; all rows except Shopping are "coming soon")

```tsx
// islands/shell/MoreSheet.tsx
import { useSignal } from "@preact/signals";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";

interface MoreSheetProps { open: boolean; onClose: () => void; }
const badge = (icon: IconName) => (
  <span class="grid place-items-center bg-primary-container text-on-primary-container rounded-full" style={{ width: 40, height: 40 }}>
    <Icon name={icon} size={20} />
  </span>
);

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const snack = useSignal<{ msg: string } | null>(null);
  const soon = (label: string) => { snack.value = { msg: `${label} — coming soon` }; setTimeout(() => snack.value = null, 2200); };
  const chevron = <Icon name="chevron" size={18} />;
  return (
    <>
      <Sheet open={open} onClose={onClose} title="The household">
        <div class="md-label-medium text-on-surface-variant uppercase tracking-wide" style={{ margin: "8px 4px 4px" }}>Modules</div>
        <ListItem leading={badge("cart")} headline="Shopping" trailing={chevron} onClick={() => { onClose(); globalThis.location.href = "/shopping"; }} />
        <ListItem leading={badge("checklist")} headline="To-dos" trailing={chevron} onClick={() => soon("To-dos")} />
        <ListItem leading={badge("plate")} headline="Menu planner" trailing={chevron} onClick={() => soon("Menu planner")} />
        <ListItem leading={badge("card")} headline="Loyalty cards" trailing={chevron} onClick={() => soon("Loyalty cards")} />
        <div class="md-label-medium text-on-surface-variant uppercase tracking-wide" style={{ margin: "16px 4px 4px" }}>Household</div>
        <ListItem leading={badge("people")} headline="Members" trailing={chevron} onClick={() => soon("Members")} />
        <ListItem leading={badge("cog")} headline="Settings" trailing={chevron} onClick={() => soon("Settings")} />
        <ListItem leading={badge("swap")} headline="Switch household" trailing={chevron} onClick={() => soon("Switch household")} />
        <a href="/logout" class="block text-center md-label-large text-error" style={{ padding: "16px" }}>Log out</a>
      </Sheet>
      <Snackbar data={snack.value} />
    </>
  );
}
```

- [ ] **Step 2: Implement `AppChrome.tsx`** (single island holding the More-sheet state; renders top bar + bottom nav)

```tsx
// islands/shell/AppChrome.tsx
import { useSignal } from "@preact/signals";
import TopAppBar from "./TopAppBar.tsx";
import NavigationBar from "./NavigationBar.tsx";
import MoreSheet from "./MoreSheet.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";

interface AppChromeProps {
  activeId?: string;
  appBar?: { title: string; backUrl: string };
  sectionTitle: string;
}

export default function AppChrome({ activeId, appBar, sectionTitle }: AppChromeProps) {
  const moreOpen = useSignal(false);
  return (
    <>
      {appBar
        ? <TopAppBar title={appBar.title} backUrl={appBar.backUrl} />
        : <TopAppBar title={sectionTitle} />}
      <NavigationBar items={NAV_CONFIG} activeId={activeId} onMore={() => moreOpen.value = true} />
      <MoreSheet open={moreOpen.value} onClose={() => moreOpen.value = false} />
    </>
  );
}
```

- [ ] **Step 3: Rewire `routes/_app.tsx`** — replace the `AppBar`/`TabBar` block with `AppChrome`; add bottom padding for the 80px nav; keep the fonts link from Task 0.3.

```tsx
import { type PageProps } from "fresh";
import { Head } from "fresh/runtime";
import { resolveActiveTab } from "@/config/navigation.ts";
import AppChrome from "@/islands/shell/AppChrome.tsx";
import { type StateInterface } from "@/utils/define.ts";

export default function App({ Component, state, url }: PageProps<unknown, StateInterface>) {
  const activeTab = resolveActiveTab(url.pathname);
  return (
    <html>
      <Head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>Happie</title>
        <link crossorigin="use-credentials" rel="manifest" href="/manifest.webmanifest" />
        {/* Google Fonts link from Task 0.3 stays here */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
        <script type="module">{`import "https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate/dist/pwa-update.js"; const el = document.createElement("pwa-update"); document.body.appendChild(el);`}</script>
      </Head>
      <body style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
        {state?.userId && (
          <AppChrome
            activeId={activeTab?.id}
            appBar={state.appBar ? { title: state.appBar.title, backUrl: state.appBar.backUrl } : undefined}
            sectionTitle={activeTab?.label ?? "Happie"}
          />
        )}
        <Component />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the shell end-to-end** — preview workflow: `preview_start`, log in (seeded user), `preview_snapshot` of `/shopping`: confirm the 5-tab bottom bar renders, the top bar shows "Shop", and tapping **More** opens the sheet. `preview_screenshot` for the record.

- [ ] **Step 5: Full check + commit**

Run: `deno task check && deno test`
Expected: exits 0; all tests pass (AppBar.test.tsx still present and passing for now).

```bash
git add islands/shell/MoreSheet.tsx islands/shell/AppChrome.tsx routes/_app.tsx
git commit -m "feat(shell): wire MD3 app chrome into _app

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Lists overview reskin

### Task 3.1: Per-list item counts in the lists route (read-only enrichment)

**Files:**
- Modify: `routes/shopping/index.tsx`

**Interfaces:**
- Produces: page data shape `{ lists: Array<ShoppingListInterface & { total: number; done: number }> }`. Computed by reading each list's items via `ShoppingListItemRepo.getAll(list.id)` in the GET handler. **No model/API change** — this only enriches SSR page data.

- [ ] **Step 1: Update the handler + page** (title now lives in the shell; the page renders only the island)

```tsx
import { page } from "fresh";
import { ShoppingListRepo, ShoppingListItemRepo } from "@/database/index.ts";
import ShoppingListsIsland from "@/islands/shopping-lists.tsx";
import { define } from "@/utils/index.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId!;
    const lists = await ShoppingListRepo.getAll(householdId);
    const withCounts = await Promise.all(lists.map(async (l) => {
      const items = await ShoppingListItemRepo.getAll(l.id);
      return { ...l, total: items.length, done: items.filter((i) => i.checked).length };
    }));
    return page({ lists: withCounts });
  },
});

export default define.page<typeof handler>(function Lists({ data }) {
  return (
    <main class="max-w-md mx-auto">
      <ShoppingListsIsland initialLists={data.lists} />
    </main>
  );
});
```

- [ ] **Step 2: Type-check.** Run: `deno check routes/shopping/index.tsx` (will fail until the island prop type is updated in Task 3.2 — that's expected; proceed).

- [ ] **Step 3: Commit** (commit together with Task 3.2 if the type depends on it; otherwise commit now)

```bash
git add routes/shopping/index.tsx
git commit -m "feat(shopping): compute per-list item counts for list cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3.2: Reskin `islands/shopping-lists.tsx`

**Files:**
- Modify: `islands/shopping-lists.tsx`

**Interfaces:**
- Consumes: `Card`, `Progress`, `Icon`, `Button`, `Sheet`, `Segmented`, `Fab`, `api.shoppingLists`.
- Produces: MD3 Lists overview. Prop type widened to `ShoppingListInterface & { total: number; done: number }`. Behavior preserved: create / rename / delete. Layout from `md3-screens.jsx:116-157` **minus** `AvatarStack`, using a default `cart` icon instead of per-list emoji, and relative `createdAt` instead of `l.updated`.

- [ ] **Step 1: Write the failing test** (`islands/shopping-lists.test.tsx`)

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import ShoppingLists from "./shopping-lists.tsx";

Deno.test("ShoppingLists — renders list name and done/total", () => {
  const html = render(h(ShoppingLists, {
    initialLists: [{ id: "1", householdId: "h", name: "Weekly groceries", createdBy: "u", createdAt: Date.now(), total: 9, done: 3 }],
  }));
  assertStringIncludes(html, "Weekly groceries");
  assertStringIncludes(html, "3/9 done");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test islands/shopping-lists.test.tsx` → FAIL (old island has no `total`/`done`).

- [ ] **Step 3: Rewrite the island.** Key points:
  - Widen `ShoppingListsProps.initialLists` item type to include `total: number; done: number`.
  - `useSignal` state: `lists`, `newName`, `tab` (`"lists"|"catalogue"`, default `"lists"`), `pendingDelete`, `renaming` (`{ id, name } | null`), `newOpen` (bool).
  - `Segmented` options `[["lists","cart","Lists"],["catalogue","tag","Catalogue"]]`; when `tab === "catalogue"` render a `ComingSoon` (`icon="tag"`, "Catalogue", "Browse and manage your household's item library — coming soon.").
  - Lists tab: map each list to a `Card variant="filled" radius={20}` containing a `cart` Icon in a 44px `bg-tertiary-container` circle, name (`md-title-medium`), `${done}/${total} done · ${relativeTime(createdAt)}` (`md-body-small text-on-surface-variant`), a count badge (`bg-secondary-container`), and a `Progress value={done} total={total}`. Card `onClick` → `globalThis.location.href = `/shopping/${id}``. **No AvatarStack.**
  - A dashed "New list" `Pressable` card opens the new-list `Sheet` (text input + Add `Button`), reusing `createList`.
  - Long-press / an overflow affordance is out of scope; instead put **rename/delete** in a per-card trailing `IconButton name="dots"` that opens a management `Sheet` (Rename row → inline input; Delete row → `text-error`). Reuse `confirmRename` / `handleDeleteConfirm`.
  - `Fab` (label "New list") fixed bottom-right above the nav: wrap in `<div class="fixed right-4 z-30" style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}>`.
  - Add `relativeTime(ms: number): string` helper (e.g. "just now", "2m ago", "3h ago", "yesterday", "3d ago").

  Preserve `api.shoppingLists.create/rename/delete` calls exactly. Build the markup with the MD3 primitives + token utilities (translate from `md3-screens.jsx:116-157`, omitting avatars/emoji).

- [ ] **Step 4: Run the test, expect pass.** Run: `deno test islands/shopping-lists.test.tsx` → PASS.

- [ ] **Step 5: Verify visually** — preview `/shopping`: list cards with progress bars, New-list sheet, rename + delete sheets, FAB. `preview_screenshot` and compare to `docs/happie/project/mocks/02-shopping.png`.

- [ ] **Step 6: Full check + commit**

Run: `deno task check && deno test`
Expected: exits 0.

```bash
git add islands/shopping-lists.tsx islands/shopping-lists.test.tsx routes/shopping/index.tsx
git commit -m "feat(shopping): reskin Lists overview to MD3

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — List detail reskin (Plan / Shop + sheets)

### Task 4.1: Plan mode + add-item & item-editor sheets

**Files:**
- Modify: `islands/items.tsx`

**Interfaces:**
- Consumes: `useShoppingList` (unchanged), `Segmented`, `Card`, `SearchBar`, `Sheet`, `Stepper`, `Chip`, `Button`, `ListItem`, `Icon`.
- Produces: List detail island with a `mode` signal (`"plan"|"shop"`, default `"plan"`) driving a `Segmented`; Plan mode renders items grouped by category (reusing `groupedList`) with `Stepper` rows; an add-item `Sheet` and item-editor `Sheet`. **No assignee UI.**

Mapping of real model → prototype fields (the prototype's fake `it.{name,cat,qty,note,done}` map to):
- name → `getItemName(li.itemId)`; category → already grouped by `groupedList`; qty → `li.quantity`; note → `li.note`; done → `li.checked`. **assignee → omitted.**

- [ ] **Step 1: Write the failing test** (`islands/items.test.tsx`) — SSR renders the Plan/Shop segmented control

```tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import Items from "./items.tsx";

Deno.test("Items — renders Plan and Shop mode toggle", () => {
  const html = render(h(Items, { listId: "l1", items: [], shoppingList: [], categories: [] }));
  assertStringIncludes(html, "Plan");
  assertStringIncludes(html, "Shop");
});
```

- [ ] **Step 2: Run it, expect failure.** Run: `deno test islands/items.test.tsx` → FAIL (old island renders "List"/"Done").

- [ ] **Step 3: Rebuild the island scaffold + Plan mode.** Preserve the `useMemo(() => useShoppingList(listId, catalog, shoppingList, initialCategories), [])` call exactly (keep the explanatory comment). Replace the JSX:
  - `const mode = useSignal<"plan" | "shop">("plan");`
  - Top: `<Segmented options={[["plan","edit","Plan"],["shop","cart","Shop"]]} value={mode.value} onChange={(m) => mode.value = m as "plan"|"shop"} />`.
  - Plan mode body (translate `PlanMode` inline model, `md3-screens.jsx:242-264`, **without** assignee/`unassigned` alert):
    - `SearchBar placeholder="Add item or search catalogue…"` with a trailing `plus` icon; `onClick` opens the add-item sheet (`addOpen.value = true`).
    - For each `group` of `groupedList.value`: a `SubHeader` (uppercase `md-title-small text-primary`) with `group.category?.label ?? "Uncategorized"`, then a `Card variant="filled" pad={0} radius={16}` whose rows are: name (`md-body-large`), optional note (`md-body-small text-on-surface-variant`, prefixed 📝), and a `Stepper value={li.quantity} onChange={(v) => updateListItem(li.id, { quantity: v })}`. The row (excluding the stepper) is a `Pressable as="div"` opening the item-editor sheet for `li`. Insert a 1px divider between rows.
  - State signals: `addOpen`, `editingId` (`string | null`).

- [ ] **Step 4: Add-item sheet** (translate `AddItemBody`, `md3-screens.jsx:269-333`). Wire to the hook:
  - Local `useSearchBox(catalog, filterFn)` for `query`/`results` (reuse existing `filterFn` from the old island).
  - Catalogue matches → `ListItem` rows; tapping a not-yet-added item → `await addToList(item.id)` then keep sheet open (so several can be added), like the prototype's quick-add.
  - "Add '<query>'" card (shown when query non-empty and no exact catalogue match): category `Chip`s from `categories.value` (default none/Uncategorized) + `Button` "Add to <category>" → `await addToCatalog(query, selectedCategoryId.value || undefined)`.
  - `selectedCategoryId` comes from the hook.

- [ ] **Step 5: Item-editor sheet** (translate `ItemEditorBody`, `md3-screens.jsx:338-413`, **omitting the "Assigned to" block**):
  - Quantity `Stepper` → `updateListItem(id, { quantity })`.
  - Category `Chip`s from `categories.value` → `updateListItem` is item-level note/qty only; category lives on the **catalog item** (`item.categoryId`), changed via `api.items.update(itemId, name, categoryId)`. For the spike, **show the category chips read-only-ish**: changing category calls `api.items.update(getItem(li.itemId).id, getItemName(li.itemId), newCatId)` then `refresh()`. (Document this in a code comment.)
  - Note `textarea` → `updateListItem(id, { note })`.
  - "Saved" flash pill (tertiary-container) on any change (port the `flash()` timer).
  - "Done" `Button` closes; "Remove from list" `Pressable` (text-error) → `removeListItem(id)` then close.

- [ ] **Step 6: Run the test, expect pass.** Run: `deno test islands/items.test.tsx` → PASS.

- [ ] **Step 7: Verify Plan mode** — preview a list detail page (`/shopping/<id>`): add an item via the sheet, change qty with the stepper, open the editor, edit a note, remove an item. Confirm optimistic updates persist (reload). `preview_screenshot` vs `mocks/03-list-detail.png`.

- [ ] **Step 8: Commit**

```bash
git add islands/items.tsx islands/items.test.tsx
git commit -m "feat(shopping): reskin List detail Plan mode + add/edit sheets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.2: Shop mode + list-management sheet

**Files:**
- Modify: `islands/items.tsx`

**Interfaces:**
- Consumes: `checkItem`, `uncheckItem`, `list`, `checkedItems`, `groupedList`, `Card`, `Progress`, `RoundCheck`, `Sheet`, `Icon`, `api.shoppingLists`.
- Produces: Shop-mode body + list-management sheet (opened from a TopAppBar overflow — but the bar is rendered by the shell, so expose the overflow via a small in-island `IconButton` in the Plan/Shop header row instead).

- [ ] **Step 1: Implement Shop mode** (translate `ShopMode`, `md3-screens.jsx:416-494`, **without** assignee avatars). Wiring:
  - `done = checkedItems.value.length`, `total = list.value.length + checkedItems.value.length`.
  - Progress `Card` ("`{done} / {total} in cart`" + `Progress height={8}`). Keep the "Screen awake" label as static text (no wake-lock in the spike — add a code comment noting that).
  - Remaining items grouped by aisle: reuse `groupedList.value` (active items). Each row = `Pressable` with `RoundCheck checked={false}` + name (+ note) + qty badge if `>1`; `onClick` → `handleCheckItem(li.id)` (reuse existing wrapper that toggles `pendingItemIds`).
  - "In cart · {done}" collapsible (`showDone` signal) listing `checkedItems.value`; each `RoundCheck checked` row `onClick` → `uncheckItem(li.id)`.
  - `allDone` celebration `Card` (tertiary-container + 🎉) when `done === total && total > 0`.

- [ ] **Step 2: List-management sheet** (translate `md3-app.jsx:462-479`): Rename (inline input → `api.shoppingLists.rename`), Clear checked (`text` row → for each `checkedItems` call `removeListItem`), Delete list (`text-error` → `api.shoppingLists.delete` then `globalThis.location.href = "/shopping"`). Share row = "coming soon" (Snackbar). Open via an `IconButton name="dots"` placed in the island's header row (right of the Segmented), since the shell's TopAppBar can't host page-specific actions in this spike.

- [ ] **Step 3: Run tests.** Run: `deno test islands/items.test.tsx` → PASS (mode toggle test still green).

- [ ] **Step 4: Verify Shop mode** — preview: switch to Shop, check items off (watch progress + "in cart" collapse), reach all-done celebration, re-add from cart, and exercise the management sheet (rename, clear checked, delete). `preview_screenshot`.

- [ ] **Step 5: Commit**

```bash
git add islands/items.tsx
git commit -m "feat(shopping): add List detail Shop mode + list management sheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 5 — Verification

### Task 5.1: Full-flow visual + behavior QA

- [ ] **Step 1: Run the whole suite + checks.** Run: `deno task check && deno test` → exits 0.
- [ ] **Step 2: End-to-end preview pass** (seeded user): `/shopping` (lists, progress, new/rename/delete) → open a list → Plan (add/search/create, qty, edit note, remove) → Shop (check/uncheck, progress, all-done, management sheet) → bottom nav to Home/To-dos/Menu (ComingSoon) → More sheet. Capture `preview_screenshot` of Lists, Plan, and Shop and compare against `mocks/02`, `mocks/03`.
- [ ] **Step 3: Responsive/desktop check.** `preview_resize` to a desktop width; confirm the `max-w-md` centered column + bottom nav still read correctly.
- [ ] **Step 4: Console/network check.** `preview_console_logs` + `preview_network` show no errors and the PATCH-batching still fires on qty/note edits.
- [ ] **Step 5: Commit** any fixes found.

```bash
git add -A
git commit -m "fix(md3): polish from full-flow QA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5.2: Remove superseded code

**Files:**
- Delete: `islands/AppBar.tsx`, `islands/AppBar.test.tsx`, `components/TabBar.tsx`, `components/shopping-list-item.tsx`, `components/done-list-item.tsx`, `components/quantity-stepper.tsx`.
- Conditionally delete: `components/BottomSheet.tsx` (only if no remaining imports).

- [ ] **Step 1: Confirm each target is unreferenced.** Run: `grep -rn "AppBar\|TabBar\|shopping-list-item\|done-list-item\|quantity-stepper\|BottomSheet" routes islands components --include=*.tsx | grep -v "islands/shell\|components/md3"` — expect no live imports (the shell + md3 replacements don't reference them). If `BottomSheet` still has an importer, keep it.
- [ ] **Step 2: Delete the unreferenced files.**
- [ ] **Step 3: Full check.** Run: `deno task check && deno test` → exits 0.
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(shopping): remove components superseded by MD3 shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5.3: Wrap up

- [ ] **Step 1:** Re-read the spec (`docs/superpowers/specs/2026-06-30-md3-shopping-spike-design.md`) and confirm every in-scope item shipped; note any intentional deviations in the PR description.
- [ ] **Step 2:** Invoke `superpowers:finishing-a-development-branch` to decide merge/PR.

---

## Self-Review (completed during planning)

- **Spec coverage:** token layer (§5 → 0.2/0.3), 15 primitives minus Avatar/Switch (§6 → 1.1-1.6), shell TopAppBar/NavigationBar/Fab + placeholders + More (§6/§7.4 → 2.x), Lists overview (§7.1 → 3.x), List detail Plan/Shop + add/edit/management sheets (§7.2/§7.3 → 4.x), reuse of `useShoppingList`/no data change (§8 → enforced in 4.x), testing (§10 → tests per task + Phase 5). Add-item/More "coming soon" placeholders cover §7.4. ✓
- **Deferrals honored:** assignees/members omitted everywhere (Global Constraints + explicit omit notes in 3.2, 4.1, 4.2); Catalogue/Categories untouched (Catalogue tab → ComingSoon). ✓
- **Type consistency:** primitive prop names are defined once in each task's Interfaces block and reused (e.g. `Segmented.options` as `[key, icon, label]` tuples used identically in 1.6 and 4.1; `Card.radius` numeric used in 3.2/4.x; `Stepper.onChange` signature consistent). `ShoppingListInterface & { total, done }` defined in 3.1 and consumed in 3.2. ✓
- **Known intentional deviations from a pixel port:** list cards use a default `cart` icon (no per-list emoji) and relative `createdAt` (no `updated`/avatars); category edit in the item editor round-trips through `api.items.update` + `refresh()`; "Screen awake" is a static label (no Wake Lock). All flagged inline. ✓
