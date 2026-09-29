import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import DesignShowcase from "./DesignShowcase.tsx";

Deno.test("DesignShowcase — renders a section per component family", () => {
  const html = render(h(DesignShowcase, {}));
  for (
    const section of [
      "Knoppen",
      "Tekstvelden",
      "Schakelaars",
      "Scheidingslijnen en lijsten",
      "Dialoogvensters",
      "Keuzeknoppen en segmenten",
      "Terugkoppeling",
    ]
  ) {
    assertStringIncludes(html, section);
  }
});
