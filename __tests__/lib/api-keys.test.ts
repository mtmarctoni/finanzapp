/**
 * @jest-environment node
 */

import { generateApiKey, hashApiKey } from "@/lib/api-keys";

describe("api key helpers", () => {
  it("generates prefixed api keys and matching hashes", () => {
    const { plaintext, hash } = generateApiKey();

    expect(plaintext.startsWith("fa_")).toBe(true);
    expect(plaintext.length).toBeGreaterThan(10);
    expect(hash).toBe(hashApiKey(plaintext));
  });

  it("hashes equal keys to the same value", () => {
    expect(hashApiKey("fa_test_key")).toBe(hashApiKey("fa_test_key"));
  });

  it("hashes different keys differently", () => {
    expect(hashApiKey("fa_test_key_a")).not.toBe(hashApiKey("fa_test_key_b"));
  });
});
