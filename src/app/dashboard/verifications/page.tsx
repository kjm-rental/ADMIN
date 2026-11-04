export const instant = false;
import { connection } from "next/server";
import { checkedQueries } from "@/lib/query-results";
import { PageHeading } from "@/components/admin-ui";
import {
  verificationCategories,
  verificationCategory,
  verificationQueueStatus,
} from "@/lib/verification-display";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { VerificationQueue } from "@/components/verification-queue";
import { requireAdmin } from "@/lib/auth";
export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await connection();
  const filters = await searchParams;
  const { supabase } = await requireAdmin();
  const [
    { data: verifications },
    { data: customers },
    { data: bookings },
    { data: models },
  ] = await Promise.all([
    supabase
      .from("customer_verifications")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id,full_name"),
    supabase
      .from("bookings")
      .select("id,booking_reference,status,motorcycle_model_id"),
    supabase.from("motorcycle_models").select("id,display_name"),
  ]).then(checkedQueries);
  const category = verificationCategories.some(
    (c) => c.key === filters.category,
  )
    ? filters.category
    : "all";
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Customer care"
        title="Verification Center"
        description="Check customer documents, give clear feedback, and prepare each rental for a safe pickup."
      />
      <section
        aria-label="Verification categories"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {[
          verificationCategories[1],
          verificationCategories[0],
          ...verificationCategories.slice(2),
        ].map((group) => (
          <Link
            key={group.key}
            href={`?category=${group.key}`}
            aria-current={category === group.key ? "page" : undefined}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${category === group.key ? "border-ocean ring-2 ring-ocean/10" : "border-slate-200 hover:border-ocean"}`}
          >
            <p className="text-3xl font-extrabold text-deep-teal">
              {verifications?.filter(
                (v) =>
                  verificationCategory(verificationQueueStatus(v)) ===
                  group.key,
              ).length ?? 0}
            </p>
            <h2 className="mt-2 text-sm font-extrabold">
              {group.key === "review" ? "Pending reviews" : group.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{group.description}</p>
          </Link>
        ))}
      </section>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck size={18} className="text-ocean" />
          Document checks and identity decisions are separate. Full verification
          requires authorized authenticity, ownership and license eligibility
          review.
        </p>
        <Link href="?category=all" className="admin-text-link">
          Show all customers
        </Link>
      </div>
      <VerificationQueue
        key={category}
        initialCategory={category ?? "all"}
        rows={(verifications ?? []).map((item) => {
          const customer = customers?.find((c) => c.id === item.customer_id);
          const booking = bookings?.find((b) => b.id === item.booking_id);
          return {
            id: item.id,
            customer: customer?.full_name ?? "Customer",
            reference: booking?.booking_reference ?? "Unavailable",
            motorcycle:
              models?.find((m) => m.id === booking?.motorcycle_model_id)
                ?.display_name ?? "Unavailable",
            bookingStatus: booking?.status ?? "unknown",
            status: verificationQueueStatus(item),
            risk: item.document_risk_level ?? null,
            submitted: item.created_at,
          };
        })}
      />
    </div>
  );
}
