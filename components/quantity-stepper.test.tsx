import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import QuantityStepper from "./quantity-stepper.tsx";

Deno.test("QuantityStepper — renders the current value", () => {
  const html = render(h(QuantityStepper, { value: 3, onChange: () => {} }));
  assertStringIncludes(html, "3");
});

Deno.test("QuantityStepper — renders decrement and increment buttons", () => {
  const html = render(h(QuantityStepper, { value: 1, onChange: () => {} }));
  assertStringIncludes(html, "Decrease quantity");
  assertStringIncludes(html, "Increase quantity");
});
