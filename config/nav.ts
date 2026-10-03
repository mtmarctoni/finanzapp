import {
  BarChart3,
  Bitcoin,
  House,
  ListOrdered,
  Repeat,
  UserRound,
} from 'lucide-react';

type NavIcon = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

export type NavItem = {
  name: string;
  href: string;
  icon: NavIcon;
};

/** Every section, in sidebar order. */
export const NAV_ITEMS: NavItem[] = [
  { name: 'Inicio', href: '/dashboard', icon: House },
  { name: 'Registros', href: '/records', icon: ListOrdered },
  { name: 'Análisis', href: '/analytics', icon: BarChart3 },
  { name: 'Recurrentes', href: '/recurring', icon: Repeat },
  { name: 'Cripto', href: '/investment/crypto', icon: Bitcoin },
];

/** The four mobile tabs; the add button sits between the second and third. */
export const MOBILE_TABS: NavItem[] = NAV_ITEMS.slice(0, 3);

/** Sections reached from the mobile "Más" sheet. */
export const MORE_ITEMS: NavItem[] = [
  ...NAV_ITEMS.slice(3),
  { name: 'Perfil', href: '/user', icon: UserRound },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
