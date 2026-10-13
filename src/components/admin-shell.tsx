"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bike,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  FileCheck2,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";

export const adminNavigation = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Operations",
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: BookOpen,
    group: "Operations",
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: CalendarDays,
    group: "Operations",
  },
  {
    href: "/dashboard/verifications",
    label: "Verification",
    icon: FileCheck2,
    group: "Operations",
  },
  {
    href: "/dashboard/fleet",
    label: "Fleet Management",
    icon: Bike,
    group: "Assets",
  },
  {
    href: "/dashboard/extras",
    label: "Booking Extras",
    icon: PackagePlus,
    group: "Assets",
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    group: "Workspace",
  },
  {
    href: "/dashboard/finance",
    label: "Finance",
    icon: CircleDollarSign,
    group: "Workspace",
  },

  {
    href: "/dashboard/deposits",
    label: "Security Deposits",
    icon: ShieldCheck,
    group: "Workspace",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    group: "Workspace",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    group: "Workspace",
  },
] as const;

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  const close = () => {
    setOpen(false);
    menu.current?.focus();
  };
  const route =
    adminNavigation.find(
      (n) => n.href !== "/dashboard" && pathname.startsWith(n.href),
    ) ?? adminNavigation[0];
  const sidebar = (mobile = false) => (
    <>
      <div className="admin-brand">
        <Link
          href="/dashboard"
          aria-label="KJM management overview"
          onClick={close}
        >
          {!mobile && collapsed ? (
            <span className="admin-brand-mark" aria-hidden="true">
              <Bike size={24} />
            </span>
          ) : (
            <Image
              src="/images/brand/kjm-logo.png"
              width={56}
              height={65}
              alt=""
              className="admin-brand-logo"
              style={{
                width: 56,
                maxWidth: 160,
                height: "auto",
                maxHeight: 72,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          )}
          <span className="admin-brand-copy">
            <strong>
              KJM<span>.</span>
            </strong>
            <small>RENTAL MANAGEMENT</small>
          </span>
        </Link>
        {mobile && (
          <button
            type="button"
            className="admin-icon-button"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav aria-label="Administration">
        {["Operations", "Assets", "Workspace"].map((group) => (
          <div key={group} className="admin-nav-group">
            <p className="admin-nav-group-title">{group}</p>
            {adminNavigation
              .filter((n) => n.group === group)
              .map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/dashboard"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "admin-nav-link admin-nav-active"
                        : "admin-nav-link"
                    }
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span className="admin-nav-label">{label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="admin-account">
        <div className="admin-account-info">
          <span className="admin-avatar" aria-hidden="true">
            {email.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>Administrator</strong>
            <span title={email}>{email}</span>
          </div>
        </div>
        <form action={signOut}>
          <button className="admin-signout" title="Sign out">
            <LogOut size={18} aria-hidden="true" />
            <span className="admin-nav-label">Sign out</span>
          </button>
        </form>
      </div>
    </>
  );
  return (
    <div className={`admin-shell ${collapsed ? "admin-shell-collapsed" : ""}`}>
      <a className="admin-skip" href="#admin-content">
        Skip to workspace
      </a>
      <aside className="admin-sidebar">{sidebar()}</aside>
      <dialog
        ref={dialog}
        className="admin-mobile-dialog"
        aria-label="Administration navigation"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <aside>{sidebar(true)}</aside>
      </dialog>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-context">
            <button
              type="button"
              className="admin-icon-button admin-collapse-toggle"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              ref={menu}
              type="button"
              className="admin-icon-button admin-mobile-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-haspopup="dialog"
            >
              <Menu size={21} />
            </button>
            <div>
              <p>
                KJM Workspace <span aria-hidden="true">/</span>
                <strong>{route.label}</strong>
              </p>
              <span className="admin-topbar-location">
                Lapu-Lapu City · Asia/Manila
              </span>
            </div>
          </div>
          <div className="admin-topbar-access">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Administrator</span>
            <span className="admin-avatar" aria-hidden="true">
              {email.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="admin-content" className="admin-workspace" tabIndex={-1}>
          {children}
        </main>
        <footer className="admin-workspace-footer">
          KJM Rental Management <span>Private operations workspace</span>
        </footer>
      </div>
    </div>
  );
}
