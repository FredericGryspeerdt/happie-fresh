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
  // Escape hatches: callers can override the button-role a11y defaults added
  // for non-<button> hosts (spread last, so these win over the defaults).
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent) => void;
  children?: ComponentChildren;
}

/**
 * Activate a synthetic button on the keyboard, the way a native <button> does:
 * Enter and Space fire the click handler, and both prevent the default (Space
 * would otherwise scroll the page). Exported so the behavior is unit-testable
 * without a DOM.
 */
export function activateOnKey(
  e: Pick<KeyboardEvent, "key" | "preventDefault">,
  activate: (e: Event) => void,
) {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    activate(e as unknown as Event);
  }
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

  const isButton = as === "button";
  // A non-<button> host with an onClick is a synthetic button: give it the
  // button role, keyboard focus, and Enter/Space activation a native button
  // would have for free. Native <button> keeps its own semantics untouched.
  const synthetic = !isButton && !!onClick;
  const activate = disabled ? undefined : (e: Event) => {
    if (stop) e.stopPropagation();
    onClick?.(e);
  };

  return (
    <Tag
      class={cn("md-press", cls)}
      disabled={isButton ? disabled : undefined}
      type={isButton ? (rest.type ?? "button") : undefined}
      role={synthetic ? "button" : undefined}
      tabIndex={synthetic ? (disabled ? -1 : 0) : undefined}
      aria-disabled={synthetic && disabled ? "true" : undefined}
      onPointerDown={disabled ? undefined : add}
      onClick={activate}
      onKeyDown={synthetic && activate
        ? (e: KeyboardEvent) => activateOnKey(e, activate)
        : undefined}
      style={{
        cursor: disabled ? "default" : "pointer",
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
