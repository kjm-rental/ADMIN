import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BookingSignature } from "./booking-signature";
import type { Database } from "@/types/database";
const saved: Database["public"]["Tables"]["booking_electronic_signatures"]["Row"] =
  {
    booking_id: "booking",
    signature_name: "Sample Renter",
    terms_version: "2026-10-12",
    signed_at: "2026-11-08T05:00:00Z",
    method: "drawn",
    signature_strokes: [
      [
        { x: 0.1, y: 0.2 },
        { x: 0.7, y: 0.8 },
      ],
    ],
    signature_image_base64: null,
  };
it("shows the saved drawing and agreement details as a read-only preview", () => {
  const html = renderToStaticMarkup(
    createElement(BookingSignature, { signature: saved }),
  );
  expect(html).toContain("polyline");
  expect(html).toContain("Sample Renter");
  expect(html).toContain("2026-10-12");
  expect(html).toContain("Manila time");
  expect(html).not.toContain("<canvas");
});
it("renders uploaded signatures inline without exposing a public storage URL", () => {
  const html = renderToStaticMarkup(
    createElement(BookingSignature, {
      signature: {
        ...saved,
        method: "uploaded",
        signature_strokes: null,
        signature_image_base64: "synthetic",
      },
    }),
  );
  expect(html).toContain("data:image/png;base64,synthetic");
  expect(html).toContain("Uploaded signature image");
  expect(html).not.toContain("supabase.co");
});
it("clearly distinguishes unsigned bookings", () => {
  const html = renderToStaticMarkup(
    createElement(BookingSignature, { signature: null }),
  );
  expect(html).toContain("No electronic signature recorded");
  expect(html).not.toContain("Signed by");
});
