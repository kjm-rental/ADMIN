import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getFreshAdminSession: mock.session }));
vi.mock("next/cache", () => ({ revalidatePath: mock.refresh }));
import {
  saveSecurityDepositSettings,
  recordSecurityDepositEvent,
  recordRentalInspection,
} from "./security-deposits";
const booking = "10000000-0000-4000-8000-000000000001",
  key = "10000000-0000-4000-8000-000000000002";
function form(values: Record<string, string>) {
  const f = new FormData();
  Object.entries(values).forEach(([k, v]) => f.set(k, v));
  return f;
}
function event() {
  return form({
    bookingId: booking,
    eventType: "cash_collected",
    amountPhp: "123.45",
    occurredAt: "2026-10-02T00:01",
    notes: "Synthetic cash",
    idempotencyKey: key,
    verified: "on",
  });
}
function inspection() {
  return form({
    bookingId: booking,
    kind: "handover",
    occurredAt: "2026-10-02T00:01",
    odometerKm: "100",
    fuelPercent: "75",
    conditionNotes: "Synthetic checked",
    accessoriesNotes: "Synthetic helmet",
    existingDamageNotes: "",
    newDamageNotes: "",
    accessoriesChecked: "on",
    identityChecked: "on",
    idempotencyKey: key,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.session.mockResolvedValue({ supabase: { rpc: mock.rpc } });
  mock.rpc.mockResolvedValue({ error: null });
});
describe("active-admin rental operations contracts", () => {
  it.each([
    [saveSecurityDepositSettings, () => new FormData()],
    [recordSecurityDepositEvent, event],
    [recordRentalInspection, inspection],
  ] as const)("requires fresh authorization", async (action, make) => {
    mock.session.mockResolvedValue(null);
    await expect(action(make())).rejects.toThrow("Active administrator");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("never assumes management or legal approval", async () => {
    await saveSecurityDepositSettings(
      form({
        cashAmountPhp: "123.45",
        acceptedDocumentTypes: "Synthetic card\nSynthetic card",
      }),
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      "admin_save_security_deposit_settings",
      {
        p_settings: expect.objectContaining({
          cash_amount_centavos: 12345,
          cash_policy_approved: false,
          id_legal_approved: false,
          id_enabled: false,
          accepted_document_types: ["Synthetic card"],
        }),
      },
    );
  });
  it.each(["1.234", "-1", "1e3", "21474836.48"])(
    "rejects invalid PHP %s",
    async (value) => {
      const f = event();
      f.set("amountPhp", value);
      await expect(recordSecurityDepositEvent(f)).rejects.toThrow();
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it("requires physical verification", async () => {
    const f = event();
    f.delete("verified");
    await expect(recordSecurityDepositEvent(f)).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("preserves centavos, idempotency and Manila midnight", async () => {
    await recordSecurityDepositEvent(event());
    expect(mock.rpc).toHaveBeenCalledWith(
      "admin_record_security_deposit_event",
      expect.objectContaining({
        p_amount_centavos: 12345,
        p_occurred_at: "2026-10-01T16:01:00.000Z",
        p_idempotency_key: key,
        p_verified: true,
      }),
    );
  });
  it("requires handover identity recheck", async () => {
    const f = inspection();
    f.delete("identityChecked");
    await expect(recordRentalInspection(f)).rejects.toThrow(
      "Confirm customer identity",
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("submits actual inspection and accessories without inferred damage", async () => {
    await recordRentalInspection(inspection());
    expect(mock.rpc).toHaveBeenCalledWith(
      "admin_record_rental_inspection",
      expect.objectContaining({
        p_details: expect.objectContaining({
          occurred_at: "2026-10-01T16:01:00.000Z",
          identity_checked: true,
          accessories_checked: true,
          new_damage_notes: "",
        }),
      }),
    );
  });
  it("reports query failures without success feedback", async () => {
    mock.rpc.mockResolvedValue({
      error: { message: "Synthetic database failure" },
    });
    await expect(recordSecurityDepositEvent(event())).rejects.toThrow(
      "Synthetic database failure",
    );
    expect(mock.refresh).not.toHaveBeenCalled();
  });
});
