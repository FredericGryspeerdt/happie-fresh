import { assertStringIncludes } from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { Barcode } from "./Barcode.tsx";

Deno.test("Barcode — renders an SVG image for a valid EAN-13", () => {
  const html = render(h(Barcode, { value: "9520123456788", format: "ean13" }));
  assertStringIncludes(html, "data:image/svg+xml");
});

Deno.test("Barcode — renders an SVG image for a QR code", () => {
  const html = render(
    h(Barcode, { value: "https://happie.app/card/42", format: "qrcode" }),
  );
  assertStringIncludes(html, "data:image/svg+xml");
});

Deno.test("Barcode — friendly fallback when the value can't be encoded", () => {
  // A non-numeric value is invalid for EAN-13, so bwip-js throws.
  const html = render(h(Barcode, { value: "not-a-barcode", format: "ean13" }));
  assertStringIncludes(html, "render");
});
