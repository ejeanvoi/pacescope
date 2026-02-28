import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { encrypt, decrypt } from "../crypto";

// Use a test encryption key (32 bytes = 64 hex chars)
const TEST_KEY = "a".repeat(64);

describe("crypto", () => {
  beforeAll(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a string roundtrip", () => {
    const plaintext = "my-secret-token-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("encrypted format is iv:authTag:ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV is 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext is at least 1 hex char
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("throws on invalid encrypted format", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted string format");
    expect(() => decrypt("a:b")).toThrow("Invalid encrypted string format");
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode content", () => {
    const plaintext = "Hello 🏃‍♂️ runner! À bientôt!";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("handles long strings", () => {
    const plaintext = "x".repeat(10000);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});

describe("crypto - missing key", () => {
  beforeAll(() => {
    vi.stubEnv("ENCRYPTION_KEY", "");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });
});
