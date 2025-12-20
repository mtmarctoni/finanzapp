import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  dateString: string | Date,
  includeTime: boolean = false
) {
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;

  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  if (includeTime) {
    return date.toLocaleString("es-ES", {
      ...dateOptions,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("es-ES", dateOptions);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Checks if a transaction should be split (joyntlanda logic)
 * Returns true if the transaction is a 'Gasto' and either:
 * - plataforma_pago equals 'joyntlanda' (case-insensitive)
 * - detalle1 contains 'joyntlanda' (case-insensitive)
 */
export function shouldSplitTransaction(
  plataforma_pago: string,
  detalle1: string | null | undefined,
  accion: string
): boolean {
  return (
    accion === "Gasto" &&
    (plataforma_pago.toLowerCase() === "joyntlanda" ||
      detalle1?.toLowerCase().includes("joyntlanda") ||
      false)
  );
}
