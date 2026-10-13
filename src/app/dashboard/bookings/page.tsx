import { checkedQueries } from "@/lib/query-results";
import { matchesBookingSearch } from "@/lib/booking-search";
import { StatusBadge, formatDate } from "@/components/admin-ui";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; verification?: string }>;
}) {
  const f = await searchParams,
    { supabase } = await requireAdmin();
  const [
    { data: bookings, error },
    { data: customers },
    { data: models },
    { data: verifications },
    { data: payments, error: paymentError },
    { data: extras, error: extrasError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id,full_name,email"),
    supabase.from("motorcycle_models").select("id,display_name"),
    supabase.from("customer_verifications").select("booking_id,overall_status"),
    supabase
      .from("payment_events")
      .select("booking_id,event_type,amount_centavos"),
    supabase
      .from("booking_extra_items")
      .select("booking_id,name_snapshot,quantity"),
  ]).then(checkedQueries);
  if (error) throw new Error(error.message);
  const q = (f.q ?? "").toLowerCase(),
    status = f.status ?? "all",
    verification = f.verification ?? "all";
  const rows = (bookings ?? []).filter((b) => {
    const c = customers?.find((x) => x.id === b.customer_id),
      m = models?.find((x) => x.id === b.motorcycle_model_id),
      v = verifications?.find((x) => x.booking_id === b.id);
    return (
      (!q ||
        matchesBookingSearch(
          q,
          b.booking_reference,
          c?.full_name,
          m?.display_name,
        )) &&
      (status === "all" || b.status === status) &&
      (verification === "all" || v?.overall_status === verification)
    );
  });
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
        Operations
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-deep-teal">Bookings</h1>
      <p className="mt-2 text-sm text-slate-500">
        Reservation requests require verification and availability approval.
      </p>
      <form className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <Search className="absolute top-3.5 left-3 size-4 text-slate-400" />
          <input
            aria-label="Search bookings"
            name="q"
            defaultValue={f.q}
            placeholder="Reference, customer, motorcycle"
            className="min-h-11 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm"
          />
        </label>
        <select
          aria-label="Booking status"
          name="status"
          defaultValue={status}
          className="rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="all">All booking statuses</option>
          {[
            "submitted",
            "pending",
            "confirmed",
            "active",
            "completed",
            "rejected",
            "cancelled",
            "expired",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Verification status"
          name="verification"
          defaultValue={verification}
          className="rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="all">All verification</option>
          {[
            "submitted",
            "under_review",
            "approved",
            "rejected",
            "resubmission_required",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button className="rounded-xl bg-deep-teal px-5 text-sm font-bold text-white">
          Filter
        </button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-responsive-table">
          <thead className="border-b border-slate-100 bg-slate-50 text-[10px] tracking-wider text-slate-400 uppercase">
            <tr>
              {[
                "Reference",
                "Customer",
                "Motorcycle",
                "Rental period",
                "Booking",
                "Verification",
                "Extras",
                "Payments",
                "Total",
              ].map((x) => (
                <th scope="col" key={x} className="px-5 py-4">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b) => {
              const c = customers?.find((x) => x.id === b.customer_id),
                m = models?.find((x) => x.id === b.motorcycle_model_id),
                v = verifications?.find((x) => x.booking_id === b.id);
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td data-label="Reference" className="px-5 py-4">
                    <Link
                      href={`/dashboard/bookings/${b.id}`}
                      className="font-bold text-ocean"
                    >
                      {b.booking_reference}
                      {b.is_test && (
                        <span className="ml-2 admin-badge">Test</span>
                      )}
                    </Link>
                  </td>
                  <td data-label="Customer" className="px-5 py-4">
                    <p className="font-bold text-deep-teal">{c?.full_name}</p>
                    <p className="text-xs text-slate-400">{c?.email}</p>
                  </td>
                  <td data-label="Motorcycle" className="px-5 py-4">
                    {m?.display_name ?? "—"}
                  </td>
                  <td data-label="Rental period" className="px-5 py-4 text-xs">
                    {formatDate(b.start_at)}
                    <br />
                    {formatDate(b.end_at)}
                  </td>
                  <td data-label="Booking" className="px-5 py-4">
                    <StatusBadge value={b.status} />
                  </td>
                  <td data-label="Verification" className="px-5 py-4">
                    <StatusBadge value={v?.overall_status ?? "missing"} />
                  </td>
                  <td data-label="Extras">
                    {extrasError
                      ? "Unavailable"
                      : extras
                          ?.filter((e) => e.booking_id === b.id)
                          .map((e) => `${e.name_snapshot} × ${e.quantity}`)
                          .join(", ") || "None"}
                  </td>
                  <td data-label="Payments">
                    {paymentError ? (
                      "Unavailable"
                    ) : (
                      <StatusBadge
                        value={(() => {
                          const paid = (payments ?? [])
                            .filter((e) => e.booking_id === b.id)
                            .reduce(
                              (sum, e) =>
                                sum +
                                (e.event_type === "payment"
                                  ? e.amount_centavos
                                  : -e.amount_centavos),
                              0,
                            );
                          return paid <= 0
                            ? "unpaid"
                            : paid < b.total_centavos
                              ? "partially paid"
                              : "paid";
                        })()}
                      />
                    )}
                  </td>
                  <td data-label="Total" className="px-5 py-4 font-bold">
                    ₱{b.quoted_total_php.toLocaleString("en-PH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-10 text-center text-sm text-slate-400">
            No bookings match this view.
          </p>
        )}
      </div>
    </div>
  );
}
