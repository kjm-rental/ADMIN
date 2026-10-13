import { CreditCard, RotateCcw, Wallet, Receipt } from "lucide-react";
import {
  PageHeading,
  StatCard,
  Panel,
  StatusBadge,
  TextLink,
  EmptyState,
  formatPHP,
  formatDate,
} from "@/components/admin-ui";
import { getOperationsView } from "@/services/operations-view";
import { summarizePayments } from "@/lib/operational-summary";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams,
    data = await getOperationsView(),
    test = scope === "test";
  const summary = summarizePayments(data.bookings, data.payments, test);
  const events = [...summary.payments].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const outstanding = summary.bookings.filter(
    (b) =>
      ["confirmed", "active", "completed"].includes(b.status) &&
      b.total_centavos > (summary.balances.get(b.id) ?? 0),
  );
  return (
    <div>
      <PageHeading
        eyebrow="Financial records"
        title="Payments & balances"
        description="Verified offline payment events, refunds, and reversals. These records do not move money or activate online payments."
      />
      <nav className="admin-subnav" aria-label="Financial record scope">
        <TextLink href="?scope=business">Business records</TextLink>
        <TextLink href="?scope=test">Test records</TextLink>
      </nav>
      <p className={`admin-note ${test ? "admin-note-warning" : ""}`}>
        {test
          ? "Test records only. Excluded from business totals."
          : "Business records only. Synthetic bookings and payment events are excluded."}
      </p>
      <section className="admin-stats" aria-label="Payment summary">
        <StatCard
          label="Recorded payments"
          value={formatPHP(summary.payment / 100)}
          icon={CreditCard}
        />
        <StatCard
          label="Refunds"
          value={formatPHP(summary.refund / 100)}
          icon={RotateCcw}
          tone="coral"
        />
        <StatCard
          label="Reversals"
          value={formatPHP(summary.reversal / 100)}
          icon={Receipt}
          tone="warning"
        />
        <StatCard
          label="Net recorded"
          value={formatPHP(summary.net / 100)}
          icon={Wallet}
          note="Payments less refunds and reversals"
        />
      </section>
      <Panel
        title="Outstanding balances"
        description="Positive recorded balances for confirmed, active, and completed bookings."
        action={<strong>{formatPHP(summary.outstanding / 100)}</strong>}
      >
        {outstanding.length ? (
          <ul className="admin-list">
            {outstanding.map((b) => (
              <li key={b.id}>
                <div>
                  <TextLink href={`/dashboard/bookings/${b.id}`}>
                    {b.booking_reference}
                  </TextLink>
                  <p>
                    {b.status} {b.is_test ? "· Test" : ""}
                  </p>
                </div>
                <strong>
                  {formatPHP(
                    Math.max(
                      0,
                      b.total_centavos - (summary.balances.get(b.id) ?? 0),
                    ) / 100,
                  )}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No outstanding balances in this scope" />
        )}
      </Panel>
      <div className="admin-table-wrap">
        <table className="admin-responsive-table">
          <caption className="sr-only">
            Verified payment event ledger — {test ? "test" : "business"} records
          </caption>
          <thead>
            <tr>
              {[
                "Booking",
                "Event",
                "Amount",
                "Method / reference",
                "Recorded at",
                "Audit",
              ].map((x) => (
                <th key={x} scope="col">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td data-label="Booking">
                  <TextLink href={`/dashboard/bookings/${e.booking_id}`}>
                    {summary.bookings.find((b) => b.id === e.booking_id)
                      ?.booking_reference ?? "Booking"}
                  </TextLink>
                  {e.is_test && <StatusBadge value="test" />}
                </td>
                <td data-label="Event">
                  <StatusBadge value={e.event_type} />
                </td>
                <td data-label="Amount">
                  <strong>{formatPHP(e.amount_centavos / 100)}</strong>
                </td>
                <td data-label="Method / reference">
                  {e.method.replaceAll("_", " ")}
                  <p className="text-slate-500">
                    {e.transaction_reference ?? "No reference"}
                  </p>
                </td>
                <td data-label="Recorded at">{formatDate(e.occurred_at)}</td>
                <td data-label="Audit">
                  <span className="break-all">
                    {e.original_payment_event_id
                      ? `Original event: ${e.original_payment_event_id}`
                      : "Verified offline record"}
                  </span>
                  <p className="text-slate-500">{e.internal_notes ?? "—"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && (
          <EmptyState
            title="No verified payment events"
            description="Record offline payments from the relevant booking after verifying receipt."
          />
        )}
      </div>
    </div>
  );
}
