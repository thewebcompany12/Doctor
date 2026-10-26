import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  action: z.enum(["book","track","cancel"]),
  queueId: z.uuid().optional(),
  patientName: z.string().trim().min(1).max(80).optional(),
  trackingSecret: z.string().regex(/^[0-9a-f]{64}$/i).optional()
});

function adminClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return { client:createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}}), key };
}
function noStore(body: unknown,status=200) {
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store, private","Pragma":"no-cache","Vary":"Cookie"}});
}
function requestIp(request:Request) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return noStore({error:"Invalid token request."},400);
  const input=parsed.data;
  const configured=adminClient();
  if(!configured) return noStore({error:"Online booking and private token tracking are not configured. The project owner must add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel environment variable."},503);
  const {client:admin,key}=configured;

  if(input.action==="book") {
    if(!input.queueId||!input.patientName) return noStore({error:"Queue and patient name are required."},400);
    const rateKey=createHmac("sha256",key).update("doctor-queue-online-booking:"+requestIp(request)+":"+input.queueId).digest("hex");
    const {data,error}=await admin.rpc("issue_public_queue_token",{
      p_queue_id:input.queueId,p_patient_label:input.patientName,p_rate_limit_key_hash:rateKey
    });
    if(error||!data||(Array.isArray(data)&&data.length===0)) {
      const message=error?.message ?? "";
      const status=message.toLowerCase().includes("rate limit")?429:message.toLowerCase().includes("not found")?404:message.toLowerCase().includes("disabled")||message.toLowerCase().includes("limit")||message.toLowerCase().includes("not available")?409:503;
      const safeMessage=status===429?"Too many booking attempts from this network. Try again in 15 minutes.":status===404?"This public queue is not available.":status===409?message:"Online token booking is temporarily unavailable.";
      return noStore({error:safeMessage},status);
    }
    const token=Array.isArray(data)?data[0]:data;
    return noStore({
      token:{displayToken:token.display_token,tokenNumber:token.token_number,expiresAt:token.tracking_expires_at},
      trackingSecret:token.tracking_secret,
      notice:"Save your private tracking link now. The tracking secret is shown only once."
    },201);
  }

  if(!input.trackingSecret) return noStore({error:"Tracking secret is required."},400);
  const trackingHash=createHash("sha256").update(input.trackingSecret.toLowerCase()).digest("hex");
  const rateKey=createHmac("sha256",key).update("doctor-queue-private-tracking:"+requestIp(request)+":"+trackingHash+":"+input.action).digest("hex");
  const {data:allowed,error:rateError}=await admin.rpc("consume_public_tracking_rate_limit",{p_rate_key_hash:rateKey});
  if(rateError) return noStore({error:"Private tracking is temporarily unavailable."},503);
  if(allowed!==true) return noStore({error:"Too many tracking requests. Wait a few minutes before retrying."},429);

  if(input.action==="cancel") {
    const {data,error}=await admin.rpc("cancel_public_queue_token",{p_tracking_secret_hash:trackingHash});
    if(error||!data||(Array.isArray(data)&&data.length===0)) {
      const message=error?.message??"";
      const status=message.toLowerCase().includes("only waiting")?409:message.toLowerCase().includes("not found")||message.toLowerCase().includes("expired")?404:503;
      return noStore({error:status===409?"This token can no longer be cancelled online.":status===404?"Token not found or its tracking secret has expired.":"Cancellation is temporarily unavailable."},status);
    }
    const token=Array.isArray(data)?data[0]:data;
    return noStore({token:{displayToken:token.display_token,status:token.token_status,expiresAt:token.tracking_expires_at},message:"Your waiting token was cancelled."});
  }

  const {data:token,error:tokenError}=await admin.from("queue_tokens")
    .select("id,queue_id,display_token,token_number,status,service_date,tracking_expires_at,tracking_revoked_at")
    .eq("tracking_secret_hash",trackingHash).gt("tracking_expires_at",new Date().toISOString()).is("tracking_revoked_at",null).maybeSingle();
  if(tokenError||!token) return noStore({error:"Token not found or its tracking secret has expired."},404);
  const {data:queue,error:queueError}=await admin.from("public_queue_snapshots")
    .select("clinic_name,doctor_name,clinic_address,clinic_city,queue_status,current_display_token,waiting_count,average_consultation_minutes,updated_at,opens_at,closes_at,is_closed")
    .eq("queue_id",token.queue_id).maybeSingle();
  if(queueError||!queue) return noStore({error:"Current public queue status is unavailable."},503);
  let tokensAhead=0;
  if(token.status==="waiting") {
    const {count,error:countError}=await admin.from("queue_tokens").select("id",{count:"exact",head:true})
      .eq("queue_id",token.queue_id).eq("service_date",token.service_date).eq("status","waiting").lt("token_number",token.token_number);
    if(countError) return noStore({error:"Your queue position is temporarily unavailable."},503);
    tokensAhead=count??0;
  }
  const approximateWaitMinutes=queue.queue_status==="open"&&token.status==="waiting"&&Number(queue.average_consultation_minutes)>0
    ? tokensAhead*Number(queue.average_consultation_minutes):null;
  return noStore({
    token:{displayToken:token.display_token,status:token.status,serviceDate:token.service_date,expiresAt:token.tracking_expires_at,tokensAhead,approximateWaitMinutes},
    queue:{clinicName:queue.clinic_name,doctorName:queue.doctor_name,clinicAddress:queue.clinic_address,clinicCity:queue.clinic_city,queueStatus:queue.queue_status,currentDisplayToken:queue.current_display_token,waitingCount:queue.waiting_count,averageConsultationMinutes:queue.average_consultation_minutes,updatedAt:queue.updated_at,opensAt:queue.opens_at,closesAt:queue.closes_at,isClosed:queue.is_closed}
  });
}
