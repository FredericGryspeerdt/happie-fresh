import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { render } from "npm:preact-render-to-string";
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
