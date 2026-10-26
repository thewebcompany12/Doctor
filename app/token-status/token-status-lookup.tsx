"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Share2, RefreshCw } from "lucide-react";
import PatientReminders from "./patient-reminders";

type Result = {
  token: { displayToken:string; status:string; serviceDate:string; expiresAt:string; tokensAhead:number; approximateWaitMinutes:number|null };
  queue: { clinicName:string; doctorName:string; clinicAddress:string|null; clinicCity:string|null; queueStatus:string; currentDisplayToken:string|null; waitingCount:number; averageConsultationMinutes:number|null; updatedAt:string; opensAt:string|null; closesAt:string|null; isClosed:boolean };
};

function time(value:string){return new Date(value).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"});}
function estimate(minutes:number|null){
 if(minutes===null)return "Not available";
 if(minutes===0)return "Your turn may be next";
 if(minutes<60)return "About "+minutes+" min";
 return "About "+Math.floor(minutes/60)+" hr "+(minutes%60)+" min";
}

export default function TokenStatusLookup() {
  const [trackingSecret,setTrackingSecret]=useState("");
  const [busy,setBusy]=useState(false);
  const [cancelBusy,setCancelBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const [lastRefresh,setLastRefresh]=useState<string|null>(null);
  const [online,setOnline]=useState(true);
  const [tick,setTick]=useState(Date.now());

  const fetchStatus=useCallback(async(secret:string,silent=false)=>{
    if(!/^[a-fA-F0-9]{64}$/.test(secret)){if(!silent)setError("Enter the 64-character private tracking secret or open your private tracking link.");return;}
    if(!silent){setBusy(true);setError("");setMessage("");}
    try{
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({action:"track",trackingSecret:secret})});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Token status is unavailable.");return;}
      setResult(body as Result);setTrackingSecret(secret);setLastRefresh(new Date().toISOString());setError("");
    }catch{setError("Could not refresh token status. Check your connection and retry.");}
    finally{if(!silent)setBusy(false);}
  },[]);

  useEffect(()=>{
    setOnline(navigator.onLine);
    const onlineHandler=()=>setOnline(true);
    const offlineHandler=()=>setOnline(false);
    const clock=window.setInterval(()=>setTick(Date.now()),5000);
    window.addEventListener("online",onlineHandler);window.addEventListener("offline",offlineHandler);
    const params=new URLSearchParams(window.location.hash.replace(/^#/,""));
    const fragmentSecret=params.get("secret")||params.get("trackingSecret");
    if(fragmentSecret&&/^[a-fA-F0-9]{64}$/.test(fragmentSecret)){
      window.history.replaceState(null,"",window.location.pathname+window.location.search);
      setTrackingSecret(fragmentSecret);
      void fetchStatus(fragmentSecret,false);
    }
    return ()=>{window.clearInterval(clock);window.removeEventListener("online",onlineHandler);window.removeEventListener("offline",offlineHandler);};
  },[fetchStatus]);

  useEffect(()=>{
    if(!result||!trackingSecret)return;
    const poll=window.setInterval(()=>{if(navigator.onLine)void fetchStatus(trackingSecret,true);},20000);
    return ()=>window.clearInterval(poll);
  },[result?.token.displayToken,trackingSecret,fetchStatus]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();await fetchStatus(trackingSecret,false);
  }
  async function cancelToken(){
    if(!trackingSecret||!result||result.token.status!=="waiting")return;
    if(!window.confirm("Cancel token "+result.token.displayToken+"? This cannot be undone online."))return;
    setCancelBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({action:"cancel",trackingSecret})});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Token cancellation failed.");return;}
      setResult(current=>current?{...current,token:{...current.token,status:body.token.status}}:current);
      setMessage("Your waiting token was cancelled.");
    }catch{setError("Could not cancel the token. Check your connection and retry.");}
    finally{setCancelBusy(false);}
  }
  async function shareTracking(){
    if(!trackingSecret||!result)return;
    const url=window.location.origin+"/token-status#secret="+trackingSecret;
    const text="Private Doctor Queue tracking for "+result.queue.clinicName+" — token "+result.token.displayToken+"\n"+url;
    if(navigator.share){try{await navigator.share({title:"My Doctor Queue token",text,url});return;}catch{/* cancelled by user */}}
    window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
  }
  const stale=!!result&&tick-new Date(result.queue.updatedAt).getTime()>120000;

  return <div className="mt-8 rounded-2xl border border-[#e1e9e4] bg-white p-5 sm:p-6">
    <h2 className="text-xl font-black">Look up your token</h2>
    <p className="mt-2 text-sm leading-6 text-[#65736d]">Open the private link from your booking or enter the 64-character tracking secret. The secret expires 48 hours after booking and must be kept private.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="text-sm font-bold">Private tracking secret<input required name="trackingSecret" value={trackingSecret} onChange={e=>setTrackingSecret(e.target.value.trim())} autoComplete="off" spellCheck={false} minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-mono text-sm font-normal"/></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Checking…":"Check status"}</button>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {result&&<section aria-live="polite" className="mt-5 rounded-xl border border-[#e1e9e4] bg-[#f8faf8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[#65736d]">Your token</p><p className="mt-1 text-3xl font-black text-[#147d55]">{result.token.displayToken}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold capitalize">{result.token.status.replaceAll("_"," ")}</span></div>
      <p className="mt-3 font-bold">{result.queue.clinicName}</p><p className="text-sm text-[#65736d]">{result.queue.doctorName}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Now calling</p><p className="mt-1 font-black">{result.queue.currentDisplayToken??"—"}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Eligible tokens ahead</p><p className="mt-1 font-black">{result.token.status==="waiting"?result.token.tokensAhead:"—"}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Estimated wait</p><p className="mt-1 font-black">{estimate(result.token.approximateWaitMinutes)}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#65736d]"><span>{online?"Connected":"Offline · showing last result"}</span><span>· Last checked {lastRefresh?time(lastRefresh):"—"} IST</span>{stale&&<span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-900">Queue data may be stale</span>}</div>
      {result.queue.queueStatus!=="open"&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The queue is currently {result.queue.queueStatus.replaceAll("_"," ")}. Follow clinic instructions before travelling.</p>}
      {result.token.status==="waiting"&&<button type="button" disabled={cancelBusy} onClick={()=>void cancelToken()} className="mt-4 rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">{cancelBusy?"Cancelling…":"Cancel waiting token"}</button>}
      <button type="button" onClick={()=>void shareTracking()} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold"><Share2 size={15}/>Share private tracking link</button>
      <button type="button" disabled={busy||!online} onClick={()=>void fetchStatus(trackingSecret,false)} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw size={15}/>{busy?"Refreshing…":"Refresh now"}</button>
      <p className="mt-3 text-xs leading-5 text-[#65736d]">Status refreshed {time(result.queue.updatedAt)} IST. Waiting time is an estimate only; consultation timing can change.</p>
      {trackingSecret&&<PatientReminders trackingSecret={trackingSecret} tokenStatus={result.token.status} tokensAhead={result.token.tokensAhead}/>}
    </section>}
  </div>;
}
