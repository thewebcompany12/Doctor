"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StaffInviteForm from "./staff-invite-form";
import AppointmentPanel from "./appointment-panel";

type Clinic = { id: string; name: string; clinic_code: string; role: string; address: string | null; city: string | null; state: string | null; phone: string | null };
type Branch = { id: string; clinic_id: string; branch_code: string; name: string; city: string | null; state: string | null; is_active: boolean };
type Doctor = { id: string; clinic_id: string; full_name: string; specialty: string | null; is_active: boolean };
type ClinicHour = { id: string; clinic_id: string; doctor_id: string | null; weekday: number; opens_at: string | null; closes_at: string | null; is_closed: boolean; doctors: { full_name: string } | null };
type Queue = { id: string; clinic_id: string; service_date: string; status: string; token_prefix: string; online_booking_enabled: boolean; walk_in_enabled: boolean; max_tokens: number | null; next_token_number: number; doctors: { full_name: string; specialty: string | null } | null };
type Token = { id: string; queue_id: string; token_number: number; display_token: string; patient_label: string; status: string };
type QueueEvent = { id: string; clinic_id: string; queue_id: string; event_type: string; previous_status: string | null; new_status: string | null; reason: string | null; created_at: string; queue_tokens: { display_token: string } | null };
type Appointment = { id: string; clinic_id: string; doctor_id: string; branch_id: string | null; patient_name: string; appointment_date: string; appointment_time: string; status: string };

export default function QueueDashboard({ clinics, queues, tokens, branches, doctors, hours, events, appointments, today, actorEmail }: { clinics: Clinic[]; queues: Queue[]; tokens: Token[]; branches: Branch[]; doctors: Doctor[]; hours: ClinicHour[]; events: QueueEvent[]; appointments: Appointment[]; today: string; actorEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function rpc(name: string, args: Record<string, unknown>, success: string) {
    setBusy(name); setError(""); setNotice("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc(name, args as never);
      if (rpcError) { setError(rpcError.message); return null; }
      setNotice(success);
      router.refresh();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed.");
      return null;
    } finally { setBusy(""); }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>, clinic: Clinic) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await rpc("update_clinic_profile", {
      p_clinic_id: clinic.id, p_name: String(data.get("name") ?? "").trim(),
      p_address: String(data.get("address") ?? "").trim() || null,
      p_city: String(data.get("city") ?? "").trim() || null,
      p_state: String(data.get("state") ?? "").trim() || null,
      p_phone: String(data.get("phone") ?? "").trim() || null
    }, "Clinic profile saved.");
  }

  async function createBranch(event: FormEvent<HTMLFormElement>, clinic: Clinic) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await rpc("create_clinic_branch", {
      p_clinic_id: clinic.id, p_branch_code: String(data.get("branchCode") ?? "").trim(),
      p_name: String(data.get("branchName") ?? "").trim(),
      p_address: String(data.get("branchAddress") ?? "").trim() || null,
      p_city: String(data.get("branchCity") ?? "").trim() || null,
      p_state: String(data.get("branchState") ?? "").trim() || null,
      p_postal_code: String(data.get("postalCode") ?? "").trim() || null,
      p_phone: String(data.get("branchPhone") ?? "").trim() || null
    }, "Branch created.");
    if (result) form.reset();
  }

  async function saveHours(event: FormEvent<HTMLFormElement>, clinic: Clinic) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const isClosed = data.get("isClosed") === "on";
    await rpc("set_clinic_hours", {
      p_clinic_id: clinic.id,
      p_doctor_id: String(data.get("doctorId") ?? "") || null,
      p_weekday: Number(data.get("weekday")),
      p_opens_at: isClosed ? null : String(data.get("opensAt") ?? ""),
      p_closes_at: isClosed ? null : String(data.get("closesAt") ?? ""),
      p_is_closed: isClosed
    }, "Opening hours saved.");
  }

  async function setupQueue(event: FormEvent<HTMLFormElement>, clinic: Clinic) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await rpc("create_clinic_queue", {
      p_clinic_id: clinic.id,
      p_doctor_name: String(data.get("doctorName") ?? "").trim(),
      p_specialty: String(data.get("specialty") ?? "").trim() || null,
      p_token_prefix: String(data.get("prefix") ?? "T").trim() || "T",
      p_max_tokens: String(data.get("maxTokens") ?? "").trim() ? Number(data.get("maxTokens")) : null,
      p_online_booking_enabled: data.get("online") === "on",
      p_walk_in_enabled: data.get("walkIn") === "on"
    }, "Today's doctor queue is ready.");
  }

  async function issueToken(queue: Queue, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("patientLabel") ?? "").trim() || "Patient";
    const result = await rpc("issue_staff_token", {
      p_queue_id: queue.id, p_patient_label: label, p_idempotency_key: crypto.randomUUID()
    }, "Token issued.");
    if (result) form.reset();
  }

  async function transition(token: Token, action: string) {
    const reason = action === "skip" ? window.prompt("Reason for skipping this patient?") : null;
    if (action === "skip" && !reason?.trim()) { setError("A reason is required to skip a patient."); return; }
    if (action === "cancel" && !window.confirm("Cancel token " + token.display_token + "?")) return;
    await rpc("transition_queue_token", {
      p_token_id: token.id, p_action: action, p_reason: reason,
      p_idempotency_key: crypto.randomUUID()
    }, "Token " + token.display_token + " updated.");
  }

  async function advance(queue: Queue) {
    const result = await rpc("advance_queue", { p_queue_id: queue.id, p_idempotency_key: crypto.randomUUID() }, "Queue advanced.");
    if (Array.isArray(result) && result.length === 0) setNotice("No waiting patients in this queue.");
  }

  return <div className="mt-8 space-y-6">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
    {clinics.map(clinic => {
      const canSetup = ["owner","manager"].includes(clinic.role);
      const clinicQueues = queues.filter(q => q.clinic_id === clinic.id);
      const clinicEvents = events.filter(e => e.clinic_id === clinic.id).slice(0,30);
      return <section key={clinic.id} className="rounded-2xl border border-[#e1e9e4] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{clinic.name}</h2><p className="mt-1 text-sm text-[#65736d]">{clinic.clinic_code} · {clinic.role}</p></div><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold">{clinicQueues.length} queue(s) today</span></div>
        {canSetup && <StaffInviteForm clinicId={clinic.id} clinicName={clinic.name} actorRole={clinic.role} actorEmail={actorEmail} />}
        <AppointmentPanel clinic={clinic} doctors={doctors} branches={branches} appointments={appointments} today={today} />
        {canSetup && <details className="mt-4 rounded-xl border border-[#e1e9e4] p-4"><summary className="cursor-pointer font-bold">Clinic profile and contact</summary>
          <form onSubmit={event => updateProfile(event,clinic)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Clinic name<input required name="name" defaultValue={clinic.name} maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Phone<input name="phone" defaultValue={clinic.phone ?? ""} maxLength={30} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold sm:col-span-2">Address<input name="address" defaultValue={clinic.address ?? ""} maxLength={240} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">City<input name="city" defaultValue={clinic.city ?? ""} maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">State<input name="state" defaultValue={clinic.state ?? ""} maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <button disabled={!!busy} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white sm:col-span-2">{busy === "update_clinic_profile" ? "Saving…" : "Save clinic profile"}</button>
          </form>
        </details>}
        {canSetup && <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4"><summary className="cursor-pointer font-bold">Branches ({branches.filter(b=>b.clinic_id===clinic.id).length})</summary>
          <div className="mt-3 space-y-2">{branches.filter(b=>b.clinic_id===clinic.id).map(branch=><div key={branch.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#f6f9f7] p-3 text-sm"><span className="font-bold">{branch.name} <span className="font-mono text-xs text-[#65736d]">({branch.branch_code})</span></span><span className="text-[#65736d]">{[branch.city,branch.state].filter(Boolean).join(", ") || "Location not set"} · {branch.is_active ? "Active" : "Inactive"}</span></div>)}</div>
          <form onSubmit={event => createBranch(event,clinic)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Branch code<input required name="branchCode" pattern="[A-Za-z0-9-]{2,16}" maxLength={16} placeholder="MAIN-2" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Branch name<input required name="branchName" maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold sm:col-span-2">Address<input name="branchAddress" maxLength={240} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">City<input name="branchCity" maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">State<input name="branchState" maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Postal code<input name="postalCode" maxLength={16} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Phone<input name="branchPhone" maxLength={30} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <button disabled={!!busy} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white sm:col-span-2">{busy === "create_clinic_branch" ? "Creating…" : "Create branch"}</button>
          </form>
        </details>}
        {canSetup && <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4"><summary className="cursor-pointer font-bold">Opening hours and doctor schedules</summary>
          <div className="mt-3 space-y-2">{hours.filter(h=>h.clinic_id===clinic.id).sort((a,b)=>a.weekday-b.weekday).map(hour=><div key={hour.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#f6f9f7] p-3 text-sm"><span className="font-bold">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][hour.weekday]} · {hour.doctors?.full_name ?? "Clinic-wide"}</span><span className="text-[#65736d]">{hour.is_closed ? "Closed" : (hour.opens_at ?? "—").slice(0,5)+"–"+(hour.closes_at ?? "—").slice(0,5)}</span></div>)}</div>
          <form onSubmit={event=>saveHours(event,clinic)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Doctor<select name="doctorId" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"><option value="">Clinic-wide hours</option>{doctors.filter(d=>d.clinic_id===clinic.id&&d.is_active).map(d=><option key={d.id} value={d.id}>{d.full_name}{d.specialty ? " · "+d.specialty : ""}</option>)}</select></label>
            <label className="text-sm font-bold">Day<select name="weekday" required className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,index)=><option key={day} value={index}>{day}</option>)}</select></label>
            <label className="text-sm font-bold">Opens at<input name="opensAt" type="time" defaultValue="09:00" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Closes at<input name="closesAt" type="time" defaultValue="17:00" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isClosed" /> Closed on this day</label>
            <button disabled={!!busy} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white">{busy === "set_clinic_hours" ? "Saving…" : "Save schedule"}</button>
          </form>
        </details>}
        <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4"><summary className="cursor-pointer font-bold">Recent queue history ({clinicEvents.length})</summary>
          {clinicEvents.length===0?<p className="mt-3 text-sm text-[#65736d]">No queue events recorded yet.</p>:<div className="mt-3 divide-y divide-[#edf1ee]">{clinicEvents.map(event=><div key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"><div><p className="font-bold">{event.queue_tokens?.display_token ? event.queue_tokens.display_token+" · " : ""}{event.event_type.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-[#65736d]">{event.previous_status ?? "—"} → {event.new_status ?? "—"}{event.reason ? " · "+event.reason : ""}</p></div><time className="text-xs text-[#65736d]">{new Date(event.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}</time></div>)}</div>}
        </details>
        {canSetup && <details className="mt-5 rounded-xl border border-dashed border-[#cbd9d0] p-4"><summary className="cursor-pointer font-bold">Set up / configure today’s doctor queue</summary>
          <form onSubmit={event => setupQueue(event,clinic)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Doctor name<input required name="doctorName" maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Specialty (optional)<input name="specialty" maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Token prefix<input name="prefix" defaultValue="T" maxLength={8} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold">Daily token limit<input name="maxTokens" type="number" min={1} max={1000} placeholder="No limit" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="online" /> Enable online booking (public booking flow not yet available)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="walkIn" defaultChecked /> Allow walk-in tokens</label>
            <button disabled={!!busy} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">{busy === "create_clinic_queue" ? "Saving…" : "Save queue settings"}</button>
          </form>
        </details>}
        {clinicQueues.length === 0 ? <p className="mt-5 rounded-xl bg-[#f8faf8] p-5 text-sm text-[#65736d]">No queue configured for today. {canSetup ? "Use the setup panel above to add a doctor and open today’s queue." : "Ask the clinic owner or manager to configure today’s queue."}</p> :
          <div className="mt-5 space-y-5">{clinicQueues.map(queue => {
            const queueTokens = tokens.filter(t => t.queue_id === queue.id);
            const waiting = queueTokens.filter(t => ["waiting","arrived"].includes(t.status)).length;
            const called = queueTokens.find(t => t.status === "called");
            const current = queueTokens.find(t => t.status === "in_consultation");
            return <article key={queue.id} className="rounded-xl border border-[#e1e9e4] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{queue.doctors?.full_name ?? "Doctor"}{queue.doctors?.specialty ? " · " + queue.doctors.specialty : ""}</h3><p className="mt-1 text-xs text-[#65736d]">Prefix {queue.token_prefix} · {waiting} waiting · {queueTokens.filter(t=>t.status==="completed").length} completed</p></div><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold capitalize">{queue.status.replace("_"," ")}</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-xs text-[#65736d]">Now called</p><p className="mt-1 text-2xl font-black">{called?.display_token ?? "—"}</p></div>
                <div className="rounded-xl bg-[#f6f9f7] p-3"><p className="text-xs text-[#65736d]">In consultation</p><p className="mt-1 text-2xl font-black">{current?.display_token ?? "—"}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {queue.status !== "open" && queue.status !== "closed" && <button disabled={!!busy} onClick={() => rpc("set_queue_status",{p_queue_id:queue.id,p_status:"open"},"Queue opened.")} className="rounded-full bg-[#147d55] px-4 py-2 text-sm font-bold text-white">Open queue</button>}
                {queue.status === "open" && <button disabled={!!busy} onClick={() => rpc("set_queue_status",{p_queue_id:queue.id,p_status:"paused"},"Queue paused.")} className="rounded-full border border-amber-200 px-4 py-2 text-sm font-bold">Pause queue</button>}
                {queue.status === "paused" && <button disabled={!!busy} onClick={() => rpc("set_queue_status",{p_queue_id:queue.id,p_status:"open"},"Queue resumed.")} className="rounded-full bg-[#147d55] px-4 py-2 text-sm font-bold text-white">Resume queue</button>}
                {queue.status !== "closed" && ["owner","manager","doctor"].includes(clinic.role) && <button disabled={!!busy} onClick={() => { if(window.confirm("Close this queue for today?")) void rpc("set_queue_status",{p_queue_id:queue.id,p_status:"closed"},"Queue closed."); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-800">Close queue</button>}
                <button disabled={!!busy || queue.status !== "open" || waiting===0} onClick={() => advance(queue)} className="rounded-full bg-[#14231d] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Call next</button>
              </div>
              {queue.status === "open" && queue.walk_in_enabled && <form onSubmit={event=>issueToken(queue,event)} className="mt-4 flex flex-wrap gap-2"><input name="patientLabel" maxLength={80} placeholder="Patient label (optional)" className="min-w-[170px] flex-1 rounded-full border border-[#dbe5df] px-4 py-2 text-sm" /><button disabled={!!busy} className="rounded-full border border-[#147d55] px-4 py-2 text-sm font-bold text-[#147d55] disabled:opacity-40">Issue walk-in token</button></form>}
              <div className="mt-5"><h4 className="font-bold">Today’s tokens</h4>{queueTokens.length===0 ? <p className="mt-2 text-sm text-[#65736d]">No tokens issued.</p> : <div className="mt-2 divide-y divide-[#edf1ee]">{queueTokens.map(token=><div key={token.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-bold">{token.display_token} · {token.patient_label}</p><p className="text-xs capitalize text-[#65736d]">{token.status.replace("_"," ")}</p></div><div className="flex flex-wrap gap-1.5">
                {token.status==="called" && <><button disabled={!!busy} onClick={()=>transition(token,"call")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Recall</button><button disabled={!!busy} onClick={()=>transition(token,"start")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Start</button></>}
                {token.status==="in_consultation" && <button disabled={!!busy} onClick={()=>transition(token,"complete")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Complete</button>}
                {token.status==="waiting" && <button disabled={!!busy} onClick={()=>transition(token,"arrive")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Mark arrived</button>}{["waiting","arrived","called"].includes(token.status) && <><button disabled={!!busy} onClick={()=>transition(token,"skip")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Skip</button><button disabled={!!busy} onClick={()=>transition(token,"absent")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Absent</button><button disabled={!!busy} onClick={()=>transition(token,"cancel")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Cancel</button></>}
              </div></div>)}</div>}</div>
            </article>;
          })}</div>}
      </section>;
    })}
  </div>;
}
