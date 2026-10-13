import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { checkedQueries } from "@/lib/query-results";
import { Panel, StatusBadge, formatDate } from "@/components/admin-ui";
import { VerificationReview } from "@/components/verification-review";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { transitionBooking } from "@/app/actions/bookings";
export default async function VerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      <h1 className="text-3xl font-extrabold text-deep-teal">
        {c?.full_name} — document review
      </h1>
      <Panel title={b.booking_reference}>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <p>
            {model?.display_name}
            <br />
            {formatDate(b.start_at)} – {formatDate(b.end_at)}
          </p>
          <p>
            {c?.email}
            <br />
            {c?.phone} · {c?.country_of_residence}
          </p>
          <p>
            Booking: <StatusBadge value={b.status} />
          </p>
          <p>
            Verification: <StatusBadge value={v.overall_status} />
          </p>
          <p>
            Licence: {v.license_issuing_country} · expires{" "}
            {v.license_expiration_date}
            <br />
            Declared categories: {v.permitted_vehicle_categories}
          </p>
          <p>
            {v.customer_type === "international_visitor"
              ? "Mandatory manual international identity and driving-document review."
              : "Manual identity and driving-document review."}
          </p>
        </div>
        <Link
          href={`/dashboard/bookings/${b.id}`}
          className="mt-4 inline-block font-bold text-ocean underline"
        >
          Open booking details and pickup requirements
        </Link>
      </Panel>
      <VerificationReview
        verification={v}
        documents={documents ?? []}
        bookingId={b.id}
      />
      {["pending", "submitted", "confirmed"].includes(b.status) && (
        <Panel title="Cancel associated booking">
          <p className="mb-3 text-sm text-slate-500">
            Use the existing controlled cancellation workflow if verification
            fails. Rejecting a document does not silently cancel the
            reservation.
          </p>
          <ActionForm action={transitionBooking}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="status" value="cancelled" />
            <label className="block text-sm font-bold">
              Cancellation reason
              <textarea
                name="reason"
                required
                maxLength={2000}
                className="mt-2 block w-full rounded-lg border p-3"
              />
            </label>
            <ConfirmButton
              message="Cancel this booking and release its reservation through the existing controlled workflow?"
              className="admin-button mt-3"
            >
              Cancel reservation
            </ConfirmButton>
          </ActionForm>
        </Panel>
      )}
      <Panel title="Verification audit history">
        <ul className="space-y-3">
          {reviews
            ?.filter((r) => r.review_type !== "document_access")
            .map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 p-4 text-sm">
                <strong>
                  {r.review_type} · {r.result.replaceAll("_", " ")}
                </strong>
                <p>{r.reason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Reviewer {r.reviewer_user_id} · {formatDate(r.created_at)}
                </p>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
