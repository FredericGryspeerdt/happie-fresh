import { useSignal } from "@preact/signals";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

export interface FabAction {
  icon: IconName;
  label: string;
  onClick: () => void;
}

interface FabMenuProps {
  actions: FabAction[];
  /** Accessible label for the (closed) primary button. */
  label?: string;
}

/**
 * MD3 expressive FAB speed-dial: a primary "+" that expands into labelled
 * action FABs over a scrim. Render inside an island (it hydrates with it).
 */
export function FabMenu({ actions, label = "Actions" }: FabMenuProps) {
  const open = useSignal(false);
  return (
    <>
      {/* scrim */}
      <div
        aria-hidden="true"
        onClick={() => (open.value = false)}
        class="fixed inset-0 z-40 bg-surface transition-opacity duration-300"
        style={{
          opacity: open.value ? 0.82 : 0,
          pointerEvents: open.value ? "auto" : "none",
        }}
      />
      <div
        class="fixed right-4 z-50 flex flex-col items-end gap-3.5"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        {/* action items — bottom-most animates first */}
        <div
          class="flex flex-col items-end gap-3"
          style={{ pointerEvents: open.value ? "auto" : "none" }}
        >
          {actions.map((a, i) => {
            const delay = open.value ? (actions.length - 1 - i) * 0.04 : 0;
            return (
              <div
                key={a.label}
                class="flex items-center gap-3"
                style={{
                  opacity: open.value ? 1 : 0,
                  transform: open.value
                    ? "translateY(0) scale(1)"
                    : "translateY(16px) scale(0.85)",
                  transition:
                    `opacity .26s ${delay}s var(--md-emphasized-decel), transform .32s ${delay}s var(--md-spring)`,
                }}
              >
                <span class="md-label-large bg-surface-chigh text-on-surface rounded-[var(--md-shape-sm)] px-3.5 py-2 md-elevation-1 whitespace-nowrap">
                  {a.label}
                </span>
                <Pressable
                  onClick={() => {
                    open.value = false;
                    a.onClick();
                  }}
                  color="var(--md-primary)"
                  aria-label={a.label}
                  class="grid place-items-center bg-surface-chigh text-primary rounded-[var(--md-shape-md)] md-elevation-3"
                  style={{ width: 40, height: 40 }}
                >
                  <Icon name={a.icon} size={22} />
                </Pressable>
              </div>
            );
          })}
        </div>
        {/* primary toggle */}
        <Pressable
          onClick={() => (open.value = !open.value)}
          color={open.value
            ? "var(--md-on-tertiary-container)"
            : "var(--md-on-primary-container)"}
          aria-label={label}
          class="grid place-items-center md-elevation-3 transition-all duration-300"
          style={{
            width: 56,
            height: 56,
            borderRadius: open.value ? "28px" : "var(--md-shape-lg)",
            background: open.value
              ? "var(--md-tertiary-container)"
              : "var(--md-primary-container)",
            color: open.value
              ? "var(--md-on-tertiary-container)"
              : "var(--md-on-primary-container)",
          }}
        >
          <span
            class="grid place-items-center transition-transform duration-300"
            style={{ transform: open.value ? "rotate(135deg)" : "rotate(0)" }}
          >
            <Icon name="plus" size={26} />
          </span>
        </Pressable>
      </div>
    </>
  );
}
