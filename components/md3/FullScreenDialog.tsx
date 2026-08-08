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
  /** Commit affordance in the header — pass a `Button variant="text"`. */
  action?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

/** MD3 full-screen dialog: multi-field create/edit flows on mobile; renders
 *  as a centered dialog on larger screens (patterns doc §9). */
export function FullScreenDialog(
  { open, onClose, title, action, children, class: cls }: FullScreenDialogProps,
) {
  const surface = useRef<HTMLDivElement>(null);
  useModal(open, onClose, surface);
  return (
    <div
      class="fixed inset-0 z-[200] grid sm:place-items-center"
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
          "relative bg-surface md-elevation-3 flex flex-col w-full h-full sm:h-auto sm:max-h-[85dvh] sm:max-w-[560px] sm:rounded-[var(--md-shape-xl)]",
          cls,
        )}
        style={{
          transform: open ? "translateY(0)" : "translateY(100dvh)",
          transition: "transform .4s var(--md-emphasized-decel)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <header class="shrink-0 h-14 flex items-center gap-1 pl-1 pr-3">
          <IconButton name="x" aria-label="Close" onClick={onClose} />
          <h2 class="md-title-large text-on-surface flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {title}
          </h2>
          {action}
        </header>
        <div
          class="flex-1 min-h-0 overflow-y-auto px-6"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
