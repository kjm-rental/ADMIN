import type { ManualQuote } from "@/lib/manual-booking";
import { rentalDuration } from "@/lib/rental-duration";
import { rentalPricingRows } from "@/lib/rental-pricing";

const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );
function dateLabel(value: string) {
  if (!value) return "Not selected";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(`${value}+08:00`));
}
export function ManualBookingSummary({
  model,
  customer,
  color,
  plate,
  startAt,
  endAt,
  quote,
  error,
}: {
  model?: string;
  customer: string;
  color?: string | null;
  plate?: string | null;
  startAt: string;
  endAt: string;
  quote: ManualQuote | null;
  error: string;
}) {
  const duration = rentalDuration(`${startAt}+08:00`, `${endAt}+08:00`);
  const rows: [string, number | undefined][] = [
    ["Motorcycle rental", quote?.base],
    ["Accessories", quote?.extras],
    [
      "Delivery",
      quote ? Number(quote.delivery.deliveryFeeCentavos ?? 0) / 100 : undefined,
    ],
    [
      "Collection",
      quote
        ? Number(quote.delivery.collectionFeeCentavos ?? 0) / 100
        : undefined,
    ],
    ["Discount / adjustment", quote?.adjustment],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-deep-teal">
          {model || "Choose a motorcycle"}
        </h3>
        {(color || plate) && (
          <p className="mt-1 text-xs text-slate-500">
            {[color, plate].filter(Boolean).join(" · ")}
          </p>
        )}
        {customer && <p className="mt-1 text-xs text-slate-500">{customer}</p>}
      </div>
      <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Pickup</dt>
          <dd className="text-right font-semibold">{dateLabel(startAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Return</dt>
          <dd className="text-right font-semibold">{dateLabel(endAt)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
          <dt className="text-slate-500">Duration · Manila</dt>
          <dd className="font-semibold">{duration?.label ?? "—"}</dd>
        </div>
      </dl>
      <dl className="space-y-2.5 text-sm">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-deep-teal">
              {amount === undefined ? "—" : money(amount)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl bg-deep-teal p-4 text-white">
        <p className="text-xs text-white/75">Final rental amount</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">
          {quote ? money(quote.final) : "—"}
        </p>
        <p className="mt-1 text-xs text-white/70">
          {quote
            ? "Rental and selected services · deposit separate"
            : model && startAt && endAt
              ? error
                ? "Price unavailable — review the message below"
                : "Calculating verified price…"
              : "Choose a motorcycle and rental dates"}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Refundable cash deposit</dt>
          <dd className="font-semibold">
            {quote ? money(quote.deposit) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 font-bold text-deep-teal">
          <dt>Rental + deposit</dt>
          <dd>{quote ? money(quote.final + quote.deposit) : "—"}</dd>
        </div>
      </dl>
      {quote && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-ocean">
            Price calculation
          </summary>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between gap-3">
              <dt>Standard total</dt>
              <dd>{money(quote.standard)}</dd>
            </div>
            {rentalPricingRows(quote.pricing).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt>{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900"
        >
          {error}
        </p>
      )}
      <p className="text-[11px] leading-5 text-slate-500">
        No payment is collected here. The deposit is refundable and recorded
        separately at handover. Availability is checked again on save.
      </p>
    </div>
  );
}
