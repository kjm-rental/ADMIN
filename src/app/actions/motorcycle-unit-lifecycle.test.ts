import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
import { manageMotorcycleUnit } from "./motorcycle-unit-lifecycle";
import {
  initialUnitLifecycleState,
  unitHistoryMessage,
} from "@/lib/motorcycle-unit-lifecycle";
const modelId = "10000000-0000-4000-8000-000000000001";
const unitId = "10000000-0000-4000-8000-000000000002";
function form(operation = "remove", status = "available") {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    modelId,
    unitId,
    operation,
    expectedStatus: status,
    confirmed: "yes",
  }))
    f.set(key, value);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ supabase: { rpc: m.rpc } });
  m.rpc.mockResolvedValue({ data: { outcome: "removed" }, error: null });
  m.redirect.mockImplementation((url: string) => {
    throw Error(`REDIRECT:${url}`);
  });
});
it("removes only the confirmed unit through the atomic admin RPC and refreshes inventory", async () => {
  await expect(
    manageMotorcycleUnit(initialUnitLifecycleState, form()),
  ).rejects.toThrow(
    `REDIRECT:/dashboard/fleet/${modelId}?unitAction=removed#inventory`,
  );
  expect(m.rpc).toHaveBeenCalledWith("admin_manage_motorcycle_unit", {
    p_model_id: modelId,
    p_unit_id: unitId,
    p_operation: "remove",
    p_expected_status: "available",
  });
  expect(m.refresh).toHaveBeenCalledWith(`/dashboard/fleet/${modelId}`);
  expect(m.refresh).toHaveBeenCalledWith("/dashboard/fleet");
  expect(m.refresh).toHaveBeenCalledWith("/dashboard/calendar");
});
it("does not access inventory without administrator authorization", async () => {
  m.auth.mockRejectedValue(Error("Administrator access required"));
  await expect(
    manageMotorcycleUnit(initialUnitLifecycleState, form()),
  ).rejects.toThrow("Administrator");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("does nothing when confirmation is absent or the operation/ID is invalid", async () => {
  const f = form();
  f.delete("confirmed");
  expect(
    (await manageMotorcycleUnit(initialUnitLifecycleState, f)).outcome,
  ).toBe("error");
  expect(
    (
      await manageMotorcycleUnit(
        initialUnitLifecycleState,
        form("delete-everything"),
      )
    ).outcome,
  ).toBe("error");
  f.set("confirmed", "yes");
  f.set("unitId", "invalid");
  expect(
    (await manageMotorcycleUnit(initialUnitLifecycleState, f)).outcome,
  ).toBe("error");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("preserves history and offers deactivation when removal is refused", async () => {
  m.rpc.mockResolvedValue({ data: { outcome: "history" }, error: null });
  expect(await manageMotorcycleUnit(initialUnitLifecycleState, form())).toEqual(
    { outcome: "history", message: unitHistoryMessage },
  );
  expect(m.refresh).not.toHaveBeenCalled();
  expect(m.redirect).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it.each([
  ["deactivate", "available", "deactivated"],
  ["reactivate", "inactive", "reactivated"],
])(
  "performs explicit %s without changing bookings",
  async (operation, status, outcome) => {
    m.rpc.mockResolvedValue({ data: { outcome }, error: null });
    await expect(
      manageMotorcycleUnit(initialUnitLifecycleState, form(operation, status)),
    ).rejects.toThrow(`unitAction=${outcome}`);
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.rpc.mock.calls[0][1]).toMatchObject({
      p_operation: operation,
      p_expected_status: status,
    });
  },
);
it("blocks deactivation with unresolved reservations without a success notification", async () => {
  m.rpc.mockResolvedValue({ data: { outcome: "blocked" }, error: null });
  const result = await manageMotorcycleUnit(
    initialUnitLifecycleState,
    form("deactivate"),
  );
  expect(result.outcome).toBe("blocked");
  expect(result.message).toContain("Resolve");
  expect(m.refresh).not.toHaveBeenCalled();
  expect(m.redirect).not.toHaveBeenCalled();
});
it.each(["stale", "not_found"])(
  "requires a refresh for %s units",
  async (outcome) => {
    m.rpc.mockResolvedValue({ data: { outcome }, error: null });
    expect(
      (await manageMotorcycleUnit(initialUnitLifecycleState, form())).message,
    ).toContain("Refresh");
    expect(m.redirect).not.toHaveBeenCalled();
  },
);
it.each([
  ["23503", "history", "operational history"],
  ["55P03", "error", "busy"],
  ["40P01", "error", "busy"],
  ["42501", "error", "administrator"],
  ["PGRST202", "error", "SQL"],
  ["XX000", "error", "could not be changed"],
])(
  "handles database error %s without leaking its details",
  async (code, outcome, message) => {
    m.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "secret database details" },
    });
    const result = await manageMotorcycleUnit(
      initialUnitLifecycleState,
      form(),
    );
    expect(result.outcome).toBe(outcome);
    expect(result.message).toContain(message);
    expect(result.message).not.toContain("secret");
    expect(m.redirect).not.toHaveBeenCalled();
  },
);
it("handles interrupted requests and malformed results without claiming success", async () => {
  m.rpc.mockRejectedValueOnce(Error("network"));
  expect(
    (await manageMotorcycleUnit(initialUnitLifecycleState, form())).message,
  ).toContain("interrupted");
  m.rpc.mockResolvedValueOnce({ data: {}, error: null });
  expect(
    (await manageMotorcycleUnit(initialUnitLifecycleState, form())).message,
  ).toContain("could not be verified");
  expect(m.refresh).not.toHaveBeenCalled();
});
