"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PlanSettings = { planCode: "starter" | "growth" | "enterprise" | "custom"; maxDoctors: number; maxBranches: number; maxStaff: number; maxDailyTokens: number | null; onlineBookingEnabled: boolean; walkInEnabled: boolean };
type Props = { clinicId: string; status: "active" | "suspended" | "archived"; name: string; address?: string | null; city?: string | null; state?: string | null; phone?: string | null; planSettings: PlanSettings };

export default function ClinicDirectoryActions(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function send(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/clinics/" + props.clinicId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "Clinic update failed."); return false; }
      setNotice(payload.action === "configure" ? "Plan and limits saved." : "Clinic updated.");
      router.refresh(); setEditing(false); setConfiguring(false); return true;
    } catch { setError("Request failed. Check your connection."); return false; }
    finally { setBusy(false); }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await send({ action: "update", name: String(data.get("name") ?? "").trim(), address: String(data.get("address") ?? "").trim() || null, city: String(data.get("city") ?? "").trim() || null, state: String(data.get("state") ?? "").trim() || null, phone: String(data.get("phone") ?? "").trim() || null });
  }
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const maxDaily = String(data.get("maxDailyTokens") ?? "").trim();
    await send({
      action: "configure",
      planCode: String(data.get("planCode") ?? "custom"),
      maxDoctors: Number(data.get("maxDoctors")),
      maxBranches: Number(data.get("maxBranches")),
      maxStaff: Number(data.get("maxStaff")),
      maxDailyTokens: maxDaily ? Number(maxDaily) : null,
      onlineBookingEnabled: data.get("onlineBookingEnabled") === "on",
      walkInEnabled: data.get("walkInEnabled") === "on"
    });
  }
  async function changeStatus(action: "activate" | "suspend" | "archive") {
    if (action === "archive" && !window.confirm("Archive this clinic? It will no longer appear publicly.")) return;
    if (action === "suspend" && !window.confirm("Suspend this clinic? Public queue visibility will stop.")) return;
    await send({ action });
  }
  const plan = props.planSettings;
  return <div className="min-w-[230px] space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => setEditing(v => !v)} className="rounded-full border border-[#dbe5df] px-3 py-1.5 text-xs font-bold">Edit</button>
      <button type="button" disabled={busy} onClick={() => setConfiguring(v => !v)} className="rounded-full border border-[#dbe5df] px-3 py-1.5 text-xs font-bold">Plan & limits</button>
      {props.status !== "active" && <button type="button" disabled={busy} onClick={() => changeStatus("activate")} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">Activate</button>}
      {props.status === "active" && <button type="button" disabled={busy} onClick={() => changeStatus("suspend")} className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-900">Suspend</button>}
      {props.status !== "archived" && <button type="button" disabled={busy} onClick={() => changeStatus("archive")} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-800">Archive</button>}
    </div>
    {editing && <form onSubmit={update} className="space-y-2 rounded-xl border border-[#e1e9e4] bg-[#f8faf8] p-3">
      <label className="block text-xs font-bold">Name<input required name="name" defaultValue={props.name} maxLength={120} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">Address<input name="address" defaultValue={props.address ?? ""} maxLength={240} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">City<input name="city" defaultValue={props.city ?? ""} maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">State<input name="state" defaultValue={props.state ?? ""} maxLength={100} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">Phone<input name="phone" defaultValue={props.phone ?? ""} maxLength={30} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <button disabled={busy} className="rounded-full bg-[#147d55] px-3 py-1.5 text-xs font-bold text-white">{busy ? "Saving…" : "Save changes"}</button>
    </form>}
    {configuring && <form onSubmit={configure} className="space-y-2 rounded-xl border border-[#e1e9e4] bg-[#f8faf8] p-3">
      <label className="block text-xs font-bold">Plan<select name="planCode" defaultValue={plan.planCode} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal"><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option><option value="custom">Custom</option></select></label>
      <label className="block text-xs font-bold">Doctor limit<input required name="maxDoctors" type="number" min={1} max={1000} defaultValue={plan.maxDoctors} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">Branch limit<input required name="maxBranches" type="number" min={1} max={1000} defaultValue={plan.maxBranches} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">Staff limit<input required name="maxStaff" type="number" min={1} max={10000} defaultValue={plan.maxStaff} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="block text-xs font-bold">Daily token limit (blank = unlimited)<input name="maxDailyTokens" type="number" min={1} max={10000} defaultValue={plan.maxDailyTokens ?? ""} className="mt-1 w-full rounded-lg border border-[#dbe5df] px-2 py-1.5 font-normal" /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="onlineBookingEnabled" defaultChecked={plan.onlineBookingEnabled} /> Online booking allowed</label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="walkInEnabled" defaultChecked={plan.walkInEnabled} /> Walk-in booking allowed</label>
      <button disabled={busy} className="rounded-full bg-[#147d55] px-3 py-1.5 text-xs font-bold text-white">{busy ? "Saving…" : "Save plan settings"}</button>
    </form>}
    {notice && <p role="status" className="max-w-[260px] text-xs text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="max-w-[260px] text-xs text-red-700">{error}</p>}
  </div>;
}
