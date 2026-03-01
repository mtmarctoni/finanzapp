import { RecurringRecord } from "@/types/finance";

export const getSignedRecurringAmount = (record: RecurringRecord): number =>
  record.accion === "Ingreso" ? record.amount : -record.amount;

export const calculateMonthlyEstimate = (records: RecurringRecord[]): number =>
  records
    .filter((record) => record.active)
    .reduce((sum, record) => sum + getSignedRecurringAmount(record), 0);
