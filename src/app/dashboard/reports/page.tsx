import { ClipboardList, Bike, CreditCard, FlaskConical } from "lucide-react";
import {
  PageHeading,
  Panel,
  StatCard,
  TextLink,
  formatPHP,
} from "@/components/admin-ui";
import { getOperationsView } from "@/services/operations-view";
import { summarizePayments } from "@/lib/operational-summary";
import { inventorySummary } from "@/lib/inventory";
export default async function ReportsPage() {
  const data = await getOperationsView(),
    summary = summarizePayments(data.bookings, data.payments),
    inventory = inventorySummary(data.units, data.bookings, data.holds);
  const statuses = [
    "submitted",
    "pending",
    "confirmed",
    "active",
    "completed",
    "rejected",
    "cancelled",
    "expired",
  ];
  return (
    <div>
      <PageHeading
        eyebrow="Reporting"
        title="Operations, in perspective"
        description="Read-only, all-time summaries from existing booking, inventory, and verified payment records. Business booking and financial totals exclude test records."
      />
      <section className="admin-stats">
        <StatCard
          label="Business bookings"
          value={summary.bookings.length}
          icon={ClipboardList}
        />
        <StatCard label="Physical units" value={inventory.total} icon={Bike} />
        <StatCard
          label="Net recorded payments"
          value={formatPHP(summary.net / 100)}
          icon={CreditCard}
        />
        <StatCard
          label="Test bookings"
          value={data.bookings.filter((b) => b.is_test).length}
          icon={FlaskConical}
          note="Separate from business reporting"
          tone="warning"
        />
      </section>
      <div className="admin-grid">
        <Panel
          title="Booking status distribution"
          description="Business bookings · all time"
          action={<TextLink href="/dashboard/bookings">Bookings</TextLink>}
        >
          {statuses.map((status) => {
            const count = summary.bookings.filter(
              (b) => b.status === status,
            ).length;
            return (
              <div key={status} className="admin-chart-row">
                <span className="capitalize">{status}</span>
                <div className="admin-chart-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${summary.bookings.length ? (count / summary.bookings.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </Panel>
        <Panel
          title="Inventory utilization"
          description="Current units with existing commitments and live holds."
          action={<TextLink href="/dashboard/fleet">Fleet</TextLink>}
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
            Unit commitments include authorized test bookings and holds. These
            counts describe current readiness, not a forecast of future
            availability.
          </p>
        </Panel>
      </div>
      <p className="admin-note">
        Financial reporting uses payment_events. Booking quotes and unverified
        payment intents do not count as received payments. Detailed event
        history is available in Finance and each booking.
      </p>
    </div>
  );
}
