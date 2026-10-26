"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Clock3, MapPin, RefreshCw, Share2, Wifi, WifiOff } from "lucide-react";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export type LiveQueueSnapshot = {
  queue_id: string; clinic_code: string; clinic_slug: string|null; clinic_name: string; doctor_name: string;
  specialty: string|null; service_date: string; queue_status: string; current_display_token: string|null;
  waiting_count: number; completed_count: number; online_booking_enabled: boolean; updated_at: string;
  clinic_city: string|null; clinic_address: string|null; opens_at: string|null; closes_at: string|null;
  is_closed: boolean; average_consultation_minutes: number;
};

function estimateText(minutes:number|null,language:"en"|"hi"){if(minutes===null)return language==="hi"?"उपलब्ध नहीं":"Not available";if(minutes===0)return language==="hi"?"आपकी बारी जल्द आ सकती है":"Your queue is clear";if(minutes<60)return language==="hi"?"लगभग "+minutes+" मिनट":"About "+minutes+" min";return language==="hi"?"लगभग "+Math.floor(minutes/60)+" घंटे "+(minutes%60)+" मिनट":"About "+Math.floor(minutes/60)+" hr "+(minutes%60)+" min";}
function time(value:string) {
  return new Date(value).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"});
}
function age(value:string) {
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60) return seconds+" sec ago";
  return Math.floor(seconds/60)+" min ago";
}

export default function LiveQueue({ initial, initialLanguage="en" }: { initial: LiveQueueSnapshot; initialLanguage?: "en"|"hi" }) {
  const [queue,setQueue]=useState(initial);
  const [language,setLanguage]=useState<"en"|"hi">(initialLanguage);
  const [lastRefresh,setLastRefresh]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [online,setOnline]=useState(true);
  const [realtime,setRealtime]=useState<"connecting"|"live"|"polling">("connecting");
  const [tick,setTick]=useState(Date.now());

  const refresh=useCallback(async (manual=false)=>{
    if(manual) setBusy(true);
    try {
      const supabase=createSupabasePublicClient();
      const {data,error:queryError}=await supabase.from("public_queue_snapshots")
        .select("queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,current_display_token,waiting_count,completed_count,online_booking_enabled,updated_at,clinic_city,clinic_address,opens_at,closes_at,is_closed,average_consultation_minutes")
        .eq("queue_id",initial.queue_id).maybeSingle();
      if(queryError) throw queryError;
      if(!data) throw new Error("This public queue is no longer available.");
      setQueue(data as LiveQueueSnapshot);
      setLastRefresh(new Date().toISOString());
      setError("");
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not refresh queue status.");
    } finally { if(manual) setBusy(false); }
  },[initial.queue_id]);

  useEffect(()=>{
    setOnline(navigator.onLine);
    const onOnline=()=>{setOnline(true);void refresh(true);};
    const onOffline=()=>{setOnline(false);setRealtime("polling");};
    const timer=window.setInterval(()=>setTick(Date.now()),5000);
    const poll=window.setInterval(()=>{if(navigator.onLine) void refresh(false);},15000);
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);
    const supabase=createSupabasePublicClient();
    const channel=supabase.channel("public-queue-"+initial.queue_id)
      .on("postgres_changes",{event:"*",schema:"public",table:"public_queue_snapshots",filter:"queue_id=eq."+initial.queue_id},()=>{void refresh(false);})
      .subscribe(status=>setRealtime(status==="SUBSCRIBED"?"live":"polling"));
    void refresh(false);
    return ()=>{window.clearInterval(timer);window.clearInterval(poll);window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);void supabase.removeChannel(channel);};
  },[initial.queue_id,refresh]);

  const isStale=tick-new Date(queue.updated_at).getTime()>120000;
  const t=language==="hi"?{directory:"क्लिनिक सूची",share:"साझा करें",publicQueue:"सार्वजनिक लाइव कतार",nowCalling:"अभी बुलाया जा रहा है",ready:"जब आपकी बारी नज़दीक हो तो तैयार रहें।",notOpen:"कतार अभी सामान्य कॉलिंग के लिए खुली नहीं है।",waiting:"प्रतीक्षा में",completed:"आज पूरे हुए",estimated:"अनुमानित प्रतीक्षा समय",estimateNote:"अनुमान वर्तमान प्रतीक्षा संख्या और औसत पर आधारित है। यह गारंटी नहीं है।",hours:"आज का समय",hoursUnknown:"समय प्रकाशित नहीं",closed:"क्लिनिक आज बंद दिखाया गया है",open:"कतार खुली है",follow:"अपना टोकन ट्रैक करें",followNote:"ऑनलाइन बुकिंग के बाद निजी ट्रैकिंग लिंक खोलें। सार्वजनिक पेज किसी मरीज का नाम या निजी टोकन नहीं दिखाता।",track:"मेरा टोकन ट्रैक करें",refresh:"अभी रिफ्रेश करें",refreshing:"रिफ्रेश हो रहा है…",privacy:"सार्वजनिक पेज केवल कतार की कुल जानकारी दिखाता है।",checked:"आखिरी जाँच",stale:"कतार डेटा पुराना हो सकता है",offline:"ऑफ़लाइन · पिछली जानकारी दिखाई जा रही है",connected:"कनेक्टेड · पोलिंग बैकअप"}:{directory:"Clinic directory",share:"Share",publicQueue:"Public live queue",nowCalling:"Now calling",ready:"Please stay ready when your token is near.",notOpen:"Queue is not currently open for normal calling.",waiting:"Waiting",completed:"Completed today",estimated:"Estimated waiting time",estimateNote:"{t.estimateNote}",hours:"Today’s hours",hoursUnknown:"Not published",closed:"Clinic marked closed today",open:"Queue is open",follow:"Follow your own token",followNote:"If you booked online, use the private tracking link to see your token status and position. The public page never displays patient names or personal tokens.",track:"Track my token",refresh:"Refresh now",refreshing:"Refreshing…",privacy:"Queue status is public aggregate information. No patient names, phone numbers or medical details are shown.",checked:"Last checked",stale:"Queue data may be stale",offline:"Offline · showing last known status",connected:"Connected · polling fallback"};
  const estimate=queue.queue_status==="open"&&queue.waiting_count>=0&&queue.average_consultation_minutes>0?queue.waiting_count*queue.average_consultation_minutes:null;
  const url=typeof window!=="undefined"?window.location.href:"";
  async function share() {
    const message=queue.clinic_name+" — "+queue.doctor_name+" live queue\n"+url;
    if(navigator.share) { try { await navigator.share({title:queue.clinic_name,text:message,url}); return; } catch { /* user may cancel */ } }
    window.open("https://wa.me/?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");
  }

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[72px] items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href={"/clinics"+(language==="hi"?"?lang=hi":"")} className="font-black">← {t.directory}</Link><button type="button" onClick={()=>setLanguage(language==="en"?"hi":"en")} className="rounded-full border border-[#dbe5df] px-3 py-2 text-xs font-bold">{language==="en"?"हिन्दी":"English"}</button></div><button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-3 py-2 text-sm font-bold"><Share2 size={15}/>{t.share}</button></div></header>
    <section className="container max-w-3xl py-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{t.publicQueue}</p><h1 className="mt-2 text-3xl font-black tracking-tight">{queue.clinic_name}</h1><p className="mt-1 text-lg font-semibold text-[#53645b]">{queue.doctor_name}{queue.specialty?" · "+queue.specialty:""}</p>{(queue.clinic_address||queue.clinic_city)&&<p className="mt-3 flex items-start gap-2 text-sm text-[#65736d]"><MapPin size={16} className="mt-0.5 shrink-0"/>{[queue.clinic_address,queue.clinic_city].filter(Boolean).join(", ")}</p>}</div>
      <span className={"rounded-full px-3 py-1.5 text-xs font-extrabold capitalize "+(queue.queue_status==="open"?"bg-emerald-100 text-emerald-800":"bg-[#e9eeeb] text-[#53645b]")}>{language==="hi"?({open:"खुली",paused:"रुकी हुई",closed:"बंद",not_started:"शुरू नहीं हुई"} as Record<string,string>)[queue.queue_status]||queue.queue_status:queue.queue_status.replaceAll("_"," ")}</span></div>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#e1e9e4] bg-white p-3 text-xs"><span className="inline-flex items-center gap-1.5 font-bold">{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?(realtime==="live"?(language==="hi"?"रीयलटाइम जुड़ा है":"Realtime connected"):t.connected):t.offline}</span><span className="text-[#65736d]">{t.checked} {lastRefresh?time(lastRefresh):"—"} IST</span>{isStale&&<span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-900">{t.stale} ({age(queue.updated_at)})</span>}</div>
      {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button onClick={()=>void refresh(true)} className="ml-2 underline">{language==="hi"?"फिर कोशिश करें":"Retry"}</button></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl bg-[#147d55] p-6 text-white"><p className="text-sm font-semibold text-white/80">{t.nowCalling}</p><p className="mt-2 text-5xl font-black">{queue.current_display_token||"—"}</p><p className="mt-3 text-sm text-white/80">{queue.queue_status==="open"?t.ready:t.notOpen}</p></article>
      <article className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><p className="text-sm font-semibold text-[#65736d]">{t.waiting}</p><p className="mt-2 text-5xl font-black">{queue.waiting_count}</p><p className="mt-3 text-sm text-[#65736d]">{t.completed}: <strong>{queue.completed_count}</strong></p></article></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-[#e1e9e4] bg-white p-5"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[#147d55]"/><h2 className="font-extrabold">{t.estimated}</h2></div><p className="mt-2 text-2xl font-black">{estimateText(estimate,language)}</p><p className="mt-2 text-xs leading-5 text-[#65736d]">Estimate based on the current waiting count and clinic average. It is not a guaranteed consultation time.</p></article>
      <article className="rounded-2xl border border-[#e1e9e4] bg-white p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-[#147d55]"/><h2 className="font-extrabold">{t.hours}</h2></div><p className="mt-2 text-2xl font-black">{queue.opens_at&&queue.closes_at?queue.opens_at.slice(0,5)+"–"+queue.closes_at.slice(0,5) : t.hoursUnknown}</p><p className="mt-2 text-sm text-[#65736d]">{queue.is_closed?t.closed:queue.queue_status==="open"?t.open:(language==="hi"?"ऊपर दी गई कतार स्थिति का पालन करें":"Follow the queue status shown above")}</p></article></div>
      <div className="mt-5 rounded-2xl border border-[#d8e8de] bg-white p-5"><h2 className="font-extrabold">{t.follow}</h2><p className="mt-2 text-sm leading-6 text-[#65736d]">{t.followNote}</p><div className="mt-3 flex flex-wrap gap-3"><Link href={"/token-status"+(language==="hi"?"?lang=hi":"")} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">{t.track}</Link><button type="button" onClick={()=>void refresh(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw size={15} className={busy?"animate-spin":""}/>{busy?t.refreshing:t.refresh}</button></div></div>
      <p className="mt-5 text-center text-xs text-[#65736d]">Queue status is public aggregate information. No patient names, phone numbers or medical details are shown.</p>
    </section>
  </main>;
}
