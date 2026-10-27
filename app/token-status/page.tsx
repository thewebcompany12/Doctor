import Link from "next/link";
import TokenStatusLookup from "./token-status-lookup";

export default async function TokenStatusPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const language=(await searchParams).lang==="hi"?"hi":"en";
  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b border-[#e1e9e4] bg-white"><div className="container flex h-[76px] items-center justify-between"><Link href="/" className="font-black tracking-tight">← Doctor Queue</Link><Link href="/clinics" className="text-sm font-bold text-[#147d55]">{language==="hi"?"क्लिनिक निर्देशिका":"Clinic directory"}</Link></div></header>
    <section className="container max-w-3xl py-12 md:py-16">
      <p className="eyebrow">{language==="hi"?"निजी टोकन जानकारी":"Private token lookup"}</p><h1 className="mt-3 text-3xl font-black tracking-tight">{language==="hi"?"अपनी कतार की स्थिति देखें":"Check your queue status"}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#65736d]">{language==="hi"?"ट्रैकिंग सीक्रेट रखने वाला व्यक्ति ही टोकन की स्थिति देख सकता है। यहाँ मरीज़ का नाम या फ़ोन नंबर नहीं दिखाया जाता।":"Only someone with the tracking secret can view token status. The lookup never reveals a patient&apos;s name or phone number."}</p>
      <TokenStatusLookup trackingConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} language={language} />
    </section>
  </main>;
}
