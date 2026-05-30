import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
}

export default function BottomSheet(
  { open, onClose, children }: BottomSheetProps,
) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentDelta = useRef(0);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent the page from scrolling while the sheet is open (covers backdrop
  // drags and any area not handled by the sheet's own touchmove listener).
  // documentElement is used instead of body for broader iOS Safari support.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  const handleTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    currentDelta.current = 0;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    currentDelta.current = e.touches[0].clientY - dragStartY.current;
    if (currentDelta.current > 0) {
      // Prevent the page behind the sheet from scrolling while dragging.
      e.preventDefault();
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${currentDelta.current}px)`;
    }
  };

  const handleTouchEnd = () => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (currentDelta.current > 80) {
      sheet.style.transition = "";
      sheet.style.transform = "";
      onClose();
    } else {
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    currentDelta.current = 0;
  };

  const handleTouchCancel = () => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = "";
    sheet.style.transform = "";
    currentDelta.current = 0;
  };

  return (
    <div class="fixed inset-0 z-50 pointer-events-none">
      <div
        class={`absolute inset-0 bg-black transition-opacity duration-300 ${
          open
            ? "opacity-50 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        class={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          open
            ? "translate-y-0 pointer-events-auto"
            : "translate-y-full pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div class="px-4 pb-8 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
