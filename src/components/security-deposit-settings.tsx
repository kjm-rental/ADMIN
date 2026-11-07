import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { saveSecurityDepositSettings } from "@/app/actions/security-deposits";
import type { DepositSettings } from "@/types/rental";
export function SecurityDepositSettings({
  settings,
  available,
}: {
  settings: DepositSettings | null;
  available: boolean;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-extrabold text-deep-teal">
        Security deposit settings
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Rental payments are cash on pickup. Refundable deposits are recorded
        separately from rental revenue. Changes apply only to future requests.
      </p>
      {!available ? (
        <p
          role="status"
          className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          Deposit management awaits approval and application of migration 020.
          No deposit option has been activated.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-600">
            Cash security deposits only. Customers never leave or surrender
            original IDs.
          </p>
          <ActionForm
            action={saveSecurityDepositSettings}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <Check
              name="cashEnabled"
              label="Enable cash security deposit"
              value={settings?.cash_enabled}
            />
            <label className="text-sm font-bold">
              Default cash deposit (PHP)
              <input
                name="cashAmountPhp"
                type="number"
                step="0.01"
                min="0.01"
                max="21474836.47"
                defaultValue={
                  settings?.cash_amount_centavos != null
                    ? settings.cash_amount_centavos / 100
                    : ""
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3"
              />
            </label>
            <p className="text-sm leading-6 text-slate-500 sm:col-span-2">
              Owner terms effective October 12, 2026 state a refundable ₱2,500
              deposit, or another amount in the booking confirmation. This is a
              proposed configuration value; the existing amount and approval
              controls are unchanged.
            </p>
            <Check
              name="cashPolicyApproved"
              label="I explicitly approve the cash deposit policy and instructions"
            />
            <Check
              name="partialReturns"
              label="Policy permits partial cash deposit returns"
              value={settings?.partial_cash_return_allowed}
            />
            <Text
              name="collectionInstructions"
              label="Deposit collection instructions"
              value={settings?.collection_instructions}
            />
            <Text
              name="returnInstructions"
              label="Deposit return instructions"
              value={settings?.return_instructions}
            />
            <Text
              name="disputeInstructions"
              label="Refund and dispute handling"
              value={settings?.dispute_instructions}
            />
            <p className="text-xs leading-5 text-slate-500">
              Cash policy:{" "}
              {settings?.cash_policy_approved_at
                ? "previously approved; explicit approval required for this save"
                : "awaiting approval"}
              . Changes apply to new bookings.
            </p>
            <ConfirmButton
              message="Save these requirements for future bookings? Existing booking deposit snapshots remain unchanged. "
              className="admin-button sm:col-span-2"
            >
              Save deposit requirements
            </ConfirmButton>
          </ActionForm>
        </>
      )}
    </section>
  );
}
function Check({
  name,
  label,
  value = false,
}: {
  name: string;
  label: string;
  value?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
      <input
        className="mt-1 size-4 shrink-0"
        type="checkbox"
        name={name}
        defaultChecked={value}
      />
      {label}
    </label>
  );
}
function Text({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <textarea
        name={name}
        defaultValue={value ?? ""}
        maxLength={4000}
        rows={3}
        className="mt-2 w-full rounded-xl border border-slate-200 p-3"
      />
    </label>
  );
}
