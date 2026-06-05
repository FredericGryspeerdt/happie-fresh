import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { SubNavItem } from "@/config/navigation.ts";

type AppBarProps =
  | {
    mode: "section";
    activeTabLabel: string;
    subNavItems: SubNavItem[];
    activeRoute: string;
    logoutRoute?: string;
  }
  | {
    mode: "detail";
    title: string;
    backUrl: string;
  };

export default function AppBar(props: AppBarProps) {
  const open = useSignal(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open.value) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        open.value = false;
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open.value]);

  if (props.mode === "detail") {
    return (
      <div ref={containerRef} class="relative z-50">
        <header class="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
          <a
            href={props.backUrl}
            class="text-blue-600 text-xl"
            aria-label="Back"
          >
            ←
          </a>
          <span class="flex-1 font-bold text-xl truncate">{props.title}</span>
        </header>
      </div>
    );
  }

  const { activeTabLabel, subNavItems, activeRoute, logoutRoute } = props;

  return (
    <div ref={containerRef} class="relative z-50">
      <header class="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
        <span class="font-bold text-xl">{activeTabLabel}</span>
        {subNavItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              open.value = !open.value;
            }}
            aria-label={open.value
              ? "Close navigation menu"
              : "Open navigation menu"}
            aria-expanded={open.value}
            class="p-1 text-gray-600 text-xl"
          >
            {open.value ? "✕" : "≡"}
          </button>
        )}
      </header>
      {open.value && (
        <nav
          class="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-md"
          aria-label="Section navigation"
        >
          <ul class="py-2">
            {subNavItems.map((item) => (
              <li key={item.route}>
                <a
                  href={item.route}
                  class={`block px-6 py-3 text-sm ${
                    item.route === activeRoute
                      ? "text-blue-600 font-medium"
                      : "text-gray-700"
                  }`}
                  aria-current={item.route === activeRoute ? "page" : undefined}
                  onClick={() => {
                    open.value = false;
                  }}
                >
                  {item.route === activeRoute ? `› ${item.label}` : item.label}
                </a>
              </li>
            ))}
            {logoutRoute && (
              <>
                <li
                  role="separator"
                  class="my-2 border-t border-gray-100"
                />
                <li>
                  <a
                    href={logoutRoute}
                    class="block px-6 py-3 text-sm text-red-500"
                  >
                    Logout
                  </a>
                </li>
              </>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
