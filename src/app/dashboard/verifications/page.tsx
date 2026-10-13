import { checkedQueries } from "@/lib/query-results";
import { EmptyState, StatusBadge } from "@/components/admin-ui";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
export default async function VerificationsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: v, error }, { data: customers }, { data: bookings }] =
    await Promise.all([
      supabase
        .from("customer_verifications")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id,full_name"),
      supabase.from("bookings").select("id,booking_reference,status"),
    ]).then(checkedQueries);
  if (error) throw new Error(error.message);
  const groups = [
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "resubmission_required",
  ];
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-extrabold tracking-wider text-ocean uppercase">
        Sensitive operations
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-deep-teal">
        Verification center
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Human review is required; uploads never imply authenticity.
      </p>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {groups.map((s) => (
          <article
            key={s}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-3xl font-extrabold text-deep-teal">
              {v?.filter((x) => x.overall_status === s).length ?? 0}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-400 capitalize">
              {s.replaceAll("_", " ")}
            </p>
          </article>
        ))}
      </section>
      <p className="admin-note">
        Open a verification record to inspect private documents and record a
        decision. Document approval remains a manual administrator decision.
      </p>
      <div className="mt-6 space-y-3">
        {!v?.length && (
          <EmptyState
            title="No verifications to review"
            description="Submitted customer verification records will appear here."
          />
        )}
        {v?.map((item) => {
          const c = customers?.find((x) => x.id === item.customer_id),
            b = bookings?.find((x) => x.id === item.booking_id);
          return (
            <Link
              href={`/dashboard/verifications/${item.id}`}
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-xs font-bold text-ocean">
                  {b?.booking_reference}
                </p>
                <h2 className="mt-1 font-extrabold text-deep-teal">
                  {c?.full_name}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {item.customer_type.replaceAll("_", " ")}
                  {item.customer_type === "international_visitor"
                    ? " · manual international review required"
                    : ""}
                </p>
              </div>
              <StatusBadge value={item.overall_status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
