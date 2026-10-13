import { checkedQueries } from "@/lib/query-results";
import { StatusBadge } from "@/components/admin-ui";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function CustomersPage() {
  const { supabase } = await requireAdmin();
  const [
    { data: customers, error },
    { data: bookings },
    { data: verifications },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id,customer_id,booking_reference,status,created_at"),
    supabase
      .from("customer_verifications")
      .select("customer_id,overall_status,created_at"),
  ]).then(checkedQueries);
  if (error) throw new Error(error.message);
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
        Operations
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-deep-teal">Customers</h1>
      <p className="mt-2 text-sm text-slate-500">
        Customer contact details and booking history. Identity documents remain
        in the restricted verification workflow.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-responsive-table">
          <thead className="border-b border-slate-100 bg-slate-50 text-[10px] tracking-wider text-slate-400 uppercase">
            <tr>
              {[
                "Customer",
                "Type",
                "Country",
                "Bookings",
                "Latest verification",
                "Joined",
              ].map((label) => (
                <th scope="col" key={label} className="px-5 py-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(customers ?? []).map((customer) => {
              const customerBookings = (bookings ?? []).filter(
                (booking) => booking.customer_id === customer.id,
              );
              const latestBooking = customerBookings.sort((a, b) =>
                b.created_at.localeCompare(a.created_at),
              )[0];
              const latestVerification = (verifications ?? [])
                .filter((item) => item.customer_id === customer.id)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              return (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td data-label="Customer" className="px-5 py-4">
                    <p className="font-bold text-deep-teal">
                      {customer.full_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {customer.email ?? "No email"} ·{" "}
                      {customer.phone ?? "No phone"}
                    </p>
                  </td>
                  <td data-label="Type" className="px-5 py-4 capitalize">
                    {customer.customer_type?.replaceAll("_", " ") ?? "—"}
                  </td>
                  <td data-label="Country" className="px-5 py-4">
                    {customer.country_of_residence ?? "—"}
                  </td>
                  <td data-label="Bookings" className="px-5 py-4">
                    {latestBooking ? (
                      <Link
                        className="font-bold text-ocean"
                        href={`/dashboard/bookings/${latestBooking.id}`}
                      >
                        {customerBookings.length} ·{" "}
                        {latestBooking.booking_reference}
                        <span className="block mt-1">
                          <StatusBadge value={latestBooking.status} />
                        </span>
                      </Link>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td data-label="Verification" className="px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-600 uppercase">
                      {(
                        latestVerification?.overall_status ?? "none"
                      ).replaceAll("_", " ")}
                    </span>
                  </td>
                  <td
                    data-label="Joined"
                    className="px-5 py-4 text-xs text-slate-500"
                  >
                    {new Date(customer.created_at).toLocaleDateString("en-PH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!customers?.length && (
          <p className="p-10 text-center text-sm text-slate-400">
            No customers yet.
          </p>
        )}
      </div>
    </div>
  );
}
