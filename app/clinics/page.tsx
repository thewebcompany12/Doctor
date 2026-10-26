import Link from "next/link";
import { MapPin, Search, Stethoscope } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";

type QueueSummary = {
  queue_id: string; clinic_code: string; clinic_slug: string | null; clinic_name: string;
  doctor_name: string; specialty: string | null; service_date: string; queue_status: string;
  current_display_token: string | null; waiting_count: number; completed_count: number;
  online_booking_enabled: boolean; updated_at: string;
};

export default async function ClinicsPage({ searchParams }: { searchParams: Promise<{ clinic?: string }> }) {
  const { clinic: selectedClinic = "" } = await searchParams;
  let queues: QueueSummary[] = [];
  let unavailable = false;
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.from("public_queue_snapshots").select("queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,current_display_token,waiting_count,completed_count,online_booking_enabled,updated_at").order("clinic_name");
    if (error) unavailable = true;
    else queues = ((data ?? []) as QueueSummary[]).sort((a,b) => a.clinic_name.localeCompare(b.clinic_name));
  } catch { unavailable = true; }
  if (selectedClinic) queues = queues.filter(q => q.clinic_code.toLowerCase() === selectedClinic.toLowerCase() || q.clinic_slug?.toLowerCase() === selectedClinic.toLowerCase());

  return <main className="min-h-screen">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[76px] items-center justify-between"><Link href="/" className="font-black tracking-tight">← Doctor Queue</Link><Link href="/login" className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">Clinic staff login</Link></div></header>
    <section className="container py-12 md:py-16">
      <p className="eyebrow">Find care</p><h1 className="mt-3 text-4xl font-black tracking-tight">{selectedClinic ? "Clinic queue" : "Clinics and live queues"}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#65736d]">Only active clinics that publish their queue are listed here. Waiting counts are estimates of the current queue, not guaranteed consultation times.</p>
      {unavailable ? <div role="status" className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"><strong>Clinic directory temporarily unavailable.</strong><p className="mt-1 text-sm">The database connection or public queue snapshot table is not configured yet. Please try again later.</p></div> : queues.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-[#cbd9d0] bg-white p-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f7ef] text-[#147d55]"><Search size={24}/></span><h2 className="mt-4 text-xl font-extrabold">{selectedClinic ? "No public queue found for this clinic" : "No public queues yet"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#65736d]">{selectedClinic ? "This Clinic ID may be inactive, unpublished, or have no active doctor queue today." : "When clinics are onboarded and publish their queue, their live status will appear here. No sample clinics or fake token counts are shown."}</p>{selectedClinic && <Link href="/clinics" className="mt-4 inline-block text-sm font-bold text-[#147d55] underline">View all clinics</Link>}</div> : <div className="mt-8 grid gap-4 md:grid-cols-2">{queues.map(q=><article key={q.queue_id} className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9f7ef] text-[#147d55]"><Stethoscope size={23}/></span><div><h2 className="text-lg font-extrabold">{q.clinic_name}</h2><p className="mt-1 text-sm text-[#65736d]">{q.doctor_name}{q.specialty ? ` · ${q.specialty}` : ""}</p></div></div><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold capitalize">{q.queue_status.replace("_"," ")}</span></div><p className="mt-4 flex items-center gap-2 text-sm text-[#65736d]"><MapPin size={15}/>{q.clinic_code}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-xs text-[#65736d]">Now calling</p><p className="mt-1 font-black">{q.current_display_token ?? "—"}</p></div><div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-xs text-[#65736d]">Waiting</p><p className="mt-1 font-black">{q.waiting_count}</p></div><div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-xs text-[#65736d]">Completed</p><p className="mt-1 font-black">{q.completed_count}</p></div></div><p className="mt-4 text-xs text-[#65736d]">Updated {new Date(q.updated_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"})} IST</p><p className="mt-3 text-sm font-semibold text-[#147d55]">{q.online_booking_enabled ? "Online booking is configured but not yet available" : "Contact clinic to obtain a token"}</p></article>)}</div>}
    </section>
  </main>;
}