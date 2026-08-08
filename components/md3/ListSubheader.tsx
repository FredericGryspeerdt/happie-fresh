// components/md3/ListSubheader.tsx
import type { ComponentChildren } from "preact";
import { cn } from "./tokens.ts";

interface ListSubheaderProps {
  children?: ComponentChildren;
  class?: string;
}

export function ListSubheader({ children, class: cls }: ListSubheaderProps) {
  return (
    <div
      class={cn("md-title-small text-on-surface-variant px-4 pt-4 pb-2", cls)}
    >
      {children}
    </div>
  );
}
