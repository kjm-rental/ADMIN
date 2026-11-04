import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { NotificationConfig } from "./config";
import type { OutboxRow } from "./types";
import { approvedUrl, manilaTime, php } from "./templates";

const clean = (value: string | null | undefined, max = 160) =>
  (value || "Not recorded")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, max);
/** Enrich an already-leased, transactionally saved event; never read private documents. */
export async function renderTelegramOwnerNotification(
  db: SupabaseClient<Database>,
  row: OutboxRow,
  config: NotificationConfig,
) {
  const adminUrl = approvedUrl(
    config.adminBase,
    `/dashboard/bookings/${row.booking_id}`,
    config.development,
  );
  if (!adminUrl)
    throw new Error("Owner notification configuration unavailable.");
  const booking = await db
    .from("bookings")
    .select(
      "customer_id,status,total_centavos,pricing_units,status_reason,start_at,end_at",
    )
    .eq("id", row.booking_id)
    .single();
  if (booking.error || !booking.data)
    throw new Error("Owner notification context unavailable.");
  const [customer, verification, payments, cancellation] = await Promise.all([
    db
      .from("customers")
      .select("full_name,phone,auth_user_id")
      .eq("id", booking.data.customer_id)
      .single(),
    db
      .from("customer_verifications")
      .select("overall_status")
      .eq("booking_id", row.booking_id)
      .maybeSingle(),
    db
      .from("payment_events")
      .select("event_type,amount_centavos")
      .eq("booking_id", row.booking_id),
    row.event_type === "booking_cancelled"
      ? db
          .from("booking_status_history")
          .select("changed_by,created_at")
          .eq("booking_id", row.booking_id)
          .eq("new_status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    [customer, verification, payments, cancellation].some(
      (query) => query.error,
    ) ||
    !customer.data
  )
    throw new Error("Owner notification context unavailable.");
  const p = row.payload;
  const paid = (payments.data ?? []).reduce(
    (sum, event) =>
      sum +
      (event.event_type === "payment"
        ? event.amount_centavos
        : -event.amount_centavos),
    0,
  );
  const payment =
    paid <= 0
      ? "Unpaid"
      : paid < booking.data.total_centavos
        ? "Partially paid"
        : "Paid";
  const status = clean(booking.data.status);
  const verificationStatus = clean(verification.data?.overall_status);
  const common = `Booking: ${clean(p.reference, 60)}\nBooking Status: ${status}\nCustomer: ${clean(customer.data.full_name)}\nMotorcycle: ${clean(p.motorcycle)}`;
  let telegramText: string;
  if (row.event_type === "booking_cancelled") {
    if (booking.data.status !== "cancelled")
      throw new Error("Cancellation is not recorded.");
    const actor = cancellation.data?.[0]?.changed_by;
    let cancelledBy =
      actor && actor === customer.data.auth_user_id
        ? "Customer"
        : "Not identified";
    if (actor && cancelledBy !== "Customer") {
      const admin = await db
        .from("admin_users")
        .select("is_active")
        .eq("auth_user_id", actor)
        .maybeSingle();
      if (!admin.error && admin.data) cancelledBy = "Admin";
    }
    telegramText = `❌ BOOKING CANCELLED!\n\n${common}\n\nPickup: ${manilaTime(p.pickupAt)}\nReturn: ${manilaTime(p.returnAt)}\nRental Total: ${php(p.rentalCentavos)}\n\nCancelled By: ${cancelledBy}\nReason: ${booking.data.status_reason ? "Recorded — see Admin" : "Not recorded"}\nCancelled At: ${manilaTime(cancellation.data?.[0]?.created_at ?? row.created_at)}`;
  } else if (
    ["booking_requested", "booking_approved"].includes(row.event_type)
  ) {
    const duration =
      booking.data.pricing_units ??
      (Date.parse(p.returnAt) - Date.parse(p.pickupAt)) / 86400000;
    telegramText = `${row.event_type === "booking_requested" ? "🏍️ NEW BOOKING RECEIVED!" : "✅ BOOKING CONFIRMED"}\n\n${common}\n\n👤 CUSTOMER\nName: ${clean(customer.data.full_name)}\nPhone: ${clean(customer.data.phone, 40)}\n\n🏍️ MOTORCYCLE RENTAL\nPickup: ${manilaTime(p.pickupAt)}\nReturn: ${manilaTime(p.returnAt)}\nDuration: ${duration.toLocaleString("en-PH", { maximumFractionDigits: 2 })} rental days\n\n💰 PAYMENT\nRental Total: ${php(p.rentalCentavos)}\nPayment Method: ${p.paymentMethod === "qrph" ? "QRPh via PayMongo" : "Cash on Pickup / Delivery"}\nPayment Status: ${payment}\n\n🛡️ VERIFICATION\n${verificationStatus.replaceAll("_", " ")}\nDocument upload or booking confirmation does not authorize pickup.`;
  } else {
    // Existing queue emits document-review and replacement requests, not all decisions.
    const heading =
      verificationStatus === "approved"
        ? "✅ VERIFICATION APPROVED — STORED DECISION"
        : verificationStatus === "rejected"
          ? "❌ VERIFICATION REJECTED"
          : verificationStatus === "resubmission_required"
            ? "⚠️ NEW DOCUMENTS REQUIRED"
            : "⚠️ MANUAL REVIEW REQUIRED";
    telegramText = `${heading}\n\n${common}\n\nStored verification status: ${verificationStatus.replaceAll("_", " ")}\nReview the saved decision and documents in Admin. No automatic approval is inferred.`;
  }
  if (p.delivery || p.collection)
    telegramText += `\n\nDELIVERY & COLLECTION\nDelivery: ${p.delivery ? clean(`${p.delivery.areaName ?? ""} · ${p.delivery.address}`, 500) : "Self pickup"}\nCollection: ${p.collection ? clean(`${p.collection.areaName ?? ""} · ${p.collection.address}`, 500) : "Self return"}\nDelivery fee: ${php(p.deliveryFeeCentavos ?? 0)}\nCollection fee: ${php(p.collectionFeeCentavos ?? 0)}\nRefundable cash deposit: ${php(p.depositCentavos ?? 0)}`;
  return {
    telegramText: telegramText.slice(0, 4000),
    telegramAdminUrl: adminUrl,
  };
}
