import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changeTemporaryPassword } from "./actions";

const errors: Record<string,string> = {
  policy: "Use at least 12 characters, including uppercase, lowercase and a number.",
  mismatch: "The passwords do not match.",
  update: "The password could not be changed. Check the requirements and retry."
};

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).maybeSingle();
  if (!profile?.must_change_password) redirect("/workspace");
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-lg rounded-3xl border border-[#e1e9e4] bg-white p-8 shadow-xl">
    <Link href="/" className="text-sm font-bold text-[#147d55]">← Doctor Queue</Link>
    <p className="eyebrow mt-6">Account security</p><h1 className="mt-2 text-3xl font-black">Set your new password</h1>
    <p className="mt-3 leading-6 text-[#65736d]">This temporary password can only be used to get started. Choose a new password before accessing your clinic workspace.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors[error] ?? "Unable to change password."}</p>}
    <form action={changeTemporaryPassword} className="mt-6 space-y-4">
      <label className="block text-sm font-bold">New password<input required name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-bold">Confirm new password<input required name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 font-normal" /></label>
      <button type="submit" className="w-full rounded-full bg-[#147d55] px-5 py-3.5 font-bold text-white">Change password securely</button>
    </form>
  </section></main>;
}
