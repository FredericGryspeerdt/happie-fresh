// components/md3/Switch.tsx
import { cn } from "./tokens.ts";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  class?: string;
}

export function Switch(
  { checked, onChange, disabled, class: cls, ...rest }: SwitchProps,
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? "true" : "false"}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      class={cn(
        "relative shrink-0 w-[52px] h-8 rounded-full border-2 transition-colors duration-200 cursor-pointer",
        checked
          ? "bg-primary border-primary"
          : "bg-surface-chighest border-outline",
        disabled && "opacity-40 pointer-events-none",
        cls,
      )}
    >
      {/* MD3 thumb: 16dp outline when off, 24dp on-primary when on. */}
      <span
        class={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
          checked
            ? "left-[22px] size-6 bg-on-primary"
            : "left-[6px] size-4 bg-outline",
        )}
        style={{ transitionTimingFunction: "var(--md-emphasized)" }}
      />
    </button>
  );
}
