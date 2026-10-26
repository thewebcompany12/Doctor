"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/forgot-password?error=email");
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { redirect("/forgot-password?error=configuration"); }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://doctor-queue-guru-kalyanam.vercel.app";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl + "/auth/callback?next=/reset-password" });
  if (error) redirect("/forgot-password?error=request");
  redirect("/forgot-password?sent=1");
}
