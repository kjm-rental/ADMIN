vi.mock("@/components/booking-payment-review", () => ({
  BookingPaymentReview: () => null,
}));
vi.mock("@/components/manual-booking-management", () => ({
  ManualBookingManagement: () => null,
}));
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/security-deposits", () => ({
  getSecurityDepositView: vi.fn().mockResolvedValue({
    available: true,
    requirements: [],
    events: [],
    inspections: [],
  }),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    React.createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("@/components/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) =>
    React.createElement("form", null, children),
}));
vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ children }: { children: ReactNode }) =>
    React.createElement("button", null, children),
}));
vi.mock("@/components/confirm-button", () => ({
  ConfirmButton: ({ children }: { children: ReactNode }) =>
    React.createElement("button", null, children),
}));
vi.mock("@/components/booking-deposit-panel", () => ({
  BookingDepositPanel: ({ section }: { section: string }) =>
    React.createElement("div", null, `Deposit section: ${section}`),
}));
vi.mock("@/app/actions/bookings", () => ({
  recordPickupInstructions: vi.fn(),
  confirmBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  transitionBooking: vi.fn(),
  recordOfflinePayment: vi.fn(),
  recordPaymentAdjustment: vi.fn(),
}));
import BookingPage from "./page";
const booking = {
  id: "booking-1",
  booking_reference: "KJM-SAMPLE",
  customer_id: "customer-1",
  motorcycle_model_id: "model-1",
  motorcycle_unit_id: "unit-1",
  status: "confirmed",
  start_at: "2026-10-12T02:00:00Z",
  end_at: "2026-10-14T07:00:00Z",
  total_centavos: 100000,
  quoted_total_php: 1000,
  base_total_php: 1000,
  extras_total_php: 0,
  rental_workflow_version: 9,
};
let queried: string[];
let tables: Record<string, Record<string, unknown>[]>;
beforeEach(() => {
  queried = [];
  vi.stubGlobal("React", React);
  tables = {
    bookings: [{ ...booking }],
    customers: [{ id: "customer-1", full_name: "Sample Customer" }],
    motorcycle_models: [{ id: "model-1", display_name: "Honda Click" }],
    customer_verifications: [
      {
        id: "verification-1",
        booking_id: "booking-1",
        overall_status: "approved",
      },
    ],
    motorcycle_units: [
      {
        id: "unit-1",
        motorcycle_model_id: "model-1",
        internal_unit_code: "CLICK-01",
        status: "available",
      },
    ],
    verification_reviews: [
      {
        id: "review-1",
        verification_id: "verification-1",
        review_type: "identity",
        result: "approved",
        reason: "Sample manual review",
        created_at: "2026-10-12T00:00:00Z",
      },
    ],
  };
  mocks.requireAdmin.mockResolvedValue({
    supabase: {
      from(table: string) {
        queried.push(table);
        let rows = tables[table] ?? [];
        let single = false;
        const q = {
          select: () => q,
          eq: (key: string, value: string) => {
            rows = rows.filter((row) => row[key] === value);
            return q;
          },
          neq: (key: string, value: string) => {
            rows = rows.filter((row) => row[key] !== value);
            return q;
          },
          in: () => q,
          lt: () => q,
          gt: () => q,
          is: () => q,
          order: () => q,
          single: () => {
            single = true;
            return q;
          },
          maybeSingle: () => {
            single = true;
            return q;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data: single ? (rows[0] ?? null) : rows,
              error: null,
            }).then(resolve),
        };
        return q;
      },
    },
  });
});
const render = async (
  tab?: string,
  flags: { payment?: string; updated?: string } = {},
) =>
  renderToStaticMarkup(
    await BookingPage({
      params: Promise.resolve({ id: "booking-1" }),
      searchParams: Promise.resolve({ tab, ...flags }),
    }),
  );
it("shows customer, rental, payment, verification and quick actions together without tabs", async () => {
  const html = await render();
  expect(html).not.toContain("?tab=");
  for (const text of [
    "Sample Customer",
    "Honda Click",
    "Rental readiness",
    "Balance due",
    "Amount paid",
    "Next step",
    "Manage booking",
    "Cash required at pickup",
  ])
    expect(html).toContain(text);
  expect(html).toContain("/dashboard/verifications/verification-1");
  expect(html).not.toContain("/dashboard/documents/");
});
it("preserves cash payment and adjustment forms inside focused dialogs with idempotency", async () => {
  const html = await render("payments");
  expect(html).toContain('name="amountPhp"');
  expect(html).toContain('name="idempotencyKey"');
  expect(html).toContain("<dialog");
  expect(html).toContain("Record payment");
});
it("keeps rescheduling available and guarded workflow components accessible", async () => {
  const html = await render("rental");
  expect(html).toContain('name="startAt"');
  expect(html).toContain('name="endAt"');
  expect(html).not.toContain("Record handover");
  expect(html).toContain("Reschedule booking");
});
it("keeps actual verification history in a collapsed section", async () => {
  const html = await render("history");
  expect(html).toContain("Sample manual review");
  expect(html).toContain("Deposit section: history");
  expect(html).toContain("<details>");
  expect(queried).toContain("verification_reviews");
});
it("preserves the same workspace after legacy action redirects", async () => {
  expect(await render(undefined, { payment: "1" })).toContain(
    "Booking record updated successfully",
  );
  expect(await render(undefined, { updated: "1" })).toContain(
    "Reschedule booking",
  );
  expect(await render("invalid")).toContain("Rental readiness");
});

it("calculates rental payments after refunds separately from deposits", async () => {
  tables.payment_events = [
    {
      id: "pay-1",
      booking_id: "booking-1",
      event_type: "payment",
      amount_centavos: 30000,
      method: "cash",
      occurred_at: "2026-10-12T02:00:00Z",
    },
    {
      id: "refund-1",
      booking_id: "booking-1",
      event_type: "refund",
      amount_centavos: 10000,
      method: "cash",
      occurred_at: "2026-10-12T03:00:00Z",
    },
  ];
  const html = await render();
  expect(html).toContain("₱200.00");
  expect(html).toContain("₱800.00");
  expect(html).toContain("Partially refunded");
  expect(html).toContain("Advanced: refund or correct rental payment");
});
it("excludes a motorcycle assigned to a conflicting booking", async () => {
  tables.bookings[0].status = "pending";
  tables.bookings.push({
    ...booking,
    id: "other-booking",
    motorcycle_unit_id: "unit-1",
  });
  const html = await render();
  expect(html).not.toContain('<option value="unit-1">');
  expect(html).toContain("No eligible unit is currently available");
});
it("excludes a motorcycle reserved by another active hold", async () => {
  tables.bookings[0].status = "pending";
  tables.booking_inventory_holds = [
    { id: "hold-1", booking_id: "other-booking", motorcycle_unit_id: "unit-1" },
  ];
  expect(await render()).not.toContain('<option value="unit-1">');
});
it("excludes motorcycles with maintenance blocks", async () => {
  tables.bookings[0].status = "pending";
  tables.motorcycle_unavailability = [{ motorcycle_unit_id: "unit-1" }];
  expect(await render()).not.toContain('<option value="unit-1">');
});
it("hides cancellation and handover actions for cancelled bookings", async () => {
  tables.bookings[0].status = "cancelled";
  const html = await render();
  expect(html).not.toContain("Confirm cancel booking");
  expect(html).not.toContain("Start handover");
  expect(html).not.toContain("Record payment");
});

it("offers a genuinely available unit for pending confirmation", async () => {
  tables.bookings[0].status = "pending";
  expect(await render()).toContain('<option value="unit-1">');
});
