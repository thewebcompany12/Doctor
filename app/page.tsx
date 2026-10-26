import Link from "next/link";
import { Activity, ArrowRight, BellRing, CheckCircle2, Clock3, HeartPulse, MapPin, QrCode, ShieldCheck, Stethoscope } from "lucide-react";

const features = [
  { icon: Clock3, title: "Live token status", body: "See which token is being called and how many people are waiting ahead." },
  { icon: BellRing, title: "Useful turn reminders", body: "Opt in to alerts when your turn is approaching. Delivery depends on device permissions." },
  { icon: ShieldCheck, title: "Privacy by design", body: "Public queue screens use token information, not patient names or medical details." }
];

export default function HomePage() {
  return <main className="min-h-screen overflow-hidden">
    <header className="container flex h-[78px] items-center justify-between">
      <Link href="/" className="flex items-center gap-3" aria-label="Doctor Queue home">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#147d55] text-white"><HeartPulse size={23}/></span>
        <span><strong className="block text-lg tracking-tight">Doctor Queue</strong><span className="block text-xs text-[#65736d]">Your time matters</span></span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm font-semibold text-[#53645b] sm:flex">
        <a href="#how-it-works" className="hover:text-[#147d55]">How it works</a>
        <a href="#for-clinics" className="hover:text-[#147d55]">For clinics</a>
      </nav>
      <Link href="/clinics" className="rounded-full bg-[#14231d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#147d55]">Find a clinic <ArrowRight className="ml-1 inline" size={15}/></Link>
    </header>

    <section className="container grid items-center gap-12 pb-20 pt-12 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-20">
      <div>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d7e8dd] bg-white px-3 py-2 text-xs font-bold text-[#147d55]"><span className="h-2 w-2 rounded-full bg-[#25a66d]"/> A calmer clinic visit starts here</div>
        <h1 className="max-w-2xl text-5xl font-black leading-[1.05] tracking-[-.055em] sm:text-6xl lg:text-7xl">Your turn at the doctor, <span className="text-[#147d55]">without the guesswork.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#65736d]">Check a clinic’s live token queue before you leave home. Know the current token, follow your own turn, and make waiting a little easier.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/clinics" className="rounded-full bg-[#147d55] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/10 transition hover:-translate-y-0.5">Find doctors near you <ArrowRight className="ml-2 inline" size={16}/></Link>
          <a href="#how-it-works" className="rounded-full border border-[#dbe5df] bg-white px-6 py-4 text-sm font-bold hover:border-[#147d55]">How it works</a>
        </div>
        <div className="mt-9 flex items-center gap-3 text-sm text-[#65736d]"><CheckCircle2 size={18} className="text-[#147d55]"/> No patient account required to explore public queues</div>
      </div>
      <div className="soft-grid relative rounded-[32px] p-4 sm:p-7">
        <div className="absolute -right-4 -top-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#f9c978] text-[#4b3512] shadow-lg"><QrCode size={28}/></div>
        <div className="relative rounded-[26px] border border-white bg-white p-5 shadow-xl shadow-[#193c2b]/10 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><span className="eyebrow">Live queue preview</span><h2 className="mt-2 text-xl font-extrabold">Your clinic, at a glance</h2></div>
            <span className="rounded-full bg-[#e9f7ef] px-3 py-1.5 text-xs font-bold text-[#147d55]">Illustration</span>
          </div>
          <div className="mt-6 rounded-2xl bg-[#f4f8f5] p-4">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#147d55]"><Stethoscope size={22}/></span><div><p className="font-bold">Clinic queue</p><p className="mt-1 flex items-center gap-1 text-xs text-[#65736d]"><MapPin size={12}/> Clinic location shown on its profile</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#e1e9e4] bg-white p-4"><p className="text-xs text-[#65736d]">Now calling</p><p className="mt-1 text-3xl font-black text-[#147d55]">—</p><p className="mt-1 text-xs text-[#65736d]">Live data appears when connected</p></div>
              <div className="rounded-xl border border-[#e1e9e4] bg-white p-4"><p className="text-xs text-[#65736d]">Queue status</p><p className="mt-2 text-lg font-extrabold">Not connected</p><p className="mt-1 text-xs text-[#65736d]">No demo values presented as real</p></div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e1e9e4] p-4"><Activity className="text-[#147d55]" size={20}/><p className="text-sm leading-6 text-[#65736d]">Queue updates come from the clinic’s server, not a guessed countdown.</p></div>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="border-y border-[#e1e9e4] bg-white py-16 md:py-20">
      <div className="container">
        <div className="max-w-xl"><p className="eyebrow">Designed for real life</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Less uncertainty. More time back.</h2><p className="mt-4 leading-7 text-[#65736d]">A simple patient experience backed by a queue system clinics can manage securely.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({icon: Icon,title,body})=><article key={title} className="rounded-2xl border border-[#e1e9e4] p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-green-900/5"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f7ef] text-[#147d55]"><Icon size={23}/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 leading-7 text-[#65736d]">{body}</p></article>)}</div>
      </div>
    </section>

    <section id="for-clinics" className="container py-16 md:py-20"><div className="flex flex-col justify-between gap-6 rounded-[28px] bg-[#143d2c] p-8 text-white md:flex-row md:items-center md:p-12"><div className="max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#a4e2bd]">For clinics and care teams</p><h2 className="mt-3 text-3xl font-black tracking-tight">Keep the queue moving. Keep patients informed.</h2><p className="mt-3 leading-7 text-white/75">Manage daily tokens, coordinate reception and doctor workflows, and share a public queue page.</p></div><Link href="/login" className="shrink-0 rounded-full bg-white px-6 py-4 text-center text-sm font-extrabold text-[#143d2c] hover:bg-[#e9f7ef]">Clinic staff sign in <ArrowRight className="ml-2 inline" size={16}/></Link></div></section>

    <footer className="border-t border-[#e1e9e4] py-7"><div className="container flex flex-col justify-between gap-2 text-xs text-[#65736d] sm:flex-row"><span>© {new Date().getFullYear()} Doctor Queue</span><span>Public queue information is not a medical diagnosis or a guaranteed waiting time.</span></div></footer>
  </main>;
}