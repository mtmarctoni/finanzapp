import { RecurringRecord } from "@/types/finance";

export const frequencyLabel: Record<RecurringRecord["frequency"], string> = {
  monthly: "Mensual",
  weekly: "Semanal",
  biweekly: "Cada 2 semanas",
  yearly: "Anual",
};
