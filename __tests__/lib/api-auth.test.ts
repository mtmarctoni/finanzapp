/**
 * @jest-environment node
 */

import {
  authenticateApiRequest,
  authenticateAndRateLimitApiRequest,
} from "@/lib/api-auth";
import { verifyApiKey } from "@/lib/api-keys";

jest.mock("@/lib/api-keys");

const mockedVerifyApiKey = verifyApiKey as jest.MockedFunction<typeof verifyApiKey>;

describe("api auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates with x-api-key header", async () => {
    mockedVerifyApiKey.mockResolvedValue({ userId: "user-1", keyId: "key-1" });

    const request = new Request("http://localhost/api/v1/entries", {
      headers: { "x-api-key": "secret-key" },
    });

    const result = await authenticateApiRequest(request);

    expect(result).toEqual({ userId: "user-1", keyId: "key-1" });
    expect(mockedVerifyApiKey).toHaveBeenCalledWith("secret-key");
  });

  it("falls back to bearer token auth", async () => {
    mockedVerifyApiKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: "user-2", keyId: "key-2" });

    const request = new Request("http://localhost/api/v1/entries", {
      headers: {
        "x-api-key": "bad-key",
        authorization: "Bearer bearer-key",
      },
    });

    const result = await authenticateApiRequest(request);

    expect(result).toEqual({ userId: "user-2", keyId: "key-2" });
    expect(mockedVerifyApiKey).toHaveBeenNthCalledWith(1, "bad-key");
    expect(mockedVerifyApiKey).toHaveBeenNthCalledWith(2, "bearer-key");
  });

  it("returns null for missing credentials", async () => {
    const request = new Request("http://localhost/api/v1/entries");

    const result = await authenticateApiRequest(request);

    expect(result).toBeNull();
    expect(mockedVerifyApiKey).not.toHaveBeenCalled();
  });

  it("returns rate limit headers for allowed requests", async () => {
    mockedVerifyApiKey.mockResolvedValue({ userId: "user-1", keyId: "key-1" });

    const request = new Request("http://localhost/api/v1/entries", {
      headers: { "x-api-key": "secret-key" },
    });

    const result = await authenticateAndRateLimitApiRequest(request);

    expect(result.auth).toEqual({ userId: "user-1", keyId: "key-1" });
    expect(result.rateLimitHeaders).toBeDefined();
    expect(result.rateLimitResponse).toBeUndefined();
  });
});
