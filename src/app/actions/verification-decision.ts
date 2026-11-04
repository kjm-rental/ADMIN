"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFreshAdminSession } from "@/lib/auth";
import {
  documentReviewType,
  verificationAttestation,
} from "@/lib/verification-attestation";
export async function decideVerification(form: FormData) {
  const input = z
    .object({
      verificationId: z.uuid(),
      bookingId: z.uuid(),
      result: z.enum(["approved", "resubmission_required", "rejected"]),
      attestation: z.string().optional(),
      documentId: z.string().optional(),
      reason: z.string().trim().max(200).optional(),
      message: z.string().trim().max(1500).optional(),
    })
    .parse(Object.fromEntries(form));
  if (
    input.result === "approved" &&
    input.attestation !== verificationAttestation
  )
    throw new Error("Explicit reviewer attestation is required.");
  if (input.result !== "approved" && !input.reason)
    throw new Error("A reason is required.");
  const session = await getFreshAdminSession();
  if (!session) throw new Error("Active administrator access required.");
  const { supabase } = session;
  const { data: v, error } = await supabase
    .from("customer_verifications")
    .select("*")
    .eq("id", input.verificationId)
    .eq("booking_id", input.bookingId)
    .single();
  if (error || !v) throw new Error("Verification could not be loaded.");
  const { data: documents, error: documentError } = await supabase
    .from("verification_documents")
    .select("id,document_kind")
    .eq("verification_id", v.id)
    .is("replaced_at", null);
  if (documentError || !documents)
    throw new Error("Current documents could not be loaded.");
  const reviewedUploads = form.getAll("documentVersion");
  if (
    reviewedUploads.some((id) => typeof id !== "string") ||
    JSON.stringify([...reviewedUploads].sort()) !==
      JSON.stringify(documents.map((d) => d.id).sort())
  )
    throw new Error(
      "Documents changed during review. Reload and inspect the current uploads before deciding.",
    );
  const types: ("identity" | "license" | "entitlement" | "international")[] = [
    "identity",
    "license",
    "entitlement",
  ];
  if (
    v.customer_type === "international_visitor" ||
    !["not_required", "not_applicable"].includes(v.international_status)
  )
    types.push("international");
  let reason: string;
  let targets = types;
  if (input.result === "approved") {
    const identity =
      v.customer_type === "international_visitor"
        ? "passport"
        : "government_id";
    if (
      ![identity, "drivers_license_front"].every((kind) =>
        documents.some((d) => d.document_kind === kind),
      )
    )
      throw new Error("Required identity and license documents are missing.");
    reason = `Authorized reviewer explicitly attested: ${verificationAttestation}`;
    targets = types.filter((type) => v[`${type}_status`] !== "approved");
  } else {
    reason = [input.reason, input.message].filter(Boolean).join(" · ");
    if (input.result === "resubmission_required") {
      const document = documents.find((d) => d.id === input.documentId);
      if (!document) throw new Error("Select a current document.");
      targets = [documentReviewType(document.document_kind)];
      reason = `Document: ${document.document_kind.replaceAll("_", " ")} · ${reason}`;
    }
  }
  // Each existing RPC retains its authorization, document gates, history and audit logging.
  // Calls are sequential; an error stops the workflow and can leave completed category reviews saved.
  for (const type of targets) {
    const { error: decisionError } = await supabase.rpc(
      "admin_review_verification",
      {
        p_verification_id: v.id,
        p_review_type: type,
        p_result: input.result,
        p_reason: reason,
      },
    );
    if (decisionError) {
      revalidatePath(`/dashboard/verifications/${v.id}`);
      revalidatePath("/dashboard/verifications");
      throw new Error(
        `Review stopped at ${type}. Reload before retrying; earlier categories may have been saved.`,
      );
    }
  }
  revalidatePath(`/dashboard/bookings/${input.bookingId}`);
  revalidatePath(`/dashboard/verifications/${v.id}`);
  revalidatePath("/dashboard/verifications");
  redirect(`/dashboard/verifications/${v.id}?reviewed=1`);
}
