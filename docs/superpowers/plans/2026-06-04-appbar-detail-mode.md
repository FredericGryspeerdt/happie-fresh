# AppBar Detail Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the AppBar a detail mode that shows a back button + list name on shopping list detail pages, and move logout from the AppBar header into the section sub-nav.

**Architecture:** `StateInterface` gains an optional `appBar` field that route handlers populate. `_app.tsx` reads it to choose between section mode (existing) and detail mode (new). The `AppBar` island gets a discriminated union prop type — section mode keeps the ≡ toggle with logout in the sub-nav panel; detail mode renders only ← + title.

**Tech Stack:** Deno, Fresh 2, Preact, `@preact/signals`, Tailwind CSS v4

---

## File Map

| Action | File |
|--------|------|
| Modify | `utils/define.ts` — add `AppBarDetail`, add `appBar?` to `StateInterface` |
| Modify | `islands/AppBar.tsx` — discriminated union props, detail mode render, logout → sub-nav |
| Modify | `islands/AppBar.test.tsx` — update section tests for `mode`, add detail mode tests |
| Modify | `routes/shopping/[id]/index.tsx` — set `ctx.state.appBar`, remove in-page back link |
| Modify | `routes/_app.tsx` — import `StateInterface`, branch on `state.appBar` |

---

## Task 1: Extend StateInterface

**Files:**
- Modify: `utils/define.ts`

No unit tests — this is a type-only change verified by `deno task check`.

- [ ] **Step 1: Update `utils/define.ts`**

  Replace the full file contents:

  ```ts
  import { createDefine } from "fresh";
  import { ItemInterface, ShoppingListItemInterface } from "../models/index.ts";

  export interface AppBarDetail {
    mode: "detail";
    title: string;
    backUrl: string;
  }

  export interface StateInterface {
    userId?: string;
    householdId?: string;
    items?: ItemInterface[];
    shoppingList?: ShoppingListItemInterface[];
    error?: string;
    appBar?: AppBarDetail;
  }

  // Setup, do this once in a file and import it everywhere else.
  export const define = createDefine<StateInterface>();
  ```

- [ ] **Step 2: Run type check**

  ```
  deno task check
  ```

  Expected: 9 pre-existing lint warnings in `islands/` and `utils/root-page.ts`, no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add utils/define.ts
  git commit -m "feat(appbar): add AppBarDetail type and appBar field to StateInterface"
  ```

---

## Task 2: Update AppBar island (TDD)

**Files:**
- Modify: `islands/AppBar.test.tsx`
- Modify: `islands/AppBar.tsx`

- [ ] **Step 1: Replace `islands/AppBar.test.tsx` with updated tests**

  The existing 5 tests are replaced with 9 tests (5 updated section-mode + 4 new detail-mode). Key change: all section-mode tests gain `mode: "section"`. The logout test changes from "renders in header" to "not in closed-state render" (logout moved to sub-nav panel which is closed in SSR).

  ```tsx
  import {
    assertFalse,
    assertStringIncludes,
  } from "jsr:@std/assert@^1.0.19";
  import { render } from "npm:preact-render-to-string@^6.6.3";
  import { h } from "preact";
  import AppBar from "./AppBar.tsx";
  import type { SubNavItem } from "@/config/navigation.ts";

  const subNavItems: SubNavItem[] = [
    { label: "My Lists", route: "/shopping" },
    { label: "Item Catalogue", route: "/shopping/catalogue" },
  ];

  // ── Section mode ──────────────────────────────────────────────────────────

  Deno.test("AppBar (section) — renders the active section label", () => {
    const html = render(
      h(AppBar, {
        mode: "section",
        activeTabLabel: "Shopping",
        subNavItems,
        activeRoute: "/shopping",
      }),
    );
    assertStringIncludes(html, "Shopping");
  });

  Deno.test("AppBar (section) — renders the menu toggle button", () => {
    const html = render(
      h(AppBar, {
        mode: "section",
        activeTabLabel: "Shopping",
        subNavItems,
        activeRoute: "/shopping",
      }),
    );
    assertStringIncludes(html, "Open navigation menu");
  });

  Deno.test(
    "AppBar (section) — does not render sub-nav panel in initial closed state",
    () => {
      const html = render(
        h(AppBar, {
          mode: "section",
          activeTabLabel: "Shopping",
          subNavItems,
          activeRoute: "/shopping",
        }),
      );
      assertFalse(html.includes("My Lists"));
      assertFalse(html.includes("Item Catalogue"));
    },
  );

  Deno.test(
    "AppBar (section) — logout link not in header (lives in sub-nav panel, closed in SSR)",
    () => {
      const html = render(
        h(AppBar, {
          mode: "section",
          activeTabLabel: "Shopping",
          subNavItems,
          activeRoute: "/shopping",
          logoutRoute: "/logout",
        }),
      );
      assertFalse(html.includes('href="/logout"'));
    },
  );

  Deno.test(
    "AppBar (section) — does not render logout when logoutRoute is omitted",
    () => {
      const html = render(
        h(AppBar, {
          mode: "section",
          activeTabLabel: "Shopping",
          subNavItems,
          activeRoute: "/shopping",
        }),
      );
      assertFalse(html.includes("Logout"));
    },
  );

  // ── Detail mode ───────────────────────────────────────────────────────────

  Deno.test("AppBar (detail) — renders the page title", () => {
    const html = render(
      h(AppBar, {
        mode: "detail",
        title: "Weekly Groceries",
        backUrl: "/shopping",
      }),
    );
    assertStringIncludes(html, "Weekly Groceries");
  });

  Deno.test("AppBar (detail) — renders back link to backUrl", () => {
    const html = render(
      h(AppBar, {
        mode: "detail",
        title: "Weekly Groceries",
        backUrl: "/shopping",
      }),
    );
    assertStringIncludes(html, 'href="/shopping"');
    assertStringIncludes(html, "Back");
  });

  Deno.test("AppBar (detail) — does not render toggle button", () => {
    const html = render(
      h(AppBar, {
        mode: "detail",
        title: "Weekly Groceries",
        backUrl: "/shopping",
      }),
    );
    assertFalse(html.includes("navigation menu"));
  });

  Deno.test("AppBar (detail) — does not render logout", () => {
    const html = render(
      h(AppBar, {
        mode: "detail",
        title: "Weekly Groceries",
        backUrl: "/shopping",
      }),
    );
    assertFalse(html.includes("Logout"));
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  deno test islands/AppBar.test.tsx
  ```

  Expected: type errors because `AppBar` does not yet accept a `mode` prop.

- [ ] **Step 3: Replace `islands/AppBar.tsx` with updated implementation**

  ```tsx
  import { useSignal } from "@preact/signals";
  import { useEffect, useRef } from "preact/hooks";
  import type { SubNavItem } from "@/config/navigation.ts";

  type AppBarProps =
    | {
        mode: "section";
        activeTabLabel: string;
        subNavItems: SubNavItem[];
        activeRoute: string;
        logoutRoute?: string;
      }
    | {
        mode: "detail";
        title: string;
        backUrl: string;
      };

  export default function AppBar(props: AppBarProps) {
    const open = useSignal(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open.value) return;
      const handleClick = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          open.value = false;
        }
      };
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }, [open.value]);

    if (props.mode === "detail") {
      return (
        <div ref={containerRef} class="relative z-50">
          <header class="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
            <a
              href={props.backUrl}
              class="text-blue-600 text-xl"
              aria-label="Back"
            >
              ←
            </a>
            <span class="flex-1 font-bold text-xl truncate">{props.title}</span>
          </header>
        </div>
      );
    }

    const { activeTabLabel, subNavItems, activeRoute, logoutRoute } = props;

    return (
      <div ref={containerRef} class="relative z-50">
        <header class="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
          <span class="font-bold text-xl">{activeTabLabel}</span>
          {subNavItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                open.value = !open.value;
              }}
              aria-label={open.value
                ? "Close navigation menu"
                : "Open navigation menu"}
              aria-expanded={open.value}
              class="p-1 text-gray-600 text-xl"
            >
              {open.value ? "✕" : "≡"}
            </button>
          )}
        </header>
        {open.value && (
          <nav
            class="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-md"
            aria-label="Section navigation"
          >
            <ul class="py-2">
              {subNavItems.map((item) => (
                <li key={item.route}>
                  <a
                    href={item.route}
                    class={`block px-6 py-3 text-sm ${
                      item.route === activeRoute
                        ? "text-blue-600 font-medium"
                        : "text-gray-700"
                    }`}
                    aria-current={item.route === activeRoute
                      ? "page"
                      : undefined}
                    onClick={() => {
                      open.value = false;
                    }}
                  >
                    {item.route === activeRoute
                      ? `› ${item.label}`
                      : item.label}
                  </a>
                </li>
              ))}
              {logoutRoute && (
                <>
                  <li
                    role="separator"
                    class="my-2 border-t border-gray-100"
                  />
                  <li>
                    <a
                      href={logoutRoute}
                      class="block px-6 py-3 text-sm text-red-500"
                    >
                      Logout
                    </a>
                  </li>
                </>
              )}
            </ul>
          </nav>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```
  deno test islands/AppBar.test.tsx
  ```

  Expected: `ok | 9 passed | 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add islands/AppBar.tsx islands/AppBar.test.tsx
  git commit -m "feat(appbar): add detail mode, move logout to sub-nav"
  ```

---

## Task 3: Update list detail route

**Files:**
- Modify: `routes/shopping/[id]/index.tsx`

No unit tests — type-checked by `deno task check`.

- [ ] **Step 1: Replace `routes/shopping/[id]/index.tsx`**

  Changes: handler sets `ctx.state.appBar` before calling `page()`. Page component removes the `← Lists` back link and the `<h1>` title (AppBar now owns both).

  ```tsx
  import { page } from "fresh";
  import {
    CategoryRepo,
    ItemRepo,
    ShoppingListItemRepo,
    ShoppingListRepo,
  } from "@/database/index.ts";
  import ItemsIsland from "@/islands/items.tsx";
  import { define } from "@/utils/index.ts";

  export const handler = define.handlers({
    async GET(ctx) {
      const householdId = ctx.state.householdId!;
      const listId = ctx.params.id;
      const list = await ShoppingListRepo.getById(householdId, listId);
      if (!list) {
        return new Response("Not found", { status: 404 });
      }
      ctx.state.appBar = {
        mode: "detail",
        title: list.name,
        backUrl: "/shopping",
      };
      const [items, shoppingList, categories] = await Promise.all([
        ItemRepo.readAll(),
        ShoppingListItemRepo.getAll(listId),
        CategoryRepo.getAll(),
      ]);
      return page({ list, items, shoppingList, categories });
    },
  });

  export default define.page<typeof handler>(function ListDetail({ data }) {
    return (
      <main class="max-w-md mx-auto p-4">
        <ItemsIsland
          listId={data.list.id}
          items={data.items}
          shoppingList={data.shoppingList}
          categories={data.categories}
        />
      </main>
    );
  });
  ```

- [ ] **Step 2: Run type check**

  ```
  deno task check
  ```

  Expected: no new errors. `ctx.state.appBar` is now typed correctly because `StateInterface` has `appBar?: AppBarDetail`.

- [ ] **Step 3: Commit**

  ```bash
  git add "routes/shopping/[id]/index.tsx"
  git commit -m "feat(appbar): set detail AppBar context from list detail handler"
  ```

---

## Task 4: Update _app.tsx

**Files:**
- Modify: `routes/_app.tsx`

- [ ] **Step 1: Replace `routes/_app.tsx`**

  Changes: import `StateInterface` from `@/utils/define.ts` (removes local `State` interface), branch on `state.appBar` to choose AppBar mode.

  ```tsx
  import { type PageProps } from "fresh";
  import { Head } from "fresh/runtime";
  import { NAV_CONFIG, resolveActiveTab } from "@/config/navigation.ts";
  import TabBar from "@/components/TabBar.tsx";
  import AppBar from "@/islands/AppBar.tsx";
  import { type StateInterface } from "@/utils/define.ts";

  export default function App(
    { Component, state, url }: PageProps<unknown, StateInterface>,
  ) {
    const activeTab = resolveActiveTab(url.pathname);

    return (
      <html>
        <Head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>happie-fresh</title>
          <link
            crossorigin="use-credentials"
            rel="manifest"
            href="/manifest.webmanifest"
          />
          <script type="module">
            import
            "https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate/dist/pwa-update.js";
            const el = document.createElement("pwa-update");
            document.body.appendChild(el);
          </script>
        </Head>
        <body class="pb-16">
          {state?.userId && (
            <>
              {state.appBar ? (
                <AppBar
                  mode="detail"
                  title={state.appBar.title}
                  backUrl={state.appBar.backUrl}
                />
              ) : (
                <AppBar
                  mode="section"
                  activeTabLabel={activeTab?.label ?? "Happie"}
                  subNavItems={activeTab?.subNav ?? []}
                  activeRoute={url.pathname}
                  logoutRoute="/logout"
                />
              )}
              <TabBar
                items={NAV_CONFIG}
                activeTabId={activeTab?.id}
              />
            </>
          )}
          <Component />
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 2: Run all tests**

  ```
  deno test
  ```

  Expected: `ok | 54 passed | 0 failed` (50 existing + 4 new AppBar detail-mode tests).

- [ ] **Step 3: Run type check**

  ```
  deno task check
  ```

  Expected: no new errors.

- [ ] **Step 4: Commit**

  ```bash
  git add routes/_app.tsx
  git commit -m "feat(appbar): branch on state.appBar for detail vs section mode in layout"
  ```

---

## Done

On list detail pages the AppBar now shows ← + list name. On all other pages it shows the section title + ≡ sub-nav with logout at the bottom of the panel.
