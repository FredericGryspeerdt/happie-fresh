// components/md3/Chip.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

interface ChipProps {
  selected?: boolean;
  onClick?: (e: Event) => void;
  leadingCheck?: boolean;
  icon?: IconName;
  class?: string;
  children?: ComponentChildren;
}

export function Chip(
  {
    selected = false,
    onClick,
    leadingCheck = true,
    icon,
    class: cls,
    children,
  }: ChipProps,
) {
  return (
    <Pressable
      onClick={onClick}
      class={cn(
        "md-label-large inline-flex items-center gap-1.5 h-8 rounded-[var(--md-shape-sm)] whitespace-nowrap shrink-0",
        selected && leadingCheck ? "pl-2 pr-3.5" : "px-3.5",
        selected
          ? "bg-secondary-container text-on-secondary-container"
          : "text-on-surface-variant border border-outline-variant",
        cls,
      )}
    >
      {selected && leadingCheck && <Icon name="check" size={16} stroke={2.4} />}
      {icon && !selected && <Icon name={icon} size={16} />}
      {children}
    </Pressable>
  );
}
