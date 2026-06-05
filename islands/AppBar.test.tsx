import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
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
