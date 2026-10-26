"use client";

import { FormEvent, useState } from "react";

type Result = {
  token: { displayToken: string; status: string; serviceDate: string; expiresAt: string };
  queue: { clinicName: string; doctorName: string; queueStatus: string; currentDisplayToken: string | null; waitingCount: number; averageConsultationMinutes: number | null; updatedAt: string };
};

export default function TokenStatusLookup() {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<Result|null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    setBusy(true);setError("");setResult(null);
    try {
      const response=await fetch("/api/public/tokens",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"track",trackingSecret:String(data.get("trackingSecret")??"").trim()
      })});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Token status is unavailable.");return;}
      setResult(body as Result);
    } catch { setError("Could not check token status. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  return <div className="mt-8 rounded-2xl border border-[#e1e9e4] bg-white p-6">
    <h2 className="text-xl font-black">Look up your token</h2>
    <p className="mt-2 text-sm leading-6 text-[#65736d]">Enter the private tracking secret shown when you booked. It expires 48 hours after booking. Never share it publicly.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="text-sm font-bold">Tracking secret<input required name="trackingSecret" autoComplete="off" spellCheck={false} minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-mono text-sm font-normal"/></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Checking…":"Check status"}</button>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result&&<section aria-live="polite" className="mt-5 rounded-xl border border-[#e1e9e4] bg-[#f8faf8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[#65736d]">Your token</p><p className="mt-1 text-3xl font-black text-[#147d55]">{result.token.displayToken}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold capitalize">{result.token.status.replaceAll("_"," ")}</span></div>
      <p className="mt-3 font-bold">{result.queue.clinicName}</p><p className="text-sm text-[#65736d]">{result.queue.doctorName}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Now calling</p><p className="mt-1 font-black">{result.queue.currentDisplayToken??"—"}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Waiting</p><p className="mt-1 font-black">{result.queue.waitingCount}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-[#65736d]">Queue</p><p className="mt-1 font-black capitalize">{result.queue.queueStatus.replaceAll("_"," ")}</p></div></div>
      <p className="mt-3 text-xs text-[#65736d]">Status refreshed {new Date(result.queue.updatedAt).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"})} IST. Waiting count is an estimate, not a guaranteed consultation time.</p>
    </section>}
  </div>;
}
