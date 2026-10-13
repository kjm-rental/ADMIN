import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";

export const instant = false;
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();
  return (
    <AdminShell email={user.email ?? "Administrator"}>{children}</AdminShell>
  );
}
