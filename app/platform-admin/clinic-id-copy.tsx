"use client";

import { useState } from "react";

export default function ClinicIdCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    setCopied(false); setError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError("Select and copy the ID manually.");
    }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" onClick={copy} className="rounded-full border border-[#dbe5df] px-3 py-1 text-xs font-bold" aria-label={"Copy Clinic ID " + value}>Copy ID</button>
    {copied && <span role="status" className="text-xs text-emerald-800">Copied</span>}
    {error && <span role="status" className="text-xs text-amber-800">{error}</span>}
  </span>;
}
