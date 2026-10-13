"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveInventoryQuantity } from "@/app/actions/fleet";
export function InventoryQuantityForm({
  modelId,
  total,
}: {
  modelId: string;
  total: number;
}) {
  const [quantity, setQuantity] = useState(total);
  const [result, action, pending] = useActionState(saveInventoryQuantity, {
    error: "",
    saved: false,
  });
  const submitted = useRef(false);
  useEffect(() => {
    if (!pending) submitted.current = false;
  }, [pending]);
  return (
    <form
      action={action}
      className="mt-5 space-y-4"
      aria-busy={pending}
      onSubmitCapture={(event) => {
        if (submitted.current) event.preventDefault();
        else submitted.current = true;
      }}
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="expectedTotal" value={total} />
      <label
        className="block text-sm font-bold text-deep-teal"
        htmlFor="inventory-total"
      >
        Total units owned
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || quantity === 0}
          onClick={() => setQuantity((v) => Math.max(0, v - 1))}
          aria-label="Decrease total units"
          className="size-12 rounded-xl border border-slate-300 font-bold disabled:opacity-40"
        >
          −
        </button>
        <input
          disabled={pending}
          id="inventory-total"
          name="total"
          required
          type="number"
          min={0}
          max={1000}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="h-12 w-28 rounded-xl border border-slate-300 text-center text-lg font-bold"
        />
        <button
          type="button"
          disabled={pending || quantity >= 1000}
          onClick={() => setQuantity((v) => v + 1)}
          aria-label="Increase total units"
          className="size-12 rounded-xl border border-slate-300 font-bold"
        >
          +
        </button>
        <button
          disabled={pending}
          className="min-h-12 rounded-xl bg-ocean px-5 font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save quantity"}
        </button>
      </div>
      {result.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {result.error}
        </p>
      )}
      {result.saved && (
        <p role="status" className="text-sm text-emerald-700">
          Inventory quantity saved.
        </p>
      )}
      <p className="text-xs leading-5 text-slate-500">
        New units are created automatically. Reductions retire eligible units
        while preserving booking history. Reservations and inventory holds can
        prevent a reduction.
      </p>
    </form>
  );
}
