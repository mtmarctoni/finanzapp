import {
  Banknote,
  BriefcaseBusiness,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  Pill,
  PiggyBank,
  Plane,
  Popcorn,
  Shirt,
  ShoppingBasket,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Category -> icon + hue. Matching is by keyword so free-form user categories
 * ("Comida fuera", "supermercado lidl") still land somewhere sensible; anything
 * unknown falls back to a neutral tag.
 */
const RULES: { test: RegExp; icon: LucideIcon; hue: string }[] = [
  { test: /super|mercad|compra/i, icon: ShoppingBasket, hue: '#FFC940' },
  {
    test: /comida|restau|cena|almuerzo|menu|menú/i,
    icon: Utensils,
    hue: '#FF9F43',
  },
  { test: /caf[eé]|bar|copa/i, icon: Coffee, hue: '#E0A46B' },
  { test: /transp|metro|bus|taxi|uber|cabify/i, icon: Bus, hue: '#4DA3FF' },
  { test: /coche|gasol|parking|peaje/i, icon: Car, hue: '#4DA3FF' },
  { test: /viaj|vuelo|hotel/i, icon: Plane, hue: '#38BDF8' },
  { test: /ocio|cine|concierto|entreten/i, icon: Popcorn, hue: '#FF5CAB' },
  {
    test: /vivienda|alquiler|hipoteca|casa|hogar/i,
    icon: House,
    hue: '#A07BFF',
  },
  { test: /luz|electric|agua|gas\b|suministro/i, icon: Zap, hue: '#FACC15' },
  { test: /internet|m[oó]vil|telef|fibra/i, icon: Wifi, hue: '#2DD4C4' },
  {
    test: /servicio|suscrip|netflix|spotify/i,
    icon: Smartphone,
    hue: '#2DD4C4',
  },
  { test: /salud|m[eé]dic|dentist|farmac/i, icon: HeartPulse, hue: '#FF6B6B' },
  { test: /medicin|pastill/i, icon: Pill, hue: '#FF6B6B' },
  { test: /gym|gimnas|deporte/i, icon: Dumbbell, hue: '#F97316' },
  { test: /ropa|moda|zapat/i, icon: Shirt, hue: '#F472B6' },
  { test: /regalo/i, icon: Gift, hue: '#F472B6' },
  { test: /educa|curso|libro|formaci/i, icon: GraduationCap, hue: '#60A5FA' },
  { test: /tecno|electr[oó]nic|ordenador/i, icon: Laptop, hue: '#94A3B8' },
  {
    test: /salario|n[oó]mina|sueldo/i,
    icon: BriefcaseBusiness,
    hue: '#3BE29A',
  },
  { test: /ahorro/i, icon: PiggyBank, hue: '#3BE29A' },
  {
    test: /inver|negocio|bolsa|fondo|cripto|etf/i,
    icon: TrendingUp,
    hue: '#8B9CFF',
  },
  { test: /banco|comisi|impuesto|hacienda/i, icon: Landmark, hue: '#94A3B8' },
  { test: /tienda|shopping|amazon/i, icon: ShoppingBag, hue: '#F59E0B' },
  { test: /belleza|peluquer/i, icon: Sparkles, hue: '#E879F9' },
];

function categoryStyle(name: string | null | undefined): {
  icon: LucideIcon;
  hue: string;
} {
  const rule = RULES.find((r) => r.test.test(name ?? ''));
  return rule ?? { icon: Tag, hue: '#9A9AA3' };
}

const PAYMENT_RULES: { test: RegExp; icon: LucideIcon }[] = [
  { test: /efectivo|cash|met[aá]lico/i, icon: Banknote },
  {
    test: /bizum|revolut|m[oó]vil|apple|google|paypal|wise/i,
    icon: Smartphone,
  },
  { test: /cuenta|transfer|banco/i, icon: Landmark },
  { test: /tarjeta|visa|master|card|bbva|santander|ing/i, icon: CreditCard },
];

export function paymentIcon(name: string | null | undefined): LucideIcon {
  return PAYMENT_RULES.find((r) => r.test.test(name ?? ''))?.icon ?? Wallet;
}

/** Tinted rounded tile with the category's icon. */
export function CategoryTile({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { icon: Icon, hue } = categoryStyle(name);
  const box =
    size === 'sm'
      ? 'h-7 w-7 rounded-[9px]'
      : size === 'lg'
        ? 'h-12 w-12 rounded-[14px]'
        : 'h-10 w-10 rounded-xl';
  const glyph =
    size === 'sm'
      ? 'h-3.5 w-3.5'
      : size === 'lg'
        ? 'h-5 w-5'
        : 'h-[18px] w-[18px]';
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', box, className)}
      style={{ backgroundColor: `${hue}22`, color: hue }}
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}
