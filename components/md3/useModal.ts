// components/md3/useModal.ts
import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const modalStack: HTMLElement[] = [];
let originalOverflow = "";

const FOCUSABLE =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Consume Escape before lower overlays (such as a Sheet) can also close. */
export function handleModalEscape(
  event: KeyboardEvent,
  onClose: () => void,
): boolean {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  onClose();
  return true;
}

/** Shared modal behavior for Dialog/FullScreenDialog while open:
 *  - locks background scrolling (body overflow)
 *  - traps Tab focus inside the modal surface
 *  - moves focus in on open, restores it to the trigger on close
 *  - closes on Escape */
export function useModal(
  open: boolean,
  onClose: () => void,
  surface: RefObject<HTMLElement>,
  focusSurface = false,
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
    if (!host) return;
    if (modalStack.length === 0) {
      originalOverflow = document.body.style.overflow;
    }
    modalStack.push(host);
    document.body.style.overflow = "hidden";

    const focusables = () =>
      host
        ? [...host.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        )
        : [];
    (focusSurface ? host : (focusables()[0] ?? host))?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== host) return;
      if (handleModalEscape(e, closeRef.current)) return;
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const inside = host?.contains(active) ?? false;
      if (!inside || active === host || (e.shiftKey && active === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture Escape before a lower overlay's document listener sees it.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const wasTop = modalStack.at(-1) === host;
      const index = modalStack.indexOf(host);
      if (index >= 0) modalStack.splice(index, 1);
      if (!modalStack.length) document.body.style.overflow = originalOverflow;
      if (wasTop && restoreTo?.isConnected) restoreTo.focus?.();
    };
  }, [open, focusSurface]);
}
