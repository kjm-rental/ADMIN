import { randomUUID } from "node:crypto";
import { confirmRentalOperation } from "@/app/actions/rental-operations";
import { ActionForm } from "./action-form";
import {
  BookingActionDialog,
  CancelBookingAction,
} from "./booking-action-dialog";
import { BookingDepositPanel } from "./booking-deposit-panel";
import { SubmitButton } from "./submit-button";
import { depositBalance } from "@/lib/deposit-balances";
import type { getSecurityDepositView } from "@/services/security-deposits";
const php = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value / 100,
  );
export function CashOperation({
  bookingId,
  operation,
  amount,
  label,
  title,
  children,
  confirmLabel,
  disabled = false,
}: {
  bookingId: string;
  operation: string;
  amount: number;
  label: string;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <BookingActionDialog label={label} title={title} disabled={disabled}>
      <ActionForm action={confirmRentalOperation} className="space-y-5">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="operation" value={operation} />
        <input type="hidden" name="expectedCentavos" value={amount} />
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
        <input type="hidden" name="confirmed" value="yes" />
        <div className="text-sm leading-7 text-slate-700">{children}</div>
        <p className="text-xs text-slate-500">
          Records physical cash only after you confirm. Your administrator
          identity and the current time are saved automatically.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <CancelBookingAction />
          <SubmitButton>{confirmLabel}</SubmitButton>
        </div>
      </ActionForm>
    </BookingActionDialog>
  );
}
export function RentalOperations({
  bookingId,
  status,
  version,
  balanceCentavos,
  data,
  paymentLocked = false,
  delivery = false,
  collection = false,
}: {
  bookingId: string;
  status: string;
  paymentLocked?: boolean;
  delivery?: boolean;
  collection?: boolean;
  version: number;
  balanceCentavos: number;
  data: Awaited<ReturnType<typeof getSecurityDepositView>>;
}) {
  const requirement = data.requirements[0];
  const balance = requirement ? depositBalance(requirement, data.events) : null;
  const returned = data.inspections.some((i) => i.kind === "return");
  const canPay = !["cancelled", "rejected", "expired"].includes(status);
  const cash = requirement?.option === "cash";
  const canReturn =
    returned &&
    ["active", "completed"].includes(status) &&
    !!balance &&
    balance.held > 0;
  return (
    <section
      id="rental-operations"
      aria-label="Rental Operations"
      className="rounded-2xl bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-extrabold text-deep-teal">
        Rental Operations
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Rental payments and refundable deposits stay separate.
      </p>
      <ol className="mt-4 divide-y divide-slate-100">
        <Step
          number={1}
          title="Rental payment"
          status={balanceCentavos === 0 ? "✓ Rental Paid" : "Pending"}
        >
          {canPay && (
            <CashOperation
              bookingId={bookingId}
              operation="rental_payment"
              amount={balanceCentavos}
              label="Mark Rental as Paid"
              title="Confirm Rental Payment"
              confirmLabel="Confirm Payment Received"
              disabled={balanceCentavos === 0 || paymentLocked}
            >
              <p>
                Have you received <strong>{php(balanceCentavos)}</strong> in
                cash from this customer?
              </p>
            </CashOperation>
          )}
          {paymentLocked && balanceCentavos > 0 && (
            <p className="text-xs text-amber-900">
              Online payment is in progress or requires reconciliation. Check
              QRPh status before recording another rental payment.
            </p>
          )}
        </Step>
        <Step
          number={2}
          title="Security deposit"
          status={
            !requirement
              ? "Not recorded"
              : !cash
                ? (balance?.status ?? "Not collected")
                : balance?.collected
                  ? `✓ Deposit Collected — ${php(balance.collected)}`
                  : "Not Collected"
          }
        >
          {cash && balance?.collected === 0 && status === "confirmed" && (
            <CashOperation
              bookingId={bookingId}
              operation="deposit_collection"
              amount={requirement.required_centavos}
              label="Mark Deposit as Collected"
              title="Confirm Security Deposit"
              confirmLabel="Confirm Deposit Collected"
            >
              <p>
                Have you received the{" "}
                <strong>{php(requirement.required_centavos)}</strong> refundable
                cash deposit?
              </p>
            </CashOperation>
          )}
          {requirement && !cash && status === "confirmed" && (
            <p className="text-xs text-slate-500">
              Record physical ID custody under Advanced deposit options.
            </p>
          )}
        </Step>
        <Step
          number={3}
          title="Motorcycle return"
          status={returned ? "✓ Returned" : "Not Returned"}
        >
          {version === 9 && status === "active" && !returned && (
            <BookingActionDialog
              label={
                collection
                  ? "Confirm Motorcycle Collected"
                  : "Mark Motorcycle as Returned"
              }
              title="Return inspection"
            >
              <BookingDepositPanel
                bookingId={bookingId}
                status={status}
                version={version}
                data={data}
                section="rental"
              />
            </BookingActionDialog>
          )}
          {version === 9 &&
            (status === "confirmed" || (status === "active" && returned)) && (
              <BookingActionDialog
                label={
                  status === "confirmed"
                    ? delivery
                      ? "Confirm Motorcycle Delivered"
                      : "Start handover"
                    : "Complete rental"
                }
              >
                <BookingDepositPanel
                  bookingId={bookingId}
                  status={status}
                  version={version}
                  data={data}
                  section="rental"
                />
              </BookingActionDialog>
            )}
        </Step>
        <Step
          number={4}
          title="Deposit refund"
          status={
            balance?.returned
              ? balance.held > 0
                ? `Partially Returned — ${php(balance.returned)}`
                : `✓ Deposit Returned — ${php(balance.returned)}`
              : balance?.deducted && balance.held === 0
                ? "Settled with approved deductions"
                : "Not Returned"
          }
        >
          {cash && canReturn && balance && (
            <CashOperation
              bookingId={bookingId}
              operation="deposit_refund"
              amount={balance.held}
              label="Return Security Deposit"
              title="Refund Security Deposit"
              confirmLabel="Confirm Cash Returned"
            >
              <dl className="mb-4 grid grid-cols-2 gap-2">
                <dt>Deposit collected</dt>
                <dd>{php(balance.collected)}</dd>
                <dt>Approved deductions</dt>
                <dd>{php(balance.deducted)}</dd>
                <dt>Already returned</dt>
                <dd>{php(balance.returned)}</dd>
                <dt className="font-bold">Amount to return</dt>
                <dd className="font-bold">{php(balance.held)}</dd>
              </dl>
              {balance.events
                .filter((e) => e.event_type === "cash_deducted")
                .map((e) => (
                  <p key={e.id}>
                    Approved deduction: {php(e.amount_centavos)} — {e.notes}
                  </p>
                ))}
              <p>
                Have you returned <strong>{php(balance.held)}</strong> in cash
                to the customer?
              </p>
            </CashOperation>
          )}
          {balance?.unresolved && (
            <p className="text-xs text-amber-800">
              An unresolved deposit case is recorded. Review its decision and
              approved deductions under Advanced deposit options before
              returning cash.
            </p>
          )}
        </Step>
      </ol>
    </section>
  );
}
function Step({
  number,
  title,
  status,
  children,
}: {
  number: number;
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <li className="space-y-3 py-4">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-extrabold text-ocean">
          {number}
        </span>
        <div>
          <h3 className="text-sm font-bold text-deep-teal">{title}</h3>
          <p
            className={`mt-1 text-xs font-semibold ${status.startsWith("✓") ? "text-emerald-700" : "text-slate-500"}`}
          >
            {status}
          </p>
        </div>
      </div>
      {children}
    </li>
  );
}
