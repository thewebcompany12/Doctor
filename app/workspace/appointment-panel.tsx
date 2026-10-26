"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Clinic = { id: string; name: string; role: string };
type Doctor = { id: string; clinic_id: string; full_name: string; specialty: string | null; is_active: boolean };
type Branch = { id: string; clinic_id: string; branch_code: string; name: string; city: string | null; state: string | null; is_active: boolean };
type Appointment = { id: string; clinic_id: string; doctor_id: string; branch_id: string | null; patient_name: string; appointment_date: string; appointment_time: string; status: string };

export default function AppointmentPanel({ clinic, doctors, branches, appointments, today }: { clinic: Clinic; doctors: Doctor[]; branches: Branch[]; appointments: Appointment[]; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = ["owner","manager","doctor","receptionist"].includes(clinic.role);
  const clinicDoctors = doctors.filter(d=>d.clinic_id===clinic.id && d.is_active);
  const clinicBranches = branches.filter(b=>b.clinic_id===clinic.id && b.is_active);
  const clinicAppointments = appointments.filter(a=>a.clinic_id===clinic.id);

  async function rpc(name: string, args: Record<string,unknown>, success: string) {
    setBusy(true); setMessage(""); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc(name,args as never);
      if (rpcError) { setError(rpcError.message); return false; }
      setMessage(success); router.refresh(); return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Appointment operation failed."); return false;
    } finally { setBusy(false); }
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const doctorId = String(data.get("doctorId") ?? "");
    if (!doctorId) { setError("Choose an active doctor."); return; }
    const ok = await rpc("create_staff_appointment", {
      p_clinic_id: clinic.id, p_doctor_id: doctorId,
      p_branch_id: String(data.get("branchId") ?? "") || null,
      p_patient_name: String(data.get("patientName") ?? "").trim(),
      p_appointment_date: String(data.get("date") ?? ""),
      p_appointment_time: String(data.get("time") ?? ""),
      p_idempotency_key: crypto.randomUUID()
    }, "Appointment booked.");
    if (ok) form.reset();
  }

  async function transition(appointment: Appointment, action: string) {
    if (action==="cancel" && !window.confirm("Cancel appointment for " + appointment.patient_name + "?")) return;
    await rpc("transition_staff_appointment",{p_appointment_id:appointment.id,p_action:action},"Appointment updated.");
  }

  return <section className="mt-6 rounded-xl border border-[#e1e9e4] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">Appointments</h3><p className="mt-1 text-xs text-[#65736d]">Upcoming bookings · patient details are clinic-private</p></div><span className="rounded-full bg-[#f2f6f3] px-3 py-1 text-xs font-bold">{clinicAppointments.length} upcoming</span></div>
    {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {canManage && <details className="mt-4 rounded-xl border border-dashed border-[#cbd9d0] p-4"><summary className="cursor-pointer font-bold">Book a clinic appointment</summary>
      <form onSubmit={createAppointment} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">Patient name<input required name="patientName" maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
        <label className="text-sm font-bold">Doctor<select required name="doctorId" defaultValue="" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"><option value="" disabled>Choose doctor</option>{clinicDoctors.map(d=><option key={d.id} value={d.id}>{d.full_name}{d.specialty ? " · "+d.specialty : ""}</option>)}</select></label>
        <label className="text-sm font-bold">Branch (optional)<select name="branchId" defaultValue="" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"><option value="">Main clinic</option>{clinicBranches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.branch_code}</option>)}</select></label>
        <label className="text-sm font-bold">Date<input required name="date" type="date" min={today} defaultValue={today} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
        <label className="text-sm font-bold">Time<input required name="time" type="time" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal" /></label>
        <button disabled={busy || clinicDoctors.length===0} className="rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving…" : "Book appointment"}</button>
        {clinicDoctors.length===0 && <p className="text-xs text-amber-800 sm:col-span-2">Set up an active doctor and opening hours before booking.</p>}
      </form>
    </details>}
    {clinicAppointments.length===0 ? <p className="mt-4 rounded-xl bg-[#f8faf8] p-4 text-sm text-[#65736d]">No upcoming appointments found.</p> : <div className="mt-4 divide-y divide-[#edf1ee]">{clinicAppointments.map(a=>{
      const doctor=clinicDoctors.find(d=>d.id===a.doctor_id);
      const branch=clinicBranches.find(b=>b.id===a.branch_id);
      return <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-[180px]"><p className="font-bold">{a.patient_name}</p><p className="mt-1 text-xs text-[#65736d]">{doctor?.full_name ?? "Doctor"}{branch ? " · "+branch.name : ""} · {a.appointment_date} {a.appointment_time.slice(0,5)}</p><p className="mt-1 text-xs capitalize text-[#65736d]">{a.status.replace("_"," ")}</p></div><div className="flex flex-wrap gap-1.5">
        {a.status==="booked" && <button disabled={busy} onClick={()=>transition(a,"confirm")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Confirm</button>}
        {["booked","confirmed"].includes(a.status) && <><button disabled={busy} onClick={()=>transition(a,"check_in")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Check in</button><button disabled={busy} onClick={()=>transition(a,"cancel")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Cancel</button><button disabled={busy} onClick={()=>transition(a,"no_show")} className="rounded-full border px-3 py-1.5 text-xs font-bold">No-show</button></>}
        {a.status==="checked_in" && <button disabled={busy} onClick={()=>transition(a,"complete")} className="rounded-full border px-3 py-1.5 text-xs font-bold">Complete</button>}
      </div></div>;
    })}</div>}
  </section>;
}
