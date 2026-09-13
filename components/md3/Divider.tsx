// components/md3/Divider.tsx
import { cn } from "./tokens.ts";

interface DividerProps {
  /** Indent from both container edges (MD3 inset divider). */
  inset?: boolean;
  class?: string;
}

export function Divider({ inset, class: cls }: DividerProps) {
  return (
    <hr class={cn("border-0 h-px bg-outline-variant", inset && "mx-4", cls)} />
  );
}
