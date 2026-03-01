import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";

import { useToast } from "@/hooks/use-toast";
import { RecurringRecord } from "@/types/finance";
import { GenerateError, RecurringFormData } from "@/components/recurring/types";

interface UseRecurringRecordsResult {
  recurringRecords: RecurringRecord[];
  loading: boolean;
  fetchRecurringRecords: () => Promise<void>;
  addRecord: (record: RecurringFormData) => Promise<boolean>;
  updateRecord: (id: string, record: RecurringFormData) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
  generateRecords: (date: Date) => Promise<boolean>;
}

const buildPayload = (record: RecurringFormData) => ({
  name: record.name,
  accion: record.accion,
  tipo: record.tipo,
  detalle1: record.detalle1,
  detalle2: record.detalle2,
  amount: parseFloat(record.amount),
  frequency: record.frequency,
  active: record.active,
  dia: record.dia,
  plataforma_pago: record.plataforma_pago,
});

export function useRecurringRecords(): UseRecurringRecordsResult {
  const [recurringRecords, setRecurringRecords] = useState<RecurringRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRecurringRecords = useCallback(async () => {
    try {
      const response = await fetch("/api/recurring");
      if (!response.ok) throw new Error("Failed to fetch recurring records");
      const data = (await response.json()) as RecurringRecord[];
      setRecurringRecords(data);
    } catch (error: unknown) {
      console.error("Error fetching recurring records:", error);
      toast({
        title: "Error",
        description: "Error al cargar los registros recurrentes",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchRecurringRecords();
  }, [fetchRecurringRecords]);

  const addRecord = useCallback(
    async (record: RecurringFormData) => {
      try {
        setLoading(true);
        const response = await fetch("/api/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(record)),
        });

        if (!response.ok) throw new Error("Failed to add recurring record");

        await fetchRecurringRecords();
        toast({
          title: "Éxito",
          description: "Registro recurrente añadido correctamente",
        });
        return true;
      } catch (error: unknown) {
        console.error("Error adding recurring record:", error);
        toast({
          title: "Error",
          description: "Error al añadir el registro recurrente",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchRecurringRecords, toast],
  );

  const updateRecord = useCallback(
    async (id: string, record: RecurringFormData) => {
      try {
        setLoading(true);
        const response = await fetch("/api/recurring", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...buildPayload(record) }),
        });

        if (!response.ok) throw new Error("Failed to update recurring record");

        await fetchRecurringRecords();
        toast({
          title: "Éxito",
          description: "Registro recurrente actualizado correctamente",
        });
        return true;
      } catch (error: unknown) {
        console.error("Error updating recurring record:", error);
        toast({
          title: "Error",
          description: "Error al actualizar el registro recurrente",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchRecurringRecords, toast],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      if (!confirm("¿Seguro que deseas eliminar este registro recurrente?"))
        return false;

      try {
        setLoading(true);
        const response = await fetch("/api/recurring", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error("Failed to delete recurring record");

        await fetchRecurringRecords();
        toast({
          title: "Éxito",
          description: "Registro recurrente eliminado correctamente",
        });
        return true;
      } catch (error: unknown) {
        console.error("Error deleting recurring record:", error);
        toast({
          title: "Error",
          description: "Error al eliminar el registro recurrente",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchRecurringRecords, toast],
  );

  const generateRecords = useCallback(
    async (date: Date) => {
      if (
        !confirm(
          "¿Generar ahora los registros recurrentes para la fecha seleccionada?",
        )
      )
        return false;

      try {
        setLoading(true);
        const response = await fetch("/api/recurring/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: format(date, "yyyy-MM-dd"),
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as GenerateError;
          throw new Error(
            errorData.details || "Failed to generate recurring records",
          );
        }

        const result = (await response.json()) as { generated: number };
        toast({
          title: "Éxito",
          description: `Generados ${result.generated} registros`,
        });
        await fetchRecurringRecords();
        return true;
      } catch (error: unknown) {
        console.error("Error generating recurring records:", error);
        toast({
          title: "Error",
          description: "Error al generar los registros recurrentes",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchRecurringRecords, toast],
  );

  return {
    recurringRecords,
    loading,
    fetchRecurringRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    generateRecords,
  };
}
