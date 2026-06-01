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
    id: "shopping",
    label: "Shopping",
    icon: "🛒",
    defaultRoute: "/shopping",
    routes: ["/shopping"],
    subNav: [
      { label: "My Lists", route: "/shopping" },
      { label: "Item Catalogue", route: "/shopping/catalogue" },
      { label: "Categories", route: "/shopping/categories" },
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
