export interface SubNavItem {
  label: string;
  route: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  defaultRoute: string;
  routes: string[];
  subNav: SubNavItem[];
}

export const NAV_CONFIG: NavItem[] = [
  {
    id: "shopping-lists",
    label: "Lists",
    icon: "🛒",
    defaultRoute: "/lists",
    routes: ["/lists", "/items", "/categories"],
    subNav: [
      { label: "My Lists", route: "/lists" },
      { label: "Item Catalogue", route: "/items" },
      { label: "Categories", route: "/categories/manage" },
    ],
  },
];

export function resolveActiveTab(pathname: string): NavItem | undefined {
  return NAV_CONFIG.find((item) =>
    item.routes.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  );
}
