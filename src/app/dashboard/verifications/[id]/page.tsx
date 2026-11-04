export const instant = false;
import { connection } from "next/server";
import { AutomaticDocumentScreening } from "@/components/automatic-document-screening";
import Link from "next/link";
import {
  verificationLabel,
  verificationQueueStatus,
} from "@/lib/verification-display";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { checkedQueries } from "@/lib/query-results";
import { StatusBadge, formatDate } from "@/components/admin-ui";
import { VerificationReview } from "@/components/verification-review";
export default async function VerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params,
    { supabase } = await requireAdmin();
  const { data: v, error } = await supabase
    .from("customer_verifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Verification could not be loaded.");
  if (!v) notFound();
  const [{ data: b }, { data: c }, { data: documents }, { data: reviews }] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("id", v.booking_id).single(),
      supabase
        .from("customers")
        .select("full_name,email,phone,country_of_residence")
        .eq("id", v.customer_id)
        .single(),
      supabase
        .from("verification_documents")
        .select("*")
        .eq("verification_id", id)
        .order("created_at"),
      supabase
        .from("verification_reviews")
        .select("*")
        .eq("verification_id", id)
        .order("created_at", { ascending: false }),
    ]).then(checkedQueries);
  if (!b) notFound();
  const { data: model, error: modelError } = await supabase
    .from("motorcycle_models")
    .select("display_name")
    .eq("id", b.motorcycle_model_id ?? "")
    .maybeSingle();
  if (modelError) throw new Error("Motorcycle details could not be loaded.");
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/dashboard/verifications"
        className="text-sm font-bold text-ocean"
      >
        ← Verification center
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-deep-teal">
          {c?.full_name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
          <Link
            href={`/dashboard/bookings/${b.id}`}
            className="font-bold text-ocean"
          >
            Booking: {b.booking_reference}
          </Link>
          <span>{model?.display_name}</span>
          <span>
            Booking: <StatusBadge value={b.status} />
          </span>
          <span>
            Verification:{" "}
            <strong className="text-deep-teal">
              {verificationLabel(verificationQueueStatus(v))}
            </strong>
          </span>
        </div>
      </header>
      <VerificationReview
        verification={v}
        documents={(documents ?? []).map((d) => ({
          id: d.id,
          document_kind: d.document_kind,
          mime_type: d.mime_type,
          status: d.status,
          created_at: d.created_at,
          size_bytes: d.size_bytes,
          replaced_at: d.replaced_at,
        }))}
        summary={<AutomaticDocumentScreening verification={v} />}
        bookingId={b.id}
      />
      <details className="text-sm">
        <summary className="cursor-pointer py-3 font-bold text-deep-teal">
          Verification History
        </summary>
        <ol className="space-y-3 border-l-2 border-teal-100 pl-4">
          {[
            ...(documents ?? []).map((d) => ({
              id: d.id,
              at: d.created_at,
              title: `Document uploaded · ${d.document_kind.replaceAll("_", " ")}`,
              reason: d.replaced_at ? "Superseded by a later upload" : "",
            })),
            ...(reviews ?? [])
              .filter((r) => r.review_type !== "document_access")
              .map((r) => ({
                id: r.id,
                at: r.created_at,
                title: `${r.review_type.replaceAll("_", " ")} · ${verificationLabel(r.result)}`,
                reason: r.reason,
              })),
          ]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((event) => (
              <li key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <strong className="capitalize">{event.title}</strong>
                {event.reason && (
                  <p className="mt-1 text-slate-600">{event.reason}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(event.at)}
                </p>
              </li>
            ))}
        </ol>
      </details>
    </div>
  );
}
