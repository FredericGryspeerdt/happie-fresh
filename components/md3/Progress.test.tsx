import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Progress } from "./Progress.tsx";
import { RoundCheck } from "./RoundCheck.tsx";

Deno.test("Progress — fills to the correct percentage width", () => {
  assertStringIncludes(render(h(Progress, { value: 3, total: 9 })), "33%");
});
Deno.test("RoundCheck — shows a check glyph only when checked", () => {
  assertStringIncludes(render(h(RoundCheck, { checked: true })), "<svg");
});
