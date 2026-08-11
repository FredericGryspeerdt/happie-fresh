import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";

Deno.test("InstallGuidance — iOS variant walks through the share sheet", () => {
  const html = render(h(InstallGuidance, { variant: "ios" }));
  assertStringIncludes(html, "Share");
  assertStringIncludes(html, "Add to Home Screen");
  assertStringIncludes(html, "<ol");
});

Deno.test("InstallGuidance — generic variant points at the browser menu", () => {
  const html = render(h(InstallGuidance, { variant: "generic" }));
  assertStringIncludes(html, "Install app");
  assertStringIncludes(html, "Add to Home Screen");
});
