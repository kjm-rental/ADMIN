import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
import { submitAdminAction } from "./feedback";
import { AdminActionError } from "@/lib/admin-action-error";
it("preserves deliberately safe operational payment messages", async () => {
  const result = await submitAdminAction(
    async () => {
      throw new AdminActionError("Payment has already been recorded.");
    },
    { error: "", saved: false },
    new FormData(),
  );
  expect(result).toEqual({
    error: "Payment has already been recorded.",
    saved: false,
  });
});
it("never forwards raw database messages", async () => {
  const result = await submitAdminAction(
    async () => {
      throw Error("private SQL and database details");
    },
    { error: "", saved: false },
    new FormData(),
  );
  expect(result.error).not.toContain("private SQL");
  expect(result.saved).toBe(false);
});
