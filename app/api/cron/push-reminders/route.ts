import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
async function handler(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)return response({error:"Unauthorized."},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
 if(!url||!serviceKey||!publicKey||!privateKey||!subject)return response({error:"Push delivery is not configured. Configure the service-role key, VAPID keys, subject and CRON_SECRET."},503);
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const {data:subscriptions,error}=await admin.from("push_subscriptions")
  .select("endpoint_hash,token_id,endpoint,p256dh,auth_secret,expiration_time,preferences")
  .eq("enabled",true).limit(500);
 if(error)return response({error:"Could not load push subscriptions."},503);
 const grouped=new Map<string,typeof subscriptions>();
 for(const sub of subscriptions??[]){
  if(sub.expiration_time&&new Date(sub.expiration_time).getTime()<=Date.now()){
   await admin.from("push_subscriptions").delete().eq("endpoint_hash",sub.endpoint_hash);continue;
  }
  const list=grouped.get(sub.token_id)??[];list.push(sub);grouped.set(sub.token_id,list);
 }
 let scanned=0,sent=0,failed=0,expired=0;
 for(const [tokenId,subs] of grouped){
  scanned++;
  const {data:token,error:tokenError}=await admin.from("queue_tokens")
   .select("id,queue_id,token_number,status,service_date,tracking_expires_at,tracking_revoked_at")
   .eq("id",tokenId).maybeSingle();
  if(tokenError||!token||!token.tracking_expires_at||new Date(token.tracking_expires_at).getTime()<=Date.now()||token.tracking_revoked_at){
   await admin.from("push_subscriptions").delete().eq("token_id",tokenId);expired++;continue;
  }
  const {data:queue,error:queueError}=await admin.from("public_queue_snapshots")
   .select("clinic_name,doctor_name,queue_status,average_consultation_minutes")
   .eq("queue_id",token.queue_id).maybeSingle();
  if(queueError||!queue)continue;
  let eventKey:string|null=null,title="",body="";
  if(["called","in_consultation"].includes(token.status)){
   eventKey="your-turn:"+token.service_date;title="It's your turn";body="Your clinic has called your token. Please follow the clinic's instructions.";
  }else if(token.status==="waiting"&&queue.queue_status==="open"){
   const {count,error:countError}=await admin.from("queue_tokens").select("id",{count:"exact",head:true})
    .eq("queue_id",token.queue_id).eq("service_date",token.service_date).eq("status","waiting").lt("token_number",token.token_number);
   if(countError||count===null||count>2)continue;
   eventKey="turn-approaching:"+token.service_date;title="Your turn is approaching";body="You are getting close to your turn at "+queue.clinic_name+". Waiting time is only an estimate.";
  }else continue;
  const {data:existing}=await admin.from("notification_deliveries").select("id,status,attempts")
   .eq("token_id",tokenId).eq("channel","web_push").eq("event_key",eventKey).maybeSingle();
  if(existing?.status==="sent"||existing&&existing.attempts>=3)continue;
  let deliveryId:string;
  if(existing){
   const {data:update}=await admin.from("notification_deliveries").update({status:"queued",scheduled_at:new Date().toISOString()}).eq("id",existing.id).select("id").single();
   if(!update)continue;deliveryId=update.id;
  }else{
   const {data:insert,error:insertError}=await admin.from("notification_deliveries").insert({token_id:tokenId,channel:"web_push",event_key:eventKey,status:"queued",attempts:0,scheduled_at:new Date().toISOString()}).select("id").single();
   if(insertError||!insert)continue;deliveryId=insert.id;
  }
  let delivered=0,lastCode:string|null=null;
  for(const sub of subs){
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify({title,body,url:"/token-status"}),{TTL:300});
    delivered++;
   }catch(e){
    const err=e as {statusCode?:number;name?:string};
    lastCode=String(err.statusCode??err.name??"push_failed").slice(0,80);
    if(err.statusCode===404||err.statusCode===410)await admin.from("push_subscriptions").delete().eq("endpoint_hash",sub.endpoint_hash);
   }
  }
  const attemptCount=(existing?.attempts??0)+1;
  await admin.from("notification_deliveries").update({
   status:delivered>0?"sent":"failed",attempts:attemptCount,
   delivered_at:delivered>0?new Date().toISOString():null,last_error_code:delivered>0?null:lastCode
  }).eq("id",deliveryId);
  if(delivered>0)sent++;else failed++;
 }
 return response({ok:true,subscriptionsScanned:subscriptions?.length??0,tokensScanned:scanned,notificationsSent:sent,deliveryFailures:failed,expiredSubscriptionsRemoved:expired});
}
export const GET=handler;
export const POST=handler;
