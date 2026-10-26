import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.object({
  clinicId: z.uuid(),
  email: z.email().max(254),
  displayName: z.string().trim().max(120).optional(),
  role: z.enum(["manager","doctor","receptionist","compounder"])
});

export async function GET(request: Request) {
  let session;
  try { session = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }); }
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const clinicId = new URL(request.url).searchParams.get("clinicId") ?? "";
  if (!z.uuid().safeParse(clinicId).success) return NextResponse.json({ error: "Valid clinic ID is required." }, { status: 400 });
  const { data: membership, error: membershipError } = await session.from("clinic_memberships")
    .select("role").eq("clinic_id",clinicId).eq("user_id",user.id).eq("is_active",true).maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify clinic permissions." }, { status: 503 });
  if (!membership || !["owner","manager"].includes(membership.role)) return NextResponse.json({ error: "Clinic owner or manager permission required." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Staff directory is not configured. Add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel environment variable." }, { status: 503 });
  const admin = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const { data: rows, error } = await admin.from("clinic_memberships").select("id,user_id,role,is_active,created_at").eq("clinic_id",clinicId).order("created_at");
  if (error) return NextResponse.json({ error: "Could not load clinic staff." }, { status: 500 });
  const users = await Promise.all((rows ?? []).map(async row => {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id",row.user_id).maybeSingle(),
      admin.auth.admin.getUserById(row.user_id)
    ]);
    return { membershipId: row.id, role: row.role, isActive: row.is_active, displayName: profile?.display_name || authUser.user?.email?.split("@")[0] || "Staff member", email: authUser.user?.email ?? "", createdAt: row.created_at };
  }));
  return NextResponse.json({ staff: users }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let session;
  try { session = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }); }
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid staff invitation details.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const { data: membership, error: membershipError } = await session.from("clinic_memberships")
    .select("role").eq("clinic_id",input.clinicId).eq("user_id",user.id).eq("is_active",true).maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify clinic permissions." }, { status: 503 });
  if (!membership || !["owner","manager"].includes(membership.role)) return NextResponse.json({ error: "Clinic owner or manager permission required." }, { status: 403 });
  if (membership.role === "manager" && input.role === "manager") return NextResponse.json({ error: "Only the clinic owner can invite another manager." }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Staff invitations are not configured. Add SUPABASE_SERVICE_ROLE_KEY as a server-only Vercel environment variable." }, { status: 503 });
  const admin = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const { data: clinic, error: clinicError } = await admin.from("clinics").select("id,is_active").eq("id",input.clinicId).maybeSingle();
  if (clinicError) return NextResponse.json({ error: "Could not load clinic." }, { status: 503 });
  if (!clinic?.is_active) return NextResponse.json({ error: "Clinic is not active." }, { status: 409 });

  const { data: settingsRow, error: settingsError } = await admin.from("clinic_settings").select("settings").eq("clinic_id",input.clinicId).maybeSingle();
  if (settingsError) return NextResponse.json({ error: "Could not verify staff limits." }, { status: 503 });
  const rawSettings = settingsRow?.settings && typeof settingsRow.settings === "object" ? settingsRow.settings as Record<string,unknown> : {};
  const subscription = rawSettings.subscription && typeof rawSettings.subscription === "object" ? rawSettings.subscription as Record<string,unknown> : {};
  const limits = subscription.limits && typeof subscription.limits === "object" ? subscription.limits as Record<string,unknown> : {};
  const maxStaff = typeof limits.staff === "number" ? limits.staff : null;
  const { count, error: countError } = await admin.from("clinic_memberships").select("id",{count:"exact",head:true}).eq("clinic_id",input.clinicId).eq("is_active",true);
  if (countError) return NextResponse.json({ error: "Could not verify current staff usage." }, { status: 503 });
  if (maxStaff !== null && (count ?? 0) >= maxStaff) return NextResponse.json({ error: "The clinic has reached its configured staff limit." }, { status: 409 });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email,{
    data: { display_name: input.displayName?.trim() || input.email.split("@")[0] }
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: "Invitation could not be sent. Verify the email and Supabase email delivery settings." }, { status: 409 });
  const invitedUser = invited.user;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: invitedUser.id, display_name: input.displayName?.trim() || input.email.split("@")[0], must_change_password: false
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(invitedUser.id);
    return NextResponse.json({ error: "Staff profile setup failed; the invitation account was rolled back." }, { status: 500 });
  }
  const { error: attachError } = await session.rpc("attach_invited_staff", {
    p_clinic_id: input.clinicId, p_user_id: invitedUser.id, p_role: input.role, p_email: input.email
  });
  if (attachError) {
    await admin.auth.admin.deleteUser(invitedUser.id);
    return NextResponse.json({ error: attachError.message.toLowerCase().includes("usage limit") ? "The clinic has reached its configured staff limit." : "Staff membership setup failed; the invitation account was rolled back." }, { status: 409 });
  }
  return NextResponse.json({ invited: true, email: input.email, role: input.role }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
