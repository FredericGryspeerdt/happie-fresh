// components/md3/Stepper.tsx
import { Pressable } from "./Pressable.tsx";
import { Icon, type IconName } from "./Icon.tsx";
interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}
export function Stepper({ value, onChange, min = 1 }: StepperProps) {
  const btn = (icon: IconName, label: string, fn: () => void) => (
    <Pressable
      onClick={(e) => {
        e.stopPropagation();
        fn();
      }}
      stop
      aria-label={label}
      class="w-8 h-8 grid place-items-center rounded-full bg-secondary-container text-on-secondary-container"
    >
      <Icon name={icon} size={18} stroke={2.3} />
    </Pressable>
  );
  return (
    <div class="inline-flex items-center gap-2">
      {btn("minus", "Decrease quantity", () =>
        onChange(Math.max(min, value - 1)))}
      <span
        class="md-title-medium text-on-surface text-center"
        style={{ minWidth: 16 }}
      >
        {value}
      </span>
      {btn("plus", "Increase quantity", () =>
        onChange(value + 1))}
    </div>
  );
}
