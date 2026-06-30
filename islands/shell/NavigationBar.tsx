import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { cn } from "@/components/md3/tokens.ts";
import type { NavItem } from "@/config/navigation.ts";

interface NavigationBarProps {
  items: NavItem[];
  activeId?: string;
  onMore: () => void;
}

export default function NavigationBar({
  items,
  activeId,
  onMore,
}: NavigationBarProps) {
  const go = (it: NavItem) => {
    if (it.id === "more") onMore();
    else globalThis.location.href = it.defaultRoute;
  };

  return (
    <nav
      class="fixed bottom-0 left-0 right-0 z-40 flex bg-surface-c"
      style={{
        height: 80,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Main navigation"
    >
      {items.map((it) => {
        const on = activeId === it.id;
        return (
          <Pressable
            key={it.id}
            onClick={() => go(it)}
            class="flex-1 flex flex-col items-center justify-center gap-1 pt-3 pb-4"
            aria-current={on ? "page" : undefined}
          >
            <span
              class="relative grid place-items-center"
              style={{ height: 32 }}
            >
              <span
                class="absolute bg-secondary-container rounded-[var(--md-shape-full)]"
                style={{
                  top: 0,
                  bottom: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: on ? 64 : 32,
                  opacity: on ? 1 : 0,
                  transition: "width .25s var(--md-emphasized), opacity .2s",
                }}
              />
              <span
                class={cn(
                  "relative transition-colors",
                  on
                    ? "text-on-secondary-container"
                    : "text-on-surface-variant",
                )}
              >
                <Icon name={it.iconName} size={24} stroke={on ? 2.3 : 2} />
              </span>
            </span>
            <span
              class={cn(
                "md-label-medium",
                on ? "text-on-surface font-bold" : "text-on-surface-variant",
              )}
            >
              {it.label}
            </span>
          </Pressable>
        );
      })}
    </nav>
  );
}
