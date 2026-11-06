import { DownloadRentalContract } from "@/components/download-rental-contract";
import { normalizeMotorcycleColor } from "@/lib/motorcycle-color";
import { ManualBookingManagement } from "@/components/manual-booking-management";
import { getLivePaymentContext } from "@/services/live-payment-status";
import { BookingPaymentReview } from "@/components/booking-payment-review";
import { getBookingServices } from "@/services/booking-services";
import { BookingServiceDetails } from "@/components/booking-service-details";
import { RentalOperations } from "@/components/rental-operations";
import { rentalDuration } from "@/lib/rental-duration";
import { rentalPricingRows } from "@/lib/rental-pricing";
export const instant = false;
import { connection } from "next/server";
import {
  verificationLabel,
  verificationQueueStatus,
} from "@/lib/verification-display";
import { Bike } from "lucide-react";
import { BookingDepositPanel } from "@/components/booking-deposit-panel";
import { businessDateTimeInput } from "@/lib/business-time";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { checkedQueries } from "@/lib/query-results";
import { Panel, StatusBadge, formatDate } from "@/components/admin-ui";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import {
  recordPickupInstructions,
  confirmBooking,
  rescheduleBooking,
  transitionBooking,
  recordOfflinePayment,
  recordPaymentAdjustment,
} from "@/app/actions/bookings";
import Image from "next/image";
import {
  BookingActionDialog,
  ManageBookingButton,
} from "@/components/booking-action-dialog";
import { getSecurityDepositView } from "@/services/security-deposits";
import { depositBalance } from "@/lib/deposit-balances";
import { requireAdmin } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm-button";
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    reviewed?: string;
    updated?: string;
    payment?: string;
    inspection?: string;
  }>;
}) {
  await connection();
  const { id } = await params,
    flash = await searchParams,
    { supabase } = await requireAdmin();
  const { data: b, error: bookingQueryError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (bookingQueryError) throw new Error("Booking could not be loaded.");
  if (!b) notFound();
  const [
    { data: c },
    { data: m },
    { data: v },
    { data: history },
    { data: units },
    { data: holds },
    { data: extras },
    { data: paymentEvents },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", b.customer_id).single(),
    supabase
      .from("motorcycle_models")
      .select("id,display_name")
      .eq("id", b.motorcycle_model_id ?? "")
      .maybeSingle(),
    supabase
      .from("customer_verifications")
      .select("*")
      .eq("booking_id", id)
      .maybeSingle(),
    supabase
      .from("booking_status_history")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("motorcycle_units")
      .select("id,internal_unit_code,registration_plate,color,status")
      .eq("motorcycle_model_id", b.motorcycle_model_id ?? "")
      .is("archived_at", null),
    supabase.from("booking_inventory_holds").select("*").eq("booking_id", id),
    supabase
      .from("booking_extra_items")
      .select("*")
      .eq("booking_id", id)
      .order("created_at"),
    supabase
      .from("payment_events")
      .select("*")
      .eq("booking_id", id)
      .order("occurred_at", { ascending: false }),
  ]).then(checkedQueries);
  const paidCentavos = (paymentEvents ?? []).reduce(
    (sum, event) =>
      sum +
      (event.event_type === "payment"
        ? event.amount_centavos
        : -event.amount_centavos),
    0,
  );
  const balanceCentavos = Math.max(0, b.total_centavos - paidCentavos);
  const refundedCentavos = (paymentEvents ?? [])
    .filter((event) => event.event_type !== "payment")
    .reduce((sum, event) => sum + event.amount_centavos, 0);
  const paymentStatus =
    refundedCentavos > 0
      ? paidCentavos <= 0
        ? "Refunded"
        : "Partially refunded"
      : paidCentavos <= 0
        ? "Unpaid"
        : balanceCentavos
          ? "Partially paid"
          : "Paid";
  const money = (centavos: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(centavos / 100);
  const unit = units?.find((item) => item.id === b.motorcycle_unit_id);
  const [
    depositData,
    { data: media },
    { data: conflicts },
    { data: reviews },
    { data: documentUploads },
    { data: otherHolds },
    { data: maintenance },
  ] = await Promise.all([
    getSecurityDepositView(id),
    supabase
      .from("motorcycle_media")
      .select("storage_path,is_primary,sort_order")
      .eq("motorcycle_model_id", b.motorcycle_model_id ?? "")
      .order("is_primary", { ascending: false })
      .order("sort_order"),
    supabase
      .from("bookings")
      .select("id,motorcycle_unit_id")
      .neq("id", id)
      .in("status", ["pending", "confirmed", "active"])
      .lt("start_at", b.end_at)
      .gt("end_at", b.start_at),
    v
      ? supabase
          .from("verification_reviews")
          .select("*")
          .eq("verification_id", v.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    v
      ? supabase
          .from("verification_documents")
          .select("id,document_kind,created_at")
          .eq("verification_id", v.id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("booking_inventory_holds")
      .select("motorcycle_unit_id")
      .neq("booking_id", id)
      .is("released_at", null)
      .is("converted_at", null)
      .gt("expires_at", new Date().toISOString())
      .lt("start_at", b.end_at)
      .gt("end_at", b.start_at),
    supabase
      .from("motorcycle_unavailability")
      .select("motorcycle_unit_id")
      .lt("start_at", b.end_at)
      .gt("end_at", b.start_at),
  ]).then((results) => {
    checkedQueries([
      results[1],
      results[2],
      results[3],
      results[4],
      results[5],
      results[6],
    ]);
    return results;
  });
  const eligibleUnits = (units ?? []).filter(
    (u) =>
      u.status === "available" &&
      (!b.selected_color ||
        normalizeMotorcycleColor(u.color ?? "") ===
          normalizeMotorcycleColor(b.selected_color)) &&
      ![
        ...(conflicts ?? []),
        ...(otherHolds ?? []),
        ...(maintenance ?? []),
      ].some((conflict) => conflict.motorcycle_unit_id === u.id),
  );
  const photo = media?.[0]
    ? supabase.storage
        .from("motorcycle-catalog")
        .getPublicUrl(media[0].storage_path).data.publicUrl
    : null;
  const service = (await getBookingServices([id]))[0];
  const onlinePayment = await getLivePaymentContext(id);
  const requirement = depositData.requirements[0];
  const deposit = requirement
    ? depositBalance(requirement, depositData.events)
    : null;
  const depositReady =
    !!requirement &&
    !!deposit &&
    !deposit.unresolved &&
    (requirement.option === "cash"
      ? deposit.held >= requirement.required_centavos
      : deposit.custody > 0);
  const identityReady = v?.identity_status === "approved";
  const licenseReady =
    v?.license_status === "approved" &&
    v?.entitlement_status === "approved" &&
    ["approved", "not_applicable"].includes(v?.international_status ?? "");
  const handover = depositData.inspections.find((i) => i.kind === "handover");
  const returned = depositData.inspections.find((i) => i.kind === "return");
  const terminal = ["completed", "cancelled", "rejected", "expired"].includes(
    b.status,
  );
  const depositDue =
    requirement?.option === "cash" && deposit
      ? Math.max(0, requirement.required_centavos - deposit.held)
      : requirement?.option === "eligible_id"
        ? 0
        : null;
  const pickupCash = depositDue === null ? null : balanceCentavos + depositDue;
  const nextAction = terminal
    ? `Booking ${b.status}`
    : b.status === "active"
      ? returned
        ? "Return the deposit or resolve its case, then complete the rental."
        : "Record the return inspection when the motorcycle comes back."
      : !b.motorcycle_unit_id
        ? "Assign an eligible motorcycle and confirm the booking."
        : !identityReady || !licenseReady || v?.overall_status !== "approved"
          ? "Review the customer’s identity and driving documents."
          : balanceCentavos > 0
            ? "Record the rental payment after receiving it."
            : !depositReady
              ? "Record the required security deposit or ID custody."
              : b.status !== "confirmed"
                ? "Confirm the booking."
                : "Open handover to complete the required pickup checks.";
  const progressStep =
    b.status === "completed"
      ? 4
      : returned || b.returned_at
        ? 3
        : b.status === "active" || handover || b.handover_at
          ? 2
          : b.status === "confirmed"
            ? 1
            : 0;
  const timeline = [
    {
      id: "created",
      at: b.created_at,
      title: "Booking created",
      detail: b.booking_reference,
    },
    ...(history ?? []).map((h) => ({
      id: h.id,
      at: h.created_at,
      title: `${h.old_status ?? "New"} → ${h.new_status}`,
      detail: "",
    })),
    ...(paymentEvents ?? []).map((e) => ({
      id: e.id,
      at: e.occurred_at,
      title: `Rental ${e.event_type.replaceAll("_", " ")}`,
      detail: `${money(e.amount_centavos)} · ${e.method.replaceAll("_", " ")}`,
    })),
    ...(deposit?.events ?? []).map((e) => ({
      id: e.id,
      at: e.occurred_at,
      title: e.event_type.replaceAll("_", " "),
      detail: `${money(e.amount_centavos)}${e.notes ? ` · ${e.notes}` : ""}`,
    })),
    ...depositData.inspections.map((i) => ({
      id: i.id,
      at: i.occurred_at,
      title: `${i.kind} inspection`,
      detail: i.condition_notes,
    })),
    ...(documentUploads ?? []).map((d) => ({
      id: d.id,
      at: d.created_at,
      title: `Document uploaded · ${d.document_kind.replaceAll("_", " ")}`,
      detail: "",
    })),
    ...(reviews ?? [])
      .filter((r) => r.review_type !== "document_access")
      .map((r) => ({
        id: r.id,
        at: r.created_at,
        title: `${r.review_type.replaceAll("_", " ")} · ${verificationLabel(r.result)}`,
        detail: r.reason ?? "",
      })),
  ]
    .filter((event) => event.at)
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href="/dashboard/bookings"
        className="inline-flex min-h-9 items-center text-sm font-bold text-ocean"
      >
        ← All bookings
      </Link>
      {(flash.reviewed ||
        flash.updated ||
        flash.payment ||
        flash.inspection) && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800"
        >
          {flash.inspection === "handover"
            ? "Motorcycle successfully handed over."
            : flash.inspection === "return"
              ? "Motorcycle return inspection saved. Deposit refund remains separate."
              : "Booking record updated successfully."}
        </p>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative grid size-16 shrink-0 sm:size-20 place-items-center overflow-hidden rounded-xl bg-slate-50 text-ocean">
            {photo ? (
              <Image
                src={photo}
                alt={m?.display_name ?? "Booked motorcycle"}
                fill
                sizes="80px"
                className="object-contain"
              />
            ) : (
              <Bike size={32} />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-ocean">
              {b.booking_reference}
            </p>
            <h1 className="mt-1 text-lg! font-extrabold text-deep-teal sm:text-xl!">
              {m?.display_name ?? "Motorcycle booking"}
            </h1>
            <p className="text-sm text-slate-600">
              {c?.full_name ?? "Customer"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge value={b.status} />
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
              >
                {paymentStatus}
              </span>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 items-center gap-3 text-xs sm:w-auto lg:flex lg:gap-5">
          <div>
            <p className="text-slate-500">Pickup · Manila</p>
            <p className="mt-1 font-bold text-deep-teal">
              {formatDate(b.start_at)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Return · Manila</p>
            <p className="mt-1 font-bold text-deep-teal">
              {formatDate(b.end_at)}
            </p>
          </div>
          <DownloadRentalContract
            bookingId={id}
            reference={b.booking_reference}
          />
          <ManageBookingButton />
        </div>
      </header>
      <ol
        aria-label="Rental progress"
        className="flex flex-wrap gap-x-5 gap-y-2 px-1 text-xs"
      >
        {["Booked", "Confirmed", "Handed over", "Returned", "Completed"].map(
          (label, index) => (
            <li
              key={label}
              aria-current={
                (!terminal && index === progressStep) ||
                (b.status === "completed" && index === 4)
                  ? "step"
                  : undefined
              }
              className={`flex items-center gap-2 ${index <= progressStep ? "font-bold text-deep-teal" : "text-slate-400"}`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full ${index <= progressStep ? "bg-teal-100" : "bg-slate-100"}`}
              >
                {index < progressStep ? "✓" : index + 1}
              </span>
              {label}
              {index < 4 && (
                <span aria-hidden="true" className="ml-2 text-slate-300">
                  →
                </span>
              )}
            </li>
          ),
        )}
      </ol>
      <ManualBookingManagement bookingId={id} edit={flash.tab === "manual"} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="divide-y divide-slate-100 rounded-2xl bg-white px-5 shadow-sm">
          <section className="py-5">
            <SectionTitle>Payment</SectionTitle>
            {rentalPricingRows(b.rental_pricing).length > 0 && (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {rentalPricingRows(b.rental_pricing).map(([label, value]) => (
                  <Info key={label} k={label} v={value} />
                ))}
              </dl>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
              <Info k="Rental total" v={money(b.total_centavos)} />
              <Info k="Amount paid" v={money(paidCentavos)} />
              <Info k="Balance due" v={money(balanceCentavos)} />
            </dl>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info
                k="Payment method"
                v={
                  (paymentEvents ?? []).some((e) => e.event_type === "payment")
                    ? [
                        ...new Set(
                          (paymentEvents ?? [])
                            .filter((e) => e.event_type === "payment")
                            .map((e) => e.method.replaceAll("_", " ")),
                        ),
                      ].join(", ")
                    : "Cash on Pickup · not received"
                }
              />
              <Info
                k="Refundable security deposit"
                v={
                  requirement
                    ? requirement.option === "cash"
                      ? money(requirement.required_centavos)
                      : `Eligible physical ID · ${requirement.document_type ?? "See arrangement"}`
                    : depositData.available
                      ? "No requirement recorded"
                      : "Unavailable"
                }
              />
              <Info
                k="Deposit collected / returned"
                v={deposit?.status ?? "Not recorded"}
              />
              <Info
                k="Cash required at pickup"
                v={
                  terminal || b.status === "active"
                    ? "See outstanding balance"
                    : pickupCash === null
                      ? `${money(balanceCentavos)} rental + deposit not recorded`
                      : money(pickupCash)
                }
              />
            </dl>
            {service && (
              <p className="mt-3 text-sm">
                Delivery fee: {money(service.delivery_fee_centavos)} ·
                Collection fee: {money(service.collection_fee_centavos)}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Refundable deposits are held separately from rental payments.
            </p>
          </section>
          <section className="py-5">
            <SectionTitle>Customer</SectionTitle>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info k="Name" v={c?.full_name ?? "Not recorded"} />
              <Info k="Phone" v={c?.phone ?? "Not recorded"} />
              <Info k="Email" v={c?.email ?? "Not recorded"} />
              <Info k="Country" v={c?.country_of_residence ?? "Not recorded"} />
            </dl>
          </section>
          <section className="py-5">
            <SectionTitle>Rental</SectionTitle>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info k="Motorcycle" v={m?.display_name ?? "Not recorded"} />
              <Info
                k="Selected color"
                v={b.selected_color ?? "No color preference recorded"}
              />
              <Info
                k="License plate"
                v={unit?.registration_plate ?? "Not configured / not assigned"}
              />
              <Info
                k="Assigned unit"
                v={
                  unit?.internal_unit_code ??
                  (b.motorcycle_unit_id
                    ? "Assigned unit details unavailable"
                    : "Motorcycle not assigned.")
                }
              />
              <Info k="Pickup · Manila" v={formatDate(b.start_at)} />
              <Info k="Return · Manila" v={formatDate(b.end_at)} />
              <Info
                k="Rental duration"
                v={
                  rentalDuration(b.start_at, b.end_at)?.label ??
                  "See rental dates"
                }
              />
              <Info
                k="Handover / return"
                v={`${b.handover_at ? formatDate(b.handover_at) : "Not handed over"} / ${returned?.occurred_at ? formatDate(returned.occurred_at) : b.returned_at ? formatDate(b.returned_at) : "Not returned"}`}
              />
            </dl>
          </section>
          <BookingPaymentReview bookingId={id} />
          <BookingServiceDetails
            data={service}
            handedOver={!!b.handover_at}
            returned={!!returned}
          />
        </div>
        <aside className="space-y-4">
          <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p className="font-bold">Handover & return motorcycle</p>
            <p className="mt-2">
              {m?.display_name ?? "Motorcycle"} · Selected color:{" "}
              {b.selected_color ?? "Not specified"}
            </p>
            <p className="mt-1">
              Plate:{" "}
              {unit?.registration_plate ?? "Not configured / not assigned"}
            </p>
          </section>
          <RentalOperations
            bookingId={id}
            status={b.status}
            version={b.rental_workflow_version ?? 0}
            balanceCentavos={balanceCentavos}
            paymentLocked={!!onlinePayment}
            data={depositData}
            delivery={!!service?.delivery}
            collection={!!service?.collection}
          />
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <SectionTitle>Next step</SectionTitle>
            <p className="mt-2 text-sm font-bold leading-relaxed text-deep-teal">
              {nextAction}
            </p>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Identity verification
              </p>
              <p className="mt-1 text-sm font-bold text-deep-teal">
                {v
                  ? verificationLabel(verificationQueueStatus(v))
                  : "Not submitted"}
              </p>
              <Link
                className="admin-text-link mt-2 inline-flex min-h-10 items-center"
                href={
                  v
                    ? `/dashboard/verifications/${v.id}`
                    : "/dashboard/verifications"
                }
              >
                View verification →
              </Link>
            </div>
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <SectionTitle>Rental readiness</SectionTitle>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                { label: "Motorcycle assigned", ready: !!b.motorcycle_unit_id },
                { label: "Identity approved", ready: identityReady },
                { label: "License eligibility approved", ready: licenseReady },
                { label: "Rental paid in full", ready: balanceCentavos === 0 },
                { label: "Deposit recorded", ready: depositReady },
                {
                  label: "Handover recorded",
                  ready: !!(handover || b.handover_at),
                },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{item.label}</span>
                  <span
                    className={
                      item.ready
                        ? "font-bold text-emerald-700"
                        : "text-amber-800"
                    }
                  >
                    {item.ready ? "✓ Yes" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Final handover checks run when you submit the inspection.
            </p>
          </section>
          <section
            id="booking-quick-actions"
            tabIndex={-1}
            aria-label="Booking quick actions"
            className="space-y-2 rounded-2xl bg-white p-5 shadow-sm outline-ocean"
          >
            <SectionTitle>Quick actions</SectionTitle>
            {["pending", "submitted"].includes(b.status) && (
              <BookingActionDialog
                label={
                  b.motorcycle_unit_id
                    ? "Confirm booking"
                    : "Assign motorcycle & confirm"
                }
                disabled={!eligibleUnits.length}
                primary
              >
                <p className="mb-3 text-xs text-slate-500">
                  Available units for this rental period. The server checks
                  conflicts again before saving.
                </p>
                <ActionForm action={confirmBooking} className="space-y-3">
                  <input type="hidden" name="bookingId" value={id} />
                  <select
                    required
                    aria-label="Assign available physical motorcycle unit"
                    name="unitId"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Select available unit</option>
                    {eligibleUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.registration_plate || u.internal_unit_code}
                        {u.color ? ` · ${u.color}` : ""}
                      </option>
                    ))}
                  </select>
                  <ConfirmButton
                    message="Confirm this booking and assign the selected physical motorcycle?"
                    className="w-full rounded-xl bg-ocean px-4 py-3 text-sm font-bold text-white"
                  >
                    Confirm booking
                  </ConfirmButton>
                </ActionForm>
              </BookingActionDialog>
            )}
            {["pending", "submitted"].includes(b.status) &&
              !eligibleUnits.length && (
                <p className="text-xs text-amber-800">
                  No eligible unit is currently available for these dates.
                </p>
              )}
            {balanceCentavos > 0 &&
              !["cancelled", "rejected", "expired"].includes(b.status) && (
                <details>
                  <summary className="cursor-pointer py-3 text-sm font-bold text-ocean">
                    Advanced rental payment
                  </summary>
                  <BookingActionDialog label="Record partial or alternative payment">
                    <Panel title="Record a payment">
                      <ActionForm
                        action={recordOfflinePayment}
                        className="space-y-3"
                      >
                        <input type="hidden" name="bookingId" value={id} />
                        <input
                          type="hidden"
                          name="idempotencyKey"
                          value={randomUUID()}
                        />
                        <label className="block text-xs font-bold text-deep-teal">
                          Amount (PHP)
                          <input
                            required
                            name="amountPhp"
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={(balanceCentavos / 100).toFixed(2)}
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                          />
                        </label>
                        <label className="block text-xs font-bold text-deep-teal">
                          Method
                          <select
                            name="method"
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                          >
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">
                              Verified bank transfer
                            </option>
                            <option value="other_offline">
                              Other approved offline method
                            </option>
                          </select>
                        </label>
                        <label className="block text-xs font-bold text-deep-teal">
                          Transaction reference
                          <input
                            name="transactionReference"
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                          />
                        </label>
                        <label className="block text-xs font-bold text-deep-teal">
                          Payment date (Asia/Manila)
                          <input
                            required
                            name="paidAt"
                            type="datetime-local"
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                          />
                        </label>
                        <label className="block text-xs font-bold text-deep-teal">
                          Internal notes
                          <textarea
                            name="notes"
                            className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3"
                          />
                        </label>
                        <ConfirmButton
                          message="Record this cash payment only after verifying the money was actually received?"
                          className="w-full rounded-xl bg-deep-teal px-4 py-3 text-sm font-bold text-white"
                        >
                          Record payment
                        </ConfirmButton>
                      </ActionForm>
                      <p className="mt-3 text-xs text-slate-400">
                        Record only money that has actually been received and
                        verified.
                      </p>
                    </Panel>
                  </BookingActionDialog>
                </details>
              )}
            {requirement && (
              <details>
                <summary className="cursor-pointer py-3 text-sm font-bold text-ocean">
                  Advanced deposit options
                </summary>
                <BookingActionDialog
                  label={
                    deposit && (deposit.held > 0 || deposit.custody > 0)
                      ? "Manage deposit / approved deductions"
                      : "Manual deposit or custody event"
                  }
                >
                  <BookingDepositPanel
                    bookingId={id}
                    status={b.status}
                    version={b.rental_workflow_version}
                    section="payments"
                    data={depositData}
                  />
                </BookingActionDialog>
              </details>
            )}
            {actionsFor(b.status)
              .filter(
                (action) =>
                  b.rental_workflow_version !== 9 ||
                  !["active", "completed"].includes(action.status),
              )
              .map((action) => (
                <BookingActionDialog key={action.status} label={action.label}>
                  <ActionForm action={transitionBooking} className="space-y-3">
                    <input type="hidden" name="bookingId" value={id} />
                    <input type="hidden" name="status" value={action.status} />
                    {["cancelled", "rejected"].includes(action.status) && (
                      <label className="block text-sm font-bold">
                        Reason
                        <textarea
                          name="reason"
                          required
                          maxLength={2000}
                          rows={3}
                          className="mt-1 w-full rounded-lg border p-3"
                        />
                      </label>
                    )}
                    <ConfirmButton
                      message={`${action.label}? Confirm the booking details before saving this change.`}
                      className="admin-button w-full"
                    >
                      Confirm {action.label.toLowerCase()}
                    </ConfirmButton>
                  </ActionForm>
                </BookingActionDialog>
              ))}
            {["confirmed", "active"].includes(b.status) && (
              <BookingActionDialog
                label={
                  b.status === "active" ? "Extend rental" : "Reschedule booking"
                }
              >
                <ActionForm action={rescheduleBooking} className="space-y-3">
                  <input type="hidden" name="bookingId" value={id} />
                  <label className="block text-xs font-bold text-deep-teal">
                    Pickup (Asia/Manila)
                    <input
                      required
                      name="startAt"
                      type="datetime-local"
                      defaultValue={businessDateTimeInput(b.start_at)}
                      readOnly={b.status === "active"}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                    />
                  </label>
                  <label className="block text-xs font-bold text-deep-teal">
                    Return (Asia/Manila)
                    <input
                      required
                      name="endAt"
                      type="datetime-local"
                      defaultValue={businessDateTimeInput(b.end_at)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                    />
                  </label>
                  <input
                    type="hidden"
                    aria-label="Assign available physical motorcycle unit"
                    name="unitId"
                    value={b.motorcycle_unit_id ?? ""}
                  />
                  <SubmitButton
                    unstyled
                    className="w-full rounded-xl border border-ocean px-4 py-2.5 text-sm font-bold text-ocean"
                  >
                    Check conflicts and save
                  </SubmitButton>
                </ActionForm>
              </BookingActionDialog>
            )}
            {b.status === "confirmed" && (
              <BookingActionDialog label="Pickup instructions">
                <ActionForm
                  action={recordPickupInstructions}
                  className="space-y-3"
                >
                  <input type="hidden" name="bookingId" value={b.id} />
                  <label className="block">
                    Pickup location
                    <input
                      name="location"
                      required
                      maxLength={1000}
                      className="mt-1 w-full rounded-lg border p-3"
                    />
                  </label>
                  <label className="block">
                    Instructions
                    <textarea
                      name="instructions"
                      required
                      maxLength={2000}
                      className="mt-1 w-full rounded-lg border p-3"
                    />
                  </label>
                  <SubmitButton>Save pickup instructions</SubmitButton>
                </ActionForm>
              </BookingActionDialog>
            )}
            {(paymentEvents ?? []).some(
              (event) => event.event_type === "payment",
            ) && (
              <BookingActionDialog label="Advanced: refund or correct rental payment">
                <Panel title="Refund or reverse payment">
                  <ActionForm
                    action={recordPaymentAdjustment}
                    className="space-y-3"
                  >
                    <input type="hidden" name="bookingId" value={id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <label className="block text-xs font-bold text-deep-teal">
                      Original payment
                      <select
                        required
                        name="originalPaymentEventId"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      >
                        {paymentEvents
                          ?.filter((event) => event.event_type === "payment")
                          .map((event) => (
                            <option key={event.id} value={event.id}>
                              ₱{(event.amount_centavos / 100).toFixed(2)} ·{" "}
                              {event.transaction_reference ??
                                event.id.slice(0, 8)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Operation
                      <select
                        name="operation"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      >
                        <option value="refund">
                          Refund (money returned separately)
                        </option>
                        <option value="reversal">Reverse invalid record</option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Amount (PHP)
                      <input
                        required
                        name="amountPhp"
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Method
                      <select
                        name="method"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">
                          Verified bank transfer
                        </option>
                        <option value="other_offline">
                          Other approved offline method
                        </option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Transaction reference
                      <input
                        required
                        name="transactionReference"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Date (Asia/Manila)
                      <input
                        required
                        name="occurredAt"
                        type="datetime-local"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
                      />
                    </label>
                    <label className="block text-xs font-bold text-deep-teal">
                      Required reason
                      <textarea
                        required
                        minLength={5}
                        name="reason"
                        className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3"
                      />
                    </label>
                    <ConfirmButton
                      message="Record this refund or reversal after verifying the offline adjustment? Financial events cannot be edited."
                      className="w-full admin-button admin-danger"
                    >
                      Record financial adjustment
                    </ConfirmButton>
                  </ActionForm>
                  <p className="mt-3 text-xs text-slate-400">
                    This records an internal event only. It does not move money
                    or contact a bank.
                  </p>
                </Panel>
              </BookingActionDialog>
            )}
          </section>
        </aside>
      </div>
      <div className="divide-y divide-slate-200 rounded-2xl bg-white px-5">
        <details>
          <summary className="cursor-pointer py-4 text-sm font-bold text-deep-teal">
            Payment history · {paymentEvents?.length ?? 0} events
          </summary>
          <ul className="divide-y divide-slate-100 pb-4 text-sm">
            {paymentEvents?.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                <div>
                  <strong className="capitalize">
                    {event.event_type} · {event.method.replaceAll("_", " ")}
                  </strong>
                  <p className="text-xs text-slate-500">
                    {event.transaction_reference ?? "No reference"} ·{" "}
                    {formatDate(event.occurred_at)}
                  </p>
                </div>
                <span className="font-bold text-deep-teal">
                  {money(event.amount_centavos)}
                </span>
              </li>
            ))}
          </ul>
          {!paymentEvents?.length && (
            <p className="pb-4 text-sm text-slate-500">
              No rental payments recorded.
            </p>
          )}
        </details>
        <details>
          <summary className="cursor-pointer py-4 text-sm font-bold text-deep-teal">
            Extras & booking details
          </summary>
          <div className="space-y-3 pb-4 text-sm">
            <p>
              Rental subtotal: {money(b.base_total_php * 100)} · Extras:{" "}
              {money(b.extras_total_php * 100)}
            </p>
            {extras?.length ? (
              extras.map((extra) => (
                <p key={extra.id}>
                  {extra.quantity}× {extra.name_snapshot} ·{" "}
                  {money(extra.line_total_centavos)}
                </p>
              ))
            ) : (
              <p>No extras selected.</p>
            )}
            <p>
              Expires:{" "}
              {b.expires_at ? formatDate(b.expires_at) : "Not applicable"}
            </p>
            <p>Booking notes: {b.status_reason ?? "None"}</p>
            {holds?.map((hold) => (
              <p key={hold.id}>
                Reservation hold:{" "}
                {hold.released_at
                  ? "Released"
                  : hold.converted_at
                    ? "Converted"
                    : `Until ${formatDate(hold.expires_at)}`}
              </p>
            ))}
          </div>
        </details>
        <details>
          <summary className="cursor-pointer py-4 text-sm font-bold text-deep-teal">
            Booking history · Asia/Manila
          </summary>
          <ol className="space-y-3 border-l-2 border-teal-100 pb-4 pl-4">
            {timeline.map((event) => (
              <li key={event.id} className="text-sm">
                <strong className="capitalize text-deep-teal">
                  {event.title}
                </strong>
                <p className="text-xs text-slate-500">{formatDate(event.at)}</p>
                {event.detail && (
                  <details className="mt-1 text-xs text-slate-600">
                    <summary className="cursor-pointer text-ocean">
                      Details
                    </summary>
                    <p className="mt-1">{event.detail}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </details>
        <details>
          <summary className="cursor-pointer py-4 text-sm font-bold text-deep-teal">
            Rental inspections & deposit activity
          </summary>
          <BookingDepositPanel
            bookingId={id}
            status={b.status}
            version={b.rental_workflow_version}
            section="history"
            data={depositData}
          />
        </details>
        <details>
          <summary className="cursor-pointer py-4 text-sm font-bold text-deep-teal">
            Verification history
          </summary>
          <ul className="space-y-3 pb-4 text-xs">
            {reviews?.map((review) => (
              <li key={review.id}>
                <strong>
                  {review.review_type === "document_access"
                    ? "Private document viewed"
                    : `${review.review_type} · ${verificationLabel(review.result)}`}
                </strong>
                <p>{review.reason}</p>
                <p className="text-slate-500">
                  {formatDate(review.created_at)}
                </p>
              </li>
            ))}
          </ul>
          {!reviews?.length && (
            <p className="pb-4 text-xs text-slate-500">
              No verification review records.
            </p>
          )}
        </details>
      </div>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-1 break-words font-semibold text-deep-teal">{v}</dd>
    </div>
  );
}
function actionsFor(status: string) {
  if (["submitted", "pending"].includes(status))
    return [
      { status: "rejected", label: "Reject request" },
      { status: "cancelled", label: "Cancel booking" },
    ];
  if (status === "confirmed")
    return [
      { status: "active", label: "Record handover" },
      { status: "cancelled", label: "Cancel booking" },
    ];
  if (status === "active")
    return [{ status: "completed", label: "Record return and complete" }];
  return [];
}
