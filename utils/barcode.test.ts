import { assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  detectFormat,
  formatLabel,
  SUPPORTED_FORMATS,
  validateBarcode,
} from "@/utils/barcode.ts";

Deno.test("detectFormat — 13 digits → ean13", () => {
  assertEquals(detectFormat("9520123456788"), "ean13");
});

Deno.test("detectFormat — 12 digits → upca", () => {
  assertEquals(detectFormat("012345000058"), "upca");
});

Deno.test("detectFormat — 8 digits → ean8", () => {
  assertEquals(detectFormat("95200002"), "ean8");
});

Deno.test("detectFormat — other digit lengths → code128", () => {
  assertEquals(detectFormat("1234567"), "code128");
  assertEquals(detectFormat("123456789012345"), "code128");
});

Deno.test("detectFormat — non-numeric → code128 (never auto-picks qr)", () => {
  assertEquals(detectFormat("ABC-123"), "code128");
});

Deno.test("detectFormat — ignores surrounding whitespace", () => {
  assertEquals(detectFormat("  9520123456788 "), "ean13");
});

Deno.test("validateBarcode — accepts a valid EAN-13 check digit", () => {
  assertEquals(validateBarcode("9520123456788", "ean13").ok, true);
});

Deno.test("validateBarcode — rejects a wrong EAN-13 check digit", () => {
  assertEquals(validateBarcode("9520123456789", "ean13").ok, false);
});

Deno.test("validateBarcode — rejects wrong-length EAN-13", () => {
  assertEquals(validateBarcode("952012345678", "ean13").ok, false);
});

Deno.test("validateBarcode — rejects non-digit EAN-13", () => {
  assertEquals(validateBarcode("95201234567AB", "ean13").ok, false);
});

Deno.test("validateBarcode — accepts a valid EAN-8", () => {
  assertEquals(validateBarcode("95200002", "ean8").ok, true);
});

Deno.test("validateBarcode — accepts a valid UPC-A", () => {
  assertEquals(validateBarcode("012345000058", "upca").ok, true);
});

Deno.test("validateBarcode — code128 accepts printable ASCII, rejects empty", () => {
  assertEquals(validateBarcode("ABC-123", "code128").ok, true);
  assertEquals(validateBarcode("   ", "code128").ok, false);
});

Deno.test("validateBarcode — qrcode accepts arbitrary non-empty text", () => {
  assertEquals(
    validateBarcode("https://happie.app/card/42", "qrcode").ok,
    true,
  );
  assertEquals(validateBarcode("", "qrcode").ok, false);
});

Deno.test("formatLabel — human-readable names", () => {
  assertEquals(formatLabel("ean13"), "EAN-13");
  assertEquals(formatLabel("qrcode"), "QR code");
});

Deno.test("SUPPORTED_FORMATS — covers every supported symbology once", () => {
  assertEquals(SUPPORTED_FORMATS.map((f) => f.format), [
    "ean13",
    "ean8",
    "upca",
    "code128",
    "qrcode",
  ]);
});
