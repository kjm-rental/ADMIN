import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { RentalContractData } from "@/services/rental-contract";
import { rentalDuration } from "@/lib/rental-duration";
import { rentalPricingRows, parseRentalPricing } from "@/lib/rental-pricing";

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
  const W = 595.28,
    H = 841.89,
    L = 42,
    R = W - 42,
    CW = R - L,
    B = 58;
  const mint = rgb(0.94, 0.97, 0.95),
    lineColor = rgb(0.81, 0.86, 0.83),
    gold = rgb(0.73, 0.57, 0.29),
    white = rgb(1, 1, 1);
  let page!: PDFPage;
  let y = 0;
  function at(
    value: string,
    x: number,
    top: number,
    size = 9.2,
    font = regular,
    color = ink,
  ) {
    page.drawText(clean(value), { x, y: top - size, size, font, color });
  }
  function lines(value: string, width: number, size = 9.2, font = regular) {
    return wrapContractText(value, font, size, width);
  }
  function paragraphAt(
    value: string,
    x: number,
    top: number,
    width: number,
    size = 9.2,
    font = regular,
    color = ink,
    leading = size * 1.45,
  ) {
    const wrapped = lines(value, width, size, font);
    wrapped.forEach((value, i) =>
      at(value, x, top - i * leading, size, font, color),
    );
    return wrapped.length * leading;
  }
  function newPage(label = "RENTAL AGREEMENT") {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: teal });
    page.drawImage(logo, { x: L, y: H - 77, width: 47, height: 47 });
    at("KJM.", L + 59, H - 32, 23, bold, teal);
    at("MOTORCYCLE RENTAL", L + 60, H - 59, 7.7, bold, muted);
    at(label, R - bold.widthOfTextAtSize(label, 7.8), H - 35, 7.8, bold, teal);
    const ref = clean(b.booking_reference);
    at(ref, R - regular.widthOfTextAtSize(ref, 8), H - 52, 8, regular, muted);
    page.drawLine({
      start: { x: L, y: H - 92 },
      end: { x: R, y: H - 92 },
      color: lineColor,
      thickness: 0.7,
    });
    y = H - 108;
  }
  function ensure(h: number) {
    if (y - h < B) newPage("AGREEMENT DETAILS");
  }
  function flow(
    value: string,
    size = 9.2,
    font = regular,
    color = ink,
    gap = 5,
  ) {
    const wrapped = lines(value, CW, size, font),
      leading = size * 1.45;
    if (wrapped.length * leading + gap <= H - 108 - B)
      ensure(wrapped.length * leading + gap);
    for (const value of wrapped) {
      ensure(leading);
      at(value, L, y, size, font, color);
      y -= leading;
    }
    y -= gap;
  }
  function heading(title: string) {
    ensure(52);
    y -= 5;
    flow(title, 11.5, bold, teal, 8);
  }
  type Field = [string, string];
  function cardHeight(fields: Field[], width: number) {
    return (
      43 +
      fields.reduce(
        (n, [, value]) =>
          n + 12 + lines(value, width - 28, 9.5).length * 13.3 + 8,
        0,
      )
    );
  }
  function card(
    title: string,
    fields: Field[],
    x: number,
    top: number,
    width: number,
    height: number,
    tinted = false,
  ) {
    page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      color: tinted ? mint : white,
      borderColor: lineColor,
      borderWidth: 0.7,
    });
    at(title.toUpperCase(), x + 14, top - 14, 8.2, bold, teal);
    let cursor = top - 37;
    for (const [label, value] of fields) {
      at(label.toUpperCase(), x + 14, cursor, 6.8, bold, muted);
      cursor -= 12;
      cursor -=
        paragraphAt(
          value,
          x + 14,
          cursor,
          width - 28,
          9.5,
          regular,
          ink,
          13.3,
        ) + 8;
    }
  }
  const net = data.payments.reduce(
    (sum, event) =>
      sum +
      (event.event_type === "payment"
        ? event.amount_centavos
        : -event.amount_centavos),
    0,
  );
  const balance = Math.max(0, b.total_centavos - net);
  newPage();
  at("Your rental agreement", L, y, 25, bold, teal);
  y -= 39;
  flow(
    data.acceptance
      ? "CUSTOMER COPY  /  Online acceptance recorded"
      : "DRAFT COPY  /  Online acceptance not recorded",
    8.5,
    bold,
    data.acceptance ? teal : rgb(0.55, 0.31, 0.12),
    9,
  );
  flow(
    `Status: ${b.status.replaceAll("_", " ")}   |   Booked ${date(b.created_at)}`,
    8.3,
    regular,
    muted,
    16,
  );
  const half = (CW - 14) / 2;
  const renter: Field[] = [
    ["Renter", c.full_name],
    ["Email", c.email || "Not provided"],
    ["Phone", c.phone || "Not provided"],
    ...(c.country_of_residence
      ? [["Country of residence", c.country_of_residence] as Field]
      : []),
  ];
  const motorcycle: Field[] = [
    ["Model", data.model?.display_name ?? "Not assigned"],
    ["Selected color", b.selected_color || data.unit?.color || "Not recorded"],
    ["Registration plate", data.unit?.registration_plate || "Not assigned"],
  ];
  const partyHeight = Math.max(
    cardHeight(renter, half),
    cardHeight(motorcycle, half),
  );
  ensure(partyHeight + 14);
  card("01 / The renter", renter, L, y, half, partyHeight);
  card(
    "02 / Your motorcycle",
    motorcycle,
    L + half + 14,
    y,
    half,
    partyHeight,
    true,
  );
  y -= partyHeight + 14;
  const duration =
      rentalDuration(b.start_at, b.end_at)?.label ?? "See rental dates",
    periods: Field[] = [
      ["Pickup", date(b.start_at)],
      ["Return", date(b.end_at)],
      ["Rental duration", duration],
    ],
    cell = CW / 3;
  const periodHeight =
    35 +
    Math.max(...periods.map(([, v]) => lines(v, cell - 25, 9.5).length * 14));
  ensure(periodHeight + 23);
  page.drawRectangle({
    x: L,
    y: y - periodHeight,
    width: CW,
    height: periodHeight,
    color: teal,
  });
  periods.forEach(([label, value], i) => {
    at(
      label.toUpperCase(),
      L + 13 + i * cell,
      y - 12,
      7,
      bold,
      rgb(0.73, 0.85, 0.8),
    );
    paragraphAt(
      value,
      L + 13 + i * cell,
      y - 27,
      cell - 25,
      9.5,
      bold,
      white,
      14,
    );
  });
  y -= periodHeight + 8;
  flow(
    "All times are local to Cebu, Philippines (Asia/Manila).",
    7.8,
    regular,
    muted,
    15,
  );
  const chargeRows: Field[] = [
    ["Rental charge", money(b.base_total_centavos)],
    ...(b.extras_total_centavos
      ? [["Accessories", money(b.extras_total_centavos)] as Field]
      : []),
    ...(data.services?.delivery_fee_centavos
      ? [["Delivery", money(data.services.delivery_fee_centavos)] as Field]
      : []),
    ...(data.services?.collection_fee_centavos
      ? [["Collection", money(data.services.collection_fee_centavos)] as Field]
      : []),
    ...(b.fees_total_centavos
      ? [["Payment fees", money(b.fees_total_centavos)] as Field]
      : []),
    ...(b.manual_adjustment_php
      ? [["Booking adjustment", money(b.manual_adjustment_php * 100)] as Field]
      : []),
  ];
  const tableWidth = 302,
    depositWidth = CW - tableWidth - 14,
    tableHeight = 37 + (chargeRows.length + 3) * 23;
  const d = data.deposit;
  const depositValue = d
    ? d.option === "eligible_id"
      ? `${d.document_type ?? "Original ID"} deposit`
      : money(d.required_centavos)
    : b.deposit_required_centavos !== null
      ? money(b.deposit_required_centavos)
      : "Not recorded";
  const depositFields: Field[] = [
    [
      d?.option === "eligible_id"
        ? "Deposit arrangement"
        : "Refundable cash deposit",
      depositValue,
    ],
    ["Collection", "Separate from rental payment"],
    ["Receipt status", "Requirement only; not proof of collection"],
  ];
  const financeHeight = Math.max(
    tableHeight,
    cardHeight(depositFields, depositWidth),
  );
  ensure(financeHeight + 14);
  page.drawRectangle({
    x: L,
    y: y - financeHeight,
    width: tableWidth,
    height: financeHeight,
    color: white,
    borderColor: lineColor,
    borderWidth: 0.7,
  });
  at("03 / PAYMENT SUMMARY", L + 14, y - 14, 8.2, bold, teal);
  let cursor = y - 37;
  const allCharges = [
    ...chargeRows,
    ["Rental total", money(b.total_centavos)],
    ["Net payments recorded", money(net)],
    ["Rental balance", money(balance)],
  ];
  for (const [i, [label, value]] of allCharges.entries()) {
    const total = i === chargeRows.length,
      last = i === allCharges.length - 1;
    if (total || last)
      page.drawRectangle({
        x: L + 1,
        y: cursor - 19,
        width: tableWidth - 2,
        height: 23,
        color: last ? teal : mint,
      });
    at(
      label,
      L + 14,
      cursor - 3,
      8.8,
      total || last ? bold : regular,
      last ? white : ink,
    );
    const font = total || last ? bold : regular;
    at(
      value,
      L + tableWidth - 14 - font.widthOfTextAtSize(value, 9),
      cursor - 3,
      9,
      font,
      last ? white : teal,
    );
    cursor -= 23;
  }
  card(
    "04 / Security deposit",
    depositFields,
    L + tableWidth + 14,
    y,
    depositWidth,
    financeHeight,
    true,
  );
  y -= financeHeight + 13;
  const acceptanceTitle = data.acceptance
    ? "Online acceptance recorded"
    : "Online acceptance not recorded";
  const acceptanceText = data.acceptance
    ? `Accepted ${date(data.acceptance.accepted_at)} | Terms ${terms.version}`
    : `Draft for review | Terms ${terms.version}`;
  const acceptanceHeight = data.signature ? 100 : 64;
  ensure(acceptanceHeight);
  page.drawRectangle({
    x: L,
    y: y - acceptanceHeight,
    width: CW,
    height: acceptanceHeight,
    color: mint,
  });
  page.drawRectangle({
    x: L,
    y: y - acceptanceHeight,
    width: 3,
    height: acceptanceHeight,
    color: gold,
  });
  at(acceptanceTitle, L + 15, y - 11, 10, bold, teal);
  at(acceptanceText, L + 15, y - 29, 8.4, regular, ink);
  at(
    data.acceptance
      ? "The complete accepted terms and any recorded electronic signature follow."
      : "This copy does not establish acceptance. Full terms are supplied for review.",
    L + 15,
    y - 45,
    7.8,
    regular,
    muted,
  );
  if (data.signature) {
    at(
      data.signature.method === "drawn"
        ? "Drawn electronic signature recorded"
        : "Typed electronic signature recorded",
      L + 15,
      y - 62,
      8.4,
      regular,
      ink,
    );
    at(date(data.signature.signed_at), L + 15, y - 79, 7.8, regular, muted);
  }
  y -= acceptanceHeight + 10;

  newPage("AGREEMENT DETAILS");
  flow("The details of your rental", 22, bold, teal, 9);
  if (data.signature) {
    flow(
      `Electronically signed by: ${data.signature.signature_name}`,
      10,
      bold,
      ink,
    );
    flow(
      `${data.signature.method === "drawn" ? "Drawn signature" : "Typed full name"} | Signed ${date(data.signature.signed_at)} | Terms ${data.signature.terms_version}`,
      9,
      regular,
      muted,
    );
  }
  if (data.signature?.signature_strokes?.length) {
    ensure(100);
    for (const stroke of data.signature.signature_strokes) {
      for (let i = 1; i < stroke.length; i++) {
        page.drawLine({
          start: { x: L + stroke[i - 1].x * 320, y: y - stroke[i - 1].y * 90 },
          end: { x: L + stroke[i].x * 320, y: y - stroke[i].y * 90 },
          thickness: 1.3,
          color: ink,
        });
      }
    }
    y -= 105;
  }
  flow(
    "Saved arrangements, pricing and agreement record",
    9.2,
    regular,
    muted,
    17,
  );
  heading("Rental pricing");
  const allPricing = rentalPricingRows(b.rental_pricing);
  const pricing =
    parseRentalPricing(b.rental_pricing)?.additionalHours === 0
      ? allPricing.slice(0, 1)
      : allPricing;
  if (pricing.length)
    for (const [label, value] of pricing)
      flow(`${label}: ${value}`, 9.2, regular, ink, 5);
  else flow(`Base rental: ${money(b.base_total_centavos)}`);
  flow(
    "Payment figures reflect recorded payments less refunds and reversals. Security deposits are separate from the rental total.",
    8.3,
    regular,
    muted,
    12,
  );
  if (data.extras.length) {
    heading("Accessories included");
    for (const extra of data.extras)
      flow(
        `${extra.quantity} × ${extra.name_snapshot}  |  ${money(extra.line_total_centavos)}`,
      );
  }
  heading("Security deposit instructions");
  flow(
    d
      ? `${d.option === "eligible_id" ? "ID deposit" : "Refundable cash deposit"}: ${depositValue}`
      : `Saved deposit requirement: ${depositValue}`,
    10,
    bold,
    teal,
  );
  flow(
    "This records the deposit requirement, not proof that cash or an ID has been received or returned.",
    8.3,
    regular,
    muted,
    10,
  );
  for (const [label, value] of [
    ["Collection", d?.collection_instructions],
    ["Return", d?.return_instructions],
    ["Deposit questions", d?.dispute_instructions],
  ])
    if (value) {
      ensure(40);
      flow(label!, 8, bold, teal, 3);
      flow(value, 9.2, regular, ink, 9);
    }
  const serviceColumns = (["delivery", "collection"] as const).map((leg) => {
    const raw = data.services?.[leg];
    const rows: string[] = [];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const key of [
        "areaName",
        "address",
        "hotel",
        "landmark",
        "instructions",
      ] as const)
        if (typeof raw[key] === "string" && raw[key])
          rows.push(
            `${key === "areaName" ? "Area" : key[0].toUpperCase() + key.slice(1)}: ${raw[key]}`,
          );
    } else rows.push("At KJM");
    return {
      title: leg === "delivery" ? "Pickup / delivery" : "Return / collection",
      rows,
    };
  });
  const serviceHeight =
    37 +
    Math.max(
      ...serviceColumns.map((column) =>
        column.rows.reduce(
          (total, value) =>
            total + lines(value, half - 24, 8.6).length * 12.5 + 4,
          0,
        ),
      ),
    );
  const selfPickupAndReturn =
    !data.services?.delivery && !data.services?.collection;
  ensure((selfPickupAndReturn ? 22 : serviceHeight + 10) + 36);
  heading("Pickup and return arrangements");
  if (selfPickupAndReturn)
    flow("Pickup and return at KJM.", 9.2, regular, ink, 8);
  else {
    serviceColumns.forEach((column, i) => {
      const x = L + i * (half + 14);
      page.drawRectangle({
        x,
        y: y - serviceHeight,
        width: half,
        height: serviceHeight,
        color: mint,
      });
      at(column.title, x + 12, y - 11, 9.5, bold, teal);
      let cursor = y - 32;
      for (const value of column.rows)
        cursor -=
          paragraphAt(
            value,
            x + 12,
            cursor,
            half - 24,
            8.6,
            regular,
            ink,
            12.5,
          ) + 4;
    });
    y -= serviceHeight + 10;
  }
  heading("Agreement record");
  flow(
    `Terms version: ${terms.version} | Effective date: ${terms.effectiveDate}`,
    9.2,
    bold,
    teal,
  );
  if (data.acceptance)
    flow(`Accepted online: ${date(data.acceptance.accepted_at)}`);
  else
    flow(
      "No online terms acceptance is recorded for this booking. The following current terms are provided for review; this draft does not establish acceptance.",
      9.2,
      bold,
    );
  // Two-column legal pages preserve the source text and reading order in full.
  newPage("RENTAL TERMS");
  flow("Terms & conditions", 23, bold, teal, 8);
  flow(
    `Version ${terms.version} | Effective ${terms.effectiveDate}`,
    8.5,
    regular,
    muted,
    18,
  );
  const colWidth = (CW - 24) / 2,
    leading = 12.4;
  let column = 0,
    columnTop = y;
  function advanceColumn() {
    if (column === 0) {
      column = 1;
      y = columnTop;
    } else {
      newPage("RENTAL TERMS");
      column = 0;
      columnTop = y;
    }
  }
  function columnEnsure(h: number) {
    if (y - h < B) advanceColumn();
  }
  const paragraphs = terms.sourceText
    .split(/\n\s*\n/)
    .slice(3)
    .flatMap((p) => p.split("\n"));
  for (const [index, paragraph] of paragraphs.entries()) {
    const heading = /^\d+\. [^\n]+$/.test(paragraph),
      size = 9.1,
      font = heading ? bold : regular;
    const wrapped = lines(paragraph, colWidth - (heading ? 16 : 0), size, font);
    const blockHeight = wrapped.length * leading + (heading ? 15 : 5);
    if (heading) {
      const nextHeight =
        lines(paragraphs[index + 1] ?? "", colWidth, 9.1).length * leading + 5;
      columnEnsure(blockHeight + Math.min(nextHeight, 180));
    } else if (blockHeight <= columnTop - B) columnEnsure(blockHeight);
    const x = L + column * (colWidth + 24);
    if (heading) {
      page.drawRectangle({
        x,
        y: y - wrapped.length * leading - 8,
        width: colWidth,
        height: wrapped.length * leading + 8,
        color: mint,
      });
      y -= 4;
    }
    for (const value of wrapped) {
      columnEnsure(leading);
      at(
        value,
        L + column * (colWidth + 24) + (heading ? 8 : 0),
        y,
        size,
        font,
        heading ? teal : ink,
      );
      y -= leading;
    }
    y -= heading ? 11 : 5;
  }
  // Document provenance is separate from the unchanged agreement wording.
  columnEnsure(145);
  y -= 10;
  const provenance = [
    "ABOUT THIS COPY",
    `Copy generated: ${date(generatedAt.toISOString())} (Asia/Manila)`,
    "Booking details reflect the saved record when this copy was generated. The attached agreement retains its recorded terms version.",
    `Archived terms: https://kjmride.com/terms/${terms.version}`,
    `Terms source SHA-256: ${terms.sourceSha256}`,
  ];
  provenance.forEach((value, index) => {
    for (const line of lines(
      value,
      colWidth,
      7.5,
      index === 0 ? bold : regular,
    )) {
      columnEnsure(11);
      at(
        line,
        L + column * (colWidth + 24),
        y,
        7.5,
        index === 0 ? bold : regular,
        muted,
      );
      y -= 11;
    }
    y -= 5;
  });
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: L, y: 42 },
      end: { x: R, y: 42 },
      thickness: 0.6,
      color: lineColor,
    });
    p.drawText("KJM MOTORCYCLE RENTAL  /  kjmride.com", {
      x: L,
      y: 27,
      size: 7,
      font: regular,
      color: muted,
    });
    const label = `${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
    p.drawText(label, {
      x: R - bold.widthOfTextAtSize(label, 8),
      y: 27,
      size: 8,
      font: bold,
      color: teal,
    });
  });
  return pdf.save();
}
