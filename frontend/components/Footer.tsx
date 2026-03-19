import Link from "next/link";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Play Games", href: "/games" },
      { label: "Casino", href: "/casino" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Leaderboard", href: "/leaderboard" },
    ],
  },
  {
    title: "Casino Games",
    links: [
      { label: "Coin Flip", href: "/casino/coin-flip" },
      { label: "Hash Roulette", href: "/casino/hash-roulette" },
      { label: "Dice Roll", href: "/casino/dice-roll" },
      { label: "Crypto Crash", href: "/casino/crash" },
      { label: "High — Low", href: "/casino/highlow" },
      { label: "Treasure Hunt", href: "/casino/treasure-hunt" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Provably Fair", href: "/provably-fair" },
      { label: "My NFTs", href: "/my-nfts" },
      { label: "Profile", href: "/profile" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0d1424] border-t border-slate-700/20 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top: Logo + Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-cyan-500/20">
                楽
              </div>
              <span className="text-base font-bold text-slate-50 tracking-tight">
                <span className="text-cyan-400">Oni</span>Games
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              Web3 arcade & casino platform. Play games, earn NFTs, trade on-chain.
              Built on OneChain.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700/20 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} OniGames · Built on OneChain
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://onescan.cc/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
            >
              OneScan ↗
            </a>
            <span className="text-slate-700">·</span>
            <Link
              href="/provably-fair"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
            >
              Provably Fair
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
