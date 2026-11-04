import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ManualBookingSummary } from "./manual-booking-summary";
import type { ManualQuote } from "@/lib/manual-booking";
const props = {
  model: "Honda ADV",
  customer: "Customer",
  color: "Red",
  plate: "TEST",
  startAt: "2030-01-01T09:00",
  endAt: "2030-01-08T09:00",
  error: "",
};
const quote: ManualQuote = {
  base: 6300,
  extras: 100,
  services: 300,
  standard: 6700,
  adjustment: -100,
  final: 6600,
  deposit: 2500,
  pricing: null,
  delivery: { deliveryFeeCentavos: 10000, collectionFeeCentavos: 20000 },
  units: [],
  token: "quote",
  policyVersion: "policy",
};
it("shows final rental, every price component, separate deposit and combined total", () => {
  const html = renderToStaticMarkup(
    <ManualBookingSummary {...props} quote={quote} />,
  );
  for (const label of [
    "Final rental amount",
    "₱6,600.00",
    "₱2,500.00",
    "₱9,100.00",
    "Accessories",
    "Delivery",
    "Collection",
    "Discount / adjustment",
    "Price calculation",
    "No payment is collected",
  ])
    expect(html).toContain(label);
});
it("shows selected color, plate, pickup/return dates and duration", () => {
  const html = renderToStaticMarkup(
    <ManualBookingSummary {...props} quote={quote} />,
  );
  for (const text of ["Red · TEST", "Pickup", "Return", "7 days", "Customer"])
    expect(html).toContain(text);
});
it("keeps price headings visible while loading without inventing a price", () => {
  const html = renderToStaticMarkup(
    <ManualBookingSummary {...props} quote={null} />,
  );
  expect(html).toContain("Final rental amount");
  expect(html).toContain("Calculating verified price");
  expect(html).not.toContain("₱0.00");
});
it("shows quote failures inline and keeps unknown totals empty", () => {
  const html = renderToStaticMarkup(
    <ManualBookingSummary {...props} quote={null} error="Check rental dates" />,
  );
  expect(html).toContain("Check rental dates");
  expect(html).toContain("Price unavailable");
  expect(html).not.toContain("₱6,600");
});
