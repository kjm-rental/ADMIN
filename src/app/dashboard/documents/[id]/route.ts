import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    { supabase, user } = await requireAdmin();
  const { data: document, error: documentError } = await supabase
    .from("verification_documents")
    .select("id,verification_id,storage_path")
    .eq("id", id)
    .maybeSingle();
  if (documentError)
    return new NextResponse("Document lookup failed", { status: 500 });
  if (!document) return new NextResponse("Document not found", { status: 404 });
  const { data, error } = await supabase.storage
    .from("identity-verification")
    .createSignedUrl(document.storage_path, 300);
  if (error || !data?.signedUrl)
    return new NextResponse("Document unavailable", { status: 404 });
  const { error: auditError } = await supabase
    .from("verification_reviews")
    .insert({
      verification_id: document.verification_id,
      document_id: document.id,
      review_type: "document_access",
      result: "accessed",
      reason: "Short-lived document URL issued",
      reviewer_user_id: user.id,
    });
  if (auditError)
    return new NextResponse("Document access could not be audited", {
      status: 500,
    });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
