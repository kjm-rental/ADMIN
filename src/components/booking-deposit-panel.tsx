import { CompactInspectionForm } from "./compact-inspection-form";
import { getInspectionContext } from "@/services/inspection-context";
import { randomUUID } from "node:crypto";
import { Panel, formatPHP, formatDate } from "@/components/admin-ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { recordSecurityDepositEvent } from "@/app/actions/security-deposits";
import { transitionBooking } from "@/app/actions/bookings";
import { getSecurityDepositView } from "@/services/security-deposits";
import { depositBalance } from "@/lib/deposit-balances";
export async function BookingDepositPanel({
  bookingId,
  status,
  version = 0,
  section = "all",
  data: suppliedData,
}: {
  bookingId: string;
  status: string;
  version?: number;
  section?: "all" | "payments" | "rental" | "history";
  data?: Awaited<ReturnType<typeof getSecurityDepositView>>;
}) {
  const data = suppliedData ?? (await getSecurityDepositView(bookingId)),
    requirement = data.requirements[0];
  if (!data.available)
    return (
      <Panel title="Security deposit & rental inspections">
        <p className="text-sm text-amber-800">
          Deposit and inspection records are unavailable. Existing booking
          operations remain available.
        </p>
      </Panel>
    );
  if (!requirement)
    return (
      <Panel title="Security deposit">
        <p className="text-sm text-slate-500">
          Legacy booking: no security deposit requirement was recorded. No
          amount or ID arrangement has been inferred.
        </p>
      </Panel>
    );
  const balance = depositBalance(requirement, data.events),
    returned = data.inspections.some((i) => i.kind === "return");
  const events =
    requirement.option === "cash"
      ? [
          "cash_collected",
          "cash_returned",
          "cash_deducted",
          "case_opened",
          "case_resolved",
        ]
      : ["id_received", "id_returned", "case_opened", "case_resolved"];
  return (
    <div className="space-y-6">
      {(section === "all" || section === "payments") && (
        <Panel
          title="Security deposit"
          description="Custody and refundable liability are separate from rental revenue."
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Arrangement</dt>
              <dd className="font-bold">
                {requirement.option === "cash"
                  ? "Cash security deposit"
                  : "Eligible physical ID deposit"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Quoted requirement</dt>
              <dd className="font-bold">
                {requirement.option === "cash"
                  ? formatPHP(requirement.required_centavos / 100)
                  : requirement.document_type}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Deposit status</dt>
              <dd className="font-bold">{balance.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cash liability held</dt>
              <dd className="font-bold">{formatPHP(balance.held / 100)}</dd>
            </div>
          </dl>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer py-2 font-bold text-ocean">
              Deposit policy & instructions
            </summary>{" "}
            <p className="mt-4 text-sm text-slate-500">
              {requirement.collection_instructions}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {requirement.return_instructions}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {requirement.dispute_instructions}
            </p>
          </details>
          <p className="mt-3 text-xs text-slate-500">
            Advanced: deductions require a completed return inspection, a
            recorded reason and explicit administrator approval. They do not
            record a cash refund or rental revenue.
          </p>
          <ActionForm
            action={recordSecurityDepositEvent}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <input name="bookingId" value={bookingId} type="hidden" />
            <input name="idempotencyKey" value={randomUUID()} type="hidden" />
            <label className="text-sm font-bold">
              Actual deposit event
              <select
                name="eventType"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3"
              >
                {events.map((event) => (
                  <option key={event} value={event}>
                    {event.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Cash amount (PHP; 0 for document or case event)
              <input
                required
                type="number"
                name="amountPhp"
                min="0"
                step="0.01"
                max="21474836.47"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3"
              />
            </label>
            <label className="text-sm font-bold">
              Actual date/time (Asia/Manila)
              <input
                required
                type="datetime-local"
                name="occurredAt"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3"
              />
            </label>
            <label className="text-sm font-bold">
              Reason / decision for deductions (required) or operational notes
              <textarea
                name="notes"
                maxLength={2000}
                rows={2}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3"
              />
            </label>
            <label className="flex gap-3 text-sm leading-6 sm:col-span-2">
              <input
                required
                type="checkbox"
                name="verified"
                className="mt-1"
              />
              I verified this physical cash or approved-document event, or this
              explicit resolution case or approved deduction decision. Do not
              enter full ID numbers or upload collateral photographs.
            </label>
            <ConfirmButton
              className="admin-button sm:col-span-2"
              message="Record this verified deposit event? It is immutable and must describe an actual event, not an automatic charge or deduction."
            >
              Record deposit event
            </ConfirmButton>
          </ActionForm>
          <ul className="mt-5 space-y-3 text-sm">
            {balance.events.map((event) => (
              <li key={event.id} className="rounded-xl bg-slate-50 p-3">
                <strong>{event.event_type.replaceAll("_", " ")}</strong> ·{" "}
                {formatPHP(event.amount_centavos / 100)}
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(event.occurred_at)} · Administrator{" "}
                  {event.recorded_by}
                </p>
                {event.notes && <p className="mt-1">{event.notes}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(section === "all" || section === "rental") &&
        version === 9 &&
        ["confirmed", "active", "completed"].includes(status) && (
          <div className="space-y-3">
            {!returned && ["confirmed", "active"].includes(status) && (
              <CompactInspectionForm
                bookingId={bookingId}
                kind={status === "confirmed" ? "handover" : "return"}
                idempotencyKey={randomUUID()}
                context={await getInspectionContext(bookingId, data)}
                pickup={data.inspections.find((i) => i.kind === "handover")}
              />
            )}
            {data.inspections.map((i) => (
              <article
                key={i.id}
                className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"
              >
                <strong>{i.kind} inspection</strong>
                <p>
                  {formatDate(i.occurred_at)} · {i.odometer_km.toLocaleString()}{" "}
                  km · Fuel {i.fuel_percent}%
                </p>
                <p>{i.condition_notes}</p>
                <p>Accessories: {i.accessories_notes}</p>
                <p>
                  Existing damage:{" "}
                  {i.existing_damage_notes || "No observation recorded"}
                </p>
                <p>
                  New damage: {i.new_damage_notes || "No observation recorded"}
                </p>
              </article>
            ))}
            {status === "active" && returned && (
              <ActionForm action={transitionBooking} className="mt-5">
                <input type="hidden" name="bookingId" value={bookingId} />
                <input type="hidden" name="status" value="completed" />
                <ConfirmButton
                  disabled={
                    (balance.held > 0 || balance.custody > 0) &&
                    !balance.unresolved
                  }
                  className="admin-button"
                  message="Complete this inspected rental? Any unresolved deposit must be explicitly tracked and remains a liability or custody obligation."
                >
                  Complete rental
                </ConfirmButton>
              </ActionForm>
            )}
          </div>
        )}
      {section === "history" && (
        <>
          <Panel title="Security deposit activity">
            {!balance.events.length && (
              <p className="text-sm text-slate-500">
                No deposit events recorded.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {balance.events.map((event) => (
                <li key={event.id} className="py-3 text-sm">
                  <strong>{event.event_type.replaceAll("_", " ")}</strong> ·{" "}
                  {formatPHP(event.amount_centavos / 100)}
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(event.occurred_at)}
                  </p>
                  {event.notes && <p className="mt-1">{event.notes}</p>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Pickup & return inspection history">
            {!data.inspections.length && (
              <p className="text-sm text-slate-500">No inspections recorded.</p>
            )}
            <ul className="space-y-3">
              {data.inspections.map((inspection) => (
                <li
                  key={inspection.id}
                  className="rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <strong>
                    {inspection.kind === "handover" ? "Pickup" : "Return"}{" "}
                    inspection
                  </strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(inspection.occurred_at)} ·{" "}
                    {inspection.odometer_km.toLocaleString()} km · Fuel{" "}
                    {inspection.fuel_percent}%
                  </p>
                  <p className="mt-2">{inspection.condition_notes}</p>
                  <p>Accessories: {inspection.accessories_notes}</p>
                  <p>
                    Existing damage:{" "}
                    {inspection.existing_damage_notes ||
                      "No observation recorded"}
                  </p>
                  <p>
                    New damage:{" "}
                    {inspection.new_damage_notes || "No observation recorded"}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
