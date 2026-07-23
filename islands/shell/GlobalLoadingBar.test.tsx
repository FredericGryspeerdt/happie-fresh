import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import GlobalLoadingBar from "./GlobalLoadingBar.tsx";

Deno.test("GlobalLoadingBar — renders a progressbar region, hidden by default", () => {
  const html = render(h(GlobalLoadingBar, {}));
  assertStringIncludes(html, 'role="progressbar"');
  assertStringIncludes(html, "md-loadbar-track");
  assertStringIncludes(html, 'aria-hidden="true"'); // not visible until a load starts
});
