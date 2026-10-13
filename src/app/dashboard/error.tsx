"use client";
import { AlertTriangle } from "lucide-react";
export default function ErrorState({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="size-5" />
      </span>
      <h1 className="mt-5 text-xl font-extrabold text-deep-teal">
        Unable to load this admin view
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        This view could not retrieve its data. Try loading it again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-ocean px-5 py-2.5 text-sm font-bold text-white"
      >
        Try again
      </button>
    </div>
  );
}
