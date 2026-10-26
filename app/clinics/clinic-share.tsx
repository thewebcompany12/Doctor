"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Share2 } from "lucide-react";

export default function ClinicShare({ slug, clinicCode, clinicName }: { slug: string | null; clinicCode: string; clinicName: string }) {
  const [url,setUrl]=useState("");
  const [copied,setCopied]=useState(false);
  const [shared,setShared]=useState(false);
  useEffect(()=>setUrl(window.location.origin+"/clinics/"+encodeURIComponent(slug||clinicCode)),[slug,clinicCode]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }
  async function share() {
    if(!url) return;
    const text=clinicName+" — Doctor Queue";
    if(navigator.share) {
      try { await navigator.share({title:clinicName,text,url}); setShared(true); } catch { setShared(false); }
    } else {
      window.open("https://wa.me/?text="+encodeURIComponent(text+"\n"+url),"_blank","noopener,noreferrer");
      setShared(true);
    }
  }
  return <section className="mt-6 rounded-2xl border border-[#e1e9e4] bg-white p-5">
    <div className="flex items-center gap-2"><Share2 size={18} className="text-[#147d55]"/><h2 className="font-extrabold">Share this clinic</h2></div>
    <p className="mt-2 text-sm text-[#65736d]">Share this public clinic page or scan its QR code. It contains no patient information.</p>
    {url&&<div className="mt-4 flex flex-wrap items-center gap-4"><div className="min-w-0 flex-1"><a href={url} className="break-all text-sm font-semibold text-[#147d55] underline">{url}</a><div className="mt-3 flex flex-wrap gap-2"><button onClick={copy} type="button" className="inline-flex items-center gap-2 rounded-full border border-[#dbe5df] px-3 py-2 text-xs font-bold"><Copy size={14}/>{copied?"Copied":"Copy link"}</button><button onClick={share} type="button" className="rounded-full bg-[#147d55] px-3 py-2 text-xs font-bold text-white">{shared?"Share opened":"Share / WhatsApp"}</button></div></div><div className="rounded-xl border border-[#e1e9e4] bg-white p-2"><Image width={136} height={136} unoptimized alt={"Public clinic QR code for "+clinicName} src={"https://api.qrserver.com/v1/create-qr-code/?size=136x136&data="+encodeURIComponent(url)}/></div></div>}
  </section>;
}
