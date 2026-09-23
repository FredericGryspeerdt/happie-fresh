import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import LaunchDiagnostics from "./LaunchDiagnostics.tsx";

Deno.test("LaunchDiagnostics — renders a copyable device report", () => {
  const html = render(h(LaunchDiagnostics, {}));

  assertStringIncludes(html, "Launch diagnostics");
  assertStringIncludes(html, "Measuring…");
  assertStringIncludes(html, "Copy report");
});
