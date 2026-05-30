import { assertFalse, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
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
