"use client";
import { useState } from "react";
import Link from "next/link";
import {
  verificationCategories,
  verificationCategory,
  verificationLabel,
} from "@/lib/verification-display";
import { formatDate, StatusBadge } from "@/components/admin-ui";
type Row = {
  id: string;
  customer: string;
  reference: string;
  motorcycle: string;
  bookingStatus: string;
  status: string;
  risk: number | null;
  submitted: string;
};
export function VerificationQueue({
  rows,
  initialCategory,
}: {
  rows: Row[];
  initialCategory: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = rows
    .filter(
      (row) =>
        (category === "all" || verificationCategory(row.status) === category) &&
        (!query ||
          `${row.customer} ${row.reference}`.toLowerCase().includes(query)),
    )
    .sort((a, b) => {
      const priority = (r: Row) =>
        ({ review: 0, passed: 1, replacement: 2, approved: 3, rejected: 4 })[
          verificationCategory(r.status)
        ];
      return (
        priority(a) - priority(b) ||
        (b.risk ?? 0) - (a.risk ?? 0) ||
        a.submitted.localeCompare(b.submitted)
      );
    });
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
        <div>
          <h2 className="font-extrabold text-deep-teal">Review queue</h2>
          <p className="text-xs text-slate-500">
            Needs attention first · {filtered.length} results
          </p>
        </div>
        <label className="text-xs font-bold">
          Search customers or bookings
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or booking reference…"
            className="mt-1 block min-h-11 w-full rounded-lg border px-3 sm:w-72"
          />
        </label>
      </div>
      <div
        className="flex flex-wrap gap-2 p-4"
        aria-label="Filter verifications"
      >
        {[{ key: "all", label: "All" }, ...verificationCategories].map(
          (item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={category === item.key}
              onClick={() => setCategory(item.key)}
              className={`min-h-10 rounded-full px-4 text-xs font-bold ${category === item.key ? "bg-deep-teal text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {item.key === "review"
                ? "Needs Review"
                : item.key === "passed"
                  ? "Checks Passed"
                  : item.label}
            </button>
          ),
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {[
                "Customer",
                "Booking reference",
                "Motorcycle",
                "Booking status",
                "Verification status",
                "Risk level",
                "Submitted · Manila",
                "Action",
              ].map((title) => (
                <th key={title} className="px-4 py-3 font-bold">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 hover:bg-teal-50/40"
              >
                <td className="px-4 py-4 font-bold text-deep-teal">
                  {row.customer}
                </td>
                <td className="px-4 py-4">{row.reference}</td>
                <td className="px-4 py-4">{row.motorcycle}</td>
                <td className="px-4 py-4">
                  <StatusBadge value={row.bookingStatus} />
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${verificationCategory(row.status) === "approved" ? "bg-emerald-50 text-emerald-800" : verificationCategory(row.status) === "rejected" ? "bg-red-50 text-red-800" : verificationCategory(row.status) === "replacement" ? "bg-amber-50 text-amber-900" : "bg-teal-50 text-teal-900"}`}
                  >
                    {verificationLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {row.risk ? `Level ${row.risk}` : "Not assessed"}
                </td>
                <td className="px-4 py-4 text-xs">
                  {formatDate(row.submitted)}
                </td>
                <td className="px-4 py-4">
                  <Link
                    className="admin-text-link"
                    href={`/dashboard/verifications/${row.id}`}
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="p-8 text-center text-sm text-slate-500">
          No verifications match this search or filter.
        </p>
      )}
    </section>
  );
}
