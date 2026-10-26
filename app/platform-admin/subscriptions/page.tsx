import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ClinicDirectoryActions from "../clinic-directory-actions";
import ClinicProvisioningForm from "../clinic-provisioning-form";
import ClinicIdCopy from "../clinic-id-copy";

type ClinicRow = {
  id: string; clinic_code: string; name: string; address: string | null;
  city: string | null; state: string | null; phone: string | null;
  is_active: boolean; is_public: boolean; created_at: string;
};
type PlanSettings = {
  planCode: "starter" | "growth" | "enterprise" | "custom";
  maxDoctors: number; maxBranches: number; maxStaff: number;
  maxDailyTokens: number | null; onlineBookingEnabled: boolean; walkInEnabled: boolean;
};
const defaultPlan: PlanSettings = {
  planCode: "starter", maxDoctors: 3, maxBranches: 1, maxStaff: 10,
  maxDailyTokens: null, onlineBookingEnabled: false, walkInEnabled: true
};
function parsePlanSettings(value: unknown): PlanSettings {
  if (!value || typeof value !== "object") return defaultPlan;
  const settings = value as { subscription?: { planCode?: unknown; limits?: { doctors?: unknown; branches?: unknown; staff?: unknown; dailyTokens?: unknown }; booking?: { online?: unknown; walkIn?: unknown } } };
  const sub = settings.subscription;
  if (!sub) return defaultPlan;
  const code = ["starter", "growth", "enterprise", "custom"].includes(String(sub.planCode)) ? sub.planCode as PlanSettings["planCode"] : "custom";
  const limits = sub.limits ?? {};
  const booking = sub.booking ?? {};
  return {
    planCode: code,
    maxDoctors: typeof limits.doctors === "number" && limits.doctors >= 1 ? limits.doctors : defaultPlan.maxDoctors,
    maxBranches: typeof limits.branches === "number" && limits.branches >= 1 ? limits.branches : defaultPlan.maxBranches,
    maxStaff: typeof limits.staff === "number" && limits.staff >= 1 ? limits.staff : defaultPlan.maxStaff,
    maxDailyTokens: typeof limits.dailyTokens === "number" && limits.dailyTokens >= 1 ? limits.dailyTokens : null,
    onlineBookingEnabled: booking.online === true,
    walkInEnabled: booking.walkIn !== false
  };
}

export default async function ClinicSubscriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string; plan?: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin, error: roleError } = await supabase.rpc("is_platform_admin");
  if (roleError || !isAdmin) redirect("/workspace");

  const { q = "", plan = "all" } = await searchParams;
  const [{ data: clinicData, error: clinicError }, { data: settingsData, error: settingsError }] = await Promise.all([
    supabase.from("clinics").select("id,clinic_code,name,address,city,state,phone,is_active,is_public,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("clinic_settings").select("clinic_id,settings").limit(1000)
  ]);
  if (clinicError || settingsError) throw new Error("Could not load clinic subscription settings.");
  const allClinics = (clinicData ?? []) as ClinicRow[];
  const plans = new Map<string, PlanSettings>((settingsData ?? []).map((row) => [row.clinic_id, parsePlanSettings(row.settings)]));
  const term = q.trim().toLocaleLowerCase();
  const rows = allClinics.filter((clinic) => {
    const p = plans.get(clinic.id) ?? defaultPlan;
    const matchesSearch = !term || [clinic.name, clinic.clinic_code, clinic.city ?? "", clinic.state ?? ""].some((v) => v.toLocaleLowerCase().includes(term));
    const matchesPlan = plan === "all" || p.planCode === plan;
    return matchesSearch && matchesPlan;
  });
  const activeCount = allClinics.filter((c) => c.is_active && c.is_public).length;
  const suspendedCount = allClinics.filter((c) => !c.is_active && c.is_public).length;
  const planCounts = ["starter", "growth", "enterprise", "custom"].map((code) => ({
    code, count: allClinics.filter((c) => (plans.get(c.id) ?? defaultPlan).planCode === code).length
  }));

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex min-h-20 flex-wrap items-center justify-between gap-3 py-4"><Link href="/" className="font-black">Doctor Queue</Link><nav className="flex flex-wrap gap-2 text-sm font-bold"><Link href="/platform-admin" className="rounded-full border px-4 py-2">Admin overview</Link><Link href="/platform-admin/subscriptions" className="rounded-full bg-[#147d55] px-4 py-2 text-white">Clinic subscriptions</Link></nav></div></header>
    <section className="container py-8 md:py-12">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#147d55]">Super Admin · Billing controls</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Clinic subscriptions</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736d]">Manage each clinic’s plan, usage limits, booking permissions and account status. Clinic IDs are generated during onboarding and shown below; plan changes are saved to the connected Supabase database and recorded in the administrative audit log.</p>
      <ClinicProvisioningForm />
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <article className="rounded-2xl border bg-white p-4 sm:col-span-2"><p className="text-xs text-[#65736d]">Total clinics</p><p className="mt-1 text-3xl font-black">{allClinics.length}</p></article>
        <article className="rounded-2xl border bg-white p-4 sm:col-span-2"><p className="text-xs text-[#65736d]">Active</p><p className="mt-1 text-3xl font-black">{activeCount}</p></article>
        <article className="rounded-2xl border bg-white p-4 sm:col-span-2"><p className="text-xs text-[#65736d]">Suspended</p><p className="mt-1 text-3xl font-black">{suspendedCount}</p></article>
        {planCounts.map((item) => <article key={item.code} className="rounded-2xl border bg-white p-4"><p className="text-xs capitalize text-[#65736d]">{item.code}</p><p className="mt-1 text-2xl font-black">{item.count}</p></article>)}
      </div>
      <section className="mt-7 rounded-2xl border border-[#e1e9e4] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">Manage clinic plans</h2><p className="mt-1 text-sm text-[#65736d]">{rows.length} matching clinics</p></div>
          <form action="/platform-admin/subscriptions" className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input name="q" defaultValue={q} placeholder="Search clinic or ID…" aria-label="Search clinics" className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm sm:w-56"/>
            <select name="plan" defaultValue={plan} aria-label="Filter by plan" className="rounded-full border px-3 py-2.5 text-sm"><option value="all">All plans</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option><option value="custom">Custom</option></select>
            <button className="rounded-full bg-[#14231d] px-4 py-2.5 text-sm font-bold text-white">Filter</button>
          </form>
        </div>
        {rows.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-[#65736d]">No clinics match these filters. Create a clinic from the Admin overview.</p> :
          <div className="mt-5 space-y-4">{rows.map((clinic) => {
            const p = plans.get(clinic.id) ?? defaultPlan;
            const status = !clinic.is_public ? "archived" : clinic.is_active ? "active" : "suspended";
            return <article key={clinic.id} className="grid gap-4 rounded-2xl border border-[#e1e9e4] p-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] md:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{clinic.name}</h3><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold capitalize">{status}</span><span className="rounded-full border border-[#dbe5df] px-3 py-1 text-xs font-bold capitalize">{p.planCode}</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><p className="break-all font-mono text-sm font-bold text-[#147d55]">Clinic ID: {clinic.clinic_code}</p><ClinicIdCopy value={clinic.clinic_code}/></div>
                <p className="mt-1 break-all text-xs text-[#65736d]">Internal record ID: {clinic.id}</p>
                <p className="mt-2 text-sm text-[#65736d]">{[clinic.city, clinic.state].filter(Boolean).join(", ") || clinic.address || "Location not set"}{clinic.phone ? " · " + clinic.phone : ""}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Doctors</p><p className="mt-1 font-black">{p.maxDoctors}</p></div>
                  <div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Branches</p><p className="mt-1 font-black">{p.maxBranches}</p></div>
                  <div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Staff</p><p className="mt-1 font-black">{p.maxStaff}</p></div>
                  <div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Daily tokens</p><p className="mt-1 font-black">{p.maxDailyTokens ?? "Unlimited"}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className={p.onlineBookingEnabled ? "rounded-full bg-emerald-50 px-3 py-1 text-emerald-800" : "rounded-full bg-slate-100 px-3 py-1 text-slate-600"}>Online booking {p.onlineBookingEnabled ? "allowed" : "off"}</span><span className={p.walkInEnabled ? "rounded-full bg-emerald-50 px-3 py-1 text-emerald-800" : "rounded-full bg-slate-100 px-3 py-1 text-slate-600"}>Walk-in {p.walkInEnabled ? "allowed" : "off"}</span></div>
                <p className="mt-3 text-xs text-[#65736d]">Created {new Date(clinic.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
              </div>
              <div className="min-w-0"><ClinicDirectoryActions clinicId={clinic.id} status={status} name={clinic.name} address={clinic.address} city={clinic.city} state={clinic.state} phone={clinic.phone} planSettings={p}/></div>
            </article>;
          })}</div>}
      </section>
      <p className="mt-5 text-xs leading-5 text-[#65736d]">Subscription tiers currently control application permissions and usage limits; online payment collection, invoices and recurring billing are not connected. Do not interpret a plan label as a paid subscription status.</p>
    </section>
  </main>;
}
