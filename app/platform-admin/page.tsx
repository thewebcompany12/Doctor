import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ClinicProvisioningForm from "./clinic-provisioning-form";

type ClinicRow = { id: string; clinic_code: string; name: string; city: string | null; state: string | null; is_active: boolean; is_public: boolean; created_at: string };

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin, error: roleError } = await supabase.rpc("is_platform_admin");
  if (roleError || !isAdmin) redirect("/workspace");

  const { q = "" } = await searchParams;
  const { data, error } = await supabase.from("clinics")
    .select("id,clinic_code,name,city,state,is_active,is_public,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Could not load clinic directory.");
  const allClinics = (data ?? []) as ClinicRow[];
  const term = q.trim().toLocaleLowerCase();
  const clinics = term ? allClinics.filter(c => [c.name,c.clinic_code,c.city ?? "",c.state ?? ""].some(v => v.toLocaleLowerCase().includes(term))) : allClinics;
  const active = allClinics.filter(c => c.is_active && c.is_public).length;
  const suspended = allClinics.filter(c => !c.is_active && c.is_public).length;
  const archived = allClinics.filter(c => !c.is_public).length;

  return <main className="min-h-screen">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-20 items-center justify-between"><Link href="/" className="font-black">Doctor Queue</Link><span className="text-sm font-bold text-[#147d55]">Platform administration</span></div></header>
    <section className="container py-10 md:py-12">
      <p className="eyebrow">Super Admin</p><h1 className="mt-3 text-3xl font-black">Platform overview</h1><p className="mt-2 text-[#65736d]">Signed in as {user.email ?? "authorized administrator"}.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Total clinics",allClinics.length],["Active",active],["Suspended",suspended],["Archived",archived]].map(([label,value])=><article key={label} className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><p className="text-sm text-[#65736d]">{label}</p><p className="mt-2 text-4xl font-black">{value}</p></article>)}
      </div>
      <ClinicProvisioningForm />
      <section className="mt-8 rounded-2xl border border-[#e1e9e4] bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">Clinic directory</h2><p className="mt-1 text-sm text-[#65736d]">{clinics.length} matching clinics · first 500 records</p></div>
          <form className="flex gap-2" action="/platform-admin"><input name="q" defaultValue={q} placeholder="Search name, code, city…" aria-label="Search clinics" className="min-w-0 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm"/><button className="rounded-full bg-[#14231d] px-4 py-2.5 text-sm font-bold text-white">Search</button></form>
        </div>
        {clinics.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-[#cbd9d0] p-8 text-center text-sm text-[#65736d]">No clinics match this search.</p> :
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[#e1e9e4] text-[#65736d]"><th className="px-3 py-3">Clinic</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Clinic ID</th><th className="px-3 py-3">Created</th></tr></thead><tbody>{clinics.map(c=><tr key={c.id} className="border-b border-[#edf1ee]"><td className="px-3 py-4 font-bold">{c.name}</td><td className="px-3 py-4">{[c.city,c.state].filter(Boolean).join(", ") || "—"}</td><td className="px-3 py-4"><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold">{!c.is_public ? "Archived" : c.is_active ? "Active" : "Suspended"}</span></td><td className="px-3 py-4 font-mono">{c.clinic_code}</td><td className="px-3 py-4">{new Date(c.created_at).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="mt-6 text-sm text-[#65736d]">Every platform-admin route verifies the Super Admin role server-side. Owner provisioning requires a server-only service-role key and is intentionally unavailable until that credential is configured.</p>
    </section>
  </main>;
}
