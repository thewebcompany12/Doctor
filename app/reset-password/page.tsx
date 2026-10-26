import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setRecoveredPassword } from "./actions";

const errors: Record<string,string> = { policy: "Use at least 12 characters, including uppercase, lowercase and a number.", mismatch: "The passwords do not match.", update: "The password could not be updated. Request a fresh reset link." };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=request");
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-lg rounded-3xl border border-[#e1e9e4] bg-white p-8 shadow-xl">
    <Link href="/" className="text-sm font-bold text-[#147d55]">← Doctor Queue</Link>
    <p className="eyebrow mt-6">Account recovery</p><h1 className="mt-2 text-3xl font-black">Choose a new password</h1>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors[error] ?? "Unable to reset password."}</p>}
    <form action={setRecoveredPassword} className="mt-6 space-y-4">
      <label className="block text-sm font-bold">New password<input required name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-bold">Confirm new password<input required name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 font-normal" /></label>
      <button className="w-full rounded-full bg-[#147d55] px-5 py-3.5 font-bold text-white">Save new password</button>
    </form>
  </section></main>;
}
