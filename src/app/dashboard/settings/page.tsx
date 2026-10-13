import Link from "next/link";
import { SecurityDepositSettings } from "@/components/security-deposit-settings";
import { getSecurityDepositView } from "@/services/security-deposits";
import { ActionForm } from "@/components/action-form";
import { checkedQueries } from "@/lib/query-results";
import { KeyRound, ShieldCheck } from "lucide-react";
import { changePin } from "@/app/actions/auth";
import { BookingSettingsForm } from "@/components/booking-settings-form";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

const errors: Record<string, string> = {
  invalid: "Enter matching 4-digit PIN values.",
  current: "The current PIN is incorrect.",
  configuration: "PIN sign-in is not configured correctly.",
  "not-authorized":
    "This account is not authorized to change the administrator PIN.",
  update: "Supabase could not update the PIN. Please try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    changed?: string;
    policy?: string;
    ready?: string;
    bookingError?: string;
    tester?: string;
  }>;
}) {
  const { error, changed, policy, ready, bookingError, tester } =
    await searchParams;
  const { supabase } = await requireAdmin();
  const deposits = await getSecurityDepositView();
  const [{ data: booking }, { data: readiness }] = await Promise.all([
    supabase.from("booking_settings").select("*").maybeSingle(),
    supabase.from("booking_readiness_checks").select("*").order("check_key"),
  ]).then(checkedQueries);
  return (
    <div className="admin-settings-layout">
      <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
        Settings
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-deep-teal">
        Workspace settings
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Rental policies, booking readiness, authorized testing, and
        administrator security.
      </p>
      {changed === "1" && (
        <p
          role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
        >
          Administrator PIN changed successfully.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {errors[error] ?? "Unable to change the PIN."}
        </p>
      )}
      {tester === "1" && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-700"
        >
          Tester authorization updated successfully.
        </p>
      )}
      {policy === "1" && (
        <p
          role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
        >
          {ready === "1"
            ? "Complete booking policies saved."
            : "Booking settings draft saved. Public booking remains disabled."}
        </p>
      )}
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ocean/10 text-ocean">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-deep-teal">
              Change administrator PIN
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Choose exactly four digits. Avoid birthdays, repeated digits, or
              codes used elsewhere.
            </p>
          </div>
        </div>
        <ActionForm
          action={changePin}
          className="mt-7 grid gap-5 sm:grid-cols-2"
        >
          <PinField label="Current PIN" name="currentPin" />
          <PinField label="New PIN" name="newPin" />
          <PinField label="Confirm new PIN" name="confirmPin" />
          <div className="flex items-end">
            <SubmitButton pendingLabel="Changing PIN…" className="w-full">
              Change PIN
            </SubmitButton>
          </div>
        </ActionForm>
        <div className="mt-7 flex gap-3 rounded-2xl bg-slate-50 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ocean" />
          <p className="text-xs leading-5 text-slate-500">
            The PIN is transformed into a server-only derived credential before
            Supabase authentication. The raw PIN is never stored by this
            application.
          </p>
        </div>
      </section>
      <Link
        href="/dashboard/settings/notifications"
        className="mt-8 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-ocean/20 bg-ocean/5 p-5 font-bold text-deep-teal hover:bg-ocean/10 focus-visible:outline-2 focus-visible:outline-ocean"
      >
        <span>
          Notifications{" "}
          <span className="mt-1 block text-xs font-normal text-slate-600">
            Telegram operations & transactional customer emails
          </span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      <SecurityDepositSettings
        available={deposits.available}
        settings={deposits.settings}
      />
      <BookingSettingsForm
        settings={booking}
        checks={readiness ?? []}
        errorCode={bookingError}
        readinessSource={{
          project: new URL(getSupabasePublicConfig().url).hostname.split(".")[0],
          loadedAt: new Date().toISOString(),
        }}
      />
    </div>
  );
}

function PinField({ label, name }: { label: string; name: string }) {
  return (
    <label className="text-sm font-bold text-deep-teal">
      {label}
      <input
        required
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete={
          name === "currentPin" ? "current-password" : "new-password"
        }
        minLength={4}
        maxLength={4}
        pattern="[0-9]{4}"
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3.5 tracking-[.4em] outline-none focus:border-ocean focus:ring-3 focus:ring-ocean/10"
      />
    </label>
  );
}
