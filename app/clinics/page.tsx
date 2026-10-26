import Link from "next/link";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import ClinicDirectoryClient, { type PublicClinic, type QueueSummary } from "./directory-client";

export const revalidate = 0;

export default async function ClinicsPage({ searchParams }: { searchParams: Promise<{ clinic?: string; q?: string; lang?: string }> }) {
  const params=await searchParams;
  let clinics: PublicClinic[]=[];
  let queues: QueueSummary[]=[];
  let unavailable=false;
  try {
    const supabase=createSupabasePublicClient();
    const [clinicResult,queueResult]=await Promise.all([
      supabase.from("public_clinic_directory").select("clinic_code,clinic_slug,clinic_name,description,address,city,state,postal_code,public_phone,doctor_names,specialties,updated_at").order("clinic_name"),
      supabase.from("public_queue_snapshots").select("queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,current_display_token,waiting_count,completed_count,online_booking_enabled,updated_at,clinic_city,clinic_address,opens_at,closes_at,is_closed").order("clinic_name")
    ]);
    if(clinicResult.error||queueResult.error) unavailable=true;
    else {
      clinics=(clinicResult.data??[]) as PublicClinic[];
      queues=(queueResult.data??[]) as QueueSummary[];
    }
  } catch { unavailable=true; }

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[76px] items-center justify-between"><Link href="/" className="font-black tracking-tight">← Doctor Queue</Link><Link href="/login" className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">Clinic staff login</Link></div></header>
    <section className="container py-10 md:py-14">
      {unavailable ? <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-extrabold">Clinic directory temporarily unavailable</h1><p className="mt-2 text-sm leading-6">The public clinic directory could not be loaded. Check your connection and try again.</p><Link href="/clinics" className="mt-4 inline-block rounded-full bg-amber-900 px-4 py-2 text-sm font-bold text-white">Retry</Link></div> :
        <ClinicDirectoryClient clinics={clinics} queues={queues} bookingConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} initialClinic={params.clinic??""} initialQuery={params.q??""} initialLanguage={params.lang==="hi"?"hi":"en"}/>}
    </section>
  </main>;
}
