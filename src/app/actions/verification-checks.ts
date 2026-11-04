"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFreshAdminSession } from "@/lib/auth";
import { screenDocuments } from "@/lib/document-prescreen";
import { recognizeDocument } from "@/lib/document-ocr";
import { recordDocumentPrescreen } from "@/lib/document-prescreen-history";
export async function runVerificationChecks(form: FormData) {
  const id = z.uuid().parse(form.get("verificationId"));
  const session = await getFreshAdminSession();
  if (!session) throw new Error("Active administrator access required.");
  const { supabase, user } = session;
  const { data: v, error } = await supabase
    .from("customer_verifications")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !v) throw new Error("Verification unavailable.");
  const [
    { data: b, error: be },
    { data: c, error: ce },
    { data: documents, error: de },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("start_at")
      .eq("id", v.booking_id)
      .single(),
    supabase
      .from("customers")
      .select("full_name,auth_user_id")
      .eq("id", v.customer_id)
      .single(),
    supabase
      .from("verification_documents")
      .select("*")
      .eq("verification_id", id)
      .is("replaced_at", null)
      .order("created_at", { ascending: false })
      .limit(13),
  ]);
  if (be || ce || de || !b || !c || !documents)
    throw new Error("Document checks unavailable.");
  const result = await screenDocuments({
    documents,
    customerType: v.customer_type,
    customerName: c.full_name,
    identityName: v.identity_name,
    licenseName: v.license_name,
    licenseExpiry: v.license_expiration_date,
    categories: v.permitted_vehicle_categories,
    pickupAt: b.start_at,
    ocr: recognizeDocument,
    load: async (document) => {
      const stored = documents.find((d) => d.id === document.id);
      if (
        !stored ||
        stored.owner_user_id !== c.auth_user_id ||
        !stored.storage_path.startsWith(c.auth_user_id ? `${c.auth_user_id}/${v.booking_id}/` : `guest/${v.booking_id}/`)
      )
        throw new Error("Unavailable");
      const audit = await supabase
        .from("verification_reviews")
        .insert({
          verification_id: id,
          document_id: document.id,
          review_type: "document_access",
          result: "accessed",
          reason: "Authorized automatic document checks; no identity approval",
          reviewer_user_id: user.id,
        });
      if (audit.error) throw new Error("Unavailable");
      const download = await supabase.storage
        .from("identity-verification")
        .download(stored.storage_path);
      if (download.error || !download.data || download.data.size > 8388608)
        throw new Error("Unavailable");
      return new Uint8Array(await download.data.arrayBuffer());
    },
  });
  const saved = await recordDocumentPrescreen({
    bookingId: v.booking_id,
    ownerId: c.auth_user_id,
    documentIds: documents.map((d) => d.id),
    result,
  });
  if (!saved)
    throw new Error(
      "Checks could not be saved. Confirm migration 029 and server configuration, or refresh after a document replacement. No approval was changed.",
    );
  revalidatePath(`/dashboard/verifications/${id}`);
  redirect(`/dashboard/verifications/${id}?checked=1`);
}
