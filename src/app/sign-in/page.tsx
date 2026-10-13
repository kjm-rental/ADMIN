import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { getAdminSession } from "@/lib/auth";

export const instant = false;
const messages: Record<string, string> = {
  "invalid-input": "Enter your 4-digit administrator PIN.",
  "invalid-credentials": "The PIN is incorrect.",
  "not-authorized": "This account does not have active administrator access.",
  configuration: "PIN sign-in has not been configured by the administrator.",
};
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminSession()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className="admin-login">
      <section className="admin-login-brand" aria-label="KJM Rental Management">
        <div className="flex items-center gap-4">
          <Image
            src="/images/brand/kjm-logo.png"
            width={160}
            height={186}
            alt="KJM Motorcycle Rental logo"
            className="admin-login-logo"
            style={{
              maxWidth: 160,
              height: "auto",
              maxHeight: 190,
              objectFit: "contain",
            }}
          />
        </div>
        <div>
          <p className="admin-eyebrow">Your operations, together</p>
          <h2>
            A clear view.
            <br />A smoother day.
          </h2>
          <p>
            Manage reservations, fleet, and rental operations from one private
            workspace.
          </p>
        </div>
        <p>Lapu-Lapu City · Mactan Island · Cebu</p>
      </section>
      <section className="admin-login-panel">
        <div className="admin-login-form">
          <span className="admin-stat-icon">
            <LockKeyhole aria-hidden="true" />
          </span>
          <h1>Welcome back</h1>
          <p>Enter your administrator PIN to access KJM Rental Management.</p>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {messages[error] ?? "Sign-in failed."}
            </p>
          )}
          <form action={signIn} className="mt-7 space-y-4">
            <label className="block text-sm font-bold text-deep-teal">
              Administrator PIN
              <input
                required
                minLength={4}
                maxLength={4}
                pattern="[0-9]{4}"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter 4 digits"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none focus:border-ocean focus:ring-3 focus:ring-ocean/10"
              />
            </label>
            <button className="min-h-12 w-full rounded-xl bg-ocean font-bold text-white shadow-lg shadow-ocean/15 hover:bg-[#066f7a]">
              Unlock dashboard
            </button>
          </form>
          <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
            Access is restricted to manually authorized KJM administrators.
            Public registration is disabled.
          </p>
        </div>
      </section>
    </main>
  );
}
