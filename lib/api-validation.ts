import { z } from "zod";

/**
 * Valid values for accion field
 */
export const AccionEnum = z.enum(["Ingreso", "Gasto", "Inversión"]);

/**
 * Schema for creating a finance entry via the public API.
 */
export const CreateEntrySchema = z.object({
  fecha: z.string().datetime({ message: "fecha must be a valid ISO 8601 datetime string" }),
  tipo: z.string().min(1).max(255),
  accion: AccionEnum,
  que: z.string().min(1).max(255),
  plataforma_pago: z.string().min(1).max(255),
  cantidad: z.number().positive("cantidad must be a positive number"),
  detalle1: z.string().max(255).optional().nullable(),
  detalle2: z.string().max(255).optional().nullable(),
  quien: z.string().min(1).max(255).optional().default("Yo"),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

/**
 * Schema for batch creating multiple entries.
 */
export const BatchCreateEntrySchema = z.object({
  entries: z
    .array(CreateEntrySchema)
    .min(1, "At least one entry is required")
    .max(100, "Maximum 100 entries per batch"),
});

export type BatchCreateEntryInput = z.infer<typeof BatchCreateEntrySchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
