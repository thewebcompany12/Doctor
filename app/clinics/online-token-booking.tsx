"use client";

import { FormEvent, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import Link from "next/link";

type BookingResult = { token: { displayToken: string; tokenNumber: number; expiresAt: string }; trackingSecret: string; notice: string };

export default function OnlineTokenBooking({ queueId, clinicName, doctorName }: { queueId: string; clinicName: string; doctorName: string }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<BookingResult|null>(null);
  const [copied,setCopied]=useState(false);
  const [trackingUrl,setTrackingUrl]=useState("");
  const [idempotencyKey,setIdempotencyKey]=useState("");
  useEffect(()=>{if(result)setTrackingUrl(window.location.origin+"/token-status#secret="+result.trackingSecret);else setTrackingUrl("");},[result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    setBusy(true);setError("");setResult(null);setCopied(false);
    const requestKey=idempotencyKey||crypto.randomUUID();
    setIdempotencyKey(requestKey);
    try {
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"book",queueId,patientName:String(data.get("patientName")??"").trim(),idempotencyKey:requestKey
      })});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Online booking failed.");return;}
      setResult(body as BookingResult);
      setIdempotencyKey(crypto.randomUUID());
      form.reset();
    } catch { setError("Booking request failed. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  async function shareTracking() {
    if(!result||!trackingUrl)return;
    const text="Doctor Queue token "+result.token.displayToken+" for "+clinicName+" · "+doctorName+"\\nPrivate tracking link: "+trackingUrl;
    if(navigator.share){try{await navigator.share({title:"My Doctor Queue token",text,url:trackingUrl});return;}catch{/* share dialog was cancelled */}}
    window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
  }

  async function copySecret() {
    if(!result) return;
    try { await navigator.clipboard.writeText(result.trackingSecret);setCopied(true); }
    catch { setCopied(false); }
  }

  return <details className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
    <summary className="cursor-pointer font-bold text-[#147d55]">Book an online token</summary>
    <p className="mt-2 text-xs leading-5 text-[#65736d]">{clinicName} · {doctorName}. Your tracking secret is private; save it to check your token later.</p>
    {!result && <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row">
      <label className="min-w-0 flex-1 text-sm font-bold">Patient name<input required name="patientName" minLength={1} maxLength={80} className="mt-1 w-full rounded-lg border border-[#dbe5df] bg-white px-3 py-2 font-normal"/></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Booking…":"Get token"}</button>
    </form>}
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result&&<div className="mt-3 rounded-xl border border-emerald-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#65736d]">Your token</p>
      <p className="mt-1 text-3xl font-black text-[#147d55]">{result.token.displayToken}</p>
      <p className="mt-2 text-sm">{result.notice}</p>
      <code className="mt-2 block break-all rounded-lg bg-[#f6f9f7] p-3 text-xs">{result.trackingSecret}</code>
      <button type="button" onClick={copySecret} className="mt-3 rounded-full border border-[#dbe5df] px-4 py-2 text-sm font-bold">{copied?"Tracking secret copied":"Copy tracking secret"}</button>
      <Link href={trackingUrl||"/token-status"} className="ml-3 inline-block text-sm font-bold text-[#147d55] underline">Open private tracking</Link>
      <button type="button" onClick={()=>void shareTracking()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white"><Share2 size={15}/>Share on WhatsApp</button>
      <p className="mt-3 text-xs text-[#65736d]">Tracking access expires {new Date(result.token.expiresAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})} IST.</p>
      <button type="button" onClick={()=>setResult(null)} className="mt-3 block text-xs font-semibold underline">Close token details</button>
    </div>}
  </details>;
}
