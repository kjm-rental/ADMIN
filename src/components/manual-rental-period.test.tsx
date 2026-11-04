import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ManualRentalPeriod } from "./manual-rental-period";
it("shows separate date/hour/minute/AM-PM controls without the combined datetime popup", () => {
  const html = renderToStaticMarkup(
    <ManualRentalPeriod startAt="" endAt="" onChange={() => undefined} />,
  );
  expect(html).toContain('aria-label="Pickup date"');
  expect(html).not.toContain('type="date"');
  expect(html).not.toContain('type="datetime-local"');
  for (const label of [
    "Pickup hour",
    "Pickup minute",
    "Pickup AM or PM",
    "Return hour",
    "Quick duration",
    "24 hours after pickup",
  ])
    expect(html).toContain(label);
});
it("shows duration and preserves existing non-quarter-hour times", () => {
  const html = renderToStaticMarkup(
    <ManualRentalPeriod
      startAt="2030-01-01T13:17"
      endAt="2030-01-03T13:17"
      onChange={() => undefined}
    />,
  );
  expect(html).toContain("Rental duration: 2 days");
  expect(html).toContain('<option selected="">17</option>');
  expect(html).toContain("1 Jan 2030");
});
it("explains invalid short rental periods", () => {
  expect(
    renderToStaticMarkup(
      <ManualRentalPeriod
        startAt="2030-01-01T09:00"
        endAt="2030-01-01T18:00"
        onChange={() => undefined}
      />,
    ),
  ).toContain("Return must be at least 24 hours");
});
