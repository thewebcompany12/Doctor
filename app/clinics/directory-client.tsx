"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, MapPin, Search, Stethoscope } from "lucide-react";
import OnlineTokenBooking from "./online-token-booking";

export type PublicClinic = {
  clinic_code: string; clinic_slug: string | null; clinic_name: string; description: string | null;
  address: string | null; city: string | null; state: string | null; postal_code: string | null;
  public_phone: string | null; doctor_names: string[]; specialties: string[]; updated_at: string;
};
export type QueueSummary = {
  queue_id: string; clinic_code: string; clinic_slug: string | null; clinic_name: string; doctor_name: string;
  specialty: string | null; service_date: string; queue_status: string; current_display_token: string | null;
  waiting_count: number; completed_count: number; online_booking_enabled: boolean; updated_at: string;
  clinic_city: string | null; clinic_address: string | null; opens_at: string | null; closes_at: string | null; is_closed: boolean;
};

export default function ClinicDirectoryClient({ clinics, queues, initialClinic, initialQuery }: {
  clinics: PublicClinic[]; queues: QueueSummary[]; initialClinic: string; initialQuery: string;
}) {
  const [query,setQuery]=useState(initialQuery);
  const [city,setCity]=useState("");
  const [specialty,setSpecialty]=useState("");
  const [language,setLanguage]=useState<"en"|"hi">("en");
  const [onlineOnly,setOnlineOnly]=useState(false);
  const text = language==="hi" ? {
    title:"क्लिनिक और डॉक्टर खोजें", intro:"केवल सार्वजनिक क्लिनिक जानकारी और असली कतार स्थिति दिखाई जाती है।",
    search:"क्लिनिक, डॉक्टर या विशेषज्ञता खोजें", city:"शहर", allCities:"सभी शहर", specialty:"विशेषज्ञता", allSpecialties:"सभी विशेषज्ञताएँ",
    online:"केवल ऑनलाइन टोकन उपलब्ध", noResults:"कोई मेल खाता क्लिनिक नहीं मिला", noResultsBody:"दूसरे शब्द या शहर से खोजें।",
    details:"क्लिनिक विवरण", queue:"आज की कतार", noQueue:"आज कोई सार्वजनिक कतार उपलब्ध नहीं", onlineBooking:"ऑनलाइन टोकन बुक करें",
    walkin:"टोकन के लिए रिसेप्शन पर संपर्क करें", updated:"अपडेट", hoursUnknown:"समय प्रकाशित नहीं", closed:"आज बंद", open:"समय", directions:"दिशा देखें",
    phone:"फोन", doctors:"डॉक्टर", viewQueue:"लाइव कतार देखें"
  } : {
    title:"Find clinics and doctors", intro:"Only public clinic details and real queue status are shown.",
    search:"Search clinic, doctor or specialty", city:"City", allCities:"All cities", specialty:"Specialty", allSpecialties:"All specialties",
    online:"Online token available only", noResults:"No matching clinics found", noResultsBody:"Try another search term or city.",
    details:"Clinic details", queue:"Today's queue", noQueue:"No public queue available today", onlineBooking:"Book an online token",
    walkin:"Contact reception to get a token", updated:"Updated", hoursUnknown:"Hours not published", closed:"Closed today", open:"Hours", directions:"Get directions",
    phone:"Phone", doctors:"Doctors", viewQueue:"View live queue"
  };

  const cityOptions=useMemo(()=>Array.from(new Set(clinics.map(c=>c.city?.trim()).filter((x):x is string=>Boolean(x)))).sort((a,b)=>a.localeCompare(b)),[clinics]);
  const specialtyOptions=useMemo(()=>Array.from(new Set(clinics.flatMap(c=>c.specialties).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[clinics]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return clinics.filter(c=>{
      if(initialClinic && c.clinic_code.toLowerCase()!==initialClinic.toLowerCase() && c.clinic_slug?.toLowerCase()!==initialClinic.toLowerCase()) return false;
      if(city && c.city!==city) return false;
      if(specialty && !c.specialties.some(s=>s.toLowerCase()===specialty.toLowerCase())) return false;
      if(onlineOnly && !queues.some(x=>x.clinic_code===c.clinic_code && x.online_booking_enabled && x.queue_status==="open")) return false;
      if(!q) return true;
      const related=queues.filter(x=>x.clinic_code===c.clinic_code);
      const haystack=[c.clinic_name,c.clinic_code,c.city,c.state,c.address,...c.doctor_names,...c.specialties,
        ...related.flatMap(x=>[x.doctor_name,x.specialty])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  },[clinics,queues,query,city,specialty,onlineOnly,initialClinic]);

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Find care</p><h1 className="mt-3 text-4xl font-black tracking-tight">{text.title}</h1><p className="mt-3 max-w-2xl leading-7 text-[#65736d]">{text.intro}</p></div>
      <button type="button" onClick={()=>setLanguage(language==="en"?"hi":"en")} className="rounded-full border border-[#dbe5df] bg-white px-4 py-2.5 text-sm font-bold" aria-label="Switch language">{language==="en"?"हिन्दी":"English"}</button>
    </div>
    <div className="mt-7 grid gap-3 rounded-2xl border border-[#e1e9e4] bg-white p-4 md:grid-cols-[minmax(220px,1.6fr)_1fr_1fr]">
      <label className="text-sm font-bold"><span className="mb-1 flex items-center gap-2"><Search size={15}/>{text.search}</span><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border border-[#dbe5df] px-3 py-3 font-normal" placeholder={text.search}/></label>
      <label className="text-sm font-bold">{text.city}<select value={city} onChange={e=>setCity(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#dbe5df] bg-white px-3 py-3 font-normal"><option value="">{text.allCities}</option>{cityOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className="text-sm font-bold">{text.specialty}<select value={specialty} onChange={e=>setSpecialty(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#dbe5df] bg-white px-3 py-3 font-normal"><option value="">{text.allSpecialties}</option>{specialtyOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm font-semibold md:col-span-3"><input type="checkbox" checked={onlineOnly} onChange={e=>setOnlineOnly(e.target.checked)} className="h-4 w-4 accent-[#147d55]"/>{text.online}</label>
    </div>
    {filtered.length===0 ? <div className="mt-8 rounded-2xl border border-dashed border-[#cbd9d0] bg-white p-10 text-center"><h2 className="text-xl font-extrabold">{text.noResults}</h2><p className="mt-2 text-sm text-[#65736d]">{text.noResultsBody}</p><button onClick={()=>{setQuery("");setCity("");setSpecialty("");setOnlineOnly(false);}} className="mt-4 rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">Clear filters</button></div> :
    <div className="mt-8 grid gap-4 lg:grid-cols-2">{filtered.map(c=>{
      const clinicQueues=queues.filter(q=>q.clinic_code===c.clinic_code);
      const href="/clinics/"+encodeURIComponent(c.clinic_slug||c.clinic_code);
      const maps=c.address||c.city ? "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([c.address,c.city,c.state,c.postal_code].filter(Boolean).join(", ")) : null;
      return <article key={c.clinic_code} className="rounded-2xl border border-[#e1e9e4] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9f7ef] text-[#147d55]"><Stethoscope size={23}/></span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold">{c.clinic_name}</h2><p className="mt-1 text-xs text-[#65736d]">{c.clinic_code}</p>{(c.city||c.address)&&<p className="mt-2 flex items-start gap-1.5 text-sm text-[#65736d]"><MapPin size={15} className="mt-0.5 shrink-0"/>{[c.address,c.city,c.state,c.postal_code].filter(Boolean).join(", ")}</p>}</div></div>
        {c.description&&<p className="mt-4 text-sm leading-6 text-[#65736d]">{c.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{c.specialties.slice(0,4).map(s=><span key={s} className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-semibold">{s}</span>)}</div>
        {c.doctor_names.length>0&&<p className="mt-3 text-sm"><span className="font-bold">{text.doctors}:</span> {c.doctor_names.slice(0,4).join(", ")}{c.doctor_names.length>4?"…":""}</p>}
        {c.public_phone&&<p className="mt-2 text-sm"><span className="font-bold">{text.phone}:</span> <a href={"tel:"+c.public_phone} className="text-[#147d55] underline">{c.public_phone}</a></p>}
        <div className="mt-5 border-t border-[#edf1ee] pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">{text.queue}</h3><span className="text-xs text-[#65736d]">{clinicQueues.length} {clinicQueues.length===1?"doctor queue":"doctor queues"}</span></div>
          {clinicQueues.length===0?<p className="mt-3 rounded-xl bg-[#f7faf8] p-3 text-sm text-[#65736d]">{text.noQueue}</p>:<div className="mt-3 space-y-3">{clinicQueues.map(q=><div key={q.queue_id} className="rounded-xl bg-[#f7faf8] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{q.doctor_name}</p><p className="mt-0.5 text-xs text-[#65736d]">{q.specialty||"General consultation"}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize">{q.queue_status.replaceAll("_"," ")}</span></div>
            <div className="mt-3 grid grid-cols-3 gap-2"><div><p className="text-[11px] text-[#65736d]">Now calling</p><p className="font-black">{q.current_display_token||"—"}</p></div><div><p className="text-[11px] text-[#65736d]">Waiting</p><p className="font-black">{q.waiting_count}</p></div><div><p className="text-[11px] text-[#65736d]">{q.is_closed?text.closed:text.open}</p><p className="font-black text-sm">{q.opens_at&&q.closes_at? q.opens_at.slice(0,5)+"–"+q.closes_at.slice(0,5):"—"}</p></div></div>
            <p className="mt-2 text-[11px] text-[#65736d]">{text.updated} {new Date(q.updated_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"})} IST</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><Link href={"/queue/"+q.queue_id} className="text-sm font-bold text-[#147d55] underline">{text.viewQueue} <ArrowUpRight size={14} className="inline"/></Link>{q.online_booking_enabled&&q.queue_status==="open"?<span className="text-xs font-bold text-[#147d55]">{text.onlineBooking}</span>:<span className="text-xs text-[#65736d]">{text.walkin}</span>}</div>
            {q.online_booking_enabled&&q.queue_status==="open"&&<OnlineTokenBooking queueId={q.queue_id} clinicName={q.clinic_name} doctorName={q.doctor_name}/>}
          </div>)}</div>}
        </div>
        <div className="mt-5 flex flex-wrap gap-3"><Link href={href} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">{text.details} <ArrowUpRight size={15} className="inline"/></Link>{maps&&<a href={maps} target="_blank" rel="noreferrer" className="rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold">{text.directions}</a>}</div>
      </article>;
    })}</div>}
  </div>;
}
