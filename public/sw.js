const CACHE_NAME="doctor-queue-static-v1";
const STATIC_ASSETS=["/icon.svg","/offline.html"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_ASSETS)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/token-status")||url.pathname.startsWith("/queue/")||url.pathname.startsWith("/clinics/"))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).catch(()=>caches.match("/offline.html")));
  return;
 }
 if(STATIC_ASSETS.includes(url.pathname)){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));return;
 }
});
self.addEventListener("push",event=>{
 let payload={title:"Doctor Queue",body:"Your queue status has an update.",url:"/token-status"};
 try{if(event.data)payload={...payload,...event.data.json()};}catch{}
 event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:"/icon.svg",badge:"/icon.svg",data:{url:payload.url||"/token-status"},tag:"doctor-queue-reminder",renotify:false}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||"/token-status",self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{
  for(const client of windows){if(client.url.startsWith(self.location.origin)&&"focus" in client){if("navigate" in client)client.navigate(target);return client.focus();}}
  return self.clients.openWindow(target);
 }));
});
