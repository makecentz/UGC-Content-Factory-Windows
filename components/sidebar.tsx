import Link from "next/link";
import { BarChart3, BookOpen, Clapperboard, Film, Flame, Home, Plus, Settings, Sparkles, Stars, WandSparkles } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/series", label: "Series", icon: Sparkles },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/ugc", label: "UGC Studio", icon: WandSparkles },
  { href: "/kids", label: "Kids Stories", icon: Stars },
  { href: "/drama", label: "Drama Shorts", icon: Film },
  { href: "/motivational", label: "Motivational Shorts", icon: Flame },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-72 flex-col border-r border-pilot-line bg-white p-5">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pilot-purple text-white">
          <BarChart3 size={21} />
        </div>
        <div>
          <div className="text-lg font-black">UGC Content Factory</div>
          <div className="text-xs text-pilot-muted">Faceless video studio</div>
        </div>
      </Link>

      <Link href="/series/new" className="mb-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white hover:bg-[#5d00d8]">
        <Plus size={17} />
        Create Series
      </Link>
      <Link href="/ugc/new" className="mb-6 -mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-pilot-line bg-white px-4 text-sm font-semibold text-pilot-ink hover:bg-pilot-soft">
        <WandSparkles size={17} />
        New UGC Ad
      </Link>
      <Link href="/kids/new" className="mb-6 -mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-pilot-line bg-white px-4 text-sm font-semibold text-pilot-ink hover:bg-pilot-soft">
        <Stars size={17} />
        New Kids Story
      </Link>
      <Link href="/drama/new" className="mb-6 -mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-pilot-line bg-white px-4 text-sm font-semibold text-pilot-ink hover:bg-pilot-soft">
        <Film size={17} />
        New Drama Short
      </Link>
      <Link href="/motivational/new" className="mb-6 -mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-pilot-line bg-white px-4 text-sm font-semibold text-pilot-ink hover:bg-pilot-soft">
        <Flame size={17} />
        New Motivational
      </Link>

      <nav className="space-y-1">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-pilot-muted hover:bg-pilot-soft hover:text-pilot-ink">
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-pilot-line bg-pilot-soft p-4">
        <div className="text-sm font-bold">Local Mode</div>
        <div className="mt-1 text-xs leading-5 text-pilot-muted">Private Windows workspace. Exports stay on this machine.</div>
      </div>
    </aside>
  );
}
