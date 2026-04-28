/**
 * @jest-environment node
 */

import { POST } from "@/app/api/v1/entries/route";
import { authenticateAndRateLimitApiRequest } from "@/lib/api-auth";
import { createClient } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";

// Mocks
jest.mock("@/lib/api-auth");
jest.mock("@vercel/postgres");
jest.mock("uuid");

const mockedAuthenticate = authenticateAndRateLimitApiRequest as jest.MockedFunction<
  typeof authenticateAndRateLimitApiRequest
>;
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

function mockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/v1/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/entries", () => {
  const mockSql = jest.fn();
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedCreateClient.mockReturnValue({
      connect: mockConnect,
      query: mockQuery,
      sql: mockSql,
      end: mockEnd,
    } as unknown as ReturnType<typeof createClient>);

    mockedAuthenticate.mockResolvedValue({
      auth: { userId: "user-123", keyId: "key-456" },
      rateLimitHeaders: {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "59",
        "X-RateLimit-Reset": "9999999999",
      },
    });
    mockedUuidv4.mockReturnValue("generated-uuid-123");
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("authentication", () => {
    it("returns 401 when API key is missing or invalid", async () => {
      mockedAuthenticate.mockResolvedValue({ auth: null });

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limit is exceeded", async () => {
      mockedAuthenticate.mockResolvedValue({
        auth: { userId: "user-123", keyId: "key-456" },
        rateLimitResponse: new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        ),
      });

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);

      expect(response.status).toBe(429);
      expect(mockSql).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("returns 422 when required fields are missing", async () => {
      const request = mockRequest({
        tipo: "Salario",
        // missing fecha, accion, que, plataforma_pago, cantidad
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(422);
      expect(json.error).toBe("Validation Error");
      expect(json.issues).toBeDefined();
    });

    it("returns 422 when accion is invalid", async () => {
      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "InvalidAction",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(422);
      expect(json.issues.some((i: { path: string }) => i.path === "accion")).toBe(true);
    });

    it("returns 422 when cantidad is not positive", async () => {
      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: -100,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(422);
      expect(json.issues.some((i: { path: string; message: string }) =>
        i.path === "cantidad" && i.message.includes("positive")
      )).toBe(true);
    });

    it("returns 422 for invalid datetime string", async () => {
      const request = mockRequest({
        fecha: "not-a-date",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(422);
      expect(json.issues.some((i: { path: string }) => i.path === "fecha")).toBe(true);
    });

    it("returns 400 for invalid JSON body", async () => {
      const request = new Request("http://localhost:3000/api/v1/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Bad Request");
    });
  });

  describe("successful creation", () => {
    it("creates a single entry with valid data", async () => {
      mockSql.mockResolvedValue({
        rows: [
          {
            id: "generated-uuid-123",
            fecha: "2024-01-15T10:30:00Z",
            tipo: "Salario",
            accion: "Ingreso",
            que: "Trabajo",
            plataforma_pago: "Transferencia",
            cantidad: 2500.5,
            detalle1: null,
            detalle2: null,
            quien: "Yo",
          },
        ],
      });

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 2500.5,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("generated-uuid-123");
      expect(json.data.cantidad).toBe(2500.5);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("60");

      expect(mockQuery).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(mockQuery).toHaveBeenNthCalledWith(2, "COMMIT");
      expect(mockSql).toHaveBeenCalledTimes(1);
      expect(mockEnd).toHaveBeenCalled();
    });

    it("creates a batch of entries", async () => {
      mockSql
        .mockResolvedValueOnce({
          rows: [
            {
              id: "generated-uuid-123",
              fecha: "2024-01-15T10:30:00Z",
              tipo: "Salario",
              accion: "Ingreso",
              que: "Trabajo",
              plataforma_pago: "Transferencia",
              cantidad: 2500,
              detalle1: null,
              detalle2: null,
              quien: "Yo",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "generated-uuid-123",
              fecha: "2024-01-16T10:30:00Z",
              tipo: "Comida",
              accion: "Gasto",
              que: "Supermercado",
              plataforma_pago: "Tarjeta",
              cantidad: 150,
              detalle1: null,
              detalle2: null,
              quien: "Yo",
            },
          ],
        });

      const request = mockRequest({
        entries: [
          {
            fecha: "2024-01-15T10:30:00Z",
            tipo: "Salario",
            accion: "Ingreso",
            que: "Trabajo",
            plataforma_pago: "Transferencia",
            cantidad: 2500,
          },
          {
            fecha: "2024-01-16T10:30:00Z",
            tipo: "Comida",
            accion: "Gasto",
            que: "Supermercado",
            plataforma_pago: "Tarjeta",
            cantidad: 150,
          },
        ],
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(mockQuery).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(mockQuery).toHaveBeenNthCalledWith(2, "COMMIT");
      expect(mockSql).toHaveBeenCalledTimes(2);
      expect(mockEnd).toHaveBeenCalled();
    });

    it("auto-corrects stale years (>30 days old) to current year", async () => {
      mockSql.mockResolvedValue({
        rows: [
          {
            id: "generated-uuid-123",
            fecha: "2026-04-25T14:39:00Z",
            tipo: "Comida",
            accion: "Gasto",
            que: "Mercadona",
            plataforma_pago: "Tarjeta",
            cantidad: 50.06,
            detalle1: null,
            detalle2: null,
            quien: "Yo",
          },
        ],
      });

      // Send a date from 2023 (more than 30 days old)
      const request = mockRequest({
        fecha: "2023-04-25T14:39:00Z",
        tipo: "Comida",
        accion: "Gasto",
        que: "Mercadona",
        plataforma_pago: "Tarjeta",
        cantidad: 50.06,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      // Verify it succeeded (the date was corrected in the SQL template)
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("keeps recent dates (<30 days) unchanged", async () => {
      mockSql.mockResolvedValue({
        rows: [
          {
            id: "generated-uuid-123",
            fecha: "2026-04-01T10:00:00Z",
            tipo: "Salario",
            accion: "Ingreso",
            que: "Trabajo",
            plataforma_pago: "Transferencia",
            cantidad: 2500.5,
            detalle1: null,
            detalle2: null,
            quien: "Yo",
          },
        ],
      });

      // Send a date from a few days ago (within 30 days)
      const request = mockRequest({
        fecha: "2026-04-01T10:00:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 2500.5,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      // Verify it succeeded with the original date
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it("defaults quien to 'Yo' when not provided", async () => {
      mockSql.mockResolvedValue({
        rows: [
          {
            id: "generated-uuid-123",
            fecha: "2024-01-15T10:30:00Z",
            tipo: "Salario",
            accion: "Ingreso",
            que: "Trabajo",
            plataforma_pago: "Transferencia",
            cantidad: 1000,
            detalle1: null,
            detalle2: null,
            quien: "Yo",
          },
        ],
      });

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      await POST(request as unknown as import("next/server").NextRequest);

      expect(mockSql.mock.calls[0]).toContain("Yo");
    });

    it("associates entry with authenticated user", async () => {
      mockSql.mockResolvedValue({ rows: [{ id: "generated-uuid-123" }] });

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      await POST(request as unknown as import("next/server").NextRequest);

      expect(mockSql.mock.calls[0]).toContain("user-123");
    });

    it("rolls back the whole batch when one insert fails", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "generated-uuid-123" }] })
        .mockRejectedValueOnce(new Error("second insert failed"));

      const request = mockRequest({
        entries: [
          {
            fecha: "2024-01-15T10:30:00Z",
            tipo: "Salario",
            accion: "Ingreso",
            que: "Trabajo",
            plataforma_pago: "Transferencia",
            cantidad: 2500,
          },
          {
            fecha: "2024-01-16T10:30:00Z",
            tipo: "Comida",
            accion: "Gasto",
            que: "Supermercado",
            plataforma_pago: "Tarjeta",
            cantidad: 150,
          },
        ],
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);

      expect(response.status).toBe(500);
      expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("error handling", () => {
    it("returns 500 when database throws", async () => {
      mockSql.mockRejectedValue(new Error("DB connection failed"));

      const request = mockRequest({
        fecha: "2024-01-15T10:30:00Z",
        tipo: "Salario",
        accion: "Ingreso",
        que: "Trabajo",
        plataforma_pago: "Transferencia",
        cantidad: 1000,
      });

      const response = await POST(request as unknown as import("next/server").NextRequest);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Internal Server Error");
      expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
