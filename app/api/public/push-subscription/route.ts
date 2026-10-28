import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({
 action:z.enum(["subscribe","unsubscribe"]),
 trackingSecret:z.string().regex(/^[0-9a-f]{64}$/i),
 subscription:z.object({
  endpoint:z.string().url().max(2048),
  expirationTime:z.number().nullable().optional(),
  keys:z.object({p256dh:z.string().min(20).max(200),auth:z.string().min(10).max(100)})
 }).optional(),
 preferences:z.object({turnApproaching:z.boolean(),yourTurn:z.boolean()}).optional()
});
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store, private","Pragma":"no-cache"}});}
function ip(request:Request){
 // Trust the platform-provided client IP only; an untrusted forwarded-for fallback
 // would let callers rotate their apparent identity and evade per-IP throttling.
 return request.headers.get("x-real-ip")?.trim()||"unknown";
}
function adminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return {client:createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}}),key};
}
function safePushEndpoint(value:string){
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443")return false;
  const h=u.hostname.toLowerCase();
  return h==="fcm.googleapis.com"||h==="updates.push.services.mozilla.com"||h.endsWith(".push.services.mozilla.com")||h.endsWith(".notify.windows.com")||h==="web.push.apple.com"||h.endsWith(".push.apple.com");
 }catch{return false;}
}
export async function POST(request:Request){
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return response({error:"Invalid notification subscription."},400);
 const input=parsed.data,configured=adminClient();
 if(!configured)return response({error:"Push reminders are not configured until the project owner adds the server-only Supabase service-role key."},503);
 const {client:admin,key}=configured;
 const secretHash=createHash("sha256").update(input.trackingSecret.toLowerCase()).digest("hex");
 const rateKey=createHmac("sha256",key).update("doctor-queue-push-subscription:"+ip(request)+":"+secretHash+":"+input.action).digest("hex");
 const {data:allowed,error:rateError}=await admin.rpc("consume_public_tracking_rate_limit",{p_rate_key_hash:rateKey});
 if(rateError)return response({error:"Notification settings are temporarily unavailable."},503);
 if(allowed!==true)return response({error:"Too many notification-setting requests. Try again later."},429);
 const {data:token,error:tokenError}=await admin.from("queue_tokens").select("id,tracking_expires_at,tracking_revoked_at")
  .eq("tracking_secret_hash",secretHash).gt("tracking_expires_at",new Date().toISOString()).is("tracking_revoked_at",null).maybeSingle();
 if(tokenError||!token)return response({error:"Token not found or tracking access expired."},404);
 if(input.action==="unsubscribe"){
  if(!input.subscription?.endpoint)return response({error:"The device subscription is required to disable reminders."},400);
  const endpointHash=createHash("sha256").update(input.subscription.endpoint).digest("hex");
  const {error}=await admin.from("push_subscriptions").delete().eq("endpoint_hash",endpointHash).eq("token_id",token.id);
  if(error)return response({error:"Could not revoke this device subscription."},503);
  return response({ok:true,message:"Push reminders were disabled for this device."});
 }
 if(!input.subscription)return response({error:"A browser push subscription is required."},400);
 if(!safePushEndpoint(input.subscription.endpoint))return response({error:"This browser push service endpoint is not supported."},400);
 if(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT)return response({error:"Web Push keys are not configured. Browser permission has not been saved."},503);
 const endpointHash=createHash("sha256").update(input.subscription.endpoint).digest("hex");
 const {error}=await admin.from("push_subscriptions").upsert({
  endpoint_hash:endpointHash,token_id:token.id,endpoint:input.subscription.endpoint,
  p256dh:input.subscription.keys.p256dh,auth_secret:input.subscription.keys.auth,
  expiration_time:input.subscription.expirationTime?new Date(input.subscription.expirationTime).toISOString():null,
  enabled:true,preferences:{turn_approaching:input.preferences?.turnApproaching??true,your_turn:input.preferences?.yourTurn??true},updated_at:new Date().toISOString()
 },{onConflict:"endpoint_hash"});
 if(error)return response({error:"Could not save notification settings."},503);
 return response({ok:true,message:"Turn reminders are enabled for this device."},201);
}
