import type { NavItem } from "@/config/navigation.ts";

interface TabBarProps {
  items: NavItem[];
  activeTabId: string | undefined;
}

export default function TabBar({ items, activeTabId }: TabBarProps) {
  return (
    <nav
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40"
      aria-label="Main navigation"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={item.defaultRoute}
          class={`flex flex-col items-center gap-1 px-4 py-2 text-xs ${
            item.id === activeTabId ? "text-blue-600" : "text-gray-500"
          }`}
          aria-current={item.id === activeTabId ? "page" : undefined}
        >
          <span class="text-xl" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
