import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-heading">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="admin-description">{description}</p>
      </div>
      {actions && <div className="admin-heading-actions">{actions}</div>}
    </header>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`}>
      <header className="admin-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="admin-panel-content">{children}</div>
    </section>
  );
}
export function StatCard({
  label,
  value,
  icon: Icon,
  note,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  note?: string;
  tone?: string;
}) {
  return (
    <article className="admin-stat">
      <div className="admin-stat-top">
        <p>{label}</p>
        <span className={`admin-stat-icon admin-tone-${tone}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <strong>{value}</strong>
      {note && <span className="admin-stat-note">{note}</span>}
    </article>
  );
}
export function StatusBadge({ value }: { value: string }) {
  const tone = [
    "approved",
    "confirmed",
    "published",
    "paid",
    "completed",
    "available",
    "active",
  ].includes(value.toLowerCase())
    ? "success"
    : ["rejected", "cancelled", "expired", "overdue", "reversal"].includes(
          value.toLowerCase(),
        )
      ? "danger"
      : [
            "pending",
            "submitted",
            "under_review",
            "resubmission_required",
            "maintenance",
            "refund",
          ].includes(value.toLowerCase())
        ? "warning"
        : "neutral";
  return (
    <span className={`admin-badge admin-badge-${tone}`}>
      <span aria-hidden="true" />
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="admin-empty">
      <span>
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="admin-text-link" href={href}>
      {children}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
export const formatPHP = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount,
  );
export const formatDate = (value: string, time = true) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Manila",
  }).format(new Date(value));
