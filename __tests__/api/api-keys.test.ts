/**
 * @jest-environment node
 */

import { GET as listKeys, POST as createKey } from "@/app/api/api-keys/route";
import { GET as getKey, DELETE as revokeKey } from "@/app/api/api-keys/[id]/route";
import { getServerSession } from "next-auth";
import {
  createApiKey,
  getApiKeyById,
  listApiKeys,
  revokeApiKey,
} from "@/lib/api-keys";

jest.mock("next-auth");
jest.mock("@/lib/api-keys");

const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockedCreateApiKey = createApiKey as jest.MockedFunction<typeof createApiKey>;
const mockedGetApiKeyById = getApiKeyById as jest.MockedFunction<typeof getApiKeyById>;
const mockedListApiKeys = listApiKeys as jest.MockedFunction<typeof listApiKeys>;
const mockedRevokeApiKey = revokeApiKey as jest.MockedFunction<typeof revokeApiKey>;

describe("api key routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com", name: "Test User" },
      expires: "2099-01-01T00:00:00.000Z",
    });
  });

  it("lists api keys for the signed-in user", async () => {
    mockedListApiKeys.mockResolvedValue([
      {
        id: "key-1",
        user_id: "user-123",
        name: "Zapier",
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_used_at: null,
      },
    ]);

    const response = await listKeys();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockedListApiKeys).toHaveBeenCalledWith("user-123");
  });

  it("creates an api key and returns plaintext once", async () => {
    mockedCreateApiKey.mockResolvedValue({
      id: "key-1",
      user_id: "user-123",
      key_hash: "hashed",
      name: "Zapier",
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_used_at: null,
      plaintext: "fa_secret_key",
    });

    const request = new Request("http://localhost/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Zapier" }),
    });

    const response = await createKey(request as unknown as import("next/server").NextRequest);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.plaintext).toBe("fa_secret_key");
    expect(mockedCreateApiKey).toHaveBeenCalledWith("user-123", "Zapier");
  });

  it("fetches a single api key for the signed-in user", async () => {
    mockedGetApiKeyById.mockResolvedValue({
      id: "key-1",
      user_id: "user-123",
      name: "Zapier",
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_used_at: null,
    });

    const response = await getKey(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "key-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("key-1");
    expect(mockedGetApiKeyById).toHaveBeenCalledWith("key-1", "user-123");
  });

  it("revokes an api key for the signed-in user", async () => {
    mockedRevokeApiKey.mockResolvedValue(true);

    const response = await revokeKey(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "key-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockedRevokeApiKey).toHaveBeenCalledWith("key-1", "user-123");
  });

  it("returns 401 when not signed in", async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await listKeys();

    expect(response.status).toBe(401);
  });
});
