import Link from "next/link";
import { requestPasswordReset } from "./actions";

const errors: Record<string,string> = {
  email: "Enter a valid account email address.",
  configuration: "Authentication is not configured yet.",
  request: "The reset request could not be sent. Verify Supabase Auth redirect settings and retry."
};
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-lg rounded-3xl border border-[#e1e9e4] bg-white p-8 shadow-xl">
    <Link href="/login" className="text-sm font-bold text-[#147d55]">← Back to sign in</Link>
    <p className="eyebrow mt-6">Account recovery</p><h1 className="mt-2 text-3xl font-black">Reset your password</h1>
    <p className="mt-3 leading-6 text-[#65736d]">If the address belongs to an account, Supabase will send a secure password-reset link. For privacy, this page does not reveal whether an account exists.</p>
    {sent && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">If an account matches that email, a reset message has been requested.</p>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors[error] ?? "Unable to request a reset."}</p>}
    <form action={requestPasswordReset} className="mt-6 space-y-4"><label className="block text-sm font-bold">Account email<input required type="email" name="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 font-normal" /></label><button className="w-full rounded-full bg-[#147d55] px-5 py-3.5 font-bold text-white">Send reset link</button></form>
    <p className="mt-4 text-xs leading-5 text-[#65736d]">The production URL must be allow-listed under Supabase Auth → URL Configuration for the email link to return here.</p>
  </section></main>;
}
