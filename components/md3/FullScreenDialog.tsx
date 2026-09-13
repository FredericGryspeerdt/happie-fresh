// components/md3/FullScreenDialog.tsx
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { IconButton } from "./IconButton.tsx";
import { Scrim } from "./Scrim.tsx";
import { cn } from "./tokens.ts";
import { useModal } from "./useModal.ts";

interface FullScreenDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeIcon?: "x" | "back";
  /** Persistent content below the scrolling body. */
  footer?: ComponentChildren;
  contentClass?: string;
  /** Commit affordance in the header — pass a `Button variant="text"`. */
  action?: ComponentChildren;
  onBack?: () => void;
  backLabel?: string;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 full-screen dialog: multi-field create/edit flows on mobile; renders
 *  as a centered dialog on larger screens (patterns doc §9). */
export function FullScreenDialog(
  {
    open,
    onClose,
    title,
    subtitle,
    closeIcon = "x",
    footer,
    contentClass,
    action,
    onBack,
    backLabel = "Back",
    children,
    class: cls,
  }: FullScreenDialogProps,
) {
  const surface = useRef<HTMLDivElement>(null);
  useModal(open, onClose, surface);
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      class="fixed inset-0 z-[200] grid grid-rows-[minmax(0,1fr)] overflow-hidden sm:place-items-center"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabindex={-1}
        class={cn(
          "relative overflow-hidden bg-surface md-elevation-3 flex flex-col w-full h-dvh min-h-0 sm:h-auto sm:max-h-[85dvh] sm:max-w-[560px] sm:rounded-[var(--md-shape-xl)]",
          cls,
        )}
        style={{
          transform: open ? "translateY(0)" : "translateY(100dvh)",
          transition: "transform .4s var(--md-emphasized-decel)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <header
          class={cn(
            "shrink-0 flex items-center gap-1 pl-1 pr-3",
            subtitle ? "py-4" : "h-14",
          )}
        >
          <IconButton
            name={onBack ? "back" : closeIcon}
            aria-label={onBack ? backLabel : "Close"}
            onClick={onBack ?? onClose}
          />
          <div class="flex-1 min-w-0">
            <h2 class="md-title-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
              {title}
            </h2>
            {subtitle && (
              <p class="md-body-large text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          {action}
          {onBack && (
            <IconButton name="x" aria-label="Close" onClick={onClose} />
          )}
        </header>
        <div
          class={cn("flex-1 min-h-0 overflow-y-auto", contentClass ?? "px-6")}
          style={{
            paddingBottom: footer
              ? undefined
              : "calc(2rem + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
        {footer && (
          <footer
            class="shrink-0 px-4 pt-3 bg-surface border-t border-outline-variant"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
