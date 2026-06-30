// components/md3/Card.tsx
import type { ComponentChildren, JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { cn } from "./tokens.ts";

type Variant = "filled" | "elevated" | "outlined";
const VARIANT: Record<Variant, string> = {
  filled: "bg-surface-chigh",
  elevated: "bg-surface-clow md-elevation-1",
  outlined: "bg-surface border border-outline-variant",
};

interface CardProps {
  variant?: Variant;
  onClick?: (e: Event) => void;
  pad?: number;
  radius?: number;
  class?: string;
  style?: JSX.CSSProperties;
  children?: ComponentChildren;
}

export function Card(
  {
    variant = "filled",
    onClick,
    pad = 16,
    radius = 12,
    class: cls,
    style,
    children,
  }: CardProps,
) {
  const base = cn("text-on-surface", VARIANT[variant], cls);
  const styleAll = { borderRadius: radius, ...style };
  if (onClick) {
    return (
      <Pressable
        as="div"
        onClick={onClick}
        class={cn("block w-full text-left", base)}
        style={styleAll}
      >
        <div style={{ padding: pad, position: "relative" }}>{children}</div>
      </Pressable>
    );
  }
  return (
    <div class={base} style={styleAll}>
      <div style={{ padding: pad, position: "relative" }}>{children}</div>
    </div>
  );
}
