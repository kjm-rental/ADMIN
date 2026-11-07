import { expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderRentalContract, wrapContractText } from "./pdf";
import { sampleRentalContract } from "./fixture";
import { contractTerms } from "./terms";
it("refuses missing or mismatched archived terms rather than replacing the accepted agreement", () => {
  expect(() => contractTerms("2099-01-01", "a".repeat(64))).toThrow(
    "original terms",
  );
  expect(() => contractTerms("2026-10-12", "a".repeat(64))).toThrow(
    "original terms",
  );
  const sample = sampleRentalContract();
  expect(() =>
    contractTerms(
      sample.terms.version,
      sample.terms.sourceSha256,
      "a".repeat(64),
    ),
  ).toThrow("original terms");
  expect(sample.terms.sections).toHaveLength(28);
});
it("wraps very long unbroken text within the printable width", async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    value = "A".repeat(400);
  const lines = wrapContractText(value, font, 10, 300);
  expect(lines.join("")).toBe(value);
  expect(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 300)).toBe(
    true,
  );
});
it("generates a paginated PDF with embedded fonts and all archived terms", async () => {
  const sample = sampleRentalContract(),
    bytes = await renderRentalContract(
      sample,
      new Date("2026-11-06T06:00:00Z"),
    ),
    pdf = await PDFDocument.load(bytes);
  expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.getPageCount()).toBeGreaterThan(4);
  expect(pdf.getTitle()).toBe("Rental contract - KJM-SAMPLE-CONTRACT");
  for (const page of pdf.getPages())
    expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
  if (process.env.KJM_CONTRACT_PREVIEW_DIR) {
    await mkdir(process.env.KJM_CONTRACT_PREVIEW_DIR, { recursive: true });
    await writeFile(
      path.join(process.env.KJM_CONTRACT_PREVIEW_DIR, "sample-contract.pdf"),
      bytes,
    );
    const cash = sampleRentalContract();
    cash.services = null;
    cash.extras.push({
      name_snapshot: "Raincoat",
      quantity: 2,
      line_total_centavos: 0,
    });
    cash.booking.end_at = "2026-11-21T02:17:00+08:00";
    cash.booking.total_centavos = 71900;
    cash.booking.quoted_total_php = 719;
    cash.payments = [{ event_type: "payment", amount_centavos: 71900 }];
    cash.booking.rental_pricing = {
      version: 1,
      mode: "hourly",
      baseDays: 1,
      baseChargePhp: 619,
      additionalHours: 0,
      hourlyRatePhp: 35,
      extensionChargePhp: 0,
      totalPhp: 619,
    };
    cash.deposit = {
      ...cash.deposit!,
      option: "cash",
      document_type: null,
      required_centavos: 250000,
      collection_instructions:
        "Customers must bring the agreed deposit to pickup. Cash is collected before release and recorded separately from rental payment. ".repeat(
          5,
        ),
      return_instructions:
        "The refundable balance is returned after inspection and assessment of outstanding charges. Deposit returns are recorded in the system. ".repeat(
          3,
        ),
      dispute_instructions:
        "Contact KJM with any deposit questions. Any deduction must be documented and explained to the renter, with supporting records available. ".repeat(
          4,
        ),
    };
    await writeFile(
      path.join(process.env.KJM_CONTRACT_PREVIEW_DIR, "sample-cash-self.pdf"),
      await renderRentalContract(cash),
    );
    const draft = sampleRentalContract();
    draft.acceptance = null;
    draft.customer.full_name = "Sample renter " + "VeryLongName".repeat(35);
    draft.customer.email = "long".repeat(80) + "@example.com";
    draft.deposit = {
      ...draft.deposit!,
      option: "cash",
      document_type: null,
      required_centavos: 250000,
    };
    await writeFile(
      path.join(
        process.env.KJM_CONTRACT_PREVIEW_DIR,
        "sample-draft-contract.pdf",
      ),
      await renderRentalContract(draft),
    );
  }
}, 20000);

it("exports a drawn signature with the renter and accepted terms", async () => {
  const sample = sampleRentalContract();
  sample.signature = {
    signature_name: "Sample Renter",
    signature_strokes: [
      [
        { x: 0.1, y: 0.5 },
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.7 },
        { x: 0.8, y: 0.4 },
      ],
    ],
    method: "drawn",
    signed_at: "2026-11-07T08:00:00Z",
    terms_version: sample.terms.version,
  };
  const bytes = await renderRentalContract(sample);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(4);
  expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
});
