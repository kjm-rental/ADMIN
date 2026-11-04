import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { InspectionContext } from "@/services/inspection-context";
import type { RentalInspection } from "@/types/rental";
vi.mock("@/app/actions/compact-inspection", () => ({
  recordCompactInspection: vi.fn(),
}));
vi.mock("./action-form", () => ({
  ActionForm: ({ children }: { children: React.ReactNode }) => (
    <form>{children}</form>
  ),
}));
vi.mock("./submit-button", () => ({
  SubmitButton: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled: boolean;
  }) => <button disabled={disabled}>{children}</button>,
}));
import { CompactInspectionForm } from "./compact-inspection-form";
const context: InspectionContext = {
  model: "Honda Click",
  customer: "Customer",
  reference: "KJM-SYNTHETIC",
  unit: "Unit 1",
  pickup: "2026-10-27T00:00:00Z",
  latestOdometer: 100,
  includedAccessories: ["Helmet 1"],
  checks: [
    {
      label: "Rental Paid",
      ready: false,
      href: "/dashboard/bookings/synthetic#rental-operations",
    },
  ],
};
it("shows booking context and a reference without assuming the actual odometer", () => {
  const html = renderToStaticMarkup(
    <CompactInspectionForm
      bookingId="synthetic"
      kind="handover"
      idempotencyKey="key"
      context={context}
    />,
  );
  for (const text of [
    "Honda Click",
    "Customer",
    "KJM-SYNTHETIC",
    "Unit 1",
    "Last recorded: 100 km",
    "Current Odometer",
    "Additional Details",
    "Confirm Motorcycle Handed Over",
  ])
    expect(html).toContain(text);
  expect(html).toContain('name="odometerKm"');
  expect(html).not.toContain('value="100"');
  expect(html).toContain("Resolve:");
  expect(html).toContain('disabled=""');
});
it("offers five fuel presets and all eight accessory choices", () => {
  const html = renderToStaticMarkup(
    <CompactInspectionForm
      bookingId="synthetic"
      kind="handover"
      idempotencyKey="key"
      context={context}
    />,
  );
  for (const label of [
    "FULL",
    "¾",
    "½",
    "¼",
    "EMPTY",
    "Motorcycle key",
    "Helmet 1",
    "Helmet 2",
    "Raincoat 1",
    "Raincoat 2",
    "Phone holder",
    "Top box",
    "Motorcycle documents",
  ])
    expect(html).toContain(label);
  expect(html).toContain('checked=""');
});
it("shows pickup inspection reference on return and keeps cash separate", () => {
  const pickup = {
    odometer_km: 100,
    fuel_percent: 75,
    occurred_at: "2026-10-27T00:00:00Z",
    condition_notes: "Existing scratch",
    accessories_notes: "Helmet 1",
  } as RentalInspection;
  const html = renderToStaticMarkup(
    <CompactInspectionForm
      bookingId="synthetic"
      kind="return"
      idempotencyKey="key"
      context={context}
      pickup={pickup}
    />,
  );
  for (const label of [
    "Pickup inspection reference",
    "Existing scratch",
    "Helmet 1",
    "75%",
    "Return Odometer",
    "Accessories returned",
    "Confirm Motorcycle Returned",
  ])
    expect(html).toContain(label);
  expect(html).not.toContain("Confirm Cash Returned");
  expect(html).not.toContain("Confirm Deposit Collected");
});
