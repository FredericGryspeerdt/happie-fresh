import bwipjs from "@bwip-js/browser";
import type { BarcodeFormat } from "@/models/index.ts";
import { cn } from "@/components/md3/tokens.ts";

interface BarcodeProps {
  value: string;
  format: BarcodeFormat;
  /** Show the human-readable digits under a linear symbology (ignored for QR). */
  includeText?: boolean;
  class?: string;
}

/**
 * Encode `value` as a crisp, self-scaling SVG barcode. bwip-js's `toSVG` is a
 * pure function (no DOM), so this renders identically on the server and client
 * — the barcode is visible before hydration with no hydration mismatch. The SVG
 * is served as an `<img>` data URI (rather than injected HTML) so it scales as a
 * vector while keeping markup safe.
 */
function toSvg(
  value: string,
  format: BarcodeFormat,
  includeText: boolean,
): string {
  const isQr = format === "qrcode";
  return bwipjs.toSVG({
    bcid: format,
    text: value,
    scale: isQr ? 4 : 3,
    ...(isQr ? {} : {
      height: 14,
      includetext: includeText,
      textxalign: "center",
    }),
  });
}

export function Barcode(
  { value, format, includeText = true, class: cls }: BarcodeProps,
) {
  let svg: string | null = null;
  try {
    svg = toSvg(value, format, includeText);
  } catch {
    svg = null;
  }

  if (!svg) {
    return (
      <div
        class={cn(
          "grid place-items-center text-center md-body-small text-on-surface-variant p-4",
          cls,
        )}
        role="img"
        aria-label="Barcode could not be rendered"
      >
        Couldn't render this barcode — check the number.
      </div>
    );
  }

  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return (
    <img
      src={src}
      alt={`${format} barcode`}
      class={cn("block w-full h-auto", cls)}
    />
  );
}
