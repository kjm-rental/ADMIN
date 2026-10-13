import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT")
      throw error;
  },
}));
import { submitAdminAction } from "./feedback";
it("reports success only after the original server action completes", async () => {
  const action = vi.fn(async () => {}),
    data = new FormData();
  expect(
    await submitAdminAction(action, { error: "", saved: false }, data),
  ).toEqual({ error: "", saved: true });
  expect(action).toHaveBeenCalledExactlyOnceWith(data);
});
it("shows failure without exposing server or customer details", async () => {
  const result = await submitAdminAction(
    async () => {
      throw Error("private customer details and connection string");
    },
    { error: "", saved: false },
    new FormData(),
  );
  expect(result.saved).toBe(false);
  expect(result.error).toContain("Review the current record");
  expect(result.error).not.toContain("private customer");
});
it("preserves authorization redirects", async () => {
  await expect(
    submitAdminAction(
      async () => {
        throw Error("NEXT_REDIRECT");
      },
      { error: "", saved: false },
      new FormData(),
    ),
  ).rejects.toThrow("NEXT_REDIRECT");
});
