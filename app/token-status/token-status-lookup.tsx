"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Share2, RefreshCw } from "lucide-react";
import PatientReminders from "./patient-reminders";

type Result = {
  token: { displayToken:string; status:string; serviceDate:string; expiresAt:string; tokensAhead:number; approximateWaitMinutes:number|null };
  queue: { clinicName:string; doctorName:string; clinicAddress:string|null; clinicCity:string|null; queueStatus:string; currentDisplayToken:string|null; waitingCount:number; averageConsultationMinutes:number|null; updatedAt:string; opensAt:string|null; closesAt:string|null; isClosed:boolean };
};

function time(value:string,language:"en"|"hi"="en"){return new Date(value).toLocaleTimeString(language==="hi"?"hi-IN":"en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"});}
function estimate(minutes:number|null,language:"en"|"hi"="en"){
 if(minutes===null)return language==="hi"?"उपलब्ध नहीं":"Not available";
 if(minutes===0)return language==="hi"?"आपकी बारी अगली हो सकती है":"Your turn may be next";
 if(minutes<60)return language==="hi"?"लगभग "+minutes+" मिनट":"About "+minutes+" min";
 return language==="hi"?"लगभग "+Math.floor(minutes/60)+" घंटा "+(minutes%60)+" मिनट":"About "+Math.floor(minutes/60)+" hr "+(minutes%60)+" min";
}

export default function TokenStatusLookup({ trackingConfigured, language }: { trackingConfigured: boolean; language: "en"|"hi" }) {
  const hi=language==="hi";
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
    if(!/^[a-fA-F0-9]{64}$/.test(secret)){if(!silent)setError(hi?"64 अक्षरों वाला निजी ट्रैकिंग सीक्रेट दर्ज करें या अपना निजी ट्रैकिंग लिंक खोलें।":"Enter the 64-character private tracking secret or open your private tracking link.");return;}
    if(!silent){setBusy(true);setError("");setMessage("");}
    try{
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({action:"track",trackingSecret:secret})});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:(hi?"टोकन की स्थिति उपलब्ध नहीं है।":"Token status is unavailable."));return;}
      setResult(body as Result);setTrackingSecret(secret);setLastRefresh(new Date().toISOString());setError("");
    }catch{setError(hi?"टोकन की स्थिति रीफ़्रेश नहीं हो सकी। कनेक्शन जाँचकर फिर प्रयास करें।":"Could not refresh token status. Check your connection and retry.");}
    finally{if(!silent)setBusy(false);}
  },[hi]);

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
  },[result,trackingSecret,fetchStatus]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();await fetchStatus(trackingSecret,false);
  }
  async function cancelToken(){
    if(!trackingSecret||!result||result.token.status!=="waiting")return;
    if(!window.confirm(hi?"टोकन "+result.token.displayToken+" रद्द करें? इसे ऑनलाइन वापस नहीं लिया जा सकता।":"Cancel token "+result.token.displayToken+"? This cannot be undone online."))return;
    setCancelBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({action:"cancel",trackingSecret})});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:(hi?"टोकन रद्द नहीं हो सका।":"Token cancellation failed."));return;}
      setResult(current=>current?{...current,token:{...current.token,status:body.token.status}}:current);
      setMessage(hi?"आपका प्रतीक्षा वाला टोकन रद्द कर दिया गया।":"Your waiting token was cancelled.");
    }catch{setError(hi?"टोकन रद्द नहीं हो सका। कनेक्शन जाँचकर फिर प्रयास करें।":"Could not cancel the token. Check your connection and retry.");}
    finally{setCancelBusy(false);}
  }
  async function shareTracking(){
    if(!trackingSecret||!result)return;
    const url=window.location.origin+"/token-status"+(hi?"?lang=hi":"")+"#secret="+trackingSecret;
    const text=(hi?"डॉक्टर क्यू की निजी ट्रैकिंग — टोकन ":"Private Doctor Queue tracking for ")+result.queue.clinicName+" — "+result.token.displayToken+"\n"+url;
    if(navigator.share){try{await navigator.share({title:hi?"मेरा डॉक्टर क्यू टोकन":"My Doctor Queue token",text,url});}catch{/* The user cancelled the native share sheet. */}return;}
    window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
  }
  const stale=!!result&&tick-new Date(result.queue.updatedAt).getTime()>120000;

  return <div className="mt-8 rounded-2xl border border-[#e1e9e4] bg-white p-5 sm:p-6">
    <h2 className="text-xl font-black">{hi?"अपना टोकन देखें":"Look up your token"}</h2>
    {!trackingConfigured&&<p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">{hi?"सर्वर पर बुकिंग क्रेडेंशियल सेट नहीं होने के कारण निजी टोकन ट्रैकिंग अभी उपलब्ध नहीं है। आपकी टोकन जानकारी सार्वजनिक नहीं की जा रही है। सेवा सेट होने तक क्लिनिक से संपर्क करें।":"Private token tracking is temporarily unavailable because the server-side booking credential is not configured. Your token details are not being exposed publicly. Please contact the clinic until the service is configured."}</p>}
    <p className="mt-2 text-sm leading-6 text-[#65736d]">{hi?"बुकिंग से मिला निजी लिंक खोलें या 64 अक्षरों वाला ट्रैकिंग सीक्रेट दर्ज करें। यह सीक्रेट बुकिंग के 48 घंटे बाद समाप्त हो जाता है; इसे निजी रखें।":"Open the private link from your booking or enter the 64-character tracking secret. The secret expires 48 hours after booking and must be kept private."}</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="text-sm font-bold">{hi?"निजी ट्रैकिंग सीक्रेट":"Private tracking secret"}<input required name="trackingSecret" value={trackingSecret} onChange={e=>setTrackingSecret(e.target.value.trim())} autoComplete="off" spellCheck={false} minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-mono text-sm font-normal"/></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?(hi?"जाँच रहे हैं…":"Checking…"):(hi?"स्थिति देखें":"Check status")}</button>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {result&&<section aria-live="polite" className="mt-5 rounded-xl border border-[#e1e9e4] bg-[#f8faf8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[#65736d]">{hi?"आपका टोकन":"Your token"}</p><p className="mt-1 text-3xl font-black text-[#147d55]">{result.token.displayToken}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold capitalize">{hi?({waiting:"प्रतीक्षा में",arrived:"पहुंच गए",called:"बुलाया गया",in_consultation:"परामर्श जारी",completed:"पूरा हुआ",cancelled:"रद्द",absent:"अनुपस्थित",skipped:"छोड़ा गया"} as Record<string,string>)[result.token.status]??result.token.status.replaceAll("_"," "):result.token.status.replaceAll("_"," ")}</span></div>
      <p className="mt-3 font-bold">{result.queue.clinicName}</p><p className="text-sm text-[#65736d]">{result.queue.doctorName}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">{hi?"अभी बुलाया जा रहा है":"Now calling"}</p><p className="mt-1 font-black">{result.queue.currentDisplayToken??"—"}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">{hi?"आपसे पहले पात्र टोकन":"Eligible tokens ahead"}</p><p className="mt-1 font-black">{result.token.status==="waiting"?result.token.tokensAhead:"—"}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">{hi?"अनुमानित प्रतीक्षा":"Estimated wait"}</p><p className="mt-1 font-black">{estimate(result.token.approximateWaitMinutes,language)}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#65736d]"><span>{online?(hi?"कनेक्टेड":"Connected"):(hi?"ऑफ़लाइन · पिछला परिणाम दिख रहा है":"Offline · showing last result")}</span><span>· {hi?"आख़िरी जाँच":"Last checked"} {lastRefresh?time(lastRefresh,language):"—"} IST</span>{stale&&<span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-900">{hi?"कतार की जानकारी पुरानी हो सकती है":"Queue data may be stale"}</span>}</div>
      {result.queue.queueStatus!=="open"&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{hi?"कतार अभी "+result.queue.queueStatus.replaceAll("_"," ")+" है। आने से पहले क्लिनिक के निर्देशों का पालन करें।":"The queue is currently "+result.queue.queueStatus.replaceAll("_"," ")+". Follow clinic instructions before travelling."}</p>}
      {result.token.status==="waiting"&&<button type="button" disabled={cancelBusy} onClick={()=>void cancelToken()} className="mt-4 rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">{cancelBusy?(hi?"रद्द हो रहा है…":"Cancelling…"):(hi?"प्रतीक्षा वाला टोकन रद्द करें":"Cancel waiting token")}</button>}
      <button type="button" onClick={()=>void shareTracking()} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold"><Share2 size={15}/>{hi?"निजी ट्रैकिंग लिंक साझा करें":"Share private tracking link"}</button>
      <button type="button" disabled={busy||!online} onClick={()=>void fetchStatus(trackingSecret,false)} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw size={15}/>{busy?(hi?"रीफ़्रेश हो रहा है…":"Refreshing…"):(hi?"अभी रीफ़्रेश करें":"Refresh now")}</button>
      <p className="mt-3 text-xs leading-5 text-[#65736d]">{hi?"स्थिति अपडेट: ":"Status refreshed "}{time(result.queue.updatedAt,language)} IST. {hi?"प्रतीक्षा समय केवल अनुमान है; परामर्श का समय बदल सकता है।":"Waiting time is an estimate only; consultation timing can change."}</p>
      {trackingSecret&&<PatientReminders trackingSecret={trackingSecret} tokenStatus={result.token.status} tokensAhead={result.token.tokensAhead} language={language}/>}
    </section>}
  </div>;
}
