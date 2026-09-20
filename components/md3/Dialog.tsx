// components/md3/Dialog.tsx
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon, type IconName } from "./Icon.tsx";
import { Scrim } from "./Scrim.tsx";
import { cn } from "./tokens.ts";
import { useModal } from "./useModal.ts";

interface DialogProps {
  open: boolean;
  focusSurface?: boolean;
  onClose: () => void;
  headline?: string;
  icon?: IconName;
  /** Right-aligned action row — pass `Button variant="text"` children. */
  actions?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 basic dialog for short input and focused decisions. */
export function Dialog(
  {
    open,
    onClose,
    headline,
    icon,
    actions,
    children,
    focusSurface = false,
    class: cls,
  }: DialogProps,
) {
  const surface = useRef<HTMLDivElement>(null);
  useModal(open, onClose, surface, focusSurface);
  const [viewport, setViewport] = useState<
    { height: number; top: number } | null
  >(null);
  useEffect(() => {
    if (!open || !globalThis.visualViewport) return;
    const view = globalThis.visualViewport;
    const resize = () =>
      setViewport({ height: view.height, top: view.offsetTop });
    resize();
    view.addEventListener("resize", resize);
    view.addEventListener("scroll", resize);
    return () => {
      view.removeEventListener("resize", resize);
      view.removeEventListener("scroll", resize);
    };
  }, [open]);
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      class="fixed inset-0 z-[210] grid place-items-center p-6"
      style={{
        pointerEvents: open ? "auto" : "none",
        ...(viewport
          ? { height: viewport.height, top: viewport.top, bottom: "auto" }
          : {}),
      }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        tabindex={-1}
        class={cn(
          "relative bg-surface-chigh rounded-[var(--md-shape-xl)] md-elevation-3 p-6 w-full min-w-[280px] max-w-[560px] sm:w-auto sm:min-w-[320px] max-h-full overflow-y-auto flex flex-col gap-4",
          cls,
        )}
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.9)",
          transition:
            "opacity .2s var(--md-emphasized), transform .3s var(--md-emphasized-decel)",
        }}
      >
        {icon && (
          <div class="grid place-items-center text-secondary">
            <Icon name={icon} size={24} />
          </div>
        )}
        {headline && (
          <h2
            class={cn(
              "md-headline-small text-on-surface",
              icon && "text-center",
            )}
          >
            {headline}
          </h2>
        )}
        {children && (
          <div class="md-body-medium text-on-surface-variant">{children}</div>
        )}
        {actions && <div class="flex justify-end gap-2 pt-2">{actions}</div>}
      </div>
    </div>
  );
}
