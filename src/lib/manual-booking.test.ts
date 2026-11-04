import { describe, expect, it } from "vitest";
import {
  adjustedRental,
  manualBookingSchema,
  type ManualBookingInput,
} from "./manual-booking";
export function validManualBooking(): ManualBookingInput {
  return {
    requestId: "10000000-0000-4000-8000-000000000001",
    bookingId: null,
    revision: 0,
    customerId: null,
    fullName: "Juan Dela Cruz",
    phone: "0917 123 4567",
    email: "",
    customerType: "philippine_resident",
    source: "whatsapp",
    modelId: "10000000-0000-4000-8000-000000000002",
    unitId: "10000000-0000-4000-8000-000000000003",
    startAt: "2027-01-01T09:00",
    endAt: "2027-01-02T09:00",
    services: { delivery: null, collection: null },
    extras: [],
    adjustment: { kind: "none", value: 0, reason: "" },
    notes: "Customer contacted us through WhatsApp.",
    action: "pending",
    confirmationReason: "",
  };
}
describe("admin reservation validation", () => {
  it("accepts a new phone-only guest without documents or an account", () =>
    expect(manualBookingSchema.parse(validManualBooking()).email).toBe(""));
  it("accepts an existing guest customer", () =>
    expect(
      manualBookingSchema.parse({
        ...validManualBooking(),
        customerId: "10000000-0000-4000-8000-000000000004",
      }).customerId,
    ).toBeTruthy());
  it("accepts confirmation without documents with explicit authorization", () =>
    expect(
      manualBookingSchema.safeParse({
        ...validManualBooking(),
        action: "confirmed",
        confirmationReason:
          "Agreed by telephone; review documents before handover.",
      }).success,
    ).toBe(true));
  it("rejects confirmation without an authorization reason", () =>
    expect(
      manualBookingSchema.safeParse({
        ...validManualBooking(),
        action: "confirmed",
      }).success,
    ).toBe(false));
  it.each(["bad", "fake@", " "])(
    "rejects a malformed nonempty email: %s",
    (email) =>
      expect(
        manualBookingSchema.safeParse({ ...validManualBooking(), email })
          .success,
      ).toBe(false),
  );
  it("enforces 24 hours", () =>
    expect(
      manualBookingSchema.safeParse({
        ...validManualBooking(),
        endAt: "2027-01-02T08:59",
      }).success,
    ).toBe(false));
  it("rejects invalid calendar dates", () =>
    expect(
      manualBookingSchema.safeParse({
        ...validManualBooking(),
        startAt: "2027-02-30T09:00",
      }).success,
    ).toBe(false));
  it("rejects duplicate accessories", () => {
    const id = validManualBooking().modelId;
    expect(
      manualBookingSchema.safeParse({
        ...validManualBooking(),
        extras: [
          { id, quantity: 1 },
          { id, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("permits independent service addresses", () => {
    const id = validManualBooking().modelId;
    const parsed = manualBookingSchema.parse({
      ...validManualBooking(),
      services: {
        delivery: { areaId: id, address: "Hotel One, Cebu" },
        collection: { areaId: id, address: "Hotel Two, Cebu" },
      },
    });
    expect(parsed.services.delivery?.address).not.toBe(
      parsed.services.collection?.address,
    );
  });
});
describe("booking-only adjustments", () => {
  it.each([
    ["none", 0, 3800],
    ["fixed", 300, 3500],
    ["percentage", 10, 3420],
    ["agreed", 3500, 3500],
    ["percentage", 100, 0],
    ["agreed", 4000, 4000],
  ] as const)(
    "%s produces the agreed total without including the deposit",
    (kind, value, final) => {
      const result = adjustedRental(3800, {
        kind,
        value,
        reason: "Agreed through WhatsApp",
      });
      expect(result).toEqual({
        standard: 3800,
        adjustment: final - 3800,
        final,
      });
    },
  );
  it("rounds partial pesos consistently with PostgreSQL", () =>
    expect(
      adjustedRental(105, {
        kind: "percentage",
        value: 10,
        reason: "Approved discount",
      }).final,
    ).toBe(95));
  it("requires adjustment reasons", () =>
    expect(() =>
      adjustedRental(3800, { kind: "fixed", value: 100, reason: "" }),
    ).toThrow());
  it("rejects discounts exceeding the total", () =>
    expect(() =>
      adjustedRental(3800, {
        kind: "fixed",
        value: 4000,
        reason: "Approved discount",
      }),
    ).toThrow());
  it("rejects percentages above 100", () =>
    expect(() =>
      adjustedRental(3800, {
        kind: "percentage",
        value: 101,
        reason: "Approved discount",
      }),
    ).toThrow());
  it("rejects fractional fixed amounts under current whole-peso ledger rules", () =>
    expect(() =>
      adjustedRental(3800, {
        kind: "fixed",
        value: 1.5,
        reason: "Approved discount",
      }),
    ).toThrow());
});
