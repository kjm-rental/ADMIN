"use client";

import { useActionState, useRef, useState } from "react";
import { manageMotorcycleUnit } from "@/app/actions/motorcycle-unit-lifecycle";
import { initialUnitLifecycleState } from "@/lib/motorcycle-unit-lifecycle";

export function MotorcycleUnitLifecycle({
  modelId,
  modelName,
  unit,
}: {
  modelId: string;
  modelName: string;
  unit: { id: string; registration_plate: string | null; status: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [operation, setOperation] = useState<
    "remove" | "deactivate" | "reactivate"
  >("remove");
  const [state, action, pending] = useActionState(
    manageMotorcycleUnit,
    initialUnitLifecycleState,
  );
  const title =
    operation === "remove"
      ? "Remove Motorcycle Unit?"
      : operation === "deactivate"
        ? "Deactivate Motorcycle Unit?"
        : "Reactivate Motorcycle Unit?";
  function open(next: typeof operation) {
    setOperation(next);
    dialog.current?.showModal();
  }
  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        className="min-h-10 rounded-xl border border-red-300 px-3 text-sm font-bold text-red-700 hover:bg-red-50"
        onClick={() => open("remove")}
      >
        Remove Unit
      </button>
      <button
        type="button"
        className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-bold text-deep-teal hover:bg-slate-50"
        onClick={() =>
          open(unit.status === "inactive" ? "reactivate" : "deactivate")
        }
      >
        {unit.status === "inactive" ? "Reactivate Unit" : "Deactivate Unit"}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className="m-auto w-[min(94vw,32rem)] rounded-2xl bg-white p-6 backdrop:bg-slate-900/60"
      >
        <h3 className="text-lg font-extrabold text-deep-teal">{title}</h3>
        <dl className="my-4 space-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Motorcycle</dt>
            <dd className="font-bold">{modelName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">License Plate</dt>
            <dd className="font-bold">
              {unit.registration_plate || "Not configured"}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-slate-600">
          {operation === "remove"
            ? "Permanent removal cannot be undone. Units with booking or operational history cannot be permanently deleted."
            : operation === "deactivate"
              ? "The unit will remain visible here and will be excluded from new bookings. Unresolved reservations and active rentals must be resolved first."
              : "The unit will become available for new bookings, subject to existing reservations and maintenance blocks."}
        </p>
        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="modelId" value={modelId} />
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="expectedStatus" value={unit.status} />
          <input type="hidden" name="operation" value={operation} />
          <input type="hidden" name="confirmed" value="yes" />
          {state.message && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              {state.message}
            </p>
          )}
          {state.outcome === "history" &&
            operation === "remove" &&
            unit.status !== "inactive" && (
              <button
                disabled={pending}
                type="button"
                className="text-sm font-bold text-ocean underline"
                onClick={() => setOperation("deactivate")}
              >
                Deactivate Unit instead
              </button>
            )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              className={`min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${operation === "remove" ? "bg-red-700 text-white" : "bg-deep-teal text-white"}`}
            >
              {pending
                ? "Please wait…"
                : operation === "remove"
                  ? "Confirm Removal"
                  : operation === "deactivate"
                    ? "Confirm Deactivation"
                    : "Confirm Reactivation"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
