import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  saveBookingSettings,
  setBookingTesterAuthorization,
} from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import {
  getMissingBookingPolicies,
  readOperatingHours,
  weekdays,
} from "@/lib/booking-settings";
import type { Database } from "@/types/database";

type Settings = Database["public"]["Tables"]["booking_settings"]["Row"];
type Check = Database["public"]["Tables"]["booking_readiness_checks"]["Row"];

export function BookingSettingsForm({
  settings,
  checks,
  errorCode,
  readinessSource,
}: {
  settings: Settings | null;
  checks: Check[];
  errorCode?: string;
  readinessSource?: { project: string; loadedAt: string };
}) {
  const hours = readOperatingHours(settings?.operating_hours);
  const missing = settings
    ? getMissingBookingPolicies(settings)
    : ["booking settings record"];
  const active = Boolean(
    settings?.public_booking_enabled &&
    settings.policies_approved_at &&
    !missing.length,
  );
  const errors: Record<string, string> = {
    hours: "Every enabled day needs valid pickup and return times.",
    invalid: "Review the policy fields and enter valid positive durations.",
    incomplete:
      "Public booking cannot be enabled until every required policy is complete and explicitly approved.",
    database:
      "The settings could not be saved. Check the connection and try again.",
    tester:
      "Tester authorization failed. Use a dedicated non-anonymous, non-administrator Auth user and an expiry within seven days.",
  };
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ocean/10 text-ocean">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-deep-teal">
            Booking settings
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Configure business-owned rules. Saving a draft never enables public
            booking.
          </p>
        </div>
      </div>
      <div
        className={`mt-6 rounded-2xl border p-4 ${active ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
      >
        <div className="flex gap-3">
          {active ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 text-amber-700" />
          )}
          <div>
            <p className="text-sm font-extrabold text-deep-teal">
              Public booking is {active ? "enabled" : "disabled"}
            </p>
            {missing.length > 0 && (
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Missing: {missing.join(", ")}.
              </p>
            )}
          </div>
        </div>
      </div>
      <details className="settings-advanced">
        <summary>Technical readiness checks</summary>
        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-extrabold text-deep-teal">
            Technical readiness evidence
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Technical checks are separate from business configuration and are
            never marked passed by saving this form.
          </p>
          {readinessSource && (
            <p className="mt-2 break-words text-xs text-slate-500">
              Source: {readinessSource.project} · Loaded{" "}
              {new Date(readinessSource.loadedAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}{" "}
              · Asia/Manila. Each check below shows when it was verified.
            </p>
          )}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checks.map((check) => (
              <li
                key={check.check_key}
                className="rounded-lg bg-slate-50 px-3 py-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span>{check.check_key.replaceAll("_", " ")}</span>
                  <strong
                    className={
                      check.passed ? "text-emerald-700" : "text-amber-700"
                    }
                  >
                    {check.passed ? "Passed" : "Not verified"}
                  </strong>
                </div>
                <p className="mt-2 break-words leading-5 text-slate-500">
                  {check.evidence ?? "No automated evidence recorded."}
                </p>
                {check.checked_at && (
                  <time
                    dateTime={check.checked_at}
                    className="mt-1 block text-[10px] text-slate-400"
                  >
                    Checked{" "}
                    {new Date(check.checked_at).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}{" "}
                    · Asia/Manila
                  </time>
                )}
              </li>
            ))}
          </ul>
          {!checks.length && (
            <p className="mt-3 text-xs font-bold text-amber-700">
              No readiness checks were returned. Review the configured checks
              before enabling public booking.
            </p>
          )}
        </div>
      </details>
      {errorCode && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {errors[errorCode] ?? "Unable to save booking settings."}
        </p>
      )}
      <details className="settings-advanced">
        <summary>Advanced: restricted booking testers</summary>
        <div className="mt-5 rounded-2xl border border-ocean/20 bg-ocean/5 p-5">
          <h3 className="font-extrabold text-deep-teal">
            Restricted synthetic booking test
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This never enables public booking. Authorization is
            database-enforced, expires within seven days, and grants no
            administrator access.
          </p>
          <ActionForm
            action={setBookingTesterAuthorization}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input
              required
              aria-label="Existing authorized tester user ID"
              name="authUserId"
              placeholder="Existing Supabase Auth user UUID"
              autoComplete="off"
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <input
              aria-label="Tester authorization expiry (Asia/Manila)"
              name="expiresAt"
              type="datetime-local"
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <ConfirmButton
              message="Update restricted tester authorization for this existing account?"
              name="authorized"
              value="true"
              className="rounded-xl border border-ocean px-4 py-2.5 text-sm font-bold text-ocean"
            >
              Authorize tester
            </ConfirmButton>
            <ConfirmButton
              message="Update restricted tester authorization for this existing account?"
              name="authorized"
              value="false"
              formNoValidate
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700"
            >
              Revoke immediately
            </ConfirmButton>
          </ActionForm>
        </div>
      </details>
      <ActionForm action={saveBookingSettings} className="mt-7 space-y-8">
        <fieldset className="admin-settings-fields">
          <legend className="font-extrabold text-deep-teal">
            Hourly extension policy
          </legend>
          <label className="mt-3 block text-sm font-bold">
            Maximum hourly extension after complete 24-hour periods
            <input
              name="maxHourlyExtensionHours"
              type="number"
              min="0"
              max="23"
              step="1"
              defaultValue={settings?.max_hourly_extension_hours ?? ""}
              disabled={settings?.max_hourly_extension_hours === undefined}
              placeholder="Not selected — preserve current billing"
              className="mt-2 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Leave blank to preserve current billing. Save 0 to bill every
            additional period as a complete rental day, or 1–23 to permit hourly
            extensions up to that many hours. Beyond this limit, the extension
            is not permitted; choose a complete rental period instead (requires
            migration 034). Partial hours round up to the next hour; hourly
            charges never exceed that next period. Minimum rental: 24 hours.
            Requires “started 24 hours” day calculation. Changes apply to new
            quotes, not saved bookings.
          </p>
          {settings?.max_hourly_extension_hours === undefined && (
            <p className="mt-2 text-xs text-amber-800">
              Apply reviewed migration 032 before configuring this policy.
            </p>
          )}
        </fieldset>
        <fieldset className="admin-settings-fields">
          <legend className="font-extrabold text-deep-teal">
            Weekly pickup and return hours
          </legend>
          <p className="mt-1 text-xs text-slate-500">
            Asia/Manila timezone. Use 00:00 as midnight at the end of the
            business day; closed days do not require times.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-3">Day</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Pickup window</th>
                  <th className="p-3">Return window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weekdays.map((day) => {
                  const schedule = hours?.[day];
                  return (
                    <tr key={day}>
                      <th className="p-3 text-left capitalize text-deep-teal">
                        {day}
                      </th>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`${day} operating hours enabled`}
                          name={`${day}Enabled`}
                          defaultChecked={schedule?.enabled ?? false}
                          className="size-4 accent-ocean"
                        />
                      </td>
                      <td className="p-3">
                        <TimeInput
                          name={`${day}PickupOpen`}
                          value={
                            schedule?.enabled ? schedule.pickupOpen : "08:00"
                          }
                        />{" "}
                        <span className="px-1">to</span>{" "}
                        <TimeInput
                          name={`${day}PickupClose`}
                          value={
                            schedule?.enabled ? schedule.pickupClose : "17:00"
                          }
                        />
                      </td>
                      <td className="p-3">
                        <TimeInput
                          name={`${day}ReturnOpen`}
                          value={
                            schedule?.enabled ? schedule.returnOpen : "08:00"
                          }
                        />{" "}
                        <span className="px-1">to</span>{" "}
                        <TimeInput
                          name={`${day}ReturnClose`}
                          value={
                            schedule?.enabled ? schedule.returnClose : "17:00"
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset className="admin-settings-fields grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 font-extrabold text-deep-teal sm:col-span-2">
            Pricing and reservation timing
          </legend>
          <Select
            label="Rental-day calculation"
            name="dayCalculation"
            value={settings?.partial_day_policy}
          >
            <option value="">Select a rule</option>
            <option value="started_24_hours">
              Each started 24-hour period
            </option>
            <option value="calendar_day">Each Manila calendar day</option>
          </Select>
          <Select
            label="Partial-day pricing"
            name="partialDayPricing"
            value={settings?.partial_day_pricing_policy}
          >
            <option value="">Select a rule</option>
            <option value="charge_full_day">Charge a full day</option>
            <option value="prorated">Prorate partial days</option>
            <option value="not_allowed">Do not allow partial days</option>
          </Select>
          <NumberField
            label="Pending request expires after (minutes)"
            name="pendingExpirationMinutes"
            value={settings?.pending_expiration_minutes}
          />
          <NumberField
            label="Inventory hold duration (minutes, optional)"
            name="pendingHoldMinutes"
            value={settings?.pending_hold_minutes}
          />
        </fieldset>
        <fieldset className="admin-settings-fields grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 font-extrabold text-deep-teal sm:col-span-2">
            Identity and driving eligibility
          </legend>
          <TextArea
            label="Accepted Philippine IDs (one per line)"
            name="acceptedIds"
            value={
              Array.isArray(settings?.accepted_philippine_id_types)
                ? settings.accepted_philippine_id_types
                    .filter((v): v is string => typeof v === "string")
                    .join("\n")
                : ""
            }
          />
          <TextArea
            label="Philippine driver's licence policy"
            name="philippineLicensePolicy"
            value={settings?.philippine_license_policy}
          />
          <TextArea
            label="International driver's licence policy"
            name="internationalLicensePolicy"
            value={settings?.international_license_policy}
          />
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-deep-teal">
            <input
              type="checkbox"
              checked
              readOnly
              className="mr-3 size-4 accent-ocean"
            />
            International renters require manual review
            <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
              Required by the current verification workflow and cannot be
              bypassed here.
            </p>
          </label>
          <Field
            label="International policy source URL"
            name="internationalSource"
            type="url"
            value={settings?.international_policy_source_url}
          />
          <Field
            label="Source reviewed on"
            name="internationalVerified"
            type="date"
            value={settings?.international_policy_verified_at}
          />
        </fieldset>
        <fieldset className="admin-settings-fields grid gap-5">
          <legend className="mb-1 font-extrabold text-deep-teal">
            Privacy and retention
          </legend>
          <TextArea
            label="Customer-facing privacy notice"
            name="privacyNotice"
            value={settings?.privacy_notice}
            rows={5}
          />
          <TextArea
            label="Identity-document retention and secure-deletion policy"
            name="retentionPolicy"
            value={settings?.retention_policy}
            rows={5}
          />
        </fieldset>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="flex items-start gap-3 text-sm font-bold text-deep-teal">
            <input
              type="checkbox"
              name="policyApproval"
              className="mt-0.5 size-4 accent-ocean"
            />
            I confirm these policies have been reviewed and approved by KJM.
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm font-extrabold text-deep-teal">
            <input
              type="checkbox"
              name="publicBookingEnabled"
              defaultChecked={settings?.public_booking_enabled ?? false}
              className="mt-0.5 size-4 accent-ocean"
            />
            Enable public booking after all readiness checks pass
          </label>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            The master switch remains off if any required field is missing.
            Pending expiry records a policy but still requires an operational
            expiry worker before relying on automatic expiration.
          </p>
        </div>
        <SubmitButton pendingLabel="Validating and saving…">
          Save booking settings
        </SubmitButton>
      </ActionForm>
    </section>
  );
}

function TimeInput({ name, value }: { name: string; value: string }) {
  return (
    <input
      type="time"
      aria-label={name.replace(/([A-Z])/g, " $1")}
      name={name}
      defaultValue={value}
      className="rounded-lg border border-slate-200 px-2 py-1.5"
    />
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | null;
}) {
  return (
    <label className="text-sm font-bold text-deep-teal">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
      />
    </label>
  );
}
function NumberField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: number | null;
}) {
  return (
    <Field label={label} name={name} type="number" value={value?.toString()} />
  );
}
function TextArea({
  label,
  name,
  value,
  rows = 4,
}: {
  label: string;
  name: string;
  value?: string | null;
  rows?: number;
}) {
  return (
    <label className="text-sm font-bold text-deep-teal">
      {label}
      <textarea
        name={name}
        rows={rows}
        defaultValue={value ?? ""}
        className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
      />
    </label>
  );
}
function Select({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-bold text-deep-teal">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
      >
        {children}
      </select>
    </label>
  );
}
