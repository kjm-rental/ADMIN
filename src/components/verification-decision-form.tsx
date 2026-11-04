"use client";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { reviewVerification } from "@/app/actions/bookings";
import { verificationLabel } from "@/lib/verification-display";
export type ReviewType =
  "identity" | "license" | "entitlement" | "international";
const titles = {
  identity: "Identity documents",
  license: "Driver’s license",
  entitlement: "Permission to ride a motorcycle",
  international: "International driving documents",
};
const questions: Record<ReviewType, string[]> = {
  identity: [
    "The document is readable",
    "I checked document authenticity and that it belongs to this customer",
    "The name matches the customer",
    "The document is valid and unexpired",
  ],
  license: [
    "All required license details and sides are readable",
    "I checked the original license and that it belongs to this customer",
    "The name matches the customer",
    "The license is valid and unexpired",
    "The license meets the motorcycle rental requirements",
  ],
  entitlement: [
    "The license categories are readable",
    "The documents permit this customer to ride this motorcycle",
  ],
  international: [
    "The required international documents are readable",
    "The names match the customer",
    "The documents are valid and unexpired",
    "The international driving documents meet the rental requirements",
  ],
};
export function VerificationDecisionForm({
  verificationId,
  bookingId,
  type,
  status,
  hasDocuments,
  compact = false,
  documents = [],
}: {
  verificationId: string;
  bookingId: string;
  type: ReviewType;
  status: string;
  hasDocuments: boolean;
  compact?: boolean;
  documents?: { id: string; document_kind: string }[];
}) {
  const [checked, setChecked] = useState<boolean[]>(
    questions[type].map(() => false),
  );
  const [reason, setReason] = useState("");
  const [affected, setAffected] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  return (
    <ActionForm
      action={reviewVerification}
      className={
        compact
          ? "mt-3 border-t border-slate-200 pt-3"
          : "rounded-2xl border border-slate-200 bg-white p-5"
      }
    >
      <input type="hidden" name="verificationId" value={verificationId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="reviewType" value={type} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold text-deep-teal">
          {titles[type]}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${status === "approved" ? "bg-emerald-50 text-emerald-900" : "bg-sand text-deep-teal"}`}
        >
          {status === "approved"
            ? "Review approved"
            : verificationLabel(status)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Scope: all {titles[type].toLowerCase()} for this booking, not just this
        image.
      </p>
      <details
        className="my-3 rounded-lg bg-slate-50 p-2"
        open={compact ? undefined : true}
      >
        <summary className="cursor-pointer text-xs font-bold text-deep-teal">
          Review requirements · {checked.filter(Boolean).length}/
          {checked.length} checked
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Inspect every relevant document. Check all requirements to enable
          approval.
        </p>
        <div className="mt-2 space-y-1">
          {questions[type].map((question, i) => (
            <label
              key={question}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-xs"
            >
              <input
                type="checkbox"
                name="reviewEvidence"
                value={String(i)}
                className="size-5 shrink-0 accent-teal-700"
                checked={checked[i]}
                onChange={(e) =>
                  setChecked((values) =>
                    values.map((value, index) =>
                      index === i ? e.target.checked : value,
                    ),
                  )
                }
              />
              {question}
            </label>
          ))}
        </div>
      </details>
      <div className="mb-3 grid gap-3 text-xs">
        <label className="font-bold">
          Affected document (for corrections)
          <select
            value={affected}
            onChange={(e) => setAffected(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border p-2"
          >
            <option value="">Select document</option>
            {documents.map((d) => (
              <option key={d.id} value={d.document_kind}>
                {d.document_kind.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="font-bold">
          Correction / rejection reason
          <select
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border p-2"
          >
            <option value="">Select reason</option>
            {[
              "Unreadable document",
              "Missing document information",
              "Expired document",
              "Identity information mismatch",
              "Eligibility requirements not met",
              "Document authenticity concern",
              "Other — explain below",
            ].map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>
        </label>
      </div>
      <input
        type="hidden"
        name="reason"
        value={[
          affected && `Document: ${affected.replaceAll("_", " ")}`,
          correctionReason,
          reason.trim(),
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 2000)}
      />
      <label className="block text-xs font-bold">
        Customer feedback (optional unless Other is selected)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          placeholder="Example: Please upload a clearer photo of the back of your license."
          className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 p-2 text-xs font-normal"
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        A reason is required when requesting new photos or rejecting
        verification.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
        <ConfirmButton
          name="result"
          value="approved"
          disabled={!hasDocuments || !checked.every(Boolean)}
          message={`Approve ${titles[type].toLowerCase()} after manually checking all requirements? This records your review decision.`}
          className="min-h-11 rounded-lg bg-deep-teal px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Approve category
        </ConfirmButton>
        <ConfirmButton
          name="result"
          value="resubmission_required"
          disabled={
            !correctionReason ||
            (correctionReason.startsWith("Other") && !reason.trim()) ||
            !affected
          }
          message="Request replacement photos with this feedback?"
          className="min-h-11 rounded-lg border border-ocean bg-white px-2 py-2 text-xs font-bold text-ocean disabled:opacity-40"
        >
          Request corrections
        </ConfirmButton>
        <ConfirmButton
          name="result"
          value="rejected"
          disabled={
            !correctionReason ||
            (correctionReason.startsWith("Other") && !reason.trim())
          }
          message="Reject this verification review with the reason provided? This does not cancel the booking."
          className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-bold text-red-800 disabled:opacity-40"
        >
          Reject verification
        </ConfirmButton>
      </div>
      {hasDocuments && !checked.every(Boolean) && (
        <p className="mt-3 text-xs text-amber-800">
          Approval unavailable: complete all{" "}
          {checked.length - checked.filter(Boolean).length} remaining
          requirements in this category. Every required category must be
          approved for full verification.
        </p>
      )}
      {!hasDocuments && (
        <p className="mt-3 text-sm text-amber-800">
          No current documents have been uploaded. Approval is unavailable.
        </p>
      )}
    </ActionForm>
  );
}
