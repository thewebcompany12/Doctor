"use client";

import { useEffect, useState } from "react";

export default function PublicClinicLink({ clinicCode }: { clinicCode: string }) {
  const [url,setUrl]=useState("");
  const [copied,setCopied]=useState(false);
  useEffect(()=>{setUrl(window.location.origin+"/clinics?clinic="+encodeURIComponent(clinicCode));},[clinicCode]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setCopied(false); }
  }
  return <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4">
    <summary className="cursor-pointer font-bold">Public clinic link and QR</summary>
    <p className="mt-2 text-sm text-[#65736d]">Share the public queue directory filtered to this Clinic ID.</p>
    {url && <div className="mt-3 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1"><a href={url} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-[#147d55] underline">{url}</a><button type="button" onClick={copy} className="mt-3 block rounded-full border border-[#dbe5df] px-3 py-1.5 text-xs font-bold">{copied?"Copied":"Copy public link"}</button></div>
      <div className="rounded-xl border border-[#e1e9e4] bg-white p-2"><img width="144" height="144" loading="lazy" alt={"QR code for clinic "+clinicCode} src={"https://api.qrserver.com/v1/create-qr-code/?size=144x144&data="+encodeURIComponent(url)} /></div>
    </div>}
  </details>;
}
