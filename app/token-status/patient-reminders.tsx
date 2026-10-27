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

export default function PatientReminders({ trackingSecret, tokenStatus, tokensAhead, language="en" }: { trackingSecret:string; tokenStatus:string; tokensAhead:number; language?:"en"|"hi" }) {
 const hi=language==="hi";
 const [mode,setMode]=useState<"off"|"browser"|"push"|"denied">("off");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [subscription,setSubscription]=useState<PushSubscription|null>(null);
 const [notifyApproaching,setNotifyApproaching]=useState(true);
 const [notifyCalled,setNotifyCalled]=useState(true);
 const vapidKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 const lastAlert=useRef("");
 useEffect(()=>{
  if(mode!=="browser"||!("Notification" in window)||Notification.permission!=="granted")return;
  let key="",title="",body="";
  if(tokenStatus==="called"||tokenStatus==="in_consultation"){key="called";title=hi?"आपकी बारी है":"It’s your turn";body=hi?"क्लिनिक ने आपका टोकन बुलाया है। कृपया क्लिनिक के निर्देशों का पालन करें।":"The clinic has called your token. Please follow the clinic’s instructions.";}
  else if(tokenStatus==="waiting"&&tokensAhead<=2){key="approaching";title=hi?"आपकी बारी नज़दीक है":"Your turn is approaching";body=hi?"आपकी बारी नज़दीक है। प्रतीक्षा समय केवल अनुमान है।":"You are getting close to your turn. Waiting time remains an estimate."}
  if((key==="called"&&!notifyCalled)||(key==="approaching"&&!notifyApproaching))return;
  if(key&&key!==lastAlert.current){lastAlert.current=key;try{new Notification(title,{body,icon:"/icon.svg",tag:"doctor-queue-"+key});}catch{}}
 },[mode,tokenStatus,tokensAhead,notifyApproaching,notifyCalled,hi]);
 async function enable() {
  setBusy(true);setMessage("");
  try {
   if(!("Notification" in window)){setMessage(hi?"यह ब्राउज़र नोटिफ़िकेशन का समर्थन नहीं करता।":"This browser does not support notifications.");return;}
   const permission=await Notification.requestPermission();
   if(permission!=="granted"){setMode("denied");setMessage(permission==="denied"?(hi?"ब्राउज़र सेटिंग में नोटिफ़िकेशन बंद हैं।":"Notifications are blocked in browser settings."):(hi?"नोटिफ़िकेशन की अनुमति नहीं मिली।":"Notification permission was not granted."));return;}
   setMode("browser");
   if(!vapidKey||!("serviceWorker" in navigator)||!("PushManager" in window)){
    setMessage(hi?"यह पेज खुला रहने तक अलर्ट चालू हैं। बैकग्राउंड पुश सेट नहीं है या इस ब्राउज़र में उपलब्ध नहीं है।":"Foreground alerts are enabled while this page stays open. Background push is not configured or supported on this browser.");
    return;
   }
   try{
    const registration=await navigator.serviceWorker.register("/sw.js");
    const current=await registration.pushManager.getSubscription();
    const sub=current??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapidKey)});
    const json=sub.toJSON() as PushSubscriptionJson;
    const response=await fetch("/api/public/push-subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",trackingSecret,subscription:json,preferences:{turnApproaching:notifyApproaching,yourTurn:notifyCalled}})});
    const body=await response.json();
    if(!response.ok)throw new Error(typeof body.error==="string"?body.error:"Background push could not be enabled.");
    setSubscription(sub);setMode("push");setMessage(hi?"इस डिवाइस पर बैकग्राउंड पुश चालू है। डिलीवरी सर्वर शेड्यूल और प्रदाता की उपलब्धता पर निर्भर है।":"Background push is enabled on this device. Delivery depends on server scheduling and provider availability.");
   }catch(e){
    setMode("browser");setMessage((e instanceof Error?e.message:(hi?"बैकग्राउंड पुश सेट नहीं हो सका।":"Background push setup failed."))+(hi?" फ़ोरग्राउंड अलर्ट केवल पेज खुला रहने पर काम करेंगे।":" Foreground alerts will work only while this page remains open."));
   }
  }catch(e){setMessage(e instanceof Error?e.message:(hi?"नोटिफ़िकेशन चालू नहीं हो सके।":"Could not enable notifications."));}
  finally{setBusy(false);}
 }
 async function savePreferences(){
  setBusy(true);setMessage("");
  try{
   const sub=subscription??await (await navigator.serviceWorker.ready).pushManager.getSubscription();
   if(!sub)throw new Error(hi?"इस डिवाइस पर कोई सक्रिय पुश सब्सक्रिप्शन नहीं है।":"No active push subscription is available on this device.");
   const response=await fetch("/api/public/push-subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",trackingSecret,subscription:sub.toJSON(),preferences:{turnApproaching:notifyApproaching,yourTurn:notifyCalled}})});
   const body=await response.json();if(!response.ok)throw new Error(typeof body.error==="string"?body.error:(hi?"रिमाइंडर प्राथमिकताएँ सेव नहीं हो सकीं।":"Could not save reminder preferences."));
   setSubscription(sub);setMode("push");setMessage(hi?"इस डिवाइस के लिए रिमाइंडर प्राथमिकताएँ सेव हो गईं।":"Reminder preferences saved for this device.");
  }catch(e){setMessage(e instanceof Error?e.message:(hi?"रिमाइंडर प्राथमिकताएँ सेव नहीं हो सकीं।":"Could not save reminder preferences."));}
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
   setSubscription(null);setMode("off");setMessage(hi?"इस डिवाइस के रिमाइंडर बंद कर दिए गए।":"This device's reminders were disabled.");
  }catch(e){setMessage(e instanceof Error?e.message:(hi?"रिमाइंडर बंद नहीं हो सके।":"Could not disable reminders."));}
  finally{setBusy(false);}
 }
 return <section className="mt-5 rounded-2xl border border-[#e1e9e4] bg-white p-5">
  <h3 className="font-extrabold">{hi?"अपनी बारी के रिमाइंडर":"Turn reminders"}</h3>
  <p className="mt-2 text-sm leading-6 text-[#65736d]">{hi?"नोटिफ़िकेशन वैकल्पिक हैं। बैकग्राउंड डिलीवरी के लिए पुश कीज़, सर्वर शेड्यूलर और सक्रिय सब्सक्रिप्शन चाहिए; फ़ोरग्राउंड अलर्ट केवल पेज खुला रहने तक काम करते हैं।":"Notifications are optional. Background delivery needs push keys, a server-side scheduler and an active subscription; foreground alerts only work while this page remains open."}</p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyApproaching} onChange={e=>setNotifyApproaching(e.target.checked)} className="h-4 w-4 accent-[#147d55]"/>{hi?"जब आपसे 2 या कम टोकन आगे हों":"Alert when 2 or fewer tokens are ahead"}</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyCalled} onChange={e=>setNotifyCalled(e.target.checked)} className="h-4 w-4 accent-[#147d55]"/>{hi?"मेरा टोकन बुलाए जाने पर":"Alert when my token is called"}</label>
  </div>
  <div className="mt-3 flex flex-wrap items-center gap-2">
   {mode==="off"||mode==="denied"?<button type="button" disabled={busy} onClick={()=>void enable()} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?(hi?"चालू हो रहा है…":"Enabling…"):mode==="denied"?(hi?"फिर प्रयास करें":"Try notifications again"):(hi?"रिमाइंडर चालू करें":"Enable turn reminders")}</button>:<button type="button" disabled={busy} onClick={()=>void disable()} className="rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50">{busy?(hi?"अपडेट हो रहा है…":"Updating…"):(hi?"रिमाइंडर बंद करें":"Disable reminders")}</button>}
   {mode==="push"&&<button type="button" disabled={busy} onClick={()=>void savePreferences()} className="rounded-full border border-[#dbe5df] px-4 py-2.5 text-sm font-bold disabled:opacity-50">{hi?"प्राथमिकताएँ सेव करें":"Save preferences"}</button>}
   <span className="text-xs font-semibold text-[#65736d]">{mode==="push"?(hi?"बैकग्राउंड पुश चालू":"Background push subscribed"):mode==="browser"?(hi?"फ़ोरग्राउंड अलर्ट":"Foreground only"):mode==="denied"?(hi?"अनुमति नहीं मिली":"Permission denied"):(hi?"चालू नहीं":"Not enabled")}</span>
  </div>
  {message&&<p role="status" className="mt-3 rounded-lg bg-[#f7faf8] p-3 text-xs leading-5 text-[#53645b]">{message}</p>}
 </section>;
}
