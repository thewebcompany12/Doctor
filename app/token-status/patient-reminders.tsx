"use client";

import { useEffect, useRef, useState } from "react";

type PushSubscriptionJson = { endpoint: string; expirationTime: number|null; keys: {p256dh:string;auth:string} };

function decodeVapidKey(value:string) {
 const base64=value.replace(/-/g,"+").replace(/_/g,"/");
 const raw=window.atob(base64+"=".repeat((4-base64.length%4)%4));
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes.buffer;
}

export default function PatientReminders({ trackingSecret, tokenStatus, tokensAhead }: { trackingSecret:string; tokenStatus:string; tokensAhead:number }) {
 const [mode,setMode]=useState<"off"|"browser"|"push"|"denied">("off");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [subscription,setSubscription]=useState<PushSubscription|null>(null);
 const vapidKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 const lastAlert=useRef("");
 useEffect(()=>{
  if(mode!=="browser"||!("Notification" in window)||Notification.permission!=="granted")return;
  let key="",title="",body="";
  if(tokenStatus==="called"||tokenStatus==="in_consultation"){key="called";title="It’s your turn";body="The clinic has called your token. Please follow the clinic’s instructions.";}
  else if(tokenStatus==="waiting"&&tokensAhead<=2){key="approaching";title="Your turn is approaching";body="You are getting close to your turn. Waiting time remains an estimate."}
  if(key&&key!==lastAlert.current){lastAlert.current=key;try{new Notification(title,{body,icon:"/icon.svg",tag:"doctor-queue-"+key});}catch{}}
 },[mode,tokenStatus,tokensAhead]);
 async function enable() {
  setBusy(true);setMessage("");
  try {
   if(!("Notification" in window)){setMessage("This browser does not support notifications.");return;}
   const permission=await Notification.requestPermission();
   if(permission!=="granted"){setMode("denied");setMessage(permission==="denied"?"Notifications are blocked in browser settings.":"Notification permission was not granted.");return;}
   setMode("browser");
   if(!vapidKey||!("serviceWorker" in navigator)||!("PushManager" in window)){
    setMessage("Foreground alerts are enabled while this page stays open. Background push is not configured or supported on this browser.");
    return;
   }
   try{
    const registration=await navigator.serviceWorker.register("/sw.js");
    const current=await registration.pushManager.getSubscription();
    const sub=current??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapidKey)});
    const json=sub.toJSON() as PushSubscriptionJson;
    const response=await fetch("/api/public/push-subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",trackingSecret,subscription:json})});
    const body=await response.json();
    if(!response.ok)throw new Error(typeof body.error==="string"?body.error:"Background push could not be enabled.");
    setSubscription(sub);setMode("push");setMessage("Background push is enabled on this device. Delivery depends on server scheduling and provider availability.");
   }catch(e){
    setMode("browser");setMessage((e instanceof Error?e.message:"Background push setup failed.")+" Foreground alerts will work only while this page remains open.");
   }
  }catch(e){setMessage(e instanceof Error?e.message:"Could not enable notifications.");}
  finally{setBusy(false);}
 }
 async function disable() {
  setBusy(true);setMessage("");
  try{
   const sub=subscription??await (await navigator.serviceWorker.ready).pushManager.getSubscription();
   if(sub){
    const response=await fetch("/api/public/push-subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"unsubscribe",trackingSecret,subscription:sub.toJSON()})});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.error==="string"?body.error:"Could not revoke server subscription.");}
    await sub.unsubscribe();
   }
   setSubscription(null);setMode("off");setMessage("This device's reminders were disabled.");
  }catch(e){setMessage(e instanceof Error?e.message:"Could not disable reminders.");}
  finally{setBusy(false);}
 }
 return <section className="mt-5 rounded-2xl border border-[#e1e9e4] bg-white p-5">
  <h3 className="font-extrabold">Turn reminders</h3>
  <p className="mt-2 text-sm leading-6 text-[#65736d]">Notifications are optional. Background delivery needs push keys, a server-side scheduler and an active subscription; foreground alerts only work while this page remains open.</p>
  <div className="mt-3 flex flex-wrap items-center gap-2">
   {mode==="off"||mode==="denied"?<button type="button" disabled={busy} onClick={()=>void enable()} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Enabling…":mode==="denied"?"Try notifications again":"Enable turn reminders"}</button>:<button type="button" disabled={busy} onClick={()=>void disable()} className="rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50">{busy?"Updating…":"Disable reminders"}</button>}
   <span className="text-xs font-semibold text-[#65736d]">{mode==="push"?"Background push subscribed":mode==="browser"?"Foreground only":mode==="denied"?"Permission denied":"Not enabled"}</span>
  </div>
  {message&&<p role="status" className="mt-3 rounded-lg bg-[#f7faf8] p-3 text-xs leading-5 text-[#53645b]">{message}</p>}
 </section>;
}
