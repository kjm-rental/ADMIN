import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getFreshAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("id, auth_user_id, role, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) return null;
  return { user, admin, supabase };
}

export const getAdminSession = cache(getFreshAdminSession);

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/sign-in");
  return session;
}
