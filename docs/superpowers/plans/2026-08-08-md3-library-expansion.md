# MD3 Library Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TextField, Switch, Divider (+ListSubheader), Dialog (basic +
full-screen) to `components/md3/`, plus a dev-only `/design` showcase route and
the Sheet-vs-Dialog boundary rule in the patterns doc.

**Architecture:** Pure Preact presentational components in `components/md3/`
following the existing house conventions (explicit props interface, variant
maps, `cn` from `tokens.ts`, `--md-*` CSS variables, `class` passthrough).
Dialogs share a new `Scrim` primitive extracted from `Sheet`. The showcase is
one island rendered by a route that 404s in production.

**Tech Stack:** Deno + Fresh 2 (`define.handlers`/`define.page`,
`HttpError`), Preact + `@preact/signals` (`useSignal` in islands only),
Tailwind v4 semantic classes, tests via `Deno.test` +
`npm:preact-render-to-string` string assertions.

## Global Constraints

- Reference spec: m3.material.io (MD3). Exact metrics are baked into each task.
- Use `class`, never `className`; colors/shape/motion only via tokens
  (`bg-primary`, `rounded-[var(--md-shape-sm)]`, `var(--md-emphasized)`) — no
  hardcoded hex/px radii except spec-mandated component metrics.
- Components are **controlled** (value/checked + change callback); no internal
  state for data, `useSignal()` only inside islands.
- Every component file gets a colocated `*.test.tsx` using the exact import
  style of `components/md3/Segmented.test.tsx`:
  `jsr:@std/assert@^1.0.19`, `npm:preact-render-to-string@^6.6.3`, `h` from
  `"preact"`.
- Test command: `deno test --unstable-kv -A <file>` (all: `deno task test`).
- Before every commit: `deno fmt && deno task check` must pass.
- Commits follow Conventional Commits; one commit per task.
- SSR safety: browser APIs (`document`) only inside `useEffect`.

---

### Task 1: Divider + ListSubheader

**Files:**
- Create: `components/md3/Divider.tsx`
- Create: `components/md3/ListSubheader.tsx`
- Test: `components/md3/Divider.test.tsx`

**Interfaces:**
- Consumes: `cn` from `components/md3/tokens.ts`
- Produces: `Divider({ inset?: boolean, class?: string })`;
  `ListSubheader({ children, class?: string })` — used by Task 7 showcase.

MD3 spec: divider is 1dp thick, color `outline-variant`; inset variant is
indented from the container edges. List subheader: `title-small` type role,
`on-surface-variant` color.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/Divider.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Divider } from "./Divider.tsx";
import { ListSubheader } from "./ListSubheader.tsx";

Deno.test("Divider — 1px outline-variant hairline", () => {
  const html = render(h(Divider, {}));
  assertStringIncludes(html, "h-px");
  assertStringIncludes(html, "bg-outline-variant");
});

Deno.test("Divider — inset variant is indented", () => {
  const html = render(h(Divider, { inset: true }));
  assertStringIncludes(html, "mx-4");
});

Deno.test("ListSubheader — title-small on-surface-variant", () => {
  const html = render(h(ListSubheader, { children: "General" }));
  assertStringIncludes(html, "General");
  assertStringIncludes(html, "md-title-small");
  assertStringIncludes(html, "text-on-surface-variant");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/Divider.test.tsx`
Expected: FAIL — `Module not found` for `Divider.tsx`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/md3/Divider.tsx
import { cn } from "./tokens.ts";

interface DividerProps {
  /** Indent from both container edges (MD3 inset divider). */
  inset?: boolean;
  class?: string;
}

export function Divider({ inset, class: cls }: DividerProps) {
  return (
    <hr class={cn("border-0 h-px bg-outline-variant", inset && "mx-4", cls)} />
  );
}
```

```tsx
// components/md3/ListSubheader.tsx
import type { ComponentChildren } from "preact";
import { cn } from "./tokens.ts";

interface ListSubheaderProps {
  children?: ComponentChildren;
  class?: string;
}

export function ListSubheader({ children, class: cls }: ListSubheaderProps) {
  return (
    <div class={cn("md-title-small text-on-surface-variant px-4 pt-4 pb-2", cls)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A components/md3/Divider.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/Divider.tsx components/md3/ListSubheader.tsx components/md3/Divider.test.tsx
git commit -m "feat(md3): add Divider and ListSubheader"
```

---

### Task 2: Switch

**Files:**
- Create: `components/md3/Switch.tsx`
- Test: `components/md3/Switch.test.tsx`

**Interfaces:**
- Consumes: `cn` from `tokens.ts`
- Produces: `Switch({ checked: boolean, onChange: (checked: boolean) => void,
  disabled?: boolean, "aria-label"?: string, class?: string })` — used by
  Task 7 showcase, future settings rows as `ListItem` `trailing`.

MD3 spec: track 52×32dp, radius full, 2dp border. Selected: track `primary`,
thumb 24dp `on-primary`, thumb end-margin 4dp. Unselected: track
`surface-container-highest` (house: `surface-chighest`) with `outline` border,
thumb 16dp `outline`, start-margin 8dp. Thumb slides with emphasized easing.
Disabled: 38%/12% on-surface mixes (house shorthand: `opacity-40` +
`pointer-events-none`). Semantics: `<button role="switch" aria-checked>`.

Thumb `left` values are content-box relative (2px border): unselected
visual 8dp margin → `left-[6px]`; selected 24dp thumb with 4dp end margin →
`left-[22px]`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/Switch.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Switch } from "./Switch.tsx";

Deno.test("Switch — on: switch role, checked, primary track", () => {
  const html = render(h(Switch, { checked: true, onChange: () => {} }));
  assertStringIncludes(html, 'role="switch"');
  assertStringIncludes(html, 'aria-checked="true"');
  assertStringIncludes(html, "bg-primary");
});

Deno.test("Switch — off: unchecked, outlined surface track", () => {
  const html = render(h(Switch, { checked: false, onChange: () => {} }));
  assertStringIncludes(html, 'aria-checked="false"');
  assertStringIncludes(html, "bg-surface-chighest");
  assertStringIncludes(html, "border-outline");
});

Deno.test("Switch — disabled renders a disabled button", () => {
  const html = render(
    h(Switch, { checked: false, onChange: () => {}, disabled: true }),
  );
  assertStringIncludes(html, "disabled");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/Switch.test.tsx`
Expected: FAIL — `Module not found` for `Switch.tsx`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/md3/Switch.tsx
import { cn } from "./tokens.ts";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  class?: string;
}

export function Switch(
  { checked, onChange, disabled, class: cls, ...rest }: SwitchProps,
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      class={cn(
        "relative shrink-0 w-[52px] h-8 rounded-full border-2 transition-colors duration-200 cursor-pointer",
        checked ? "bg-primary border-primary" : "bg-surface-chighest border-outline",
        disabled && "opacity-40 pointer-events-none",
        cls,
      )}
    >
      <span
        class={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
          checked
            ? "left-[22px] size-6 bg-on-primary"
            : "left-[6px] size-4 bg-outline",
        )}
        style={{ transitionTimingFunction: "var(--md-emphasized)" }}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A components/md3/Switch.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/Switch.tsx components/md3/Switch.test.tsx
git commit -m "feat(md3): add Switch"
```

---

### Task 3: TextField

**Files:**
- Create: `components/md3/TextField.tsx`
- Test: `components/md3/TextField.test.tsx`

**Interfaces:**
- Consumes: `cn`, `Icon`/`IconName` from `./Icon.tsx`
- Produces:
  ```ts
  TextField({
    label?: string, value: string, onInput: (value: string) => void,
    type?: string, name?: string, id?: string, placeholder?: string,
    supporting?: string, error?: string, icon?: IconName,
    trailing?: ComponentChildren, disabled?: boolean,
    multiline?: boolean, rows?: number,
    inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search",
    class?: string,
  })
  ```
  Used by Task 7 showcase and future member/settings forms.

Design decision (grilling record): **house style, not MD3 floating label** —
static label above a filled container, exactly the de-facto pattern in
`components/cards/CardForm.tsx` (label:
`md-label-medium uppercase tracking-wide text-on-surface-variant px-1 mb-1`;
container: `bg-surface-chighest rounded-[var(--md-shape-sm)] h-12 px-4`; input:
`md-body-large text-on-surface`; error text: `md-body-small text-error px-1
mt-1`). MD3 supplies the states: error switches container outline + supporting
text to `error`; focus shows a 2px primary active outline (focus-within);
disabled dims per MD3's 38% rule. `error` presence wins over `supporting`.
`aria-invalid` on error; `aria-describedby` wired when `id` is provided.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/TextField.test.tsx
import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { TextField } from "./TextField.tsx";

Deno.test("TextField — label above a filled container, house style", () => {
  const html = render(h(TextField, {
    label: "Name",
    value: "Frida",
    onInput: () => {},
  }));
  assertStringIncludes(html, "Name");
  assertStringIncludes(html, "md-label-medium");
  assertStringIncludes(html, "bg-surface-chighest");
  assertStringIncludes(html, 'value="Frida"');
});

Deno.test("TextField — error state shows message and aria-invalid", () => {
  const html = render(h(TextField, {
    id: "name",
    label: "Name",
    value: "",
    onInput: () => {},
    error: "Name is required",
  }));
  assertStringIncludes(html, "Name is required");
  assertStringIncludes(html, "text-error");
  assertStringIncludes(html, 'aria-invalid="true"');
  assertStringIncludes(html, 'aria-describedby="name-help"');
});

Deno.test("TextField — supporting text renders when no error", () => {
  const html = render(h(TextField, {
    value: "",
    onInput: () => {},
    supporting: "Visible to the household",
  }));
  assertStringIncludes(html, "Visible to the household");
  assertStringIncludes(html, "text-on-surface-variant");
});

Deno.test("TextField — multiline renders a textarea", () => {
  const html = render(h(TextField, {
    value: "notes",
    onInput: () => {},
    multiline: true,
    rows: 3,
  }));
  assertStringIncludes(html, "<textarea");
  assertStringIncludes(html, "notes");
});

Deno.test("TextField — no supporting row when neither error nor supporting", () => {
  const html = render(h(TextField, { value: "", onInput: () => {} }));
  assert(!html.includes("md-body-small"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/TextField.test.tsx`
Expected: FAIL — `Module not found` for `TextField.tsx`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/md3/TextField.tsx
import type { ComponentChildren } from "preact";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

interface TextFieldProps {
  label?: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  /** Helper line under the field; replaced by `error` when set. */
  supporting?: string;
  /** Error message; presence switches the field to its error state. */
  error?: string;
  icon?: IconName;
  trailing?: ComponentChildren;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search";
  class?: string;
}

export function TextField(
  {
    label,
    value,
    onInput,
    type = "text",
    name,
    id,
    placeholder,
    supporting,
    error,
    icon,
    trailing,
    disabled,
    multiline,
    rows = 3,
    inputMode,
    class: cls,
  }: TextFieldProps,
) {
  const invalid = Boolean(error);
  const helpId = id && (error || supporting) ? `${id}-help` : undefined;
  const handle = (e: Event) =>
    onInput((e.currentTarget as HTMLInputElement).value);
  const inputCls = cn(
    "flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large",
    disabled
      ? "text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]"
      : "text-on-surface",
  );
  return (
    <div class={cn("flex flex-col", cls)}>
      {label && (
        <label
          for={id}
          class="md-label-medium uppercase tracking-wide text-on-surface-variant px-1 mb-1"
        >
          {label}
        </label>
      )}
      <div
        class={cn(
          "flex items-center gap-2 rounded-[var(--md-shape-sm)] px-4",
          multiline ? "py-3" : "h-12",
          disabled
            ? "bg-[color-mix(in_srgb,var(--md-on-surface)_4%,transparent)]"
            : "bg-surface-chighest",
          invalid
            ? "outline outline-2 -outline-offset-2 outline-[var(--md-error)]"
            : "focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-[var(--md-primary)]",
        )}
      >
        {icon && (
          <span class="shrink-0 text-on-surface-variant">
            <Icon name={icon} size={20} />
          </span>
        )}
        {multiline
          ? (
            <textarea
              id={id}
              name={name}
              rows={rows}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={helpId}
              class={cn(inputCls, "resize-none")}
              onInput={handle}
            />
          )
          : (
            <input
              id={id}
              name={name}
              type={type}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              inputMode={inputMode}
              aria-invalid={invalid || undefined}
              aria-describedby={helpId}
              class={inputCls}
              onInput={handle}
            />
          )}
        {trailing}
      </div>
      {(error || supporting) && (
        <span
          id={helpId}
          class={cn(
            "md-body-small px-1 mt-1",
            error ? "text-error" : "text-on-surface-variant",
          )}
        >
          {error ?? supporting}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A components/md3/TextField.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/TextField.tsx components/md3/TextField.test.tsx
git commit -m "feat(md3): add TextField (house-style filled field)"
```

---

### Task 4: Extract Scrim from Sheet

**Files:**
- Create: `components/md3/Scrim.tsx`
- Modify: `components/md3/Sheet.tsx` (replace the inline scrim `<div>`)
- Test: `components/md3/Scrim.test.tsx`

**Interfaces:**
- Produces: `Scrim({ open: boolean, onClick?: () => void })` — an
  `absolute inset-0` layer; the parent must be `fixed`/`relative`. Used by
  `Sheet` (this task) and both dialogs (Tasks 5–6).

MD3 spec: scrim is 32% opacity black over the content behind a modal surface.
This is byte-for-byte the treatment `Sheet.tsx` already inlines
(`rgba(0,0,0,.32)`, `.3s var(--md-emphasized)` fade) — extraction, not change.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/Scrim.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Scrim } from "./Scrim.tsx";

Deno.test("Scrim — 32% black, fades with emphasized easing", () => {
  const html = render(h(Scrim, { open: true }));
  assertStringIncludes(html, "rgba(0,0,0,.32)");
  assertStringIncludes(html, "opacity:1");
  assertStringIncludes(html, 'aria-hidden="true"');
});

Deno.test("Scrim — transparent when closed", () => {
  const html = render(h(Scrim, { open: false }));
  assertStringIncludes(html, "opacity:0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/Scrim.test.tsx`
Expected: FAIL — `Module not found` for `Scrim.tsx`.

- [ ] **Step 3: Write Scrim and refactor Sheet**

```tsx
// components/md3/Scrim.tsx
interface ScrimProps {
  open: boolean;
  onClick?: () => void;
}

/** MD3 scrim: 32% black over content behind a modal surface. Positioned
 *  absolute — the parent overlay must establish the containing block. */
export function Scrim({ open, onClick }: ScrimProps) {
  return (
    <div
      onClick={onClick}
      aria-hidden="true"
      class="absolute inset-0"
      style={{
        background: "rgba(0,0,0,.32)",
        opacity: open ? 1 : 0,
        transition: "opacity .3s var(--md-emphasized)",
      }}
    />
  );
}
```

In `components/md3/Sheet.tsx`, add `import { Scrim } from "./Scrim.tsx";` and
replace the inline scrim block:

```tsx
      <div
        onClick={onClose}
        aria-hidden="true"
        class="absolute inset-0"
        style={{
          background: "rgba(0,0,0,.32)",
          opacity: open ? 1 : 0,
          transition: "opacity .3s var(--md-emphasized)",
        }}
      />
```

with:

```tsx
      <Scrim open={open} onClick={onClose} />
```

- [ ] **Step 4: Run the full md3 test suite to verify no regression**

Run: `deno test --unstable-kv -A components/md3/`
Expected: PASS — all existing tests plus the 2 new Scrim tests.

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/Scrim.tsx components/md3/Scrim.test.tsx components/md3/Sheet.tsx
git commit -m "refactor(md3): extract shared Scrim from Sheet"
```

---

### Task 5: Dialog (basic)

**Files:**
- Create: `components/md3/Dialog.tsx`
- Test: `components/md3/Dialog.test.tsx`

**Interfaces:**
- Consumes: `Scrim` (Task 4), `Icon`/`IconName`, `cn`
- Produces: `Dialog({ open: boolean, onClose: () => void, headline?: string,
  icon?: IconName, actions?: ComponentChildren, children?, class?: string })`
  — used by Task 6 (visual parity), Task 7 showcase.

MD3 basic dialog spec: container `surface-container-high` (house:
`surface-chigh`), radius 28dp = `--md-shape-xl`, elevation 3, 24dp padding,
min 280dp / max 560dp wide. Optional icon: 24dp, `secondary`, centered (then
headline centers too). Headline: `headline-small`, `on-surface`. Supporting
content: `body-medium`, `on-surface-variant`. Actions: right-aligned row.
Centered on screen — this is the point: it floats clear of the soft keyboard
(grilling decision Q3). Escape closes; always mounted, fades/scales like the
Sheet slides.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/Dialog.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Dialog } from "./Dialog.tsx";

Deno.test("Dialog — open: modal dialog with headline on surface-chigh", () => {
  const html = render(h(Dialog, {
    open: true,
    onClose: () => {},
    headline: "Rename list",
    children: "Pick a new name.",
  }));
  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, 'aria-modal="true"');
  assertStringIncludes(html, "Rename list");
  assertStringIncludes(html, "md-headline-small");
  assertStringIncludes(html, "bg-surface-chigh");
  assertStringIncludes(html, "md-elevation-3");
  assertStringIncludes(html, "pointer-events:auto");
});

Deno.test("Dialog — closed: inert and invisible", () => {
  const html = render(h(Dialog, { open: false, onClose: () => {} }));
  assertStringIncludes(html, "pointer-events:none");
  assertStringIncludes(html, "opacity:0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/Dialog.test.tsx`
Expected: FAIL — `Module not found` for `Dialog.tsx`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/md3/Dialog.tsx
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { Icon, type IconName } from "./Icon.tsx";
import { Scrim } from "./Scrim.tsx";
import { cn } from "./tokens.ts";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  headline?: string;
  icon?: IconName;
  /** Right-aligned action row — pass `Button variant="text"` children. */
  actions?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 basic dialog: centered, so short typed input stays clear of the soft
 *  keyboard. Keyboard-less confirmations stay on `Sheet` (patterns doc §9). */
export function Dialog(
  { open, onClose, headline, icon, actions, children, class: cls }: DialogProps,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div
      class="fixed inset-0 z-[200] grid place-items-center p-6"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        class={cn(
          "relative bg-surface-chigh rounded-[var(--md-shape-xl)] md-elevation-3 p-6 w-full min-w-[280px] max-w-[560px] sm:w-auto sm:min-w-[320px] max-h-full overflow-y-auto flex flex-col gap-4",
          cls,
        )}
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.9)",
          transition:
            "opacity .2s var(--md-emphasized), transform .3s var(--md-emphasized-decel)",
        }}
      >
        {icon && (
          <div class="grid place-items-center text-secondary">
            <Icon name={icon} size={24} />
          </div>
        )}
        {headline && (
          <h2
            class={cn(
              "md-headline-small text-on-surface",
              icon && "text-center",
            )}
          >
            {headline}
          </h2>
        )}
        {children && (
          <div class="md-body-medium text-on-surface-variant">{children}</div>
        )}
        {actions && <div class="flex justify-end gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A components/md3/Dialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/Dialog.tsx components/md3/Dialog.test.tsx
git commit -m "feat(md3): add basic Dialog"
```

---

### Task 6: FullScreenDialog

**Files:**
- Create: `components/md3/FullScreenDialog.tsx`
- Test: `components/md3/FullScreenDialog.test.tsx`

**Interfaces:**
- Consumes: `Scrim`, `IconButton` (props: `name: IconName`,
  `"aria-label": string`, `onClick`), `cn`
- Produces: `FullScreenDialog({ open: boolean, onClose: () => void,
  title: string, action?: ComponentChildren, children?, class?: string })` —
  used by Task 7 showcase; future multi-field create/edit flows.

MD3 full-screen dialog spec: full-bleed `surface` container; 56dp header with
a close affordance (leading, the `"x"` icon), `title-large` title, and the
commit action (trailing, a text `Button`). Slides up with emphasized-decel
(parity with `Sheet`). On expanded screens (Tailwind `sm:` ≈ MD3 600dp) it
renders as a centered dialog-like container instead — max 560dp wide, 85dvh
tall, `--md-shape-xl` radius. Closed transform is `translateY(100dvh)` (a full
viewport, not 100% of own height — the desktop container is not full-height,
so `100%` would leave it visible mid-screen). Safe-area padded top and bottom.
Escape closes.

- [ ] **Step 1: Write the failing test**

```tsx
// components/md3/FullScreenDialog.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { FullScreenDialog } from "./FullScreenDialog.tsx";

Deno.test("FullScreenDialog — open: header with close, title, action", () => {
  const html = render(h(FullScreenDialog, {
    open: true,
    onClose: () => {},
    title: "New member",
    action: "SAVE_ACTION_SLOT",
    children: "form goes here",
  }));
  assertStringIncludes(html, 'role="dialog"');
  assertStringIncludes(html, "New member");
  assertStringIncludes(html, "md-title-large");
  assertStringIncludes(html, 'aria-label="Close"');
  assertStringIncludes(html, "SAVE_ACTION_SLOT");
  assertStringIncludes(html, "form goes here");
});

Deno.test("FullScreenDialog — closed: inert, slid a full viewport down", () => {
  const html = render(h(FullScreenDialog, {
    open: false,
    onClose: () => {},
    title: "New member",
  }));
  assertStringIncludes(html, "pointer-events:none");
  assertStringIncludes(html, "translateY(100dvh)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A components/md3/FullScreenDialog.test.tsx`
Expected: FAIL — `Module not found` for `FullScreenDialog.tsx`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/md3/FullScreenDialog.tsx
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { IconButton } from "./IconButton.tsx";
import { Scrim } from "./Scrim.tsx";
import { cn } from "./tokens.ts";

interface FullScreenDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Commit affordance in the header — pass a `Button variant="text"`. */
  action?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 full-screen dialog: multi-field create/edit flows on mobile; renders
 *  as a centered dialog on larger screens (patterns doc §9). */
export function FullScreenDialog(
  { open, onClose, title, action, children, class: cls }: FullScreenDialogProps,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div
      class="fixed inset-0 z-[200] grid sm:place-items-center"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        class={cn(
          "relative bg-surface md-elevation-3 flex flex-col w-full h-full sm:h-auto sm:max-h-[85dvh] sm:max-w-[560px] sm:rounded-[var(--md-shape-xl)]",
          cls,
        )}
        style={{
          transform: open ? "translateY(0)" : "translateY(100dvh)",
          transition: "transform .4s var(--md-emphasized-decel)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <header class="shrink-0 h-14 flex items-center gap-1 pl-1 pr-3">
          <IconButton name="x" aria-label="Close" onClick={onClose} />
          <h2 class="md-title-large text-on-surface flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {title}
          </h2>
          {action}
        </header>
        <div
          class="flex-1 min-h-0 overflow-y-auto px-6"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test --unstable-kv -A components/md3/FullScreenDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Format, check, commit**

```bash
deno fmt && deno task check
git add components/md3/FullScreenDialog.tsx components/md3/FullScreenDialog.test.tsx
git commit -m "feat(md3): add FullScreenDialog"
```

---

### Task 7: Dev-only showcase at /design

**Files:**
- Create: `routes/design/index.tsx`
- Create: `islands/design/DesignShowcase.tsx`
- Test: `islands/design/DesignShowcase.test.tsx`

**Interfaces:**
- Consumes: every md3 component; `useSignal` from `@preact/signals`;
  `HttpError`/`page` from `"fresh"`; `define` from `@/utils/index.ts`.
- Produces: `/design` page — the live-verification surface for this PR and
  future component work.

Production gate: `DENO_DEPLOYMENT_ID` is set on Deno Deploy (same signal
`scripts/seed.ts` uses) → `throw new HttpError(404)` (Fresh 2 replacement for
`ctx.renderNotFound()`, verified via Context7). The route sits behind the
auth middleware like everything else — fine, dev has a seeded login.

- [ ] **Step 1: Write the failing test**

```tsx
// islands/design/DesignShowcase.test.tsx
import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DesignShowcase from "./DesignShowcase.tsx";

Deno.test("DesignShowcase — renders a section per component family", () => {
  const html = render(h(DesignShowcase, {}));
  for (
    const section of [
      "Buttons",
      "Text fields",
      "Switches",
      "Dividers & lists",
      "Dialogs",
      "Chips & segmented",
      "Feedback",
    ]
  ) {
    assertStringIncludes(html, section);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --unstable-kv -A islands/design/DesignShowcase.test.tsx`
Expected: FAIL — `Module not found` for `DesignShowcase.tsx`.

- [ ] **Step 3: Write the island**

```tsx
// islands/design/DesignShowcase.tsx
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { Button } from "@/components/md3/Button.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { Divider } from "@/components/md3/Divider.tsx";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { ListSubheader } from "@/components/md3/ListSubheader.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Spinner } from "@/components/md3/Spinner.tsx";
import { Switch } from "@/components/md3/Switch.tsx";
import { TextField } from "@/components/md3/TextField.tsx";

function Section(
  { title, children }: { title: string; children?: ComponentChildren },
) {
  return (
    <section class="flex flex-col gap-3">
      <h2 class="md-title-medium text-on-surface pt-6">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignShowcase() {
  const name = useSignal("");
  const notes = useSignal("");
  const seg = useSignal("plan");
  const wake = useSignal(true);
  const push = useSignal(false);
  const dialogOpen = useSignal(false);
  const dialogName = useSignal("");
  const fsOpen = useSignal(false);
  const sheetOpen = useSignal(false);
  const snack = useSignal<{ msg: string } | null>(null);
  return (
    <div class="flex flex-col gap-2 pb-24">
      <h1 class="md-headline-small text-on-surface pt-4">MD3 showcase</h1>
      <p class="md-body-medium text-on-surface-variant">
        Dev-only. Every component in its states — the live-verification
        surface for component work.
      </p>

      <Section title="Buttons">
        <div class="flex flex-wrap gap-2 items-center">
          <Button>Filled</Button>
          <Button variant="tonal">Tonal</Button>
          <Button variant="elevated">Elevated</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="text">Text</Button>
          <Button variant="error">Error</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button icon="plus">With icon</Button>
          <IconButton name="edit" aria-label="Edit" />
          <IconButton name="trash" variant="tonal" aria-label="Delete" />
        </div>
      </Section>

      <Section title="Text fields">
        <TextField
          id="sc-name"
          label="Name"
          value={name.value}
          onInput={(v) => name.value = v}
          placeholder="e.g. Frida"
          supporting="Visible to the household"
          icon="user"
        />
        <TextField
          id="sc-error"
          label="With error"
          value=""
          onInput={() => {}}
          error="Name is required"
        />
        <TextField
          id="sc-disabled"
          label="Disabled"
          value="Can't touch this"
          onInput={() => {}}
          disabled
        />
        <TextField
          id="sc-notes"
          label="Notes (multiline)"
          value={notes.value}
          onInput={(v) => notes.value = v}
          multiline
          rows={3}
        />
      </Section>

      <Section title="Switches">
        <Card pad={0}>
          <ListItem
            headline="Keep screen awake"
            supporting="While the shopping list is open"
            trailing={
              <Switch
                checked={wake.value}
                onChange={(v) => wake.value = v}
                aria-label="Keep screen awake"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Notifications"
            supporting="Due to-dos on this device"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Notifications"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Disabled switch"
            trailing={
              <Switch checked={false} onChange={() => {}} disabled aria-label="Disabled" />
            }
          />
        </Card>
      </Section>

      <Section title="Dividers & lists">
        <Card pad={0}>
          <ListSubheader>General</ListSubheader>
          <ListItem headline="A list item" supporting="With supporting text" />
          <Divider inset />
          <ListItem headline="Another item" trailing="Meta" />
          <Divider />
          <ListSubheader>Danger zone</ListSubheader>
          <ListItem headline="Full-width divider above" />
        </Card>
      </Section>

      <Section title="Dialogs">
        <div class="flex flex-wrap gap-2">
          <Button variant="tonal" onClick={() => dialogOpen.value = true}>
            Basic dialog
          </Button>
          <Button variant="tonal" onClick={() => fsOpen.value = true}>
            Full-screen dialog
          </Button>
          <Button variant="tonal" onClick={() => sheetOpen.value = true}>
            Sheet (for comparison)
          </Button>
        </div>
      </Section>

      <Section title="Chips & segmented">
        <div class="flex flex-wrap gap-2">
          <Chip selected>Selected</Chip>
          <Chip>Unselected</Chip>
          <Chip icon="tag">With icon</Chip>
        </div>
        <Segmented
          options={[["plan", "edit", "Plan"], ["shop", "cart", "Shop"]]}
          value={seg.value}
          onChange={(v) => seg.value = v}
        />
      </Section>

      <Section title="Feedback">
        <div class="flex items-center gap-4">
          <Spinner />
          <div class="flex-1">
            <Progress value={3} total={5} />
          </div>
          <Button
            variant="text"
            onClick={() => {
              snack.value = { msg: "Saved to the household" };
              setTimeout(() => snack.value = null, 3000);
            }}
          >
            Snackbar
          </Button>
        </div>
      </Section>

      <Dialog
        open={dialogOpen.value}
        onClose={() => dialogOpen.value = false}
        headline="Rename list"
        actions={
          <>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Cancel
            </Button>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Rename
            </Button>
          </>
        }
      >
        <div class="pt-2">
          <TextField
            id="sc-dialog-name"
            label="Name"
            value={dialogName.value}
            onInput={(v) => dialogName.value = v}
            placeholder="Type with the keyboard open"
          />
        </div>
      </Dialog>

      <FullScreenDialog
        open={fsOpen.value}
        onClose={() => fsOpen.value = false}
        title="New member"
        action={
          <Button variant="text" onClick={() => fsOpen.value = false}>
            Save
          </Button>
        }
      >
        <div class="flex flex-col gap-4 pt-2">
          <TextField
            id="sc-fs-name"
            label="Name"
            value={name.value}
            onInput={(v) => name.value = v}
          />
          <TextField
            id="sc-fs-notes"
            label="Notes"
            value={notes.value}
            onInput={(v) => notes.value = v}
            multiline
          />
          <ListItem
            headline="Manager"
            supporting="Can edit members and delete"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Manager"
              />
            }
          />
        </div>
      </FullScreenDialog>

      <Sheet
        open={sheetOpen.value}
        onClose={() => sheetOpen.value = false}
        title="A bottom sheet"
      >
        <p class="md-body-large text-on-surface pb-4">
          Sheets stay the home of keyboard-less overlays: confirmations,
          action lists, pickers.
        </p>
        <Button full onClick={() => sheetOpen.value = false}>Got it</Button>
      </Sheet>

      <Snackbar data={snack.value} />
    </div>
  );
}
```

Prop signatures verified against source: `Sheet({ open, onClose, title?,
size?, children })`, `Progress({ value, total, height? })`,
`Snackbar({ data: { msg, action?, onAction? } | null })`,
`IconButton({ name, "aria-label", variant?, onClick? })`, `Card({ variant?,
pad?, radius?, onClick? })`, `Segmented({ options: [value, icon, label][],
value, onChange })`.

- [ ] **Step 4: Write the route**

```tsx
// routes/design/index.tsx
import { HttpError, page } from "fresh";
import { define } from "@/utils/index.ts";
import DesignShowcase from "@/islands/design/DesignShowcase.tsx";

export const handler = define.handlers({
  GET() {
    // Dev-only: DENO_DEPLOYMENT_ID is set on Deno Deploy (prod + previews).
    if (Deno.env.get("DENO_DEPLOYMENT_ID")) throw new HttpError(404);
    return page({});
  },
});

export default define.page<typeof handler>(function Design() {
  return (
    <main class="max-w-md mx-auto px-4">
      <DesignShowcase />
    </main>
  );
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --unstable-kv -A islands/design/DesignShowcase.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Format, check, commit**

```bash
deno fmt && deno task check
git add routes/design/index.tsx islands/design/
git commit -m "feat(design): dev-only component showcase at /design"
```

---

### Task 8: Patterns doc — new components + Sheet/Dialog boundary

**Files:**
- Modify: `docs/ui-ux-patterns.md` (§9, lines ~312–331, and the §13 checklist
  bullet that says "Confirmations use a bottom Sheet" if present)

**Interfaces:** none — documentation.

- [ ] **Step 1: Replace §9's How/See paragraphs**

Replace the current **How:** and **See:** block of section 9 with:

```markdown
**How:** Reach for the existing pieces first: `Button`, `IconButton`,
`Pressable`, `Card`, `Sheet` (bottom sheets), `Dialog`, `FullScreenDialog`,
`TextField`, `Switch`, `Snackbar`, `Spinner`, `Progress`, `Chip`, `Segmented`,
`ListItem`, `ListSubheader`, `Divider`, `Icon`, `SearchBar`, `Stepper`,
`RoundCheck`, `PullToRefresh`, `FabMenu`, `CategoryPickerList`.

**Overlay boundary (Sheet vs Dialog):**

- **`Sheet`** is the default for keyboard-less overlays: confirmations
  (always), action lists, pickers, informational content. Never a browser
  `confirm()`.
- **`Dialog`** (basic, centered) is for short typed input — one or two
  fields — or an urgent decision that needs typing. Centered keeps it clear
  of the soft keyboard, which a bottom sheet fights.
- **`FullScreenDialog`** is for multi-field create/edit flows on mobile; on
  larger screens it renders as a centered dialog.

**See:** `components/md3/` (component set), `components/md3/tokens.ts` (tokens
+ `cn` helper), `/design` (dev-only showcase of every component and state —
404s in production; use it to verify component changes live).
```

- [ ] **Step 2: Update the checklist**

Find the §13-style checklist line
`- [ ] UI is composed from MD3 components + tokens, not hand-rolled` (around
line 563) — verify the surrounding items; if any says confirmations must use a
Sheet "not a center modal", reword it to match the boundary above (Sheets for
keyboard-less overlays; Dialogs for typed input).

- [ ] **Step 3: Format, check, commit**

```bash
deno fmt && deno task check
git add docs/ui-ux-patterns.md
git commit -m "docs(ui-ux): record Sheet vs Dialog boundary and new md3 components"
```

---

### Task 9: Full verification (suite + live browser)

**Files:** none new. Fixes go into the files above if issues surface.

- [ ] **Step 1: Full test suite and checks**

Run: `deno task test && deno task check`
Expected: all tests pass, fmt/lint/types clean.

- [ ] **Step 2: Live verification on the worktree dev server**

Per the browser-e2e recipe (memory): seed `.env` +
`KV_PATH=data/kv.db` + `deno task db:seed` if not already done; start the
worktree dev server on a non-default port (launch config `dev-wt`,
`runtimeArgs: ["task","dev","--port","5178"]`); log in with the seeded user
(curl the login POST, set the cookie via `document.cookie`).

Then on `/design`, with **real pointer interactions** (never synthetic
`.click()` — false passes):

1. Type into the "Name" TextField — value updates, focus ring shows.
2. Trigger the error TextField — red outline + message present.
3. Toggle both switches — thumb slides, track color flips.
4. Open the basic dialog — scrim + centered card; type in its TextField;
   Escape closes it (desktop).
5. Open the full-screen dialog — slides up full-bleed at mobile viewport
   (resize to 375×812); ✕ closes; at desktop width it renders centered
   with rounded corners.
6. Open the Sheet — unchanged behavior (scrim regression check for Task 4).
7. Screenshot the page and each dialog for the PR.

- [ ] **Step 3: Confirm the production gate**

Run: `DENO_DEPLOYMENT_ID=fake deno test --unstable-kv -A islands/design/` —
tests still pass (gate lives in the route, not the island). Then verify the
gate by reading `routes/design/index.tsx` — the guard must check
`Deno.env.get("DENO_DEPLOYMENT_ID")` before `page({})`.

- [ ] **Step 4: Commit any verification fixes**

```bash
deno fmt && deno task check
git add -A && git commit -m "fix(md3): address live-verification findings"
```

(Skip if nothing surfaced.)
