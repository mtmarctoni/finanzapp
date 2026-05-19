/**
 * @jest-environment node
 */

import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { createHash, createHmac } from "crypto";

describe("api key security", () => {
  const originalPepper = process.env.API_KEY_PEPPER;

  afterAll(() => {
    if (originalPepper === undefined) {
      delete process.env.API_KEY_PEPPER;
    } else {
      process.env.API_KEY_PEPPER = originalPepper;
    }
  });

  describe("hashApiKey with pepper (HMAC-SHA-256)", () => {
    it("uses HMAC-SHA-256 when API_KEY_PEPPER is set", () => {
      process.env.API_KEY_PEPPER = "test-pepper-value";
      const key = "fa_testkey123";
      const hash = hashApiKey(key);
      const expected = createHmac("sha256", "test-pepper-value")
        .update(key)
        .digest("hex");
      expect(hash).toBe(expected);
    });

    it("produces different hashes with different peppers", () => {
      process.env.API_KEY_PEPPER = "pepper-a";
      const hashA = hashApiKey("fa_same_key");
      process.env.API_KEY_PEPPER = "pepper-b";
      const hashB = hashApiKey("fa_same_key");
      expect(hashA).not.toBe(hashB);
    });

    it("produces 64-char hex output (SHA-256 digest)", () => {
      process.env.API_KEY_PEPPER = "pepper";
      const { hash } = generateApiKey();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("hashApiKey without pepper (legacy SHA-256 fallback)", () => {
    it("falls back to plain SHA-256 when API_KEY_PEPPER is not set", () => {
      delete process.env.API_KEY_PEPPER;
      const key = "fa_testkey456";
      const hash = hashApiKey(key);
      const expected = createHash("sha256").update(key).digest("hex");
      expect(hash).toBe(expected);
    });
  });

  describe("generateApiKey", () => {
    it("produces keys with the fa_ prefix", () => {
      const { plaintext } = generateApiKey();
      expect(plaintext.startsWith("fa_")).toBe(true);
    });

    it("produces 67-char keys (fa_ + 64 hex chars from 32 random bytes)", () => {
      const { plaintext } = generateApiKey();
      expect(plaintext).toHaveLength(3 + 64);
    });

    it("generates unique keys on successive calls", () => {
      const { plaintext: a } = generateApiKey();
      const { plaintext: b } = generateApiKey();
      expect(a).not.toBe(b);
    });
  });

  describe("verifyApiKey prefix check (regression: key without prefix)", () => {
    it("rejects keys without the fa_ prefix", async () => {
      process.env.API_KEY_PEPPER = "test";
      const { verifyApiKey } = await import("@/lib/api-keys");
      const result = await verifyApiKey("not_a_valid_key");
      expect(result).toBeNull();
    });

    it("rejects empty string", async () => {
      const { verifyApiKey } = await import("@/lib/api-keys");
      const result = await verifyApiKey("");
      expect(result).toBeNull();
    });
  });
});