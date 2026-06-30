// components/md3/Button.tsx
import type { ComponentChildren, JSX } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text";
const VARIANT: Record<Variant, string> = {
  filled: "bg-primary text-on-primary",
  tonal: "bg-secondary-container text-on-secondary-container",
  elevated: "bg-surface-clow text-primary md-elevation-1",
  outlined: "bg-transparent text-primary border border-outline-variant",
  text: "bg-transparent text-primary",
};

interface ButtonProps {
  variant?: Variant;
  icon?: IconName;
  full?: boolean;
  onClick?: (e: Event) => void;
  disabled?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children?: ComponentChildren;
}

export function Button(
  {
    variant = "filled",
    icon,
    full,
    onClick,
    disabled,
    class: cls,
    style,
    children,
  }: ButtonProps,
) {
  return (
    <Pressable
      onClick={onClick}
      disabled={disabled}
      class={cn(
        "md-label-large inline-flex items-center justify-center gap-2 h-10 rounded-[var(--md-shape-full)] whitespace-nowrap",
        icon ? "pl-4 pr-[22px]" : "px-6",
        full ? "w-full" : "w-auto",
        disabled
          ? "bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]"
          : VARIANT[variant],
        cls,
      )}
      style={style}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Pressable>
  );
}
