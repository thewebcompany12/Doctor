import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase.from("clinic_memberships").select("clinic_id,role,is_active,clinics(name,clinic_code)").eq("user_id",user.id).eq("is_active",true);
  return <main className="min-h-screen"><header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-20 items-center justify-between"><Link href="/" className="font-black">Doctor Queue</Link><form action="/auth/signout" method="post"><button className="text-sm font-bold text-[#147d55]">Sign out</button></form></div></header><section className="container py-12"><p className="eyebrow">Workspace</p><h1 className="mt-3 text-3xl font-black">Your clinic access</h1><p className="mt-2 text-[#65736d]">Signed in as {user.email ?? "authorized user"}.</p>{memberships?.length ? <div className="mt-8 grid gap-4 md:grid-cols-2">{memberships.map((m:any)=><article key={m.clinic_id} className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><h2 className="text-xl font-extrabold">{m.clinics?.name ?? "Clinic"}</h2><p className="mt-2 text-sm text-[#65736d]">Clinic ID: {m.clinics?.clinic_code} · Role: {m.role}</p><p className="mt-4 text-sm text-[#65736d]">Queue management screens are being implemented in the next phase.</p></article>)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-[#cbd9d0] bg-white p-8"><h2 className="font-extrabold">No clinic membership found</h2><p className="mt-2 text-sm leading-6 text-[#65736d]">Your account has no active clinic membership. A platform administrator must provision access securely.</p></div>}</section></main>;
}