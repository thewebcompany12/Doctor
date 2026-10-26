import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ownerEmail: z.email().max(254),
  ownerEmailVerified: z.literal(true),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional()
});

function clinicCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "DQ-" + Array.from(bytes, b => chars[b % chars.length]).join("");
}

function temporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

export async function POST(request: Request) {
  let session;
  try { session = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }); }

  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: admin } = await session.rpc("is_platform_admin");
  if (!admin) return NextResponse.json({ error: "Platform administrator permission required." }, { status: 403 });

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey) return NextResponse.json({ error: "Server-side clinic provisioning is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment." }, { status: 503 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid clinic details. Verify the owner email in person before provisioning.", details: parsed.error.flatten() }, { status: 400 });

  const adminClient = createClient(serviceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { name, ownerEmail, address, city, state, phone } = parsed.data;
  const code = clinicCode();
  const tempPassword = temporaryPassword();

  const { data: created, error: userError } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: name + " clinic owner", must_change_password: true }
  });
  if (userError || !created.user) return NextResponse.json({ error: "Could not create owner account. Verify the email and Auth configuration." }, { status: 409 });

  const { data: clinic, error: clinicError } = await adminClient.from("clinics").insert({
    clinic_code: code, name, address: address ?? null, city: city ?? null, state: state ?? null,
    phone: phone ?? null, created_by: user.id, is_active: true, is_public: true
  }).select("id,clinic_code,name").single();

  if (clinicError || !clinic) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Clinic creation failed; owner account was rolled back." }, { status: 500 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: created.user.id, display_name: name + " clinic owner", must_change_password: true
  });
  const { error: membershipError } = await adminClient.from("clinic_memberships").insert({
    clinic_id: clinic.id, user_id: created.user.id, role: "owner", is_active: true
  });

  if (profileError || membershipError) {
    await adminClient.from("clinic_memberships").delete().eq("clinic_id", clinic.id);
    await adminClient.from("clinics").delete().eq("id", clinic.id);
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Owner provisioning failed; created records were rolled back." }, { status: 500 });
  }

  await adminClient.from("audit_logs").insert({
    clinic_id: clinic.id, actor_user_id: user.id, action: "clinic.created",
    target_type: "clinic", target_id: clinic.id, metadata: { clinic_code: code, owner_user_id: created.user.id }
  });

  return NextResponse.json({
    clinic: { id: clinic.id, clinicCode: clinic.clinic_code, name: clinic.name },
    ownerEmail,
    temporaryPassword: tempPassword,
    notice: "Email confirmation was skipped only because the authenticated Super Admin attested that the owner email was verified. Deliver this one-time password securely and require an immediate password change."
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
