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
