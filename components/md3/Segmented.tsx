// components/md3/Segmented.tsx
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";
type Option = [key: string, icon: IconName, label: string];
interface SegmentedProps {
  options: Option[];
  value: string;
  onChange: (k: string) => void;
}
export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div
      class="flex border border-outline rounded-[var(--md-shape-full)] overflow-hidden"
      style={{ height: 40 }}
    >
      {options.map(([k, icon, label], i) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onClick={() => onChange(k)}
            class={cn(
              "flex-1 flex items-center justify-center gap-2 md-label-large",
              on
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface",
              i ? "border-l border-outline" : "",
            )}
          >
            {on
              ? <Icon name="check" size={18} stroke={2.4} />
              : <Icon name={icon} size={18} />} {label}
          </Pressable>
        );
      })}
    </div>
  );
}
