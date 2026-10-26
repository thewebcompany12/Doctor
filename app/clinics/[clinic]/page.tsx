import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, Phone, Stethoscope } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import ClinicShare from "../clinic-share";
import OnlineTokenBooking from "../online-token-booking";
import type { PublicClinic, QueueSummary } from "../directory-client";

export const revalidate = 0;

export default async function ClinicDetailPage({ params, searchParams }: { params: Promise<{ clinic: string }>; searchParams: Promise<{ lang?: string }> }) {
  const {clinic}=await params;
  const language=(await searchParams).lang==="hi"?"hi":"en";
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(clinic)) notFound();
  const supabase=createSupabasePublicClient();
  let clinicData: PublicClinic|null=null;
  const bySlug=await supabase.from("public_clinic_directory").select("clinic_code,clinic_slug,clinic_name,description,address,city,state,postal_code,public_phone,doctor_names,specialties,updated_at").eq("clinic_slug",clinic).maybeSingle();
  if(!bySlug.error&&bySlug.data) clinicData=bySlug.data as PublicClinic;
  if(!clinicData) {
    const byCode=await supabase.from("public_clinic_directory").select("clinic_code,clinic_slug,clinic_name,description,address,city,state,postal_code,public_phone,doctor_names,specialties,updated_at").eq("clinic_code",clinic).maybeSingle();
    if(byCode.error||!byCode.data) notFound();
    clinicData=byCode.data as PublicClinic;
  }
  const {data:queueData,error}=await supabase.from("public_queue_snapshots")
    .select("queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,current_display_token,waiting_count,completed_count,online_booking_enabled,updated_at,clinic_city,clinic_address,opens_at,closes_at,is_closed")
    .eq("clinic_code",clinicData.clinic_code).order("doctor_name");
  if(error) throw new Error("Public clinic queue could not be loaded.");
  const queues=(queueData??[]) as QueueSummary[];
  const address=[clinicData.address,clinicData.city,clinicData.state,clinicData.postal_code].filter(Boolean).join(", ");
  const directions=address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address):null;
  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[72px] items-center justify-between"><div className="flex items-center gap-4"><Link href={"/clinics"+(language==="hi"?"?lang=hi":"")} className="inline-flex items-center gap-2 font-bold"><ArrowLeft size={17}/> {language==="hi"?"क्लिनिक सूची":"Clinic directory"}</Link><Link href={"/clinics/"+encodeURIComponent(clinic)+(language==="hi"?"":"?lang=hi")} className="rounded-full border border-[#dbe5df] px-3 py-2 text-xs font-bold">{language==="hi"?"English":"हिन्दी"}</Link></div><Link href="/login" className="text-sm font-bold text-[#147d55]">{language==="hi"?"स्टाफ लॉगिन":"Clinic staff login"}</Link></div></header>
    <section className="container max-w-4xl py-8 md:py-12">
      <div className="rounded-3xl border border-[#e1e9e4] bg-white p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e9f7ef] text-[#147d55]"><Stethoscope size={27}/></span><div className="min-w-0"><p className="eyebrow">{language==="hi"?"सार्वजनिक क्लिनिक प्रोफ़ाइल":"Public clinic profile"}</p><h1 className="mt-2 text-3xl font-black tracking-tight">{clinicData.clinic_name}</h1><p className="mt-2 text-sm text-[#65736d]">{language==="hi"?"क्लिनिक आईडी":"Clinic ID"}: {clinicData.clinic_code}</p></div></div>
        {clinicData.description&&<p className="mt-5 leading-7 text-[#53645b]">{clinicData.description}</p>}
        {address&&<p className="mt-5 flex items-start gap-2 text-sm text-[#53645b]"><MapPin size={17} className="mt-0.5 shrink-0 text-[#147d55]"/>{address}</p>}
        {clinicData.public_phone&&<p className="mt-3 flex items-center gap-2 text-sm"><Phone size={16} className="text-[#147d55]"/><a href={"tel:"+clinicData.public_phone} className="font-semibold text-[#147d55] underline">{clinicData.public_phone}</a></p>}
        {directions&&<a href={directions} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold">{language==="hi"?"रास्ता देखें":"Get directions"}</a>}
        <div className="mt-6 flex flex-wrap gap-2">{clinicData.specialties.map(s=><span key={s} className="rounded-full bg-[#f2f6f3] px-3 py-1.5 text-xs font-semibold">{s}</span>)}</div>
      </div>
      <ClinicShare slug={clinicData.clinic_slug} clinicCode={clinicData.clinic_code} clinicName={clinicData.clinic_name} language={language}/>
      <section className="mt-8"><div className="flex items-end justify-between gap-3"><div><p className="eyebrow">{language==="hi"?"लाइव कतार स्थिति":"Live queue status"}</p><h2 className="mt-2 text-2xl font-black">{language==="hi"?"डॉक्टर और आज की कतारें":"Doctors and today&apos;s queues"}</h2></div><span className="text-xs text-[#65736d]">{queues.length} queues</span></div>
        {queues.length===0?<div className="mt-4 rounded-2xl border border-dashed border-[#cbd9d0] bg-white p-7"><h3 className="font-extrabold">{language==="hi"?"आज कोई सार्वजनिक कतार नहीं":"No public queue today"}</h3><p className="mt-2 text-sm leading-6 text-[#65736d]">{language==="hi"?"इस क्लिनिक ने आज की सक्रिय कतार प्रकाशित नहीं की है। समय या वॉक-इन टोकन के लिए रिसेप्शन से संपर्क करें।":"This clinic profile is public, but it has not published an active doctor queue for today. Contact the clinic to ask about consultation hours or walk-in tokens."}</p></div>:
        <div className="mt-4 grid gap-4 md:grid-cols-2">{queues.map(q=><article key={q.queue_id} className="rounded-2xl border border-[#e1e9e4] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{q.doctor_name}</h3><p className="mt-1 text-sm text-[#65736d]">{q.specialty||"General consultation"}</p></div><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold capitalize">{q.queue_status.replaceAll("_"," ")}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Now calling</p><p className="mt-1 text-xl font-black">{q.current_display_token||"—"}</p></div><div className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xs text-[#65736d]">Waiting</p><p className="mt-1 text-xl font-black">{q.waiting_count}</p></div></div>
          <p className="mt-4 flex items-center gap-2 text-sm text-[#65736d]"><Clock3 size={15}/>{q.opens_at&&q.closes_at&&!q.is_closed?q.opens_at.slice(0,5)+"–"+q.closes_at.slice(0,5):q.is_closed?"Closed today":"Hours not published"}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Link href={"/queue/"+q.queue_id+(language==="hi"?"?lang=hi":"")} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">{language==="hi"?"लाइव कतार देखें":"View live queue"}</Link>{q.online_booking_enabled&&q.queue_status==="open"?<span className="self-center text-xs font-bold text-[#147d55]">Online booking enabled</span>:<span className="self-center text-xs text-[#65736d]">{language==="hi"?"टोकन के लिए रिसेप्शन से पूछें":"Ask reception for a token"}</span>}</div>
          {q.online_booking_enabled&&q.queue_status==="open"&&<OnlineTokenBooking queueId={q.queue_id} clinicName={q.clinic_name} doctorName={q.doctor_name} bookingConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} language={language}/>}
        </article>)}</div>}
      </section>
    </section>
  </main>;
}
