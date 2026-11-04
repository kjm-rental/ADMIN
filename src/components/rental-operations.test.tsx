import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { getSecurityDepositView } from "@/services/security-deposits";
vi.mock("@/app/actions/rental-operations", () => ({
  confirmRentalOperation: vi.fn(),
}));
vi.mock("./action-form", () => ({
  ActionForm: ({ children }: { children: React.ReactNode }) => (
    <form>{children}</form>
  ),
}));
vi.mock("./booking-action-dialog", () => ({
  BookingActionDialog: ({
    label,
    title,
    children,
    disabled,
  }: {
    label: string;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <section>
      <button disabled={disabled}>{label}</button>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  CancelBookingAction: () => <button>Cancel</button>,
}));
vi.mock("./booking-deposit-panel", () => ({
  BookingDepositPanel: () => <p>Existing inspection workflow</p>,
}));
vi.mock("./submit-button", () => ({
  SubmitButton: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));
import { RentalOperations } from "./rental-operations";
type Data = Awaited<ReturnType<typeof getSecurityDepositView>>;
function data(events: Array<[string, number]> = [], returned = false): Data {
  return {
    available: true,
    requirements: [
      {
        booking_id: "booking",
        option: "cash",
        required_centavos: 250000,
        is_test: false,
      },
    ],
    events: events.map(([event_type, amount_centavos], index) => ({
      id: String(index),
      sequence: index,
      booking_id: "booking",
      event_type,
      amount_centavos,
      is_test: false,
      notes: "Approved fuel charge",
    })),
    inspections: returned ? [{ kind: "return" }] : [],
  } as unknown as Data;
}
function view(status: string, source: Data, balance = 119800) {
  return renderToStaticMarkup(
    <RentalOperations
      bookingId="booking"
      status={status}
      version={9}
      balanceCentavos={balance}
      data={source}
    />,
  );
}
it("shows correct full cash payment and collection amounts without editable fields", () => {
  const html = view("confirmed", data());
  expect(html).toContain("₱1,198.00");
  expect(html).toContain("₱2,500.00");
  expect(html).toContain("Confirm Payment Received");
  expect(html).toContain("Confirm Deposit Collected");
  expect(html).not.toContain('type="number"');
  expect(html).not.toContain("Confirm Cash Returned");
});
it("disables a paid rental and hides duplicate deposit collection", () => {
  const html = view("active", data([["cash_collected", 250000]]), 0);
  expect(html).toContain('disabled=""');
  expect(html).toContain("✓ Rental Paid");
  expect(html).not.toContain("Confirm Deposit Collected");
  expect(html).toContain("Mark Motorcycle as Returned");
  expect(html).toContain("Existing inspection workflow");
  expect(html).not.toContain("Confirm Cash Returned");
});
it("does not refund automatically on motorcycle return", () => {
  const html = view("active", data([["cash_collected", 250000]], true), 0);
  expect(html).toContain("✓ Returned");
  expect(html).toContain("Have you returned");
  expect(html).toContain("Confirm Cash Returned");
  expect(html).not.toContain("✓ Deposit Returned");
});
it("shows the remaining cash refund after an approved deduction", () => {
  const html = view(
    "active",
    data(
      [
        ["cash_collected", 250000],
        ["cash_deducted", 50000],
      ],
      true,
    ),
    0,
  );
  expect(html).toContain('value="200000"');
  expect(html).toContain("Approved fuel charge");
  expect(html).toContain("Approved deductions");
  expect(html).toContain("₱500.00");
});
it("hides duplicate refunds after all liability is settled", () => {
  const html = view(
    "completed",
    data(
      [
        ["cash_collected", 250000],
        ["cash_deducted", 50000],
        ["cash_returned", 200000],
      ],
      true,
    ),
    0,
  );
  expect(html).toContain("✓ Deposit Returned — ₱2,000.00");
  expect(html).not.toContain("Confirm Cash Returned");
});
it("does not mutate historical financial data while rendering", () => {
  const source = data([["cash_collected", 250000]], true);
  const before = JSON.stringify(source);
  view("active", source);
  expect(JSON.stringify(source)).toBe(before);
});
