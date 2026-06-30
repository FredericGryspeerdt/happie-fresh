// components/md3/RoundCheck.tsx
import { Icon } from "./Icon.tsx";
import { cn } from "./tokens.ts";
interface RoundCheckProps {
  checked: boolean;
}
export function RoundCheck({ checked }: RoundCheckProps) {
  return (
    <span
      class={cn(
        "w-6 h-6 rounded-full shrink-0 grid place-items-center transition-colors",
        checked ? "bg-primary text-on-primary" : "border-2 border-outline",
      )}
    >
      {checked && <Icon name="check" size={16} stroke={2.6} />}
    </span>
  );
}
