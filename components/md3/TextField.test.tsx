import { assert, assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { TextField } from "./TextField.tsx";

Deno.test("TextField — label above a filled container, house style", () => {
  const html = render(h(TextField, {
    label: "Name",
    value: "Frida",
    onInput: () => {},
  }));
  assertStringIncludes(html, "Name");
  assertStringIncludes(html, "md-label-medium");
  assertStringIncludes(html, "bg-surface-chighest");
  assertStringIncludes(html, 'value="Frida"');
});

Deno.test("TextField — error state shows message and aria-invalid", () => {
  const html = render(h(TextField, {
    id: "name",
    label: "Name",
    value: "",
    onInput: () => {},
    error: "Name is required",
  }));
  assertStringIncludes(html, "Name is required");
  assertStringIncludes(html, "text-error");
  assertStringIncludes(html, 'aria-invalid="true"');
  assertStringIncludes(html, 'aria-describedby="name-help"');
});

Deno.test("TextField — supporting text renders when no error", () => {
  const html = render(h(TextField, {
    value: "",
    onInput: () => {},
    supporting: "Visible to the household",
  }));
  assertStringIncludes(html, "Visible to the household");
  assertStringIncludes(html, "text-on-surface-variant");
});

Deno.test("TextField — multiline renders a textarea", () => {
  const html = render(h(TextField, {
    value: "notes",
    onInput: () => {},
    multiline: true,
    rows: 3,
  }));
  assertStringIncludes(html, "<textarea");
  assertStringIncludes(html, "notes");
});

Deno.test("TextField — no supporting row when neither error nor supporting", () => {
  const html = render(h(TextField, { value: "", onInput: () => {} }));
  assert(!html.includes("md-body-small"));
});
