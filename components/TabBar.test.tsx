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
