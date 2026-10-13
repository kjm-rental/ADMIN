"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getFreshAdminSession } from "@/lib/auth";
import { derivePinCredential } from "@/lib/pin";

const credentialsSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
});

export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    pin: formData.get("pin"),
  });
  if (!parsed.success) redirect("/sign-in?error=invalid-input");

  const email = process.env.ADMIN_LOGIN_EMAIL?.trim();
  if (!email) redirect("/sign-in?error=configuration");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: derivePinCredential(parsed.data.pin),
  });
  if (error) redirect("/sign-in?error=invalid-credentials");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?error=invalid-credentials");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    redirect("/sign-in?error=not-authorized");
  }

  redirect("/dashboard");
}

export async function changePin(formData: FormData) {
  const parsed = z
    .object({
      currentPin: z.string().regex(/^\d{4}$/),
      newPin: z.string().regex(/^\d{4}$/),
      confirmPin: z.string().regex(/^\d{4}$/),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.newPin !== parsed.data.confirmPin)
    redirect("/dashboard/settings?error=invalid");
  const caller = await getFreshAdminSession();
  if (!caller) redirect("/sign-in?error=not-authorized");
  const supabase = caller.supabase;
  const email = process.env.ADMIN_LOGIN_EMAIL?.trim();
  if (!email) redirect("/dashboard/settings?error=configuration");
  if (caller.user.email?.toLowerCase() !== email.toLowerCase())
    redirect("/dashboard/settings?error=not-authorized");
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: derivePinCredential(parsed.data.currentPin),
  });
  if (verifyError) redirect("/dashboard/settings?error=current");
  // Recheck membership after PIN reauthentication, without React session caching.
  const verified = await getFreshAdminSession();
  if (!verified || verified.user.id !== caller.user.id)
    redirect("/sign-in?error=not-authorized");
  const { error } = await verified.supabase.auth.updateUser({
    password: derivePinCredential(parsed.data.newPin),
  });
  if (error) redirect("/dashboard/settings?error=update");
  redirect("/dashboard/settings?changed=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
