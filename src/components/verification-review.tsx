import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Panel } from "@/components/admin-ui";
import {
  PrivateDocumentViewer,
  type ReviewDocument,
} from "@/components/private-document-viewer";
import { reviewVerification } from "@/app/actions/bookings";
import type { Database } from "@/types/database";
export function VerificationReview({
  verification,
  documents,
  bookingId,
}: {
  verification:
    Database["public"]["Tables"]["customer_verifications"]["Row"] | null;
  documents: ReviewDocument[];
  bookingId: string;
}) {
  return (
    <>
      <Panel title="Private documents">
        <p className="mb-4 text-xs text-slate-500">
          Private previews are restricted to authorized administrators. Access
          is audited and signed URLs expire after five minutes.
        </p>
        <PrivateDocumentViewer documents={documents} />
      </Panel>
      <Panel title="Verification">
        <div className="grid gap-3 sm:grid-cols-2">
          {verification &&
            (
              ["identity", "license", "entitlement", "international"] as const
            ).map((type) => (
              <ActionForm
                action={reviewVerification}
                key={type}
                className="rounded-xl border border-slate-200 p-4"
              >
                <input
                  type="hidden"
                  name="verificationId"
                  value={verification.id}
                />
                <input type="hidden" name="bookingId" value={bookingId} />
                <input type="hidden" name="reviewType" value={type} />
                <p className="text-xs font-extrabold capitalize text-deep-teal">
                  {type}: {verification[`${type}_status`]}
                </p>
                <textarea
                  name="reason"
                  placeholder="For rejection or resubmission, identify the documents and corrections required"
                  className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "approved",
                    "under_review",
                    "resubmission_required",
                    "rejected",
                  ].map((result) => (
                    <SubmitButton
                      unstyled
                      key={result}
                      name="result"
                      value={result}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase"
                    >
                      {result.replaceAll("_", " ")}
                    </SubmitButton>
                  ))}
                </div>
              </ActionForm>
            ))}
        </div>
      </Panel>
    </>
  );
}
