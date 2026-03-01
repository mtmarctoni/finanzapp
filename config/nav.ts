import {
  Home,
  LayoutDashboard,
  Repeat,
  BarChart3,
  Bitcoin,
} from "lucide-react";

export type NavIcon = React.ComponentType<{ className?: string }>;

export type NavItem = {
  name: string;
  href: string;
  icon: NavIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Registros", href: "/records", icon: LayoutDashboard },
  { name: "Cripto", href: "/investment/crypto", icon: Bitcoin },
  { name: "Recurrentes", href: "/recurring", icon: Repeat },
  { name: "Análisis", href: "/analytics", icon: BarChart3 },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
