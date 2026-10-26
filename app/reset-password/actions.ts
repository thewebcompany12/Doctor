"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setRecoveredPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) redirect("/reset-password?error=policy");
  if (password !== confirmation) redirect("/reset-password?error=mismatch");
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=request");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update");
  redirect("/workspace");
}
