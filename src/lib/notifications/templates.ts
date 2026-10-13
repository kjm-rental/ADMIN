import {
  eventCatalog,
  type NotificationEvent,
  type NotificationPayload,
} from "./types";
export const templateVersion = 1;
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const clean = (value: string, max = 240) =>
  value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
export const php = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(centavos / 100);
export const manilaTime = (timestamp: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
export function approvedUrl(
  base: string | undefined,
  path: string,
  development = false,
) {
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      (url.protocol !== "https:" &&
        !(
          development &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      return undefined;
    return new URL(path, url).href;
  } catch {
    return undefined;
  }
}
export function renderNotification(
  event: NotificationEvent,
  p: NotificationPayload,
  options: {
    mainBase?: string;
    adminBase?: string;
    pickupLocation?: string;
    development?: boolean;
  } = {},
) {
  if (!Object.hasOwn(eventCatalog, event))
    throw Error("Unsupported notification template");
  const meta = eventCatalog[event];
  if (!meta) throw Error("Unsupported notification template");
  const reference = clean(p.reference, 60),
    motorcycle = clean(p.motorcycle);
  const deposit =
    p.depositOption === "cash" && p.depositCentavos != null
      ? `Cash security deposit: ${php(p.depositCentavos)} (separate from rental payment)`
      : p.depositOption === "eligible_id"
        ? "Approved document custody arrangement; review your agreed rental terms"
        : "Security deposit arrangement awaiting confirmation";
  const rows: [string, string][] = [
    ["Booking", reference],
    ["Motorcycle", motorcycle],
    ["Pickup · Philippine time", manilaTime(p.pickupAt)],
    ["Return · Philippine time", manilaTime(p.returnAt)],
    ["Rental amount", php(p.rentalCentavos)],
    ["Security deposit", deposit],
  ];
  if (
    p.amountCentavos != null &&
    ["cash_payment", "deposit_collected", "deposit_returned"].includes(event)
  )
    rows.unshift([
      event === "deposit_returned" ? "Amount returned" : "Amount recorded",
      php(p.amountCentavos),
    ]);
  if (
    options.pickupLocation &&
    [
      "booking_approved",
      "pickup_reminder",
      "handover",
      "return_reminder",
    ].includes(event)
  )
    rows.push([
      "Configured pickup location",
      clean(options.pickupLocation, 500),
    ]);
  if (
    ["booking_requested", "booking_approved", "pickup_reminder"].includes(event)
  ) {
    rows.push(
      ["Payment method", "Cash on Pickup"],
      ["Payment due", "At motorcycle collection"],
    );
  }
  const contact = approvedUrl(
    options.mainBase,
    "/contact",
    options.development,
  );
  // Contact is an existing public page. No private URLs, tokens or invented document-upload paths.
  const adminLink = /^[0-9a-f-]{36}$/i.test(p.bookingId)
    ? approvedUrl(
        options.adminBase,
        `/dashboard/bookings/${p.bookingId}`,
        options.development,
      )
    : undefined;
  const body =
      event === "booking_approved" &&
      p.verificationStatus &&
      p.verificationStatus !== "approved"
        ? `${meta.body} Your identification documents are pending verification.`
        : meta.body,
    summary = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const text = `KJM Motorcycle Rental\nMactan Island / Cebu\n\n${meta.title}\n\n${body}\n\n${summary}${contact ? `\n\nContact KJM: ${contact}` : "\n\nPlease contact KJM through the website for assistance."}\n\nThis is a transactional update about your rental. Do not reply with identity documents.`;
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:14px 0;border-bottom:1px solid #E7E3DA"><div style="font-size:12px;color:#566E6D;margin-bottom:5px">${escapeHtml(label)}</div><div style="font-size:15px;color:#143F40;font-weight:600;overflow-wrap:anywhere">${escapeHtml(value)}</div></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(meta.subject)}</title></head><body style="margin:0;background:#FAF7F0;font-family:Arial,Helvetica,sans-serif;color:#143F40"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(body)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #E7E3DA;border-radius:16px"><tr><td style="background:#143F40;padding:30px 24px;color:#FAF7F0;border-radius:16px 16px 0 0"><div style="font-size:24px;font-weight:700;letter-spacing:2px">KJM</div><div style="font-size:13px;margin-top:8px">MOTORCYCLE RENTAL</div><div style="font-size:13px;margin-top:12px;color:#F6A783">Mactan Island / Cebu</div></td></tr><tr><td style="padding:28px 24px"><p style="font-size:12px;letter-spacing:2px;color:#566E6D">YOUR ISLAND RIDE</p><h1 style="font-size:27px;line-height:1.25;margin:10px 0 18px">${escapeHtml(meta.title)}</h1><p style="font-size:16px;line-height:1.65">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">${rowHtml}</table>${contact ? `<p style="margin:28px 0 10px"><a href="${escapeHtml(contact)}" style="display:inline-block;background:#F6A783;color:#143F40;padding:15px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none">Contact KJM</a></p>` : ""}</td></tr><tr><td style="padding:22px 24px;background:#FAF7F0;border-radius:0 0 16px 16px;font-size:12px;line-height:1.7;color:#566E6D">KJM Motorcycle Rental · Mactan Island / Cebu<br>This is a transactional rental update. Please do not reply with identity documents.</td></tr></table></td></tr></table></body></html>`;
  // Telegram plain text deliberately has no parse_mode, so markup is never interpreted.
  const telegramText =
    `${meta.heading}\n\n${summary}\n\n${body}${adminLink ? `\n\nKJM ADMIN: ${adminLink}` : ""}`.slice(
      0,
      4000,
    );
  return { subject: meta.subject, html, text, telegramText };
}
