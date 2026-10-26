import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import QueueDashboard from "./queue-dashboard";

type Membership = { clinic_id: string; role: string; is_active: boolean; clinics: { name: string | null; clinic_code: string | null; address: string | null; city: string | null; state: string | null; phone: string | null } | null };
type BranchRow = { id: string; clinic_id: string; branch_code: string; name: string; city: string | null; state: string | null; is_active: boolean };
type DoctorRow = { id: string; clinic_id: string; full_name: string; specialty: string | null; is_active: boolean };
type HourRow = { id: string; clinic_id: string; doctor_id: string | null; weekday: number; opens_at: string | null; closes_at: string | null; is_closed: boolean; doctors: { full_name: string } | null };
type EventRow = { id: string; clinic_id: string; queue_id: string; event_type: string; previous_status: string | null; new_status: string | null; reason: string | null; created_at: string; queue_tokens: { display_token: string } | null };
type QueueRow = { id: string; clinic_id: string; service_date: string; status: string; token_prefix: string; online_booking_enabled: boolean; walk_in_enabled: boolean; max_tokens: number | null; next_token_number: number; doctors: { full_name: string; specialty: string | null } | null };
type TokenRow = { id: string; queue_id: string; token_number: number; display_token: string; patient_label: string; status: string };

export default async function WorkspacePage() {
  let supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try { supabaseClient = await createSupabaseServerClient(); } catch { redirect("/login?error=configuration"); }
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabaseClient.from("profiles").select("must_change_password").eq("id",user.id).maybeSingle();
  if (profile?.must_change_password) redirect("/change-password");
  const { data: isAdmin } = await supabaseClient.rpc("is_platform_admin");
  const { data } = await supabaseClient.from("clinic_memberships")
    .select("clinic_id,role,is_active,clinics(name,clinic_code,address,city,state,phone)")
    .eq("user_id",user.id).eq("is_active",true);
  const memberships = (data ?? []) as unknown as Membership[];
  const clinicIds = memberships.map(m=>m.clinic_id);
  const clinics = memberships.map(m=>({ id:m.clinic_id, name:m.clinics?.name ?? "Clinic", clinic_code:m.clinics?.clinic_code ?? "—", role:m.role, address:m.clinics?.address ?? null, city:m.clinics?.city ?? null, state:m.clinics?.state ?? null, phone:m.clinics?.phone ?? null }));
  let branches: BranchRow[] = [];
  let doctors: DoctorRow[] = [];
  let hours: HourRow[] = [];
  let events: EventRow[] = [];
  if (clinicIds.length) {
    const { data: branchData } = await supabaseClient.from("clinic_branches").select("id,clinic_id,branch_code,name,city,state,is_active").in("clinic_id",clinicIds).order("name");
    branches = (branchData ?? []) as BranchRow[];
    const { data: doctorData } = await supabaseClient.from("doctors").select("id,clinic_id,full_name,specialty,is_active").in("clinic_id",clinicIds).order("full_name");
    doctors = (doctorData ?? []) as DoctorRow[];
    const { data: hoursData } = await supabaseClient.from("clinic_hours").select("id,clinic_id,doctor_id,weekday,opens_at,closes_at,is_closed,doctors(full_name)").in("clinic_id",clinicIds).order("weekday");
    hours = (hoursData ?? []) as unknown as HourRow[];
    const { data: eventData } = await supabaseClient.from("queue_events").select("id,clinic_id,queue_id,event_type,previous_status,new_status,reason,created_at,queue_tokens(display_token)").in("clinic_id",clinicIds).order("created_at",{ascending:false}).limit(200);
    events = (eventData ?? []) as unknown as EventRow[];
  }
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  let queues: QueueRow[] = [];
  let tokens: TokenRow[] = [];
  if (clinicIds.length) {
    const { data: queueData } = await supabaseClient.from("queues")
      .select("id,clinic_id,service_date,status,token_prefix,online_booking_enabled,walk_in_enabled,max_tokens,next_token_number,doctors(full_name,specialty)")
      .in("clinic_id",clinicIds).eq("service_date",today).order("updated_at",{ascending:false});
    queues = (queueData ?? []) as unknown as QueueRow[];
    const queueIds = queues.map(q=>q.id);
    if (queueIds.length) {
      const { data: tokenData } = await supabaseClient.from("queue_tokens")
        .select("id,queue_id,token_number,display_token,patient_label,status")
        .in("queue_id",queueIds).eq("service_date",today).order("token_number",{ascending:true});
      tokens = (tokenData ?? []) as TokenRow[];
    }
  }

  return <main className="min-h-screen">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-20 items-center justify-between"><Link href="/" className="font-black">Doctor Queue</Link><div className="flex items-center gap-4"><span className="hidden text-sm text-[#65736d] sm:inline">{user.email ?? "Authorized user"}</span><form action="/auth/signout" method="post"><button className="text-sm font-bold text-[#147d55]">Sign out</button></form></div></div></header>
    <section className="container py-10 md:py-12">
      <p className="eyebrow">Clinic workspace</p><h1 className="mt-3 text-3xl font-black">Today’s queue operations</h1><p className="mt-2 text-[#65736d]">Live data for {today} · India Standard Time. Token changes are committed through authorized database functions.</p>
      {memberships.length ? <QueueDashboard clinics={clinics} queues={queues} tokens={tokens} branches={branches} doctors={doctors} hours={hours} events={events} actorEmail={user.email ?? ""}/> : <div className="mt-8 rounded-2xl border border-dashed border-[#cbd9d0] bg-white p-8"><h2 className="font-extrabold">No clinic membership found</h2><p className="mt-2 text-sm leading-6 text-[#65736d]">Your account has no active clinic membership. A platform administrator must provision access securely.</p>{isAdmin && <Link href="/platform-admin" className="mt-4 inline-block rounded-full bg-[#147d55] px-5 py-3 text-sm font-bold text-white">Open Super Admin dashboard</Link>}</div>}
    </section>
  </main>;
}
