"use client";

import { useEffect, useState } from "react";

export default function PwaRegistration() {
 const [installEvent,setInstallEvent]=useState<Event|null>(null);
 const [installed,setInstalled]=useState(false);
 useEffect(()=>{
  if("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(()=>{});
  const before=(event:Event)=>{event.preventDefault();setInstallEvent(event);};
  const appInstalled=()=>{setInstalled(true);setInstallEvent(null);};
  window.addEventListener("beforeinstallprompt",before);
  window.addEventListener("appinstalled",appInstalled);
  return ()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",appInstalled);};
 },[]);
 async function install(){
  const e=installEvent as (Event&{prompt?:()=>Promise<void>;userChoice?:Promise<{outcome:string}>})|null;
  if(!e?.prompt)return;
  await e.prompt();
  const choice=await e.userChoice;
  if(choice?.outcome==="accepted")setInstalled(true);
  setInstallEvent(null);
 }
 if(installed||!installEvent)return null;
 return <button onClick={()=>void install()} type="button" className="fixed bottom-4 right-4 z-50 rounded-full bg-[#14231d] px-4 py-3 text-sm font-bold text-white shadow-xl">Install Doctor Queue</button>;
}
