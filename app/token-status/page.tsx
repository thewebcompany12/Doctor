import Link from "next/link";
import TokenStatusLookup from "./token-status-lookup";

export default function TokenStatusPage() {
  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[76px] items-center justify-between"><Link href="/" className="font-black tracking-tight">← Doctor Queue</Link><Link href="/clinics" className="text-sm font-bold text-[#147d55]">Clinic directory</Link></div></header>
    <section className="container max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Private token lookup</p><h1 className="mt-3 text-3xl font-black tracking-tight">Check your queue status</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#65736d]">Only someone with the tracking secret can view token status. The lookup never reveals a patient&apos;s name or phone number.</p>
      <TokenStatusLookup />
    </section>
  </main>;
}
