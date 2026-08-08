// components/md3/Dialog.tsx
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { Icon, type IconName } from "./Icon.tsx";
import { Scrim } from "./Scrim.tsx";
import { cn } from "./tokens.ts";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  headline?: string;
  icon?: IconName;
  /** Right-aligned action row — pass `Button variant="text"` children. */
  actions?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 basic dialog: centered, so short typed input stays clear of the soft
 *  keyboard. Keyboard-less confirmations stay on `Sheet` (patterns doc §9). */
export function Dialog(
  { open, onClose, headline, icon, actions, children, class: cls }: DialogProps,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div
      class="fixed inset-0 z-[200] grid place-items-center p-6"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
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
