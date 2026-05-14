import Link from "next/link";
import Image from "next/image";
import { Clapperboard, Home, Plus, Settings, Stars } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/kids", label: "Kids Stories", icon: Stars },
  { href: "/videos", label: "Completed Videos", icon: Clapperboard },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-72 flex-col border-r border-pilot-line bg-white p-5">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3">
        <Image src="/ugccflogo.png" alt="UGC Content Factory" width={58} height={58} className="h-14 w-14 object-contain" priority />
        <div>
          <div className="text-lg font-black leading-tight">UGC Content Factory</div>
          <div className="text-xs text-pilot-muted">Kids story studio</div>
        </div>
      </Link>

      <Link href="/kids/new" className="mb-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pilot-purple px-4 text-sm font-semibold text-white hover:bg-[#5d00d8]">
        <Stars size={17} />
        New Kids Story
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
        <div className="mt-1 text-xs leading-5 text-pilot-muted">Private Windows workspace for kids stories. Exports stay on this machine.</div>
      </div>
    </aside>
  );
}
