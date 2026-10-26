"use client";

import { useEffect, useState } from "react";

export default function PwaRegistration() {
 const [installEvent,setInstallEvent]=useState<Event|null>(null);
 const [installed,setInstalled]=useState(false);
 const [offline,setOffline]=useState(false);
 useEffect(()=>{
  setOffline(!navigator.onLine);
  const wentOnline=()=>setOffline(false);
  const wentOffline=()=>setOffline(true);
  window.addEventListener("online",wentOnline);window.addEventListener("offline",wentOffline);
  if("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(()=>{});
  const before=(event:Event)=>{event.preventDefault();setInstallEvent(event);};
  const appInstalled=()=>{setInstalled(true);setInstallEvent(null);};
  window.addEventListener("beforeinstallprompt",before);
  window.addEventListener("appinstalled",appInstalled);
  return ()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",appInstalled);window.removeEventListener("online",wentOnline);window.removeEventListener("offline",wentOffline);};
 },[]);
 async function install(){
  const e=installEvent as (Event&{prompt?:()=>Promise<void>;userChoice?:Promise<{outcome:string}>})|null;
  if(!e?.prompt)return;
  await e.prompt();
  const choice=await e.userChoice;
  if(choice?.outcome==="accepted")setInstalled(true);
  setInstallEvent(null);
 }
 return <>
  {offline&&<div role="alert" className="fixed left-3 right-3 top-3 z-[100] rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 shadow-lg">You are offline. Live status may be stale; no token booking is confirmed until the server accepts it.</div>}
  {!installed&&installEvent&&<button onClick={()=>void install()} type="button" className="fixed bottom-4 right-4 z-50 rounded-full bg-[#14231d] px-4 py-3 text-sm font-bold text-white shadow-xl">Install Doctor Queue</button>}
 </>;
}
