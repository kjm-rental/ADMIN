"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
export function DownloadRentalContract({
  bookingId,
  reference,
}: {
  bookingId: string;
  reference: string;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/contract`,
        { cache: "no-store", credentials: "same-origin", redirect: "error" },
      );
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.startsWith("application/pdf")
      ) {
        const body = await response.json().catch(() => null);
        throw Error(
          body?.error || "The contract could not be downloaded. Please retry.",
        );
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `KJM-Rental-Contract-${reference.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The contract could not be downloaded. Please retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="col-span-2 sm:col-span-1">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ocean/25 bg-white px-4 py-2.5 text-sm font-bold text-ocean hover:bg-ocean/5 disabled:opacity-60"
        aria-busy={pending}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending ? "Preparing PDF…" : "Download contract (PDF)"}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 max-w-xs text-xs leading-5 text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
