"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) redirect("/login?error=missing");
  // Supabase Auth signs in with the account email. Clinic ID login requires a
  // trusted server-side identity lookup and is intentionally not emulated here.
  if (!identifier.includes("@")) redirect("/login?error=email_required");
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { redirect("/login?error=configuration"); }
  const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
  if (error) redirect("/login?error=invalid");
  redirect("/workspace");
}