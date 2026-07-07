import type { IconName } from "@/components/md3/Icon.tsx";

export interface SubNavItem {
  label: string;
  route: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  iconName: IconName;
  defaultRoute: string;
  routes: string[];
  subNav: SubNavItem[];
}

export const NAV_CONFIG: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: "🏠",
    iconName: "home",
    defaultRoute: "/home",
    routes: ["/home"],
    subNav: [],
  },
  {
    id: "shopping",
    label: "Shop",
    icon: "🛒",
    iconName: "cart",
    defaultRoute: "/shopping",
    routes: ["/shopping"],
    subNav: [],
  },
  {
    id: "todos",
    label: "To-dos",
    icon: "✅",
    iconName: "checklist",
    defaultRoute: "/todos",
    routes: ["/todos"],
    subNav: [],
  },
  {
    id: "menu",
    label: "Menu",
    icon: "🍽️",
    iconName: "plate",
    defaultRoute: "/menu",
    routes: ["/menu"],
    subNav: [],
  },
  {
    id: "more",
    label: "More",
    icon: "⋯",
    iconName: "dots",
    defaultRoute: "/more",
    routes: ["/more"],
    subNav: [],
  },
];

export function resolveActiveTab(pathname: string): NavItem | undefined {
  return NAV_CONFIG.find((item) =>
    item.routes.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  );
}
