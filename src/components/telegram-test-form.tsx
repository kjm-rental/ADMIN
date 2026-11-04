"use client";
import { useActionState } from "react";
import { sendTelegramTestMessage } from "@/app/actions/telegram-test";
import { SubmitButton } from "@/components/submit-button";
export function TelegramTestForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(sendTelegramTestMessage, {
    success: false,
    message: "",
  });
  return (
    <form action={action} aria-busy={pending} className="space-y-3">
      <fieldset disabled={pending} className="space-y-3">
        <label className="block text-sm font-bold text-deep-teal">
          Test message
          <textarea
            name="message"
            required
            minLength={1}
            maxLength={1000}
            rows={3}
            defaultValue="Hello from KJM! This is an owner-only Telegram connection test."
            className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
          />
        </label>
        <p className="text-xs text-slate-500">
          Sends only to the configured owner. Do not include passwords, document
          numbers, or ID photos. This test does not enable automatic
          notifications.
        </p>
        <SubmitButton disabled={!configured} pendingLabel="Sending…">
          Send Test Message
        </SubmitButton>
      </fieldset>
      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={`rounded-xl p-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
