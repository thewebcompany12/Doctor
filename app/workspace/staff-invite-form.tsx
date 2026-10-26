"use client";

import { FormEvent, useState } from "react";

type Props = { clinicId: string; clinicName: string; actorRole: string };

export default function StaffInviteForm({ clinicId, clinicName, actorRole }: Props) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
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
    } catch { setError("Request failed. Check your connection and retry."); }
    finally { setBusy(false); }
  }
  return <details className="mt-3 rounded-xl border border-[#e1e9e4] p-4">
    <summary className="cursor-pointer font-bold">Invite staff</summary>
    <p className="mt-2 text-sm text-[#65736d]">Clinic: {clinicName}. Invitation emails are sent by Supabase Auth; the service-role key is required on the server.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold">Staff email<input required name="email" type="email" maxLength={254} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"/></label>
      <label className="text-sm font-bold">Display name<input name="displayName" maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal"/></label>
      <label className="text-sm font-bold">Role<select name="role" className="mt-1 w-full rounded-lg border border-[#dbe5df] px-3 py-2 font-normal">
        {actorRole==="owner" && <option value="manager">Manager</option>}
        <option value="doctor">Doctor</option><option value="receptionist">Receptionist</option><option value="compounder">Compounder</option>
      </select></label>
      <button disabled={busy} className="self-end rounded-full bg-[#147d55] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Sending invitation…":"Send invitation"}</button>
    </form>
    {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </details>;
}
