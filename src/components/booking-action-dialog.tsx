"use client";
import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function BookingActionDialog({
  label,
  title = label,
  children,
  primary = false,
  disabled = false,
}: {
  label: string;
  title?: string;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
        className={`admin-button w-full disabled:opacity-40 ${primary ? "" : "admin-button-secondary"}`}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        className="m-auto max-h-[90dvh] w-[min(94vw,42rem)] overflow-auto rounded-2xl bg-white p-5 backdrop:bg-slate-900/60"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-deep-teal">{title}</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close booking action"
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
export function ManageBookingButton() {
  return (
    <button
      type="button"
      className="admin-button col-span-2 lg:col-span-1"
      onClick={() => {
        const area = document.getElementById("booking-quick-actions");
        area?.scrollIntoView({ behavior: "smooth", block: "center" });
        area?.focus({ preventScroll: true });
      }}
    >
      Manage booking
    </button>
  );
}

export function CancelBookingAction() {
  return (
    <button
      type="button"
      className="admin-button admin-button-secondary"
      onClick={(event) => event.currentTarget.closest("dialog")?.close()}
    >
      Cancel
    </button>
  );
}
