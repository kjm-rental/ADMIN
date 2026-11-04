"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/admin-ui";
export function ManualBookingDocuments({ bookingId }: { bookingId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Panel
      title="Add private documents"
      description="Optional for reservations. Uploading does not approve identity or a license. Review genuine documents before handover."
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          startTransition(async () => {
            setMessage("");
            try {
              const response = await fetch(
                `/api/manual-bookings/${bookingId}/documents`,
                { method: "POST", body: data },
              );
              const result = await response.json();
              if (!response.ok) throw Error(result.error ?? "Upload failed.");
              setMessage(
                "Document saved privately. Complete the existing verification review before handover.",
              );
              form.reset();
              router.refresh();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Upload failed.");
            }
          });
        }}
      >
        <label className="text-sm">
          Document type
          <select
            name="kind"
            className="mt-1 block min-h-11 rounded-xl border border-slate-200 px-3"
            disabled={pending}
          >
            <option value="government_id">Government ID</option>
            <option value="passport">Passport</option>
            <option value="drivers_license_front">
              Driver’s license front
            </option>
            <option value="drivers_license_back">Driver’s license back</option>
            <option value="international_driving_permit">
              International driving permit
            </option>
            <option value="supporting_document">Supporting document</option>
          </select>
        </label>
        <label className="min-w-0 text-sm">
          Image or PDF · max 8 MB
          <input
            required
            name="document"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
            disabled={pending}
            className="mt-1 block max-w-full text-xs"
          />
        </label>
        <button disabled={pending} className="admin-btn-secondary">
          {pending ? "Uploading…" : "Upload privately"}
        </button>
      </form>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </Panel>
  );
}
