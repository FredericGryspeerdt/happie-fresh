import { useSignal } from "@preact/signals";
import type { ComponentChildren, JSX } from "preact";
import { cn } from "./tokens.ts";

interface Ripple {
  id: number;
  cx: number;
  cy: number;
  size: number;
}

export function useRipple() {
  const rips = useSignal<Ripple[]>([]);
  const add = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    const host = e.currentTarget;
    const b = host.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    const cx = (e.clientX ?? b.left + b.width / 2) - b.left;
    const cy = (e.clientY ?? b.top + b.height / 2) - b.top;
    const id = Math.random();
    rips.value = [...rips.value, { id, cx, cy, size }];
    setTimeout(() => {
      rips.value = rips.value.filter((p) => p.id !== id);
    }, 520);
  };
  return { rips, add };
}

interface PressableProps {
  as?: keyof JSX.IntrinsicElements;
  color?: string; // ripple/state-layer tint (CSS color), default currentColor
  onClick?: (e: Event) => void;
  class?: string;
  style?: JSX.CSSProperties;
  disabled?: boolean;
  stop?: boolean; // stopPropagation on click
  type?: string;
  "aria-label"?: string;
  children?: ComponentChildren;
}

export function Pressable(
  {
    as = "button",
    color,
    onClick,
    class: cls,
    style,
    disabled,
    stop,
    children,
    ...rest
  }: PressableProps,
) {
  const { rips, add } = useRipple();
  // deno-lint-ignore no-explicit-any
  const Tag = as as any;
  return (
    <Tag
      class={cn("md-press", cls)}
      disabled={as === "button" ? disabled : undefined}
      type={as === "button" ? (rest.type ?? "button") : undefined}
      onPointerDown={disabled ? undefined : add}
      onClick={disabled ? undefined : (e: Event) => {
        if (stop) e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        border: "none",
        background: "transparent",
        font: "inherit",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
        color: "inherit",
        ...style,
      }}
      {...rest}
    >
      <span class="md-state" style={color ? { color } : undefined} />
      {rips.value.map((r) => (
        <span
          key={r.id}
          class="md-rip"
          style={{
            left: r.cx - r.size,
            top: r.cy - r.size,
            width: r.size * 2,
            height: r.size * 2,
            color,
          }}
        />
      ))}
      {children}
    </Tag>
  );
}
