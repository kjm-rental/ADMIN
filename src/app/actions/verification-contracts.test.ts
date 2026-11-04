import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  getFreshAdminSession: mocks.requireAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import {
  confirmBooking,
  recordOfflinePayment,
  recordPaymentAdjustment,
  rescheduleBooking,
  reviewVerification,
  transitionBooking,
} from "./bookings";
import {
  saveInventoryQuantity,
  archiveModel,
  deleteMedia,
  moveMedia,
  saveModel,
  setModelPublication,
  setPrimaryMedia,
  uploadMedia,
} from "./fleet";
import { saveExtra } from "./extras";
import { saveBookingSettings, setBookingTesterAuthorization } from "./settings";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const payment = () =>
  form({
    bookingId: id,
    amountPhp: "125.25",
    method: "cash",
    transactionReference: "Synthetic contract test",
    paidAt: "2031-06-01T12:00:00+08:00",
    notes: "Synthetic",
    idempotencyKey: other,
  });
const adjustment = () =>
  form({
    bookingId: id,
    originalPaymentEventId: other,
    operation: "refund",
    amountPhp: "25.25",
    method: "cash",
    transactionReference: "Synthetic refund",
    occurredAt: "2031-06-01T12:00:00+08:00",
    reason: "Synthetic verified refund",
    idempotencyKey: id,
  });
const model = () =>
  form(
    Object.fromEntries(
      [
        "generation",
        "modelYear",
        "engineCc",
        "category",
        "transmission",
        "exactModelName",
        "fuelTankCapacity",
        "coolingSystem",
        "startingSystem",
        "brakingSystem",
        "specificationSourceUrl",
        "weeklyRate",
        "monthlyRate",
        "description",
        "features",
      ]
        .map((k) => [k, ""])
        .concat([
          ["brand", "Synthetic"],
          ["modelName", "Synthetic"],
          ["displayName", "Synthetic"],
          ["specificationStatus", "pending"],
          ["specificationNote", "Synthetic test model"],
          ["dailyRate", "499"],
        ]),
    ),
  );
const extra = () =>
  form({
    name: "Synthetic",
    description: "",
    pricePhp: "100",
    displayOrder: "0",
    pricingModel: "per_rental",
    totalQuantity: "2",
    maxPerBooking: "1",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    user: { id },
    supabase: { rpc: mocks.rpc, from: mocks.from },
  });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
describe("existing server action contracts — mocked boundary, no database writes", () => {
  it("maps confirmed unit and booking IDs without accepting client prices", async () => {
    const f = form({ bookingId: id, unitId: other, price: "1" });
    await expect(confirmBooking(f)).rejects.toThrow(
      `REDIRECT:/dashboard/bookings/${id}?updated=1`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("admin_confirm_booking", {
      p_booking_id: id,
      p_unit_id: other,
    });
  });
  it("rejects malformed IDs before an RPC", async () => {
    await expect(
      confirmBooking(form({ bookingId: "bad", unitId: other })),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("maps payment centavos, verified method and the original idempotency key", async () => {
    await expect(recordOfflinePayment(payment())).rejects.toThrow("?payment=1");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_record_offline_payment", {
      p_booking_id: id,
      p_amount_centavos: 12525,
      p_method: "cash",
      p_transaction_reference: "Synthetic contract test",
      p_paid_at: "2031-06-01T04:00:00.000Z",
      p_notes: "Synthetic",
      p_idempotency_key: other,
    });
  });
  it.each(["0", "-1", "1.001"])(
    "rejects invalid payment amount %s",
    async (amount) => {
      const f = payment();
      f.set("amountPhp", amount);
      await expect(recordOfflinePayment(f)).rejects.toThrow();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects non-cash rental receipts", async () => {
    const f = payment();
    f.set("method", "bank_transfer");
    f.delete("transactionReference");
    await expect(recordOfflinePayment(f)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes refunds to the immutable-event RPC", async () => {
    await expect(recordPaymentAdjustment(adjustment())).rejects.toThrow(
      "?payment=1",
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_record_payment_adjustment",
      expect.objectContaining({
        p_original_payment_event_id: other,
        p_operation: "refund",
        p_amount_centavos: 2525,
        p_idempotency_key: id,
      }),
    );
  });
  it("rejects adjustment without a meaningful reason", async () => {
    const f = adjustment();
    f.set("reason", "x");
    await expect(recordPaymentAdjustment(f)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not report success when a financial RPC fails", async () => {
    mocks.rpc.mockResolvedValue({
      error: { message: "Synthetic RPC rejection" },
    });
    await expect(recordOfflinePayment(payment())).rejects.toThrow(
      "Synthetic RPC rejection",
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("sends manual verification choice and reason without approving other document types", async () => {
    await expect(
      reviewVerification(
        form({
          bookingId: id,
          verificationId: other,
          reviewType: "license",
          result: "resubmission_required",
          reason: "Synthetic reason",
        }),
      ),
    ).rejects.toThrow("?reviewed=1");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_review_verification", {
      p_verification_id: other,
      p_review_type: "license",
      p_result: "resubmission_required",
      p_reason: "Synthetic reason",
    });
  });
  it("rejects verification rejection without a reason", async () => {
    await expect(
      reviewVerification(
        form({
          bookingId: id,
          verificationId: other,
          reviewType: "identity",
          result: "rejected",
        }),
      ),
    ).rejects.toThrow("reason is required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["active", "completed", "cancelled", "rejected"])(
    "delegates %s transition rules to the existing RPC",
    async (status) => {
      await expect(
        transitionBooking(
          form({ bookingId: id, status, reason: "Synthetic status test" }),
        ),
      ).rejects.toThrow("?updated=1");
      expect(mocks.rpc).toHaveBeenCalledWith(
        "admin_transition_booking_with_reason",
        {
          p_booking_id: id,
          p_new_status: status,
          p_reason: "Synthetic status test",
        },
      );
    },
  );
  it("interprets rescheduling inputs explicitly in Manila time", async () => {
    await expect(
      rescheduleBooking(
        form({
          bookingId: id,
          startAt: "2031-06-01T12:00",
          endAt: "2031-06-02T12:00",
          unitId: "",
        }),
      ),
    ).rejects.toThrow("?updated=1");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_reschedule_booking", {
      p_booking_id: id,
      p_start_at: "2031-06-01T04:00:00.000Z",
      p_end_at: "2031-06-02T04:00:00.000Z",
      p_unit_id: null,
    });
  });
  it("preserves expectedTotal concurrency protection for quantity saves", async () => {
    await expect(
      saveInventoryQuantity(
        { error: "", saved: false },
        form({ modelId: id, total: "5", expectedTotal: "2" }),
      ),
    ).resolves.toEqual({ error: "", saved: true });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_motorcycle_quantity", {
      p_model_id: id,
      p_total: 5,
      p_expected_total: 2,
    });
  });
  it.each(["-1", "1.5", "1001"])(
    "rejects quantity %s before database access",
    async (total) => {
      expect(
        (
          await saveInventoryQuantity(
            { error: "", saved: false },
            form({ modelId: id, total, expectedTotal: "2" }),
          )
        ).saved,
      ).toBe(false);
      expect(mocks.requireAdmin).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("returns quantity errors without a false success", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Inventory changed" } });
    await expect(
      saveInventoryQuantity(
        { error: "", saved: false },
        form({ modelId: id, total: "5", expectedTotal: "2" }),
      ),
    ).resolves.toEqual({ error: "Inventory changed", saved: false });
  });
  it("requires authorization expiry and maps revocation submitter value", async () => {
    await expect(
      setBookingTesterAuthorization(
        form({ authUserId: id, expiresAt: "", authorized: "true" }),
      ),
    ).rejects.toThrow("bookingError=tester");
    expect(mocks.rpc).not.toHaveBeenCalled();
    await expect(
      setBookingTesterAuthorization(
        form({ authUserId: id, expiresAt: "", authorized: "false" }),
      ),
    ).rejects.toThrow("tester=1");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_booking_tester", {
      p_auth_user_id: id,
      p_expires_at: null,
      p_authorized: false,
    });
  });
  it("refuses incomplete policies before enabling public booking", async () => {
    await expect(
      saveBookingSettings(form({ publicBookingEnabled: "on" })),
    ).rejects.toThrow("bookingError=invalid");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  const protectedCases: [string, () => Promise<unknown>][] = [
    ["confirm", () => confirmBooking(form({ bookingId: id, unitId: other }))],
    ["payment", () => recordOfflinePayment(payment())],
    ["adjustment", () => recordPaymentAdjustment(adjustment())],
    [
      "verification",
      () =>
        reviewVerification(
          form({
            bookingId: id,
            verificationId: other,
            reviewType: "identity",
            result: "approved",
          }),
        ),
    ],
    [
      "transition",
      () => transitionBooking(form({ bookingId: id, status: "active" })),
    ],
    [
      "reschedule",
      () =>
        rescheduleBooking(
          form({
            bookingId: id,
            startAt: "2031-06-01T12:00",
            endAt: "2031-06-02T12:00",
          }),
        ),
    ],
    [
      "quantity",
      () =>
        saveInventoryQuantity(
          { error: "", saved: false },
          form({ modelId: id, total: "5", expectedTotal: "2" }),
        ),
    ],
    ["save model", () => saveModel(model())],
    ["archive", () => archiveModel(form({ id }))],
    ["publication", () => setModelPublication(form({ id, publish: "true" }))],
    [
      "upload",
      () => uploadMedia(form({ modelId: id, alt: "Synthetic image" })),
    ],
    ["primary image", () => setPrimaryMedia(form({ id, modelId: other }))],
    ["delete image", () => deleteMedia(form({ id, modelId: other }))],
    [
      "reorder image",
      () => moveMedia(form({ id, modelId: other, direction: "up" })),
    ],
    ["extra", () => saveExtra(extra())],
    ["settings", () => saveBookingSettings(form({}))],
    [
      "tester",
      () =>
        setBookingTesterAuthorization(
          form({ authUserId: id, expiresAt: "", authorized: "false" }),
        ),
    ],
  ];
  it.each(protectedCases)(
    "denied authorization prevents %s database work",
    async (_name, call) => {
      mocks.requireAdmin.mockRejectedValue(
        new Error("Synthetic authorization denial"),
      );
      await expect(call()).rejects.toThrow("Synthetic authorization denial");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );
});

// In-memory PostgREST boundary for fleet/extras parameter and failure checks.
function captureTables(
  options: {
    failure?: string;
    failureTable?: string;
    rows?: Record<string, unknown>[];
  } = {},
) {
  const calls: { table: string; method: string; value?: unknown }[] = [];
  mocks.from.mockImplementation((table: string) => {
    const result = {
      data: options.rows ?? null,
      error:
        options.failure &&
        (!options.failureTable || options.failureTable === table)
          ? { message: options.failure }
          : null,
      count: 0,
    };
    const query = {
      insert(value: unknown) {
        calls.push({ table, method: "insert", value });
        return query;
      },
      update(value: unknown) {
        calls.push({ table, method: "update", value });
        return query;
      },
      delete() {
        calls.push({ table, method: "delete" });
        return query;
      },
      select() {
        return query;
      },
      eq() {
        return query;
      },
      is() {
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id }, error: null }),
      then(resolve: (r: typeof result) => unknown) {
        return Promise.resolve(result).then(resolve);
      },
    };
    return query;
  });
  return calls;
}
describe("fleet and extras form contracts — in-memory database only", () => {
  it("maps model identity, rates and empty specification fields without inventing values", async () => {
    const calls = captureTables();
    const f = model();
    f.set("id", id);
    await expect(saveModel(f)).rejects.toThrow(
      `REDIRECT:/dashboard/fleet/${id}?saved=1`,
    );
    expect(
      calls.find(
        (c) => c.table === "motorcycle_models" && c.method === "update",
      )?.value,
    ).toMatchObject({
      brand: "Synthetic",
      model_name: "Synthetic",
      display_name: "Synthetic",
      daily_rate_php: 499,
      generation: null,
      engine_cc: null,
      fuel_tank_capacity_liters: null,
      is_published: false,
      notable_features: [],
    });
    expect(
      calls.some((c) => c.table === "audit_logs" && c.method === "insert"),
    ).toBe(true);
  });
  it("does not redirect success when model saving fails", async () => {
    captureTables({ failure: "Synthetic model rejection" });
    const f = model();
    f.set("id", id);
    await expect(saveModel(f)).rejects.toThrow("Synthetic model rejection");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("publication changes only the publication flag", async () => {
    const calls = captureTables();
    await setModelPublication(form({ id, publish: "true" }));
    expect(
      calls.find(
        (c) => c.table === "motorcycle_models" && c.method === "update",
      )?.value,
    ).toEqual({ is_published: true });
  });
  it("archiving preserves records rather than deleting them", async () => {
    const calls = captureTables();
    await expect(archiveModel(form({ id }))).rejects.toThrow(
      "REDIRECT:/dashboard/fleet",
    );
    expect(
      calls.find(
        (c) => c.table === "motorcycle_models" && c.method === "update",
      )?.value,
    ).toMatchObject({ is_published: false, archived_at: expect.any(String) });
    expect(calls.filter((c) => c.method === "delete")).toHaveLength(0);
  });
  it("primary selection clears prior model primary then sets the selected image", async () => {
    const calls = captureTables();
    await setPrimaryMedia(form({ id, modelId: other }));
    expect(
      calls
        .filter((c) => c.table === "motorcycle_media" && c.method === "update")
        .map((c) => c.value),
    ).toEqual([{ is_primary: false }, { is_primary: true }]);
  });
  it("reordering swaps adjacent image sort positions", async () => {
    const calls = captureTables({
      rows: [
        { id, sort_order: 0 },
        { id: other, sort_order: 1 },
      ],
    });
    await moveMedia(form({ id, modelId: id, direction: "down" }));
    expect(
      calls
        .filter((c) => c.table === "motorcycle_media" && c.method === "update")
        .map((c) => c.value),
    ).toEqual([{ sort_order: 1 }, { sort_order: 0 }]);
  });
  it("rejects unsupported uploaded file type before storage operations", async () => {
    const f = form({ modelId: id, alt: "Synthetic image" });
    f.set(
      "files",
      new File(["synthetic"], "synthetic.txt", { type: "text/plain" }),
    );
    await expect(uploadMedia(f)).rejects.toThrow("no larger than 8 MB");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("maps extra pricing mode and inventory limits to catalog fields", async () => {
    const calls = captureTables();
    const f = extra();
    f.set("id", id);
    f.set("available", "on");
    f.set("pricingModel", "per_day");
    await expect(saveExtra(f)).rejects.toThrow(
      "REDIRECT:/dashboard/extras?saved=1",
    );
    expect(
      calls.find(
        (c) => c.table === "booking_extras_catalog" && c.method === "update",
      )?.value,
    ).toMatchObject({
      price_php: 100,
      pricing_model: "per_day",
      total_quantity: 2,
      max_per_booking: 1,
      is_available: true,
      is_active: true,
    });
  });
  it("rejects extra customer limit above available inventory", async () => {
    const f = extra();
    f.set("maxPerBooking", "3");
    await expect(saveExtra(f)).rejects.toThrow(
      "cannot exceed available quantity",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("Phase 8 correction action regressions", () => {
  it.each(["2031-06-01T00:01", "2031-06-01T23:59"])(
    "passes the correct Manila instant for payment and adjustment %s",
    async (local) => {
      const expected = local.endsWith("00:01")
        ? "2031-05-31T16:01:00.000Z"
        : "2031-06-01T15:59:00.000Z";
      const f = payment();
      f.set("paidAt", local);
      await expect(recordOfflinePayment(f)).rejects.toThrow("payment=1");
      expect(mocks.rpc.mock.calls.at(-1)?.[1].p_paid_at).toBe(expected);
      const a = adjustment();
      a.set("occurredAt", local);
      await expect(recordPaymentAdjustment(a)).rejects.toThrow("payment=1");
      expect(mocks.rpc.mock.calls.at(-1)?.[1].p_occurred_at).toBe(expected);
    },
  );
  it("rejects date-only payment input without a financial RPC", async () => {
    const f = payment();
    f.set("paidAt", "2031-06-01");
    await expect(recordOfflinePayment(f)).rejects.toThrow("date alone");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stops primary image selection when clearing existing primary images fails", async () => {
    const calls = captureTables({ failure: "Synthetic image update failure" });
    await expect(setPrimaryMedia(form({ id, modelId: other }))).rejects.toThrow(
      "Synthetic image update failure",
    );
    expect(calls.filter((c) => c.method === "update")).toHaveLength(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not redirect success when an extras audit insert fails", async () => {
    captureTables({
      failure: "Synthetic audit failure",
      failureTable: "audit_logs",
    });
    await expect(saveExtra(extra())).rejects.toThrow("Synthetic audit failure");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("manual identity approval safeguards", () => {
  it("rejects approval without every manual evidence confirmation", async () => {
    await expect(
      reviewVerification(
        form({
          bookingId: id,
          verificationId: other,
          reviewType: "identity",
          result: "approved",
        }),
      ),
    ).rejects.toThrow("Confirm every");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records an explicit authorized identity review without approving other components", async () => {
    const f = form({
      bookingId: id,
      verificationId: other,
      reviewType: "identity",
      result: "approved",
      reason: "Original document authenticity and ownership checked",
    });
    for (const value of ["0", "1", "2", "3"]) f.append("reviewEvidence", value);
    await expect(reviewVerification(f)).rejects.toThrow(
      `REDIRECT:/dashboard/verifications/${other}?reviewed=1`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_review_verification",
      expect.objectContaining({
        p_review_type: "identity",
        p_result: "approved",
      }),
    );
  });
  it("does not send decisions if authorization fails", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      reviewVerification(
        form({
          bookingId: id,
          verificationId: other,
          reviewType: "license",
          result: "resubmission_required",
          reason: "Clearer photo needed",
        }),
      ),
    ).rejects.toThrow("Unauthorized");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
