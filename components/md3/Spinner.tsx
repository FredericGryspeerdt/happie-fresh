// components/md3/Spinner.tsx
import type { ComponentChildren } from "preact";
import { cn } from "./tokens.ts";

interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  /** Any CSS color; defaults to currentColor so it inherits text color. */
  color?: string;
  class?: string;
  "aria-label"?: string;
  children?: ComponentChildren;
}

export function Spinner(
  { size = 20, color = "currentColor", class: cls, "aria-label": ariaLabel }:
    SpinnerProps,
) {
  const label = ariaLabel ?? "Loading";
  const borderWidth = Math.max(2, Math.round(size / 10));
  return (
    <span role="status" class={cn("inline-block align-middle", cls)}>
      <span
        class="block rounded-[var(--md-shape-full)]"
        style={{
          width: size,
          height: size,
          borderWidth,
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
          borderTopColor: color,
          animation: "md-spin 0.7s linear infinite",
        }}
      />
      <span class="sr-only">{label}</span>
    </span>
  );
}
