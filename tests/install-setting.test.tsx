import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import InstallSetting from "@/islands/shell/InstallSetting.tsx";

Deno.test("InstallSetting — SSR renders the row deterministically", () => {
  // deno-lint-ignore no-explicit-any
  const html = render(h(InstallSetting, {} as any));
  assertStringIncludes(html, "Install the app");
});

Deno.test("InstallSetting — sheet content is not rendered while closed", () => {
  // deno-lint-ignore no-explicit-any
  const html = render(h(InstallSetting, {} as any));
  assert(
    !html.includes("Install Happie"),
    "promptable button should not render while the sheet is closed",
  );
  assert(
    !html.includes("browser's menu"),
    "guidance should not render while the sheet is closed",
  );
});
