import { getSecurityDepositView } from "@/services/security-deposits";
import { depositBalance } from "@/lib/deposit-balances";
import Link from "next/link";
import {
  Bike,
  CalendarDays,
  ClipboardList,
  Clock3,
  CreditCard,
  ShieldCheck,
  ArrowUpRight,
  Wrench,
} from "lucide-react";
import {
  PageHeading,
  Panel,
  StatCard,
  EmptyState,
  StatusBadge,
  TextLink,
  formatPHP,
  formatDate,
} from "@/components/admin-ui";
import { getOperationsView } from "@/services/operations-view";
import { summarizePayments, manilaDay } from "@/lib/operational-summary";
import { inventorySummary } from "@/lib/inventory";
export default async function DashboardPage() {
  const data = await getOperationsView();
  const deposits = await getSecurityDepositView();
  const liabilities = deposits.requirements
    .filter((d) => !d.is_test)
    .map((d) => depositBalance(d, deposits.events));
  const finance = summarizePayments(data.bookings, data.payments);
  const bookings = finance.bookings,
    now = new Date(),
    today = manilaDay(now);
  const pending = bookings.filter((b) =>
    ["submitted", "pending"].includes(b.status),
  );
  const pickups = bookings.filter(
    (b) => b.status === "confirmed" && manilaDay(b.start_at) === today,
  );
  const returns = bookings.filter(
    (b) => b.status === "active" && manilaDay(b.end_at) === today,
  );
  const overdue = bookings.filter(
    (b) => b.status === "active" && Date.parse(b.end_at) < now.getTime(),
  );
  const ids = new Set(bookings.map((b) => b.id));
  const reviews = data.verifications.filter(
    (v) =>
      ids.has(v.booking_id) &&
      ["submitted", "under_review", "resubmission_required"].includes(
        v.overall_status,
      ),
  );
  const inventory = inventorySummary(data.units, data.bookings, data.holds);
  const cards = [
    {
      label: "Total bookings",
      value: bookings.length,
      icon: ClipboardList,
      note: "Business records · all statuses",
    },
    {
      label: "Pending requests",
      value: pending.length,
      icon: Clock3,
      note: "Submitted + pending",
      tone: "warning",
    },
    {
      label: "Confirmed bookings",
      value: bookings.filter((b) => b.status === "confirmed").length,
      icon: CalendarDays,
      note: "Ready for scheduled handover",
    },
    {
      label: "Active rentals",
      value: bookings.filter((b) => b.status === "active").length,
      icon: Bike,
      note: "Currently handed over",
    },
    {
      label: "Today’s pickups",
      value: pickups.length,
      icon: ArrowUpRight,
      note: "Confirmed · Manila time",
    },
    {
      label: "Today’s returns",
      value: returns.length,
      icon: CalendarDays,
      note: "Active · Manila time",
    },
    {
      label: "Overdue returns",
      value: overdue.length,
      icon: Clock3,
      note: "Active past scheduled return",
      tone: "coral",
    },
    {
      label: "Pending verification",
      value: reviews.length,
      icon: ShieldCheck,
      note: "Review or resubmission required",
    },
  ];
  const operations = [
    ...new Map(
      [...overdue, ...pickups, ...returns].map((b) => [b.id, b]),
    ).values(),
  ];
  return (
    <div>
      <PageHeading
        eyebrow="Operations overview"
        title="Your day, at a glance"
        description={`Bookings, fleet readiness, and recorded payments. ${formatDate(now.toISOString(), false)} · Asia/Manila.`}
        actions={
          <Link className="admin-button" href="/dashboard/bookings">
            View bookings <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        }
      />
      <section className="admin-stats" aria-label="Booking summary">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>
      <Panel
        title="Security deposits"
        description="Refundable liabilities and permitted document custody are separate from rental revenue."
        action={<TextLink href="/dashboard/deposits">Manage deposits</TextLink>}
      >
        {deposits.available ? (
          <section className="admin-stats">
            <StatCard
              icon={ShieldCheck}
              label="Cash security deposits held"
              value={formatPHP(
                liabilities.reduce((sum, d) => sum + d.held, 0) / 100,
              )}
            />
            <StatCard
              icon={ShieldCheck}
              label="Deposits awaiting return"
              value={
                liabilities.filter((d) => d.held > 0 || d.custody > 0).length
              }
            />
            <StatCard
              icon={ShieldCheck}
              label="Unresolved deposit cases"
              value={liabilities.filter((d) => d.unresolved).length}
            />
            <StatCard
              icon={ShieldCheck}
              label="Cash rental payments received"
              value={formatPHP(
                finance.payments
                  .filter(
                    (e) => e.method === "cash" && e.event_type === "payment",
                  )
                  .reduce((sum, e) => sum + e.amount_centavos, 0) / 100,
              )}
              note="Gross verified cash receipts; excludes deposits"
            />
          </section>
        ) : (
          <p className="text-sm text-amber-800">
            Deposit accounting awaits approval and application of migration 020.
            No deposit statistics are estimated.
          </p>
        )}
      </Panel>
      <div className="admin-grid">
        <Panel
          title="Today’s operations"
          description="Scheduled pickups, active returns, and overdue rentals."
          action={<TextLink href="/dashboard/calendar">Calendar</TextLink>}
        >
          {operations.length ? (
            <ul className="admin-list">
              {operations.map((b) => (
                <li key={b.id}>
                  <div>
                    <TextLink href={`/dashboard/bookings/${b.id}`}>
                      {b.booking_reference}
                    </TextLink>
                    <p>
                      {formatDate(b.start_at)} → {formatDate(b.end_at)}
                    </p>
                  </div>
                  <StatusBadge
                    value={
                      overdue.some((x) => x.id === b.id) ? "overdue" : b.status
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No operations due today"
              description="Pickups and returns appear here when scheduled bookings are ready."
            />
          )}
        </Panel>
        <Panel
          title="Fleet readiness"
          description="Current inventory, including live commitments and holds."
          action={<TextLink href="/dashboard/fleet">Manage fleet</TextLink>}
        >
          <dl className="admin-mini-metrics">
            {Object.entries(inventory).map(([label, value]) => (
              <div key={label}>
                <dt className="capitalize">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="admin-note">
            Available units: {inventory.available}. Inventory quantities
            continue to use the existing quantity management system.
          </p>
        </Panel>
      </div>
      <div className="admin-grid">
        <Panel
          title="Requests needing attention"
          action={
            <TextLink href="/dashboard/verifications">Verifications</TextLink>
          }
        >
          {pending.length ? (
            <ul className="admin-list">
              {pending.slice(0, 6).map((b) => (
                <li key={b.id}>
                  <div>
                    <TextLink href={`/dashboard/bookings/${b.id}`}>
                      {b.booking_reference}
                    </TextLink>
                    <p>Pickup {formatDate(b.start_at)}</p>
                  </div>
                  <StatusBadge value={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No pending requests"
              description="New requests will appear here for administrator review."
            />
          )}
        </Panel>
        <Panel
          title="Finance snapshot"
          description="Verified payment events only. Business records."
          action={<TextLink href="/dashboard/finance">Finance</TextLink>}
        >
          <div className="space-y-3">
            <StatCard
              label="Net recorded payments"
              value={formatPHP(finance.net / 100)}
              icon={CreditCard}
              note="Payments less refunds and reversals"
            />
            <StatCard
              label="Outstanding balances"
              value={formatPHP(finance.outstanding / 100)}
              icon={Wrench}
              note="Confirmed, active, and completed bookings"
            />
          </div>
        </Panel>
      </div>
      <p className="admin-note">
        {data.bookings.filter((b) => b.is_test).length} test booking(s) excluded
        from booking and finance summaries. Fleet readiness includes all real
        unit commitments, including authorized test holds.
      </p>
    </div>
  );
}
