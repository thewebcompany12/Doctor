"use client";

import { FormEvent, useState } from "react";

type Provisioned = { clinic: { clinicCode: string; name: string }; ownerEmail: string; temporaryPassword: string; notice: string };

export default function ClinicProvisioningForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Provisioned | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      ownerEmail: String(data.get("ownerEmail") ?? "").trim(),
      ownerEmailVerified: data.get("ownerEmailVerified") === "on",
      address: String(data.get("address") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      state: String(data.get("state") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim()
    };
    try {
      const response = await fetch("/api/admin/clinics", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) setError(typeof body.error === "string" ? body.error : "Clinic provisioning failed.");
      else setResult(body as Provisioned);
    } catch {
      setError("The request failed. Check your connection and retry.");
    } finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-2xl border border-[#e1e9e4] bg-white p-6">
    <h2 className="text-xl font-black">Onboard a clinic</h2>
    <p className="mt-2 text-sm leading-6 text-[#65736d]">Creates an owner account and membership. Confirm the owner email has been verified through a trusted channel. The temporary password is shown once only.</p>
    <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold">Clinic name<input required name="name" minLength={2} maxLength={120} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-bold">Owner email<input required name="ownerEmail" type="email" maxLength={254} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-bold">Address (optional)<input name="address" maxLength={240} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-bold">City<input name="city" maxLength={100} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-bold">State<input name="state" maxLength={100} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="text-sm font-bold">Phone<input name="phone" maxLength={30} className="mt-1 w-full rounded-xl border border-[#dbe5df] px-3 py-2.5 font-normal" /></label>
      <label className="sm:col-span-2 flex items-start gap-3 text-sm font-medium"><input required type="checkbox" name="ownerEmailVerified" className="mt-1" /><span>I have independently verified that the owner controls this email address and am authorized to create the account.</span></label>
      <button disabled={busy} className="rounded-full bg-[#147d55] px-5 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? "Provisioning…" : "Create clinic and owner"}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <h3 className="font-black">Clinic created: {result.clinic.name} ({result.clinic.clinicCode})</h3>
      <p className="mt-2">Owner: {result.ownerEmail}</p>
      <p className="mt-2 break-all"><strong>Temporary password:</strong> <code>{result.temporaryPassword}</code></p>
      <p className="mt-2">{result.notice}</p>
      <button type="button" onClick={() => navigator.clipboard.writeText(result.temporaryPassword)} className="mt-3 rounded-full border border-emerald-300 px-4 py-2 font-bold">Copy temporary password</button>
    </div>}
  </section>;
}
