"use client";

import { FormEvent, useState } from "react";

type Staff = { membershipId: string; role: string; isActive: boolean; displayName: string; email: string; createdAt: string };
type Props = { clinicId: string; clinicName: string; actorRole: string; actorEmail: string };

export default function StaffInviteForm({ clinicId, clinicName, actorRole, actorEmail }: Props) {
  const [busy,setBusy]=useState(false);
  const [loadingStaff,setLoadingStaff]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [staff,setStaff]=useState<Staff[]|null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/clinic/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        clinicId,email:String(data.get("email")??"").trim(),displayName:String(data.get("displayName")??"").trim()||undefined,role:String(data.get("role")??"receptionist")
      })});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Invitation failed.");return;}
      setNotice("Invitation sent to "+body.email+". They must accept the email invitation to set up access.");
      form.reset();
      await loadStaff();
    } catch { setError("Request failed. Check your connection and retry."); }
    finally { setBusy(false); }
  }
  async function loadStaff() {
    setLoadingStaff(true);setError("");
    try {
      const response=await fetch("/api/clinic/staff?clinicId="+encodeURIComponent(clinicId),{cache:"no-store"});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Staff directory unavailable.");return;}
      setStaff(Array.isArray(body.staff)?body.staff as Staff[]:[]);
    } catch { setError("Could not load staff. Check your connection."); }
    finally { setLoadingStaff(false); }
  }
  async function setActive(member: Staff, isActive: boolean) {
    if(!window.confirm((isActive?"Activate ":"Deactivate ")+member.email+"?")) return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/clinic/staff/"+encodeURIComponent(member.membershipId),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive})});
      const body=await response.json();
      if(!response.ok){setError(typeof body.error==="string"?body.error:"Staff update failed.");return;}
      setStaff(current=>current?.map(row=>row.membershipId===member.membershipId?{...row,isActive}:row)??null);
      setNotice(member.email+" was "+(isActive?"activated":"deactivated")+".");
    } catch { setError("Request failed. Check your connection."); }
    finally { setBusy(false); }
  }
  return <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4">
    <summary className="cursor-pointer font-bold">Staff and permissions</summary>
    <p className="mt-2 text-sm text-[#65736d]">Clinic: {clinicName}. Invitations are sent through Supabase Auth. Staff management requires a server-only service-role key.</p>
    <button type="button" onClick={loadStaff} disabled={loadingStaff||busy} className="mt-3 rounded-full border border-[#dbe5df] px-4 py-2 text-sm font-bold">{loadingStaff?"Loading staff…":"Load current staff"}</button>
    {staff && <div className="mt-3 space-y-2">{staff.length===0?<p className="text-sm text-[#65736d]">No staff memberships found.</p>:staff.map(member=><div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6f9f7] p-3">
      <div><p className="font-bold">{member.displayName}</p><p className="text-xs text-[#65736d]">{member.email} · {member.role} · {member.isActive?"Active":"Inactive"}</p></div>
      {member.role!=="owner" && member.email.toLowerCase()!==actorEmail.toLowerCase() && !(actorRole==="manager"&&member.role==="manager") && <button type="button" disabled={busy} onClick={()=>setActive(member,!member.isActive)} className="rounded-full border border-[#dbe5df] px-3 py-1.5 text-xs font-bold">{member.isActive?"Deactivate":"Activate"}</button>}
    </div>)}</div>}
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold">Staff email<input required name="email" type="email" maxLength={254} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"/></label>
      <label className="text-sm font-bold">Display name<input name="displayName" maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"/></label>
      <label className="text-sm font-bold">Role<select name="role" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal">
        {actorRole==="owner" && <option value="manager">Manager</option>}
        <option value="doctor">Doctor</option><option value="receptionist">Receptionist</option><option value="compounder">Compounder</option>
      </select></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Sending…":"Send invitation"}</button>
    </form>
    {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </details>;
}
