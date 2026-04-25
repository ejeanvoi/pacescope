import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "../validators/auth";
import {
  gpxUploadSchema,
  activityListQuerySchema,
  GPX_MAX_FILE_SIZE,
} from "../validators/activity";

// ─── Auth Validators ────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
    expect(loginSchema.safeParse({ password: "x" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "alice@example.com",
      password: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    const result = registerSchema.safeParse({
      name: "A".repeat(101),
      email: "a@b.com",
      password: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "Pass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "PASSWORD1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "Password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 chars", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "A1" + "a".repeat(127),
    });
    expect(result.success).toBe(false);
  });
});

// ─── Activity Validators ────────────────────────────────────────────

describe("gpxUploadSchema", () => {
  it("accepts valid upload data", () => {
    const result = gpxUploadSchema.safeParse({ type: "RUN" });
    expect(result.success).toBe(true);
  });

  it("accepts all activity types", () => {
    for (const type of ["RUN", "TRAIL_RUN", "TREADMILL"]) {
      expect(gpxUploadSchema.safeParse({ type }).success).toBe(true);
    }
  });

  it("rejects invalid activity type", () => {
    expect(gpxUploadSchema.safeParse({ type: "CYCLING" }).success).toBe(false);
  });

  it("accepts optional name", () => {
    const result = gpxUploadSchema.safeParse({
      type: "RUN",
      name: "My Run",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name longer than 200 chars", () => {
    const result = gpxUploadSchema.safeParse({
      type: "RUN",
      name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("activityListQuerySchema", () => {
  it("applies defaults for empty input", () => {
    const result = activityListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe("startDate");
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("coerces string numbers", () => {
    const result = activityListQuerySchema.safeParse({
      page: "3",
      limit: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects page < 1", () => {
    expect(
      activityListQuerySchema.safeParse({ page: "0" }).success
    ).toBe(false);
  });

  it("rejects limit > 100", () => {
    expect(
      activityListQuerySchema.safeParse({ limit: "101" }).success
    ).toBe(false);
  });

  it("accepts valid sort options", () => {
    for (const sortBy of [
      "startDate",
      "distance",
      "duration",
      "averagePace",
    ]) {
      const result = activityListQuerySchema.safeParse({ sortBy });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid sortBy", () => {
    expect(
      activityListQuerySchema.safeParse({ sortBy: "name" }).success
    ).toBe(false);
  });

  it("accepts optional type filter", () => {
    const result = activityListQuerySchema.safeParse({ type: "TRAIL_RUN" });
    expect(result.success).toBe(true);
  });
});

describe("GPX_MAX_FILE_SIZE", () => {
  it("is 10MB", () => {
    expect(GPX_MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });
});
