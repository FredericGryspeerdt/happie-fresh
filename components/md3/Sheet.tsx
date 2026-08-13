// components/md3/Sheet.tsx
import { useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import type { ComponentChildren } from "preact";
import { Scrim } from "./Scrim.tsx";
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** "large" pins a stable, fixed height so content scrolls inside a constant
   *  window instead of the sheet growing/shrinking (e.g. live search results).
   *  Default "auto" sizes to content (capped at maxHeight) — unchanged. */
  size?: "auto" | "large";
  children: ComponentChildren;
}
export function Sheet(
  { open, onClose, title, size = "auto", children }: SheetProps,
) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentDelta = useRef(0);
  // Sheets can be rendered inside another sheet's panel (e.g. a settings row's
  // own Sheet mounted inside MoreSheet). That panel always carries an inline
  // `transform`, which makes it a containing block for `position: fixed`
  // descendants — so a nested sheet's "fixed" wrapper would move with it
  // instead of staying anchored to the viewport. After mount, portal the
  // whole wrapper to <body> to escape any transformed ancestor. Before mount
  // (SSR and the first client/hydration render) keep rendering in place so
  // server and first client render agree (§11 progressive-enhancement
  // pattern) and so render-to-string output used by tests is unchanged.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);
  useEffect(() => { // Escape to close — ported from the previous BottomSheet implementation
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => { // scroll-lock — ported from the previous BottomSheet implementation
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);
  const onTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    currentDelta.current = 0;
  };
  const onTouchMove = (e: TouchEvent) => {
    const el = sheetRef.current;
    if (!el) return;
    currentDelta.current = e.touches[0].clientY - dragStartY.current;
    if (currentDelta.current > 0) {
      e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateY(${currentDelta.current}px)`;
    }
  };
  const reset = () => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = "";
    el.style.transform = "";
    currentDelta.current = 0;
  };
  const onTouchEnd = () => {
    if (currentDelta.current > 80) {
      reset();
      onClose();
    } else reset();
    currentDelta.current = 0;
  };
  const tree = (
    <div
      class="fixed inset-0 z-[200] flex flex-col justify-end"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <Scrim open={open} onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        class="relative bg-surface-clow px-6 pb-8 flex flex-col"
        style={{
          borderRadius: "var(--md-shape-xl) var(--md-shape-xl) 0 0",
          maxHeight: "84%",
          height: size === "large" ? "80dvh" : undefined,
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform .4s var(--md-emphasized-decel)",
          boxShadow: "0 -8px 40px rgba(0,0,0,.22)",
        }}
      >
        {
          /* Drag zone: handle + title. Dragging here dismisses; the scrollable
            body below is free to scroll (fixes an upward scroll being read as
            a drag-down-to-dismiss). */
        }
        <div
          class="shrink-0"
          style={{ touchAction: "none" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={reset}
        >
          <div class="pt-4 pb-3 flex justify-center">
            <div
              class="rounded-full bg-on-surface-variant"
              style={{ width: 32, height: 4, opacity: 0.4 }}
            />
          </div>
          {title && (
            <div class="md-title-large text-on-surface mb-2">
              {title}
            </div>
          )}
        </div>
        <div
          class={`overflow-y-auto -mx-6 px-6 pt-1${
            size === "large" ? " flex-1 min-h-0" : ""
          }`}
          style={{ overscrollBehavior: "contain" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
  return portalTarget ? createPortal(tree, portalTarget) : tree;
}
