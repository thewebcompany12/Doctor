import Link from "next/link";
export default function NotFound() {
  return <main className="grid min-h-screen place-items-center px-6 text-center"><div><p className="text-sm font-bold uppercase tracking-widest text-emerald-700">404 · Not found</p><h1 className="mt-3 text-4xl font-black">This page isn’t here.</h1><p className="mt-3 text-slate-600">The link may be incorrect or the page may have moved.</p><Link className="mt-6 inline-block rounded-full bg-emerald-700 px-5 py-3 font-bold text-white" href="/">Back to Doctor Queue</Link></div></main>;
}