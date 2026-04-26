import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { ApiKeyManager } from "@/components/api-key-manager"

const mockToast = jest.fn()

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

describe("ApiKeyManager", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })
  })

  it("loads and renders active api keys", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "key-1",
            user_id: "user-123",
            name: "Zapier",
            is_active: true,
            created_at: "2026-01-01T10:00:00.000Z",
            updated_at: "2026-01-01T10:00:00.000Z",
            last_used_at: null,
          },
        ],
      }),
    }) as jest.Mock

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("Zapier")).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith("/api/api-keys", { cache: "no-store" })
  })

  it("creates a new api key and shows plaintext once", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "key-2",
            name: "n8n",
            is_active: true,
            created_at: "2026-01-02T10:00:00.000Z",
            updated_at: "2026-01-02T10:00:00.000Z",
            last_used_at: null,
            plaintext: "fa_secret_key",
          },
        }),
      }) as jest.Mock

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText("Nombre de la nueva llave"), {
      target: { value: "n8n" },
    })
    fireEvent.click(screen.getByText("Crear llave"))

    await waitFor(() => {
      expect(screen.getByText("fa_secret_key")).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenNthCalledWith(2, "/api/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "n8n" }),
    })
  })

  it("copies the generated key to clipboard", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "key-2",
            name: "n8n",
            is_active: true,
            created_at: "2026-01-02T10:00:00.000Z",
            updated_at: "2026-01-02T10:00:00.000Z",
            last_used_at: null,
            plaintext: "fa_secret_key",
          },
        }),
      }) as jest.Mock

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText("Nombre de la nueva llave"), {
      target: { value: "n8n" },
    })
    fireEvent.click(screen.getByText("Crear llave"))

    await waitFor(() => {
      expect(screen.getByText("Copiar llave")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Copiar llave"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("fa_secret_key")
    })
  })

  it("revokes an api key and removes it from active list", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "key-1",
              user_id: "user-123",
              name: "Zapier",
              is_active: true,
              created_at: "2026-01-01T10:00:00.000Z",
              updated_at: "2026-01-01T10:00:00.000Z",
              last_used_at: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }) as jest.Mock

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("Zapier")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText("Revocar llave Zapier"))

    await waitFor(() => {
      expect(screen.queryByText("Zapier")).not.toBeInTheDocument()
    })

    expect(fetch).toHaveBeenNthCalledWith(2, "/api/api-keys/key-1", {
      method: "DELETE",
    })
  })
})
