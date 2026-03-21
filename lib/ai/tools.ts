import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";

/**
 * AI tool: Create a finance entry in the database.
 * The userId is injected at call time — not exposed to the AI.
 */
export function createFinanceEntryTool(userId: string) {
  return tool({
    description:
      "Create a new finance entry (income, expense, or investment) in the database.",
    inputSchema: z.object({
      fecha: z
        .string()
        .describe("Transaction date in ISO 8601 format (e.g., 2026-03-21)"),
      tipo: z
        .string()
        .describe(
          'Category of the transaction (e.g., "Comida", "Sueldo", "Transporte")'
        ),
      accion: z
        .enum(["Ingreso", "Gasto", "Inversión"])
        .describe("Transaction type: Ingreso, Gasto, or Inversión"),
      que: z
        .string()
        .describe(
          'Short description of the transaction (e.g., "Restaurante El Camino")'
        ),
      plataforma_pago: z
        .string()
        .describe(
          'Payment method (e.g., "Efectivo", "Tarjeta", "Bizum")'
        ),
      cantidad: z
        .number()
        .positive()
        .describe("Amount (always positive)"),
      detalle1: z
        .string()
        .optional()
        .describe("Optional extra detail 1"),
      detalle2: z
        .string()
        .optional()
        .describe("Optional extra detail 2"),
    }),
    execute: async (input) => {
      const entryId = uuidv4();
      const client = createClient();
      await client.connect();

      try {
        await client.sql`
          INSERT INTO finance_entries (id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2, user_id)
          VALUES (${entryId}, ${input.fecha}::timestamptz, ${input.tipo}, ${input.accion}, ${input.que}, ${input.plataforma_pago}, ${input.cantidad}, ${input.detalle1 || null}, ${input.detalle2 || null}, ${userId})
        `;

        return {
          success: true as const,
          entryId,
          message: `Entrada creada: ${input.accion} de ${input.cantidad}\u20AC \u2014 ${input.que} (${input.tipo})`,
        };
      } catch (error) {
        console.error("AI tool createFinanceEntry error:", error);
        return {
          success: false as const,
          message: "Error al crear la entrada en la base de datos.",
        };
      } finally {
        await client.end();
      }
    },
  });
}

/**
 * AI tool: Get recent finance entries.
 */
export function getRecentEntriesTool(userId: string) {
  return tool({
    description:
      "Get the most recent finance entries for the user, optionally filtered by type.",
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of entries to return (default 10, max 50)"),
      accion: z
        .enum(["Ingreso", "Gasto", "Inversión"])
        .optional()
        .describe("Filter by transaction type"),
    }),
    execute: async (input) => {
      const client = createClient();
      await client.connect();

      try {
        let result;
        if (input.accion) {
          result = await client.sql`
            SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2
            FROM finance_entries
            WHERE user_id = ${userId} AND accion = ${input.accion}
            ORDER BY fecha DESC
            LIMIT ${input.limit}
          `;
        } else {
          result = await client.sql`
            SELECT id, fecha, tipo, accion, que, plataforma_pago, cantidad, detalle1, detalle2
            FROM finance_entries
            WHERE user_id = ${userId}
            ORDER BY fecha DESC
            LIMIT ${input.limit}
          `;
        }

        return {
          entries: result.rows,
          count: result.rows.length,
        };
      } catch (error) {
        console.error("AI tool getRecentEntries error:", error);
        return { entries: [] as Record<string, unknown>[], count: 0, error: "Error al consultar entradas." };
      } finally {
        await client.end();
      }
    },
  });
}

/**
 * AI tool: Get spending breakdown by category.
 */
export function getSpendingByCategoryTool(userId: string) {
  return tool({
    description:
      "Get a breakdown of spending (Gasto) grouped by category (tipo) for a date range.",
    inputSchema: z.object({
      from: z
        .string()
        .describe("Start date in ISO 8601 format (e.g., 2026-01-01)"),
      to: z
        .string()
        .describe("End date in ISO 8601 format (e.g., 2026-03-21)"),
    }),
    execute: async (input) => {
      const client = createClient();
      await client.connect();

      try {
        const result = await client.sql`
          SELECT tipo, SUM(cantidad) as total, COUNT(*) as count
          FROM finance_entries
          WHERE user_id = ${userId}
            AND accion = 'Gasto'
            AND fecha >= ${input.from}::timestamptz
            AND fecha <= ${input.to}::timestamptz
          GROUP BY tipo
          ORDER BY total DESC
        `;

        return {
          categories: result.rows,
          totalSpending: result.rows.reduce(
            (sum, row) => sum + Number(row.total),
            0
          ),
        };
      } catch (error) {
        console.error("AI tool getSpendingByCategory error:", error);
        return {
          categories: [] as Record<string, unknown>[],
          totalSpending: 0,
          error: "Error al consultar gastos por categor\u00EDa.",
        };
      } finally {
        await client.end();
      }
    },
  });
}

/**
 * AI tool: Get total income/expense/investment for a period.
 */
export function getTotalByPeriodTool(userId: string) {
  return tool({
    description:
      "Get total amounts for income, expenses, and investments in a date range.",
    inputSchema: z.object({
      from: z
        .string()
        .describe("Start date in ISO 8601 format (e.g., 2026-01-01)"),
      to: z
        .string()
        .describe("End date in ISO 8601 format (e.g., 2026-03-21)"),
    }),
    execute: async (input) => {
      const client = createClient();
      await client.connect();

      try {
        const result = await client.sql`
          SELECT accion, SUM(cantidad) as total, COUNT(*) as count
          FROM finance_entries
          WHERE user_id = ${userId}
            AND fecha >= ${input.from}::timestamptz
            AND fecha <= ${input.to}::timestamptz
          GROUP BY accion
        `;

        const totals: Record<string, { total: number; count: number }> = {};
        for (const row of result.rows) {
          totals[row.accion] = {
            total: Number(row.total),
            count: Number(row.count),
          };
        }

        const income = totals["Ingreso"]?.total ?? 0;
        const expense = totals["Gasto"]?.total ?? 0;
        const investment = totals["Inversi\u00F3n"]?.total ?? 0;

        return {
          income,
          expense,
          investment,
          netBalance: income - expense - investment,
          details: totals,
        };
      } catch (error) {
        console.error("AI tool getTotalByPeriod error:", error);
        return {
          income: 0,
          expense: 0,
          investment: 0,
          netBalance: 0,
          error: "Error al calcular totales.",
        };
      } finally {
        await client.end();
      }
    },
  });
}
