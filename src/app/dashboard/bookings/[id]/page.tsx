import { VerificationReview } from "@/components/verification-review";
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
  confirmBooking,
  rescheduleBooking,
  transitionBooking,
  recordOfflinePayment,
  recordPaymentAdjustment,
} from "@/app/actions/bookings";
import { requireAdmin } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm-button";
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    reviewed?: string;
    updated?: string;
    payment?: string;
  }>;
}) {
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
    { data: docs },
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
      .from("verification_documents")
      .select("*")
      .eq("booking_id", id)
      .order("created_at"),
    supabase
      .from("booking_status_history")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("motorcycle_units")
      .select("id,internal_unit_code,status")
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
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/bookings" className="text-sm font-bold text-ocean">
        ← Bookings
      </Link>
      {(flash.reviewed || flash.updated || flash.payment) && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700"
        >
          Booking record updated.
        </p>
      )}
      <header className="admin-booking-summary">
        <p className="text-xs font-bold tracking-wider text-ocean uppercase">
          {b.booking_reference}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{m?.display_name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {c?.full_name} · {c?.customer_type?.replaceAll("_", " ")}
            </p>
          </div>
          <StatusBadge value={b.status} />
        </div>
      </header>
      <div className="admin-booking-layout">
        <div className="space-y-6">
          <Panel title="Rental overview">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info k="Pickup" v={formatDate(b.start_at)} />
              <Info k="Return" v={formatDate(b.end_at)} />
              <Info
                k="Total price snapshot"
                v={`₱${b.quoted_total_php.toLocaleString("en-PH")}`}
              />
              <Info
                k="Rental subtotal"
                v={`₱${b.base_total_php.toLocaleString("en-PH")}`}
              />
              <Info
                k="Extras subtotal"
                v={`₱${b.extras_total_php.toLocaleString("en-PH")}`}
              />
              <Info
                k="Expires"
                v={b.expires_at ? formatDate(b.expires_at) : "Not applicable"}
              />
              <Info k="Status reason" v={b.status_reason ?? "—"} />
            </dl>
          </Panel>
          <Panel title="Customer">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info k="Name" v={c?.full_name ?? "—"} />
              <Info k="Mobile" v={c?.phone ?? "—"} />
              <Info k="Email" v={c?.email ?? "—"} />
              <Info k="Country" v={c?.country_of_residence ?? "—"} />
            </dl>
          </Panel>
          <Panel title="Extras & inventory holds">
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Selected extras
              </p>
              {extras?.length ? (
                <ul className="mt-2 space-y-2">
                  {extras.map((extra) => (
                    <li
                      key={extra.id}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="font-semibold text-deep-teal">
                        {extra.quantity}× {extra.name_snapshot}
                      </span>
                      <span className="font-bold text-ocean">
                        ₱
                        {(extra.line_total_centavos / 100).toLocaleString(
                          "en-PH",
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No extras selected.
                </p>
              )}
            </div>
            {holds?.map((hold) => (
              <p
                key={hold.id}
                className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"
              >
                Inventory hold:{" "}
                {hold.released_at
                  ? "released"
                  : hold.converted_at
                    ? "converted"
                    : `active until ${formatDate(hold.expires_at)}`}
              </p>
            ))}
          </Panel>
          <Panel title="Payments">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Info k="Status" v={paymentStatus} />
              <Info
                k="Verified paid"
                v={`₱${(paidCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              />
              <Info
                k="Outstanding"
                v={`₱${(balanceCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              />
            </dl>
            <ul className="mt-4 divide-y divide-slate-100">
              {paymentEvents?.map((event) => (
                <li
                  key={event.id}
                  className="flex justify-between gap-4 py-3 text-xs"
                >
                  <span>
                    <strong className="text-deep-teal">
                      {event.event_type.toUpperCase()} ·{" "}
                      {event.method.replaceAll("_", " ")}
                    </strong>
                    <br />
                    <span className="text-slate-400">
                      {event.transaction_reference ?? "No reference"} ·{" "}
                      {formatDate(event.occurred_at)}
                    </span>
                  </span>
                  <span className="font-bold text-ocean">
                    ₱
                    {(event.amount_centavos / 100).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <VerificationReview
            verification={v}
            documents={docs ?? []}
            bookingId={id}
          />
          <Panel title="Handover & return">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info
                k="Handover recorded"
                v={b.handover_at ? formatDate(b.handover_at) : "Not recorded"}
              />
              <Info
                k="Return recorded"
                v={b.returned_at ? formatDate(b.returned_at) : "Not recorded"}
              />
            </dl>
          </Panel>
          <Panel title="Activity history">
            {!history?.length && (
              <p className="admin-note">No status changes recorded.</p>
            )}
            <ul className="divide-y divide-slate-100">
              {history?.map((h) => (
                <li key={h.id} className="flex justify-between py-3 text-xs">
                  <span className="font-bold text-deep-teal">
                    {h.old_status ?? "new"} → {h.new_status}
                  </span>
                  <time className="text-slate-400">
                    {formatDate(h.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <aside className="space-y-5">
          {balanceCentavos > 0 && (
            <Panel title="Record verified payment">
              <ActionForm action={recordOfflinePayment} className="space-y-3">
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
                <SubmitButton
                  unstyled
                  className="w-full rounded-xl bg-deep-teal px-4 py-3 text-sm font-bold text-white"
                >
                  Record verified offline payment
                </SubmitButton>
              </ActionForm>
              <p className="mt-3 text-xs text-slate-400">
                Customer claims cannot create verified payment events.
              </p>
            </Panel>
          )}
          {(paymentEvents ?? []).some(
            (event) => event.event_type === "payment",
          ) && (
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
                          {event.transaction_reference ?? event.id.slice(0, 8)}
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
                This records an internal event only. It does not move money or
                contact a bank.
              </p>
            </Panel>
          )}
          <Panel title="Booking actions">
            {["submitted", "pending"].includes(b.status) && (
              <ActionForm action={confirmBooking} className="space-y-3">
                <input type="hidden" name="bookingId" value={id} />
                <select
                  required
                  aria-label="Assign available physical motorcycle unit"
                  name="unitId"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                >
                  <option value="">Select available unit</option>
                  {units
                    ?.filter((u) => u.status === "available")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.internal_unit_code}
                      </option>
                    ))}
                </select>
                <ConfirmButton
                  message="Confirm this verified booking and assign the selected physical motorcycle?"
                  className="w-full rounded-xl bg-ocean px-4 py-3 text-sm font-bold text-white"
                >
                  Confirm booking
                </ConfirmButton>
              </ActionForm>
            )}
            <div className="mt-3 grid gap-2">
              {actionsFor(b.status)
                .filter(
                  (action) =>
                    b.rental_workflow_version !== 9 ||
                    !["active", "completed"].includes(action.status),
                )
                .map((a) => (
                  <ActionForm
                    action={transitionBooking}
                    key={a.status}
                    className="space-y-2"
                  >
                    <input type="hidden" name="bookingId" value={id} />
                    <input type="hidden" name="status" value={a.status} />
                    {["rejected", "cancelled"].includes(a.status) && (
                      <textarea
                        required
                        name="reason"
                        placeholder="Required reason"
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                      />
                    )}
                    <ConfirmButton
                      message={`${a.label}? Confirm the rental details before recording this status change.`}
                      className={`w-full admin-button admin-button-secondary ${["cancelled", "rejected"].includes(a.status) ? "admin-danger" : ""}`}
                    >
                      {a.label}
                    </ConfirmButton>
                  </ActionForm>
                ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              Confirmation is database-controlled and fails unless verification
              is approved and the selected unit remains available.
            </p>
          </Panel>
          {["confirmed", "active"].includes(b.status) && (
            <Panel
              title={
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
            </Panel>
          )}
        </aside>
      </div>
      <BookingDepositPanel
        bookingId={id}
        status={b.status}
        version={b.rental_workflow_version}
      />
    </div>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="admin-detail-info">
      <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        {k}
      </dt>
      <dd className="mt-1 font-semibold text-deep-teal">{v}</dd>
    </div>
  );
}
function actionsFor(status: string) {
  if (["submitted", "pending"].includes(status))
    return [
      { status: "rejected", label: "Reject request" },
      { status: "cancelled", label: "Cancel request" },
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
