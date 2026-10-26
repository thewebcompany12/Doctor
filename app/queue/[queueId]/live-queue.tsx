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

function time(value:string) {
  return new Date(value).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"});
}
function age(value:string) {
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60) return seconds+" sec ago";
  return Math.floor(seconds/60)+" min ago";
}

export default function LiveQueue({ initial }: { initial: LiveQueueSnapshot }) {
  const [queue,setQueue]=useState(initial);
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
  const estimate=queue.queue_status==="open"&&queue.waiting_count>=0&&queue.average_consultation_minutes>0?queue.waiting_count*queue.average_consultation_minutes:null;
  const url=typeof window!=="undefined"?window.location.href:"";
  async function share() {
    const message=queue.clinic_name+" — "+queue.doctor_name+" live queue\n"+url;
    if(navigator.share) { try { await navigator.share({title:queue.clinic_name,text:message,url}); return; } catch { /* user may cancel */ } }
    window.open("https://wa.me/?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");
  }

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[72px] items-center justify-between gap-3"><Link href="/clinics" className="font-black">← Clinic directory</Link><button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-3 py-2 text-sm font-bold"><Share2 size={15}/>Share</button></div></header>
    <section className="container max-w-3xl py-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Public live queue</p><h1 className="mt-2 text-3xl font-black tracking-tight">{queue.clinic_name}</h1><p className="mt-1 text-lg font-semibold text-[#53645b]">{queue.doctor_name}{queue.specialty?" · "+queue.specialty:""}</p>{(queue.clinic_address||queue.clinic_city)&&<p className="mt-3 flex items-start gap-2 text-sm text-[#65736d]"><MapPin size={16} className="mt-0.5 shrink-0"/>{[queue.clinic_address,queue.clinic_city].filter(Boolean).join(", ")}</p>}</div>
      <span className={"rounded-full px-3 py-1.5 text-xs font-extrabold capitalize "+(queue.queue_status==="open"?"bg-emerald-100 text-emerald-800":"bg-[#e9eeeb] text-[#53645b]")}>{queue.queue_status.replaceAll("_"," ")}</span></div>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#e1e9e4] bg-white p-3 text-xs"><span className="inline-flex items-center gap-1.5 font-bold">{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?(realtime==="live"?"Realtime connected":"Connected · polling fallback"):"Offline · showing last known status"}</span><span className="text-[#65736d]">Last checked {lastRefresh?time(lastRefresh):"—"} IST</span>{isStale&&<span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-900">Queue data may be stale ({age(queue.updated_at)})</span>}</div>
      {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button onClick={()=>void refresh(true)} className="ml-2 underline">Retry</button></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl bg-[#147d55] p-6 text-white"><p className="text-sm font-semibold text-white/80">Now calling</p><p className="mt-2 text-5xl font-black">{queue.current_display_token||"—"}</p><p className="mt-3 text-sm text-white/80">{queue.queue_status==="open"?"Please stay ready when your token is near.":"Queue is not currently open for normal calling."}</p></article>
      <article className="rounded-2xl border border-[#e1e9e4] bg-white p-6"><p className="text-sm font-semibold text-[#65736d]">Waiting</p><p className="mt-2 text-5xl font-black">{queue.waiting_count}</p><p className="mt-3 text-sm text-[#65736d]">Completed today: <strong>{queue.completed_count}</strong></p></article></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-[#e1e9e4] bg-white p-5"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[#147d55]"/><h2 className="font-extrabold">Estimated waiting time</h2></div><p className="mt-2 text-2xl font-black">{estimate===null?"Not available":estimate===0?"Your queue is clear":estimate<60?("About "+estimate+" min"):("About "+Math.floor(estimate/60)+" hr "+(estimate%60)+" min")}</p><p className="mt-2 text-xs leading-5 text-[#65736d]">Estimate based on the current waiting count and clinic average. It is not a guaranteed consultation time.</p></article>
      <article className="rounded-2xl border border-[#e1e9e4] bg-white p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-[#147d55]"/><h2 className="font-extrabold">Today's hours</h2></div><p className="mt-2 text-2xl font-black">{queue.opens_at&&queue.closes_at?queue.opens_at.slice(0,5)+"–"+queue.closes_at.slice(0,5):"Not published"}</p><p className="mt-2 text-sm text-[#65736d]">{queue.is_closed?"Clinic marked closed today":queue.queue_status==="open"?"Queue is open": "Follow the queue status shown above"}</p></article></div>
      <div className="mt-5 rounded-2xl border border-[#d8e8de] bg-white p-5"><h2 className="font-extrabold">Follow your own token</h2><p className="mt-2 text-sm leading-6 text-[#65736d]">If you booked online, use the private tracking link or your 64-character tracking secret to see your token status and position. The public page never displays patient names or personal tokens.</p><div className="mt-3 flex flex-wrap gap-3"><Link href="/token-status" className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">Track my token</Link><button type="button" onClick={()=>void refresh(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw size={15} className={busy?"animate-spin":""}/>{busy?"Refreshing…":"Refresh now"}</button></div></div>
      <p className="mt-5 text-center text-xs text-[#65736d]">Queue status is public aggregate information. No patient names, phone numbers or medical details are shown.</p>
    </section>
  </main>;
}
