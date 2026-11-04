import {
  getLivePaymentContext,
  livePaymentLabel,
} from "@/services/live-payment-status";
import { formatDate, formatPHP } from "./admin-ui";
export async function BookingPaymentReview({
  bookingId,
}: {
  bookingId: string;
}) {
  const data = await getLivePaymentContext(bookingId);
  if (!data) return null;
  const c = data.checkout;
  return (
    <section className="space-y-2 rounded-xl border border-deep-teal/15 bg-white p-4 text-sm">
      <h2 className="font-extrabold text-deep-teal">QRPh via PayMongo</h2>
      <p
        className={`font-bold ${c.status === "paid" ? "text-emerald-800" : "text-amber-900"}`}
      >
        {livePaymentLabel(c)}
      </p>
      <p>
        Rental & services: {formatPHP(c.amount_centavos / 100)} · cash deposit
        separate
      </p>
      {data.reference && (
        <p className="break-all">
          Transaction reference: <strong>{data.reference}</strong>
        </p>
      )}
      {c.checkout_session_id && (
        <p className="break-all text-xs text-slate-500">
          Checkout reference: {c.checkout_session_id}
        </p>
      )}
      {c.provider_checked_at && (
        <p className="text-xs text-slate-500">
          Last provider verification: {formatDate(c.provider_checked_at)}
        </p>
      )}
      {c.status === "review_required" && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900"
        >
          Payment was received but the booking needs owner review. Check
          fulfilment and any supported refund workflow. No booking was
          automatically confirmed or refunded.
        </p>
      )}
      {c.status !== "paid" && (
        <p className="text-xs text-slate-500">
          An online payment attempt exists. Reconcile its provider status before
          recording another payment.
        </p>
      )}
    </section>
  );
}
