import type { BarcodeFormat } from "@/models/index.ts";

export type { BarcodeFormat };

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Supported symbologies in picker order, with human labels. */
export const SUPPORTED_FORMATS: { format: BarcodeFormat; label: string }[] = [
  { format: "ean13", label: "EAN-13" },
  { format: "ean8", label: "EAN-8" },
  { format: "upca", label: "UPC-A" },
  { format: "code128", label: "Code 128" },
  { format: "qrcode", label: "QR code" },
];

const LABELS: Record<BarcodeFormat, string> = Object.fromEntries(
  SUPPORTED_FORMATS.map((f) => [f.format, f.label]),
) as Record<BarcodeFormat, string>;

/** Fixed digit lengths for the numeric retail symbologies (incl. check digit). */
const FIXED_LENGTHS: Partial<Record<BarcodeFormat, number>> = {
  ean13: 13,
  ean8: 8,
  upca: 12,
};

export function formatLabel(format: BarcodeFormat): string {
  return LABELS[format] ?? format;
}

/**
 * Best-guess symbology from a raw value, used to preselect the format in the
 * add-card form. Pure digit strings map to their fixed-length retail formats;
 * anything else falls back to Code 128. We never auto-pick `qrcode` — QR is an
 * explicit user choice, since numeric/URL payloads are ambiguous.
 */
export function detectFormat(value: string): BarcodeFormat {
  const v = value.trim();
  if (/^\d+$/.test(v)) {
    if (v.length === 13) return "ean13";
    if (v.length === 12) return "upca";
    if (v.length === 8) return "ean8";
  }
  return "code128";
}

/**
 * GS1 mod-10 check digit for a numeric string that already includes its check
 * digit as the last character. Weights alternate 3,1 from the rightmost data
 * digit — the single algorithm behind EAN-13, EAN-8 and UPC-A.
 */
function hasValidCheckDigit(digits: string): boolean {
  const data = digits.slice(0, -1);
  const check = Number(digits[digits.length - 1]);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    // Weight the rightmost data digit by 3, then alternate.
    const weight = (data.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += Number(data[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Validate a value against a chosen symbology before we store or render it, so
 * typos surface in the form rather than as a broken barcode. Numeric formats
 * must be the right length and pass the check digit; Code 128 accepts printable
 * ASCII; QR accepts any non-empty text.
 */
export function validateBarcode(
  value: string,
  format: BarcodeFormat,
): ValidationResult {
  const v = value.trim();
  if (!v) return { ok: false, message: "Enter a barcode value." };

  const fixed = FIXED_LENGTHS[format];
  if (fixed !== undefined) {
    const label = formatLabel(format);
    if (!/^\d+$/.test(v)) {
      return { ok: false, message: `${label} must be digits only.` };
    }
    if (v.length !== fixed) {
      return { ok: false, message: `${label} must be ${fixed} digits.` };
    }
    if (!hasValidCheckDigit(v)) {
      return { ok: false, message: `That ${label} number looks incorrect.` };
    }
    return { ok: true };
  }

  if (format === "code128") {
    // Code 128 covers the printable ASCII range (0x20–0x7E).
    if (!/^[\x20-\x7E]+$/.test(v)) {
      return { ok: false, message: "Use letters, digits and basic symbols." };
    }
    return { ok: true };
  }

  // qrcode — encodes essentially anything; just guard against empty.
  return { ok: true };
}
