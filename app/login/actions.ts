"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) redirect("/login?error=missing");
  if (!identifier.includes("@")) redirect("/login?error=email_required");
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { redirect("/login?error=configuration"); }
  const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
  if (error) redirect("/login?error=invalid");
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).maybeSingle();
    if (profile?.must_change_password) redirect("/change-password");
  }
  redirect("/workspace");
}
