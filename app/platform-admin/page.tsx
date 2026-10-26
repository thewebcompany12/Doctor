import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlatformAdminPage() {
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
  if (error || !isAdmin) redirect("/workspace");
  const { count: clinicsCount } = await supabase.from("clinics").select("id", { count: "exact", head: true });
  return <main className="min-h-screen"><header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-20 items-center justify-between"><Link href="/" className="font-black">Doctor Queue</Link><span className="text-sm font-bold text-[#147d55]">Platform administration</span></div></header><section className="container py-12"><p className="eyebrow">Super Admin</p><h1 className="mt-3 text-3xl font-black">Platform overview</h1><p className="mt-2 text-[#65736d]">Signed in as {user.email ?? "authorized administrator"}.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><p className="text-sm text-[#65736d]">Registered clinics</p><p className="mt-2 text-4xl font-black">{clinicsCount ?? "—"}</p></article><article className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><p className="text-sm text-[#65736d]">Provisioning</p><p className="mt-2 font-bold">Secure manual bootstrap</p><p className="mt-2 text-sm leading-6 text-[#65736d]">Clinic creation and temporary credentials require the server-side provisioning service before this dashboard can perform changes.</p></article></div><p className="mt-8 text-sm text-[#65736d]">This route checks the server-side platform role. No public signup can grant Super Admin privileges.</p></section></main>;
}