import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import NavigationBar from "./NavigationBar.tsx";
import { NAV_CONFIG } from "@/config/navigation.ts";

Deno.test("NavigationBar — renders all five tab labels", () => {
  const html = render(
    h(NavigationBar, {
      items: NAV_CONFIG,
      activeId: "shopping",
      onMore: () => {},
    }),
  );
  for (const label of ["Home", "Shop", "To-dos", "Menu", "More"]) {
    assertStringIncludes(html, label);
  }
});
