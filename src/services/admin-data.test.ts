import { describe, expect, it } from "vitest";

import {
  AdminAuthorizationError,
  assertActiveAdmin,
  withActiveAdmin,
} from "@/services/admin-data";

describe("admin authorization boundary", () => {
  it("denies anonymous callers", () => {
    expect(() =>
      assertActiveAdmin({ userId: null, isActiveAdmin: false }),
    ).toThrow(AdminAuthorizationError);
  });

  it("denies ordinary authenticated users", () => {
    expect(() =>
      assertActiveAdmin({ userId: "ordinary-user", isActiveAdmin: false }),
    ).toThrow(AdminAuthorizationError);
  });

  it("runs an operation only after the active-admin assertion", async () => {
    await expect(
      withActiveAdmin(
        { userId: "verified-admin", isActiveAdmin: true },
        async (userId) => userId,
      ),
    ).resolves.toBe("verified-admin");
  });
});
