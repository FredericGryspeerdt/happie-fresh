// components/md3/IconButton.tsx
import type { JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

type Variant = "standard" | "filled" | "tonal" | "outlined";
const VARIANT: Record<Variant, string> = {
  standard: "bg-transparent text-on-surface-variant",
  filled: "bg-primary text-on-primary",
  tonal: "bg-secondary-container text-on-secondary-container",
  outlined:
    "bg-transparent text-on-surface-variant border border-outline-variant",
};

interface IconButtonProps {
  name: IconName;
  variant?: Variant;
  onClick?: (e: Event) => void;
  size?: number;
  iconSize?: number;
  "aria-label": string;
  class?: string;
  style?: JSX.CSSProperties;
}

export function IconButton(
  {
    name,
    variant = "standard",
    onClick,
    size = 40,
    iconSize = 22,
    class: cls,
    style,
    ...rest
  }: IconButtonProps,
) {
  return (
    <Pressable
      onClick={onClick}
      class={cn(
        "grid place-items-center rounded-[var(--md-shape-full)] shrink-0",
        VARIANT[variant],
        cls,
      )}
      style={{ width: size, height: size, ...style }}
      aria-label={rest["aria-label"]}
    >
      <Icon name={name} size={iconSize} />
    </Pressable>
  );
}
