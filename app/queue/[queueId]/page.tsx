import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import LiveQueue, { type LiveQueueSnapshot } from "./live-queue";

export const revalidate = 0;

export default async function PublicQueuePage({ params }: { params: Promise<{ queueId: string }> }) {
  const {queueId}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(queueId)) notFound();
  const supabase=createSupabasePublicClient();
  const {data,error}=await supabase.from("public_queue_snapshots")
    .select("queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,current_display_token,waiting_count,completed_count,online_booking_enabled,updated_at,clinic_city,clinic_address,opens_at,closes_at,is_closed,average_consultation_minutes")
    .eq("queue_id",queueId).maybeSingle();
  if(error) throw new Error("Queue status is temporarily unavailable.");
  if(!data) notFound();
  return <LiveQueue initial={data as LiveQueueSnapshot}/>;
}
