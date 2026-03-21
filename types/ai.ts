/**
 * AI-related type definitions
 */

/**
 * Request body for the parse-entry endpoint
 */
export type ParseEntryRequest = {
  text: string;
};

/**
 * Parsed finance entry returned by the AI
 */
export type ParsedEntry = {
  fecha: string;
  tipo: string;
  accion: "Ingreso" | "Gasto" | "Inversión";
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1?: string;
  detalle2?: string;
};

/**
 * Response from the parse-entry endpoint
 */
export type ParseEntryResponse = {
  success: boolean;
  entry?: ParsedEntry;
  entryId?: string;
  error?: string;
};

/**
 * Chat message type for the chat widget
 */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
};
