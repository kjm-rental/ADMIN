"use client";
import { useRef, useState, type ReactNode } from "react";
import {
  PrivateDocumentViewer,
  type ReviewDocument,
} from "@/components/private-document-viewer";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { decideVerification } from "@/app/actions/verification-decision";
import {
  documentLabel,
  verificationAttestation,
} from "@/lib/verification-attestation";
import type { Database } from "@/types/database";
export function VerificationReview({
  verification,
  documents,
  bookingId,
  summary,
}: {
  verification:
    Database["public"]["Tables"]["customer_verifications"]["Row"] | null;
  documents: ReviewDocument[];
  bookingId: string;
  summary?: ReactNode;
}) {
  const [activeDocumentId, setActiveDocumentId] = useState<
    string | undefined
  >();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<
    "approved" | "resubmission_required" | "rejected"
  >("approved");
  const current = documents.filter((d) => !d.replaced_at);
  const canApprove =
    !!verification &&
    [
      verification.customer_type === "international_visitor"
        ? "passport"
        : "government_id",
      "drivers_license_front",
    ].every((kind) => current.some((d) => d.document_kind === kind));
  function open(value: typeof mode) {
    setMode(value);
    dialog.current?.showModal();
  }
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(210px,1fr)]">
        <div className="min-w-0 rounded-2xl bg-white p-3 sm:p-4">
          <PrivateDocumentViewer
            documents={documents}
            activeDocumentId={activeDocumentId}
            onDocumentSelect={setActiveDocumentId}
          />
        </div>
        <aside className="space-y-5 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Documents
            </h2>
            <div className="space-y-1">
              {current.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={(activeDocumentId ?? current[0]?.id) === d.id}
                  onClick={() => setActiveDocumentId(d.id)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs ${(activeDocumentId ?? current[0]?.id) === d.id ? "bg-teal-50 text-deep-teal" : "text-slate-600"}`}
                >
                  <span aria-hidden="true">
                    {d.status === "approved" ? "✓" : "•"}
                  </span>
                  <span>
                    {documentLabel(d.document_kind)}
                    <span className="block text-slate-500">
                      {d.status === "approved"
                        ? "Approved"
                        : d.status === "resubmission_required"
                          ? "New photo requested"
                          : d.status === "rejected"
                            ? "Rejected"
                            : "Uploaded"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          {summary}
        </aside>
      </div>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {!canApprove && (
          <p className="mr-auto text-xs text-amber-800">
            Required identity and license uploads are needed for approval.
          </p>
        )}
        <button
          type="button"
          disabled={!canApprove || verification?.overall_status === "approved"}
          onClick={() => open("approved")}
          className="admin-button disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!verification || !current.length}
          onClick={() => open("resubmission_required")}
          className="admin-button admin-button-secondary disabled:opacity-40"
        >
          Request new photo
        </button>
        <button
          type="button"
          disabled={!verification}
          onClick={() => open("rejected")}
          className="admin-button bg-red-50! text-red-800! disabled:opacity-40"
        >
          Reject
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="decision-title"
        className="m-auto w-[min(94vw,32rem)] max-h-[90dvh] overflow-auto rounded-2xl bg-white p-6 backdrop:bg-slate-900/60"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="decision-title"
            className="text-xl font-extrabold text-deep-teal"
          >
            {mode === "approved"
              ? "Approve verification"
              : mode === "rejected"
                ? "Reject verification"
                : "Request new photo"}
          </h2>
          <button
            type="button"
            aria-label="Close review dialog"
            onClick={() => dialog.current?.close()}
            className="min-h-11 min-w-11 text-xl"
          >
            ×
          </button>
        </div>
        <ActionForm
          key={mode}
          action={decideVerification}
          className="space-y-4"
        >
          <input
            type="hidden"
            name="verificationId"
            value={verification?.id ?? ""}
          />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="result" value={mode} />
          {current.map((d) => (
            <input
              key={d.id}
              type="hidden"
              name="documentVersion"
              value={d.id}
            />
          ))}
          {mode === "approved" ? (
            <>
              {verification?.document_check_status !==
                "DOCUMENT_CHECKS_PASSED" && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Unresolved automatic warnings:{" "}
                  {verification?.document_check_status?.replaceAll("_", " ") ??
                    "NOT CHECKED"}
                  . Inspect the warnings and original documents before
                  confirming.
                </p>
              )}
              {Array.isArray(verification?.document_review_reasons) && (
                <ul className="max-h-28 space-y-1 overflow-auto text-xs text-amber-900">
                  {verification.document_review_reasons
                    .filter((r): r is string => typeof r === "string")
                    .map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                </ul>
              )}
              <p className="text-sm leading-relaxed">
                {verificationAttestation}
              </p>
              <p className="text-xs text-slate-500">
                Confirming records your attestation for every required review
                category.
              </p>
              <SubmitButton
                name="attestation"
                value={verificationAttestation}
                className="admin-button w-full"
              >
                Confirm review and approve
              </SubmitButton>
            </>
          ) : (
            <>
              {mode === "resubmission_required" && (
                <label className="block text-sm font-bold">
                  Document
                  <select
                    name="documentId"
                    required
                    defaultValue=""
                    className="mt-1 min-h-11 w-full rounded-lg border p-2"
                  >
                    <option value="" disabled>
                      Select document
                    </option>
                    {current.map((d) => (
                      <option key={d.id} value={d.id}>
                        {documentLabel(d.document_kind)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-bold">
                Reason
                <select
                  name="reason"
                  required
                  defaultValue=""
                  className="mt-1 min-h-11 w-full rounded-lg border p-2"
                >
                  <option value="" disabled>
                    Select reason
                  </option>
                  {[
                    "Unreadable or incomplete document",
                    "Expired document",
                    "Identity mismatch",
                    "Authenticity concern",
                    "Motorcycle eligibility not established",
                    "Required information missing",
                  ].map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                {mode === "rejected" ? "Explanation" : "Message"}{" "}
                <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  name="message"
                  maxLength={1500}
                  rows={3}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <SubmitButton className="admin-button w-full">
                {mode === "rejected"
                  ? "Confirm rejection"
                  : "Send photo request"}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </dialog>
    </div>
  );
}
