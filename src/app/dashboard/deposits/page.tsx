import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  PageHeading,
  Panel,
  StatCard,
  formatPHP,
  formatDate,
} from "@/components/admin-ui";
import { getSecurityDepositView } from "@/services/security-deposits";
import { getOperationsView } from "@/services/operations-view";
import { requireAdmin } from "@/lib/auth";
import { checkedQueries } from "@/lib/query-results";
import { depositBalance } from "@/lib/deposit-balances";
export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams,
    test = scope === "test",
    data = await getSecurityDepositView();
  const heading = (
    <PageHeading
      eyebrow="Custody & accounting"
      title="Security deposits"
      description="Refundable cash liabilities and legally approved document custody. Separate from rental revenue."
      actions={
        <Link
          className="admin-button"
          href="/dashboard/settings?section=deposits"
        >
          Deposit settings
        </Link>
      }
    />
  );
  if (!data.available)
    return (
      <div>
        {heading}
        <Panel title="Workflow awaiting database approval">
          <p>
            Migration 020 is prepared but has not been approved and applied.
            Both deposit options remain unavailable until configured and
            approved.
          </p>
        </Panel>
      </div>
    );
  const operations = await getOperationsView(),
    { supabase } = await requireAdmin();
  const [{ data: customers }, { data: models }] = await Promise.all([
    supabase.from("customers").select("id,full_name"),
    supabase.from("motorcycle_models").select("id,display_name"),
  ]).then(checkedQueries);
  const rows = data.requirements
    .filter((d) => d.is_test === test)
    .map((requirement) => ({
      requirement,
      balance: depositBalance(requirement, data.events),
      booking: operations.bookings.find((b) => b.id === requirement.booking_id),
    }));
  const held = rows.reduce((sum, row) => sum + row.balance.held, 0),
    awaiting = rows.filter((r) => r.balance.held > 0 || r.balance.custody > 0),
    unresolved = rows.filter((r) => r.balance.unresolved);
  return (
    <div>
      {heading}
      <form className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold">
          Record scope
          <select
            name="scope"
            defaultValue={test ? "test" : "business"}
            className="ml-3 min-h-11 rounded-xl border border-slate-200 bg-white px-3"
          >
            <option value="business">Business records</option>
            <option value="test">Synthetic test records</option>
          </select>
        </label>
        <button className="admin-button">Filter</button>
      </form>
      <p className="mb-5 text-sm text-slate-500">
        {test
          ? "Synthetic records only. These values are not business finances."
          : "Business records only. Synthetic records are excluded."}
      </p>
      <section className="admin-stats">
        <StatCard
          icon={ShieldCheck}
          label="Cash deposits held"
          value={formatPHP(held / 100)}
          note="Refundable liability; not rental revenue"
        />
        <StatCard
          icon={ShieldCheck}
          label="Deposits awaiting return"
          value={awaiting.length}
          note="Cash held or approved document in custody"
        />
        <StatCard
          icon={ShieldCheck}
          label="Unresolved deposit cases"
          value={unresolved.length}
          note="Remain visible after rental completion"
        />
      </section>
      <div className="admin-table-wrap">
        <table className="admin-responsive-table">
          <thead>
            <tr>
              {[
                "Booking",
                "Customer",
                "Motorcycle",
                "Arrangement",
                "Required",
                "Status",
                "Cash held",
                "Collected / received",
                "Returned",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ requirement: d, balance: b, booking }) => (
              <tr key={d.booking_id}>
                <td data-label="Booking">
                  <Link
                    href={`/dashboard/bookings/${d.booking_id}`}
                    className="font-bold text-ocean"
                  >
                    {booking?.booking_reference ?? "Booking unavailable"}
                  </Link>
                  {d.is_test && <span className="admin-badge ml-2">Test</span>}
                </td>
                <td data-label="Customer">
                  {customers?.find((c) => c.id === booking?.customer_id)
                    ?.full_name ?? "—"}
                </td>
                <td data-label="Motorcycle">
                  {models?.find((m) => m.id === booking?.motorcycle_model_id)
                    ?.display_name ?? "—"}
                </td>
                <td data-label="Arrangement">
                  {d.option === "cash"
                    ? "Cash security deposit"
                    : `Eligible ID: ${d.document_type}`}
                </td>
                <td data-label="Required">
                  {formatPHP(d.required_centavos / 100)}
                </td>
                <td data-label="Status">{b.status}</td>
                <td data-label="Cash held">{formatPHP(b.held / 100)}</td>
                <td data-label="Collected / received">
                  {b.events.find((e) =>
                    ["cash_collected", "id_received"].includes(e.event_type),
                  )?.occurred_at
                    ? formatDate(
                        b.events.find((e) =>
                          ["cash_collected", "id_received"].includes(
                            e.event_type,
                          ),
                        )!.occurred_at,
                      )
                    : "Not received"}
                </td>
                <td data-label="Returned">
                  {b.events
                    .filter((e) =>
                      ["cash_returned", "id_returned"].includes(e.event_type),
                    )
                    .at(-1)?.occurred_at
                    ? formatDate(
                        b.events
                          .filter((e) =>
                            ["cash_returned", "id_returned"].includes(
                              e.event_type,
                            ),
                          )
                          .at(-1)!.occurred_at,
                      )
                    : "Not returned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            No deposit requirements in this record scope.
          </p>
        )}
      </div>
    </div>
  );
}
