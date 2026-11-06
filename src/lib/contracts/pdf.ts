import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { RentalContractData } from "@/services/rental-contract";
import { rentalDuration } from "@/lib/rental-duration";
import { rentalPricingRows } from "@/lib/rental-pricing";

const assets = Promise.all([
  readFile(path.join(process.cwd(), "assets/contracts/NotoSans-Regular.ttf")),
  readFile(path.join(process.cwd(), "assets/contracts/NotoSans-Bold.ttf")),
  readFile(path.join(process.cwd(), "public/images/brand/kjm-logo.png")),
]);
const teal = rgb(0.08, 0.25, 0.25),
  ink = rgb(0.16, 0.2, 0.22),
  muted = rgb(0.36, 0.42, 0.43);
const money = (centavos: number) =>
  `PHP ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (instant: string) =>
  new Date(instant).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ");
export function wrapContractText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of clean(text).split(/\s+/)) {
    if (!word) continue;
    if (font.widthOfTextAtSize(word, size) > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let part = "";
      for (const character of word) {
        if (part && font.widthOfTextAtSize(part + character, size) > width) {
          lines.push(part);
          part = "";
        }
        part += character;
      }
      line = part;
    } else if (
      line &&
      font.widthOfTextAtSize(`${line} ${word}`, size) > width
    ) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
export async function renderRentalContract(
  data: RentalContractData,
  generatedAt = new Date(),
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes, logoBytes] = await assets;
  const regular = await pdf.embedFont(regularBytes, { subset: true }),
    bold = await pdf.embedFont(boldBytes, { subset: true }),
    logo = await pdf.embedPng(logoBytes);
  const { booking: b, customer: c, terms } = data;
  pdf.setTitle(`Rental contract - ${b.booking_reference}`);
  pdf.setAuthor("KJM Motorcycle Rental");
  pdf.setSubject(`Rental agreement copy; terms ${terms.version}`);
  pdf.setCreationDate(generatedAt);
  const width = 595.28,
    height = 841.89,
    left = 46,
    right = width - 46,
    bottom = 57;
  let page: PDFPage, y: number;
  function newPage() {
    page = pdf.addPage([width, height]);
    y = height - 80;
    page.drawText("KJM MOTORCYCLE RENTAL", {
      x: left,
      y: height - 38,
      size: 10,
      font: bold,
      color: teal,
    });
    page.drawText(clean(b.booking_reference), {
      x: left,
      y: height - 53,
      size: 8,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: left, y: height - 63 },
      end: { x: right, y: height - 63 },
      thickness: 0.6,
      color: rgb(0.78, 0.84, 0.82),
    });
  }
  function ensure(space: number) {
    if (y - space < bottom) newPage();
  }
  function text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      gap?: number;
      indent?: number;
    } = {},
  ) {
    const size = options.size ?? 9.3,
      font = options.bold ? bold : regular,
      indent = options.indent ?? 0,
      leading = size * 1.5;
    const lines = wrapContractText(value, font, size, right - left - indent);
    const paragraphHeight = lines.length * leading + (options.gap ?? 5);
    if (paragraphHeight <= height - 80 - bottom) ensure(paragraphHeight);
    for (const line of lines) {
      ensure(leading);
      page.drawText(line, {
        x: left + indent,
        y: y - size,
        size,
        font,
        color: options.color ?? ink,
      });
      y -= leading;
    }
    y -= options.gap ?? 5;
  }
  function section(title: string) {
    ensure(58);
    y -= 9;
    text(title, { size: 12, bold: true, color: teal, gap: 9 });
  }
  function row(label: string, value: string) {
    text(`${label}: ${value}`, { gap: 5 });
  }
  newPage();
  page!.drawImage(logo, { x: right - 54, y: y! - 46, width: 46, height: 46 });
  text("RENTAL CONTRACT COPY", { size: 19, bold: true, color: teal, gap: 8 });
  text(
    data.acceptance
      ? "Booking details and accepted terms"
      : "DRAFT COPY - online acceptance not recorded",
    { size: 10, bold: true, gap: 14 },
  );
  row("Booking reference", b.booking_reference);
  row("Booking status", b.status.replaceAll("_", " "));
  row("Booked on", date(b.created_at));
  row("Copy generated", `${date(generatedAt.toISOString())} (Asia/Manila)`);
  text(
    "Booking details below reflect the saved record at the time this copy was generated. Attached terms retain their recorded version.",
    { size: 8.5, color: muted, gap: 10 },
  );
  section("Renter and motorcycle");
  row("Renter", c.full_name);
  row("Email", c.email || "Not provided");
  row("Phone", c.phone || "Not provided");
  if (c.country_of_residence)
    row("Country of residence", c.country_of_residence);
  row("Motorcycle", data.model?.display_name ?? "Not assigned");
  row("Color", b.selected_color || data.unit?.color || "Not recorded");
  row("Registration plate", data.unit?.registration_plate || "Not assigned");
  section("Rental period");
  row("Pickup", date(b.start_at));
  row("Return", date(b.end_at));
  row(
    "Duration",
    rentalDuration(b.start_at, b.end_at)?.label ??
      "See pickup and return times",
  );
  text("All dates and times are Philippine time (Asia/Manila).", {
    size: 8.5,
    color: muted,
  });
  section("Rental charges and payment record");
  const pricing = rentalPricingRows(b.rental_pricing);
  if (pricing.length) for (const [label, value] of pricing) row(label, value);
  else row("Base rental", money(b.base_total_centavos));
  row("Accessories", money(b.extras_total_centavos));
  if (data.services) {
    row("Delivery fee", money(data.services.delivery_fee_centavos));
    row("Collection fee", money(data.services.collection_fee_centavos));
  }
  row("Payment fees", money(b.fees_total_centavos));
  if (b.manual_adjustment_php)
    row("Booking adjustment", money(b.manual_adjustment_php * 100));
  row("Total rental and charges", money(b.total_centavos));
  const net = data.payments.reduce(
    (sum, event) =>
      sum +
      (event.event_type === "payment"
        ? event.amount_centavos
        : -event.amount_centavos),
    0,
  );
  row("Net rental payments recorded", money(net));
  row("Rental balance", money(Math.max(0, b.total_centavos - net)));
  text(
    "Payment figures reflect recorded payments less refunds/reversals. The security deposit is separate from the rental total.",
    { size: 8.5, color: muted },
  );
  if (data.extras.length) {
    section("Included accessories");
    for (const extra of data.extras)
      row(
        `${extra.quantity} × ${extra.name_snapshot}`,
        money(extra.line_total_centavos),
      );
  }
  section("Security deposit arrangement");
  if (data.deposit) {
    const d = data.deposit;
    row(
      "Deposit",
      d.option === "eligible_id"
        ? `${d.document_type ?? "Original ID"} deposit`
        : `Refundable cash deposit - ${money(d.required_centavos)}`,
    );
    text(
      "This is the saved deposit requirement, not proof that cash or an ID has been received or returned.",
      { size: 8.5, color: muted },
    );
    if (d.collection_instructions)
      row("Collection instructions", d.collection_instructions);
    if (d.return_instructions)
      row("Return instructions", d.return_instructions);
    if (d.dispute_instructions)
      row("Deposit questions", d.dispute_instructions);
  } else if (b.deposit_required_centavos !== null)
    row("Saved deposit requirement", money(b.deposit_required_centavos));
  else text("No deposit arrangement recorded.");
  if (data.services) {
    section("Pickup and return arrangements");
    for (const leg of ["delivery", "collection"] as const) {
      const raw = data.services[leg];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const title = leg === "delivery" ? "Delivery" : "Collection";
        for (const key of [
          "areaName",
          "address",
          "hotel",
          "landmark",
          "instructions",
        ] as const)
          if (typeof raw[key] === "string" && raw[key])
            row(`${title} ${key === "areaName" ? "area" : key}`, raw[key]);
      } else row(leg === "delivery" ? "Pickup" : "Return", "At KJM");
    }
  }
  section("Terms acceptance record");
  row("Terms version", terms.version);
  row("Effective date", terms.effectiveDate);
  if (data.acceptance) {
    row("Accepted online", date(data.acceptance.accepted_at));
    text(
      "Online acceptance is recorded for this booking. This copy does not contain a handwritten or digital signature image.",
      { size: 8.5, color: muted },
    );
  } else
    text(
      "No online terms acceptance is recorded for this booking. The following current terms are provided for review; this draft does not establish acceptance.",
      { size: 9, bold: true },
    );
  text(`Terms source SHA-256: ${terms.sourceSha256}`, {
    size: 7.5,
    color: muted,
  });
  text(`Archived terms: https://kjmride.com/terms/${terms.version}`, {
    size: 8.5,
    color: muted,
  });
  newPage();
  text("TERMS AND CONDITIONS", { size: 17, bold: true, color: teal, gap: 10 });
  text(`Version ${terms.version} | Effective ${terms.effectiveDate}`, {
    size: 9,
    color: muted,
    gap: 13,
  });
  // Use the immutable source text, including every clause and list item, in source order.
  const paragraphs = terms.sourceText.split(/\n\s*\n/).slice(3);
  for (const [index, paragraph] of paragraphs.entries()) {
    if (/^\d+\. [^\n]+$/.test(paragraph)) {
      const headingHeight =
        wrapContractText(paragraph, bold, 10, right - left).length * 15 + 8;
      const firstClauseHeight =
        wrapContractText(
          paragraphs[index + 1] ?? "",
          regular,
          9.3,
          right - left,
        ).length *
          13.95 +
        7;
      ensure(headingHeight + Math.min(firstClauseHeight, 200));
      text(paragraph, { size: 10, bold: true, color: teal, gap: 8 });
    } else
      for (const line of paragraph.split("\n"))
        text(line, { size: 9.3, gap: 7 });
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: left, y: 42 },
      end: { x: right, y: 42 },
      thickness: 0.5,
      color: rgb(0.78, 0.84, 0.82),
    });
    p.drawText("Rental contract copy | KJM Motorcycle Rental", {
      x: left,
      y: 27,
      size: 7.3,
      font: regular,
      color: muted,
    });
    const label = `${index + 1} / ${pages.length}`;
    p.drawText(label, {
      x: right - regular.widthOfTextAtSize(label, 8),
      y: 27,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return pdf.save();
}
