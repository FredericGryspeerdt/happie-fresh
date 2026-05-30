# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat header navbar with a bottom `TabBar` (main features) + `AppBar` island (section header + slide-down sub-nav), as specified in `docs/superpowers/specs/2026-05-30-navigation-design.md`.

**Architecture:** Active state (which tab, which sub-route) is resolved server-side in `_app.tsx` using a central `NAV_CONFIG` and passed as props to both new components. `TabBar` is a static server-rendered component (just `<a>` links); `AppBar` is an island that owns the open/close toggle signal.

**Tech Stack:** Deno, Fresh 2, Preact, `@preact/signals`, Tailwind CSS v4, `preact-render-to-string` (tests), `@std/assert` (tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `config/navigation.ts` | NAV_CONFIG, types, `resolveActiveTab` helper |
| Create | `config/navigation.test.ts` | Unit tests for `resolveActiveTab` |
| Create | `components/TabBar.tsx` | Server-rendered bottom tab bar |
| Create | `components/TabBar.test.tsx` | Render tests for TabBar |
| Create | `islands/AppBar.tsx` | Header + slide-down sub-nav island |
| Create | `islands/AppBar.test.tsx` | SSR render tests for AppBar (closed state) |
| Modify | `routes/_app.tsx` | Wire AppBar + TabBar, remove old header |

---

## Task 1: Navigation config

**Files:**
- Create: `config/navigation.ts`
- Create: `config/navigation.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `config/navigation.test.ts`:

  ```ts
  import { assertEquals } from "jsr:@std/assert@^1.0.19";
  import { resolveActiveTab } from "@/config/navigation.ts";

  Deno.test("resolveActiveTab — /lists matches shopping-lists", () => {
    assertEquals(resolveActiveTab("/lists")?.id, "shopping-lists");
  });

  Deno.test("resolveActiveTab — /items matches shopping-lists", () => {
    assertEquals(resolveActiveTab("/items")?.id, "shopping-lists");
  });

  Deno.test("resolveActiveTab — /categories/manage matches shopping-lists", () => {
    assertEquals(resolveActiveTab("/categories/manage")?.id, "shopping-lists");
  });

  Deno.test("resolveActiveTab — /lists/some-id matches shopping-lists via prefix", () => {
    assertEquals(resolveActiveTab("/lists/some-id")?.id, "shopping-lists");
  });

  Deno.test("resolveActiveTab — /login matches no tab", () => {
    assertEquals(resolveActiveTab("/login"), undefined);
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  deno test config/navigation.test.ts
  ```

  Expected: error — `Cannot find module '@/config/navigation.ts'`

- [ ] **Step 3: Implement `config/navigation.ts`**

  Create `config/navigation.ts`:

  ```ts
  export interface SubNavItem {
    label: string;
    route: string;
  }

  export interface NavItem {
    id: string;
    label: string;
    icon: string;
    defaultRoute: string;
    routes: string[];
    subNav: SubNavItem[];
  }

  export const NAV_CONFIG: NavItem[] = [
    {
      id: "shopping-lists",
      label: "Lists",
      icon: "🛒",
      defaultRoute: "/lists",
      routes: ["/lists", "/items", "/categories"],
      subNav: [
        { label: "My Lists", route: "/lists" },
        { label: "Item Catalogue", route: "/items" },
        { label: "Categories", route: "/categories/manage" },
      ],
    },
  ];

  export function resolveActiveTab(pathname: string): NavItem | undefined {
    return NAV_CONFIG.find((item) =>
      item.routes.some(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      )
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```
  deno test config/navigation.test.ts
  ```

  Expected: `ok | 5 passed | 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add config/navigation.ts config/navigation.test.ts
  git commit -m "feat(navigation): add NAV_CONFIG and resolveActiveTab helper"
  ```

---

## Task 2: TabBar component

**Files:**
- Create: `components/TabBar.tsx`
- Create: `components/TabBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `components/TabBar.test.tsx`:

  ```tsx
  import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
  import { render } from "npm:preact-render-to-string@^6.6.3";
  import { h } from "preact";
  import TabBar from "./TabBar.tsx";
  import type { NavItem } from "@/config/navigation.ts";

  const items: NavItem[] = [
    {
      id: "shopping-lists",
      label: "Lists",
      icon: "🛒",
      defaultRoute: "/lists",
      routes: ["/lists"],
      subNav: [],
    },
    {
      id: "feature-2",
      label: "Feature 2",
      icon: "📦",
      defaultRoute: "/feature-2",
      routes: ["/feature-2"],
      subNav: [],
    },
  ];

  Deno.test("TabBar — renders icon and label for each item", () => {
    const html = render(h(TabBar, { items, activeTabId: "shopping-lists" }));
    assertStringIncludes(html, "🛒");
    assertStringIncludes(html, "Lists");
    assertStringIncludes(html, "📦");
    assertStringIncludes(html, "Feature 2");
  });

  Deno.test("TabBar — renders correct hrefs", () => {
    const html = render(h(TabBar, { items, activeTabId: "shopping-lists" }));
    assertStringIncludes(html, 'href="/lists"');
    assertStringIncludes(html, 'href="/feature-2"');
  });

  Deno.test("TabBar — marks active tab with aria-current", () => {
    const html = render(h(TabBar, { items, activeTabId: "shopping-lists" }));
    assertStringIncludes(html, 'aria-current="page"');
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  deno test components/TabBar.test.tsx
  ```

  Expected: error — `Cannot find module './TabBar.tsx'`

- [ ] **Step 3: Implement `components/TabBar.tsx`**

  Create `components/TabBar.tsx`:

  ```tsx
  import type { NavItem } from "@/config/navigation.ts";

  interface TabBarProps {
    items: NavItem[];
    activeTabId: string | undefined;
  }

  export default function TabBar({ items, activeTabId }: TabBarProps) {
    return (
      <nav
        class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40"
        aria-label="Main navigation"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={item.defaultRoute}
            class={`flex flex-col items-center gap-1 px-4 py-2 text-xs ${
              item.id === activeTabId ? "text-blue-600" : "text-gray-500"
            }`}
            aria-current={item.id === activeTabId ? "page" : undefined}
          >
            <span class="text-xl" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```
  deno test components/TabBar.test.tsx
  ```

  Expected: `ok | 3 passed | 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add components/TabBar.tsx components/TabBar.test.tsx
  git commit -m "feat(navigation): add TabBar component"
  ```

---

## Task 3: AppBar island

**Files:**
- Create: `islands/AppBar.tsx`
- Create: `islands/AppBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

  The tests cover the SSR/initial render only — effects and signal mutations don't run server-side, so `open` is always `false` in tests.

  Create `islands/AppBar.test.tsx`:

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
    { label: "My Lists", route: "/lists" },
    { label: "Item Catalogue", route: "/items" },
  ];

  Deno.test("AppBar — renders the active section label", () => {
    const html = render(
      h(AppBar, {
        activeTabLabel: "Shopping Lists",
        subNavItems,
        activeRoute: "/lists",
      }),
    );
    assertStringIncludes(html, "Shopping Lists");
  });

  Deno.test("AppBar — renders the menu toggle button", () => {
    const html = render(
      h(AppBar, {
        activeTabLabel: "Shopping Lists",
        subNavItems,
        activeRoute: "/lists",
      }),
    );
    assertStringIncludes(html, "Open navigation menu");
  });

  Deno.test("AppBar — does not render sub-nav panel in initial (closed) state", () => {
    const html = render(
      h(AppBar, {
        activeTabLabel: "Shopping Lists",
        subNavItems,
        activeRoute: "/lists",
      }),
    );
    assertFalse(html.includes("My Lists"));
    assertFalse(html.includes("Item Catalogue"));
  });

  Deno.test("AppBar — renders logout link when logoutRoute is provided", () => {
    const html = render(
      h(AppBar, {
        activeTabLabel: "Shopping Lists",
        subNavItems,
        activeRoute: "/lists",
        logoutRoute: "/logout",
      }),
    );
    assertStringIncludes(html, 'href="/logout"');
    assertStringIncludes(html, "Logout");
  });

  Deno.test("AppBar — does not render logout link when logoutRoute is omitted", () => {
    const html = render(
      h(AppBar, {
        activeTabLabel: "Shopping Lists",
        subNavItems,
        activeRoute: "/lists",
      }),
    );
    assertFalse(html.includes("Logout"));
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  deno test islands/AppBar.test.tsx
  ```

  Expected: error — `Cannot find module './AppBar.tsx'`

- [ ] **Step 3: Implement `islands/AppBar.tsx`**

  Create `islands/AppBar.tsx`:

  ```tsx
  import { useSignal } from "@preact/signals";
  import { useEffect, useRef } from "preact/hooks";
  import type { SubNavItem } from "@/config/navigation.ts";

  interface AppBarProps {
    activeTabLabel: string;
    subNavItems: SubNavItem[];
    activeRoute: string;
    logoutRoute?: string;
  }

  export default function AppBar(
    { activeTabLabel, subNavItems, activeRoute, logoutRoute }: AppBarProps,
  ) {
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

    return (
      <div ref={containerRef} class="relative z-50">
        <header class="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
          <span class="font-bold text-xl">{activeTabLabel}</span>
          <div class="flex items-center gap-3">
            {logoutRoute && (
              <a href={logoutRoute} class="text-sm text-red-500">
                Logout
              </a>
            )}
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
          </div>
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

  Expected: `ok | 5 passed | 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add islands/AppBar.tsx islands/AppBar.test.tsx
  git commit -m "feat(navigation): add AppBar island"
  ```

---

## Task 4: Wire up `_app.tsx`

**Files:**
- Modify: `routes/_app.tsx`

- [ ] **Step 1: Verify `url` is available on `PageProps` in Fresh 2**

  Run the following Context7 lookup before writing code — the API may differ from training data:

  ```
  resolve-library-id: "fresh"
  query-docs: "PageProps url property _app"
  ```

  Confirm that `PageProps` exposes `url: URL`. If the property name differs, adjust the destructuring in Step 2 accordingly.

- [ ] **Step 2: Replace `routes/_app.tsx`**

  Full file replacement (the old header is removed entirely):

  ```tsx
  import { type PageProps } from "fresh";
  import { Head } from "fresh/runtime";
  import { NAV_CONFIG, resolveActiveTab } from "@/config/navigation.ts";
  import TabBar from "@/components/TabBar.tsx";
  import AppBar from "@/islands/AppBar.tsx";

  interface State {
    userId?: string;
  }

  export default function App(
    { Component, state, url }: PageProps<unknown, State>,
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
              <AppBar
                activeTabLabel={activeTab?.label ?? "Happie"}
                subNavItems={activeTab?.subNav ?? []}
                activeRoute={url.pathname}
                logoutRoute="/logout"
              />
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

- [ ] **Step 3: Run type check**

  ```
  deno task check
  ```

  Expected: no errors. If `url` is not on `PageProps`, the type checker will catch it here — follow the Fresh 2 docs from Step 1 to find the correct access pattern.

- [ ] **Step 4: Run the dev server and verify manually**

  ```
  deno task dev
  ```

  Open `http://localhost:8000` in a browser (or use the preview tool). Log in, then verify:

  - [ ] AppBar shows "Lists" as the section title on `/lists`
  - [ ] Tapping ≡ reveals "My Lists", "Item Catalogue", "Categories"
  - [ ] Active sub-feature is highlighted with `›` prefix and blue text
  - [ ] Tapping a sub-feature closes the sub-nav and navigates
  - [ ] TabBar is fixed at the bottom with the 🛒 Lists tab highlighted
  - [ ] Tapping outside the sub-nav closes it
  - [ ] Logout link is visible and works
  - [ ] Page content is not hidden behind the TabBar (scroll to bottom of a list page)
  - [ ] Login page shows no AppBar or TabBar

- [ ] **Step 5: Run all tests**

  ```
  deno test
  ```

  Expected: all existing tests still pass alongside the new ones.

- [ ] **Step 6: Commit**

  ```bash
  git add routes/_app.tsx
  git commit -m "feat(navigation): wire AppBar and TabBar into _app layout"
  ```

---

## Done

All navigation chrome has been replaced. The old flat header is gone. Phase 2 (drawer migration) is not in scope — see the spec for the trigger condition and migration approach.
