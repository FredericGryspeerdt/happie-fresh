// components/md3/useModal.ts
import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const FOCUSABLE =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Shared modal behavior for Dialog/FullScreenDialog while open:
 *  - locks background scrolling (body overflow)
 *  - traps Tab focus inside the modal surface
 *  - moves focus in on open, restores it to the trigger on close
 *  - closes on Escape */
export function useModal(
  open: boolean,
  onClose: () => void,
  surface: RefObject<HTMLElement>,
) {
  // Consumers pass inline `onClose` arrows whose identity changes every
  // render. Depending on it would tear down and re-run the effect on each
  // keystroke inside the modal — stealing focus back to the first field and
  // drifting the focus-restore target. Track the latest via a ref instead.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const host = surface.current;
    const restoreTo = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      host
        ? [...host.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        )
        : [];
    (focusables()[0] ?? host)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const inside = host?.contains(active) ?? false;
      if (!inside || (e.shiftKey && active === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo?.focus?.();
    };
  }, [open]);
}
