import { requireAdmin } from "@/lib/auth";
import { parseVerificationProgress } from "@/lib/verification-progress";
import { formatDate } from "@/components/admin-ui";
import type { Database } from "@/types/database";
export async function AutomaticDocumentScreening({
  verification,
}: {
  verification: Database["public"]["Tables"]["customer_verifications"]["Row"];
}) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_verification_progress", {
    p_booking_id: verification.booking_id,
  });
  const progress = error ? null : parseVerificationProgress(data);
  const latest = progress?.checks.find((item) => item.current);
  const checks = latest?.summary.checks ?? [];
  const warnings = checks.filter((check) => check.status !== "passed");
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
        Automatic checks
      </h2>
      <p className="text-sm font-bold text-deep-teal">
        {latest
          ? latest.summary.preliminaryStatus === "passed"
            ? "Automatic document checks passed."
            : `${checks.filter((c) => c.status === "passed").length} passed · ${warnings.length} need review`
          : "No current automatic results"}
      </p>
      {warnings.slice(0, 3).map((check, i) => (
        <p
          key={i}
          className="line-clamp-2 text-xs leading-relaxed text-amber-900"
        >
          ! {check.label}: {check.detail}
        </p>
      ))}
      {!progress && (
        <p className="text-xs text-amber-900">
          Saved checks unavailable. Reload to retry.
        </p>
      )}
      <p className="text-xs text-slate-500">
        Risk:{" "}
        {latest?.summary.riskLevel ??
          verification.document_risk_level ??
          "Not assessed"}
      </p>
      <details>
        <summary className="min-h-9 cursor-pointer py-2 text-xs font-bold text-ocean">
          View details
          {warnings.length > 3 ? ` · ${warnings.length - 3} more warnings` : ""}
        </summary>
        <div className="space-y-3 text-xs">
          {latest && (
            <p className="text-slate-500">
              Checked {formatDate(latest.createdAt)} · Asia/Manila
            </p>
          )}
          {checks.map((check, i) => (
            <p key={i}>
              <strong>
                {check.status === "passed"
                  ? "PASS"
                  : check.status === "failed"
                    ? "CORRECTION REQUIRED"
                    : "REVIEW"}{" "}
                · {check.label}
              </strong>
              <br />
              {check.detail}
            </p>
          ))}
          {latest?.summary.reviewReasons?.map((reason, i) => (
            <p key={`reason-${i}`}>{reason}</p>
          ))}
          {progress?.checks
            .filter((item) => !item.current)
            .map((item) => (
              <p key={item.id}>
                {formatDate(item.createdAt)} · Previous uploads ·{" "}
                {item.summary.preliminaryStatus.replaceAll("_", " ")}
              </p>
            ))}
          {!latest && (
            <p>NOT CHECKED — no saved checks for current documents.</p>
          )}
        </div>
      </details>
    </section>
  );
}
