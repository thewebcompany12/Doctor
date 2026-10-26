import Link from "next/link";
import { signIn } from "./actions";

const messages: Record<string,string> = {
  missing: "Enter your account email and password.",
  email_required: "Clinic ID sign-in is not configured yet. Use the authorized account email for now.",
  configuration: "Authentication is not configured. Set the public Supabase environment variables.",
  invalid: "Sign-in failed. Check your credentials and try again."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-5 py-12"><div className="w-full max-w-md"><Link href="/" className="text-sm font-bold text-[#147d55]">← Doctor Queue</Link><div className="mt-6 rounded-3xl border border-[#e1e9e4] bg-white p-7 shadow-xl shadow-green-950/5 sm:p-9"><p className="eyebrow">Clinic workspace</p><h1 className="mt-3 text-3xl font-black tracking-tight">Welcome back</h1><p className="mt-2 leading-6 text-[#65736d]">Authorized clinic and platform accounts only.</p>{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{messages[error] ?? "Unable to sign in."}</p>}<form action={signIn} className="mt-7 space-y-4"><label className="block text-sm font-bold">Account email<input name="identifier" type="text" autoComplete="username" required className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 outline-none focus:border-[#147d55] focus:ring-2 focus:ring-[#147d55]/10" placeholder="you@clinic.com"/></label><label className="block text-sm font-bold">Password<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[#dbe5df] px-4 py-3 outline-none focus:border-[#147d55] focus:ring-2 focus:ring-[#147d55]/10" placeholder="Enter password"/></label><button className="w-full rounded-full bg-[#147d55] px-5 py-3.5 font-bold text-white hover:bg-[#106747]" type="submit">Sign in securely</button></form><p className="mt-5 text-xs leading-5 text-[#65736d]">Clinic ID authentication and temporary-password onboarding will be enabled only after the secure provisioning flow is implemented. Public signup does not grant staff or admin access.</p></div></div></main>;
}