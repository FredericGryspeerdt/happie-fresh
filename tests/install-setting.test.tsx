import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import InstallSetting from "@/islands/shell/InstallSetting.tsx";

Deno.test("InstallSetting — SSR renders the row deterministically", () => {
  const html = render(<InstallSetting />);
  assertStringIncludes(html, "Install the app");
});

Deno.test("InstallSetting — sheet content is not rendered while closed", () => {
  const html = render(<InstallSetting />);
  assert(
    !html.includes("Install Happie"),
    "promptable button should not render while the sheet is closed",
  );
  assert(
    !html.includes("browser's menu"),
    "guidance should not render while the sheet is closed",
  );
});
