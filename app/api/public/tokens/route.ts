import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({
  action: z.enum(["book","track"]),
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

export async function POST(request: Request) {
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Invalid token request."},{status:400,headers:{"Cache-Control":"no-store"}});
  const input=parsed.data;
  const configured=adminClient();
  if(!configured) return NextResponse.json({error:"Online token booking is not configured. The project owner must add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel environment variable."},{status:503,headers:{"Cache-Control":"no-store"}});
  const {client:admin,key}=configured;

  if(input.action==="book") {
    if(!input.queueId||!input.patientName) return NextResponse.json({error:"Queue and patient name are required."},{status:400,headers:{"Cache-Control":"no-store"}});
    const ip=request.headers.get("x-real-ip") ?? "unknown";
    const rateKey=createHmac("sha256",key).update("doctor-queue-online-booking:"+ip+":"+input.queueId).digest("hex");
    const {data,error}=await admin.rpc("issue_public_queue_token",{
      p_queue_id:input.queueId,p_patient_label:input.patientName,p_rate_limit_key_hash:rateKey
    });
    if(error||!data?.length) {
      const message=error?.message ?? "";
      const status=message.includes("rate limit")?429:message.includes("not found")?404:message.includes("disabled")||message.includes("limit")||message.includes("not available")?409:503;
      const safeMessage=status===429?"Too many booking attempts from this network. Try again in 15 minutes.":status===404?"This public queue is not available.":status===409?message:"Online token booking is temporarily unavailable.";
      return NextResponse.json({error:safeMessage},{status,headers:{"Cache-Control":"no-store"}});
    }
    const token=Array.isArray(data)?data[0]:data;
    return NextResponse.json({
      token:{displayToken:token.display_token,tokenNumber:token.token_number,expiresAt:token.tracking_expires_at},
      trackingSecret:token.tracking_secret,
      notice:"Save this tracking secret now. It is shown only once and is required to look up this token."
    },{status:201,headers:{"Cache-Control":"no-store","Pragma":"no-cache"}});
  }

  if(!input.trackingSecret) return NextResponse.json({error:"Tracking secret is required."},{status:400,headers:{"Cache-Control":"no-store"}});
  const trackingHash=createHash("sha256").update(input.trackingSecret.toLowerCase()).digest("hex");
  const {data:token,error:tokenError}=await admin.from("queue_tokens")
    .select("id,queue_id,display_token,status,service_date,tracking_expires_at,tracking_revoked_at")
    .eq("tracking_secret_hash",trackingHash).gt("tracking_expires_at",new Date().toISOString()).is("tracking_revoked_at",null).maybeSingle();
  if(tokenError||!token) return NextResponse.json({error:"Token not found or its tracking secret has expired."},{status:404,headers:{"Cache-Control":"no-store"}});
  const {data:queue,error:queueError}=await admin.from("public_queue_snapshots")
    .select("clinic_name,doctor_name,queue_status,current_display_token,waiting_count,average_consultation_minutes,updated_at")
    .eq("queue_id",token.queue_id).maybeSingle();
  if(queueError||!queue) return NextResponse.json({error:"Current public queue status is unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({
    token:{displayToken:token.display_token,status:token.status,serviceDate:token.service_date,expiresAt:token.tracking_expires_at},
    queue:{clinicName:queue.clinic_name,doctorName:queue.doctor_name,queueStatus:queue.queue_status,currentDisplayToken:queue.current_display_token,waitingCount:queue.waiting_count,averageConsultationMinutes:queue.average_consultation_minutes,updatedAt:queue.updated_at}
  },{headers:{"Cache-Control":"no-store","Pragma":"no-cache"}});
}
