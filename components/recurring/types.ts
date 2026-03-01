import { RecurringRecord } from "@/types/finance";

export interface GenerateError {
  error: string;
  details?: string;
}

export type FilterState = "all" | "active" | "inactive";
export type SortState = "name" | "amount" | "day";

export type RecurringFormData = {
  name: string;
  accion: "" | RecurringRecord["accion"];
  tipo: string;
  detalle1: string;
  detalle2: string;
  amount: string;
  frequency: RecurringRecord["frequency"];
  active: boolean;
  dia: number;
  plataforma_pago: string;
};

export const INITIAL_RECURRING_FORM: RecurringFormData = {
  name: "",
  accion: "",
  tipo: "",
  detalle1: "",
  detalle2: "",
  amount: "0",
  frequency: "monthly",
  active: true,
  dia: 1,
  plataforma_pago: "any",
};
