import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  let session;
  try { session = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }); }
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = z.object({ isActive: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid staff status update." }, { status: 400 });
  const { membershipId } = await params;
  if (!z.uuid().safeParse(membershipId).success) return NextResponse.json({ error: "Invalid membership ID." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Staff management is not configured. Add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel environment variable." }, { status: 503 });
  const admin = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const { data: target, error: targetError } = await admin.from("clinic_memberships").select("id,clinic_id,user_id,role,is_active").eq("id",membershipId).maybeSingle();
  if (targetError) return NextResponse.json({ error: "Could not load staff membership." }, { status: 503 });
  if (!target) return NextResponse.json({ error: "Staff membership not found." }, { status: 404 });
  const { data: actor, error: actorError } = await session.from("clinic_memberships").select("role").eq("clinic_id",target.clinic_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
  if (actorError) return NextResponse.json({ error: "Could not verify clinic permissions." }, { status: 503 });
  if (!actor || !["owner","manager"].includes(actor.role)) return NextResponse.json({ error: "Clinic owner or manager permission required." }, { status: 403 });
  if (target.role === "owner" || target.user_id === user.id) return NextResponse.json({ error: "Owners and your own membership cannot be deactivated here." }, { status: 403 });
  if (actor.role === "manager" && target.role === "manager") return NextResponse.json({ error: "Only the clinic owner can manage another manager." }, { status: 403 });

  const { error: updateError } = await admin.from("clinic_memberships").update({ is_active: body.data.isActive }).eq("id",membershipId);
  if (updateError) return NextResponse.json({ error: "Staff membership could not be updated." }, { status: 500 });
  const { error: auditError } = await admin.from("audit_logs").insert({
    clinic_id: target.clinic_id, actor_user_id: user.id, action: body.data.isActive ? "clinic.staff_activated" : "clinic.staff_deactivated",
    target_type: "clinic_membership", target_id: membershipId, metadata: { user_id: target.user_id, role: target.role, previous_active: target.is_active, is_active: body.data.isActive }
  });
  if (auditError) {
    await admin.from("clinic_memberships").update({ is_active: target.is_active }).eq("id",membershipId);
    return NextResponse.json({ error: "Audit record failed; membership status was rolled back where possible." }, { status: 500 });
  }
  return NextResponse.json({ membershipId, isActive: body.data.isActive }, { headers: { "Cache-Control": "no-store" } });
}
