import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), name: z.string().trim().min(2).max(120).optional(), address: z.string().trim().max(240).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), state: z.string().trim().max(100).nullable().optional(), phone: z.string().trim().max(30).nullable().optional() }),
  z.object({ action: z.enum(["activate", "suspend", "archive"]) })
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ clinicId: string }> }) {
  let session;
  try { session = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }); }
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: admin, error: roleError } = await session.rpc("is_platform_admin");
  if (roleError || !admin) return NextResponse.json({ error: "Platform administrator permission required." }, { status: 403 });

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey) return NextResponse.json({ error: "Server-side clinic administration is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment." }, { status: 503 });

  const { clinicId } = await params;
  if (!z.uuid().safeParse(clinicId).success) return NextResponse.json({ error: "Invalid clinic ID." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid clinic update.", details: parsed.error.flatten() }, { status: 400 });

  const adminClient = createClient(serviceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: before, error: readError } = await adminClient.from("clinics").select("id,clinic_code,name,is_active,is_public").eq("id", clinicId).maybeSingle();
  if (readError) return NextResponse.json({ error: "Could not read clinic." }, { status: 500 });
  if (!before) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });

  let patch: Record<string, unknown>;
  const action = parsed.data.action;
  if (action === "update") {
    const { action: _action, ...fields } = parsed.data;
    patch = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Provide at least one clinic field to update." }, { status: 400 });
  } else if (action === "activate") patch = { is_active: true, is_public: true };
  else if (action === "suspend") patch = { is_active: false, is_public: true };
  else patch = { is_active: false, is_public: false };

  const { data: updated, error: updateError } = await adminClient.from("clinics").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", clinicId).select("id,clinic_code,name,is_active,is_public").single();
  if (updateError || !updated) return NextResponse.json({ error: "Clinic update failed." }, { status: 500 });
  const { error: auditError } = await adminClient.from("audit_logs").insert({
    clinic_id: clinicId, actor_user_id: user.id, action: "clinic." + action,
    target_type: "clinic", target_id: clinicId,
    metadata: { before: { name: before.name, is_active: before.is_active, is_public: before.is_public }, after: { name: updated.name, is_active: updated.is_active, is_public: updated.is_public } }
  });
  if (auditError) return NextResponse.json({ error: "Clinic changed but its audit record failed. Investigate audit logging immediately." }, { status: 500 });
  return NextResponse.json({ clinic: updated }, { headers: { "Cache-Control": "no-store" } });
}
