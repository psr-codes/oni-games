import { WHITEPAPER_URL } from "@/game-store/data";
import Link from "next/link";

const ARCADE_GAMES = [
  { label: "Poly Dash", href: "/games/poly-dash" },
  { label: "Tetris", href: "/games/tetris" },
  { label: "Space Invaders", href: "/games/space-invaders" },
  { label: "Neon Snake", href: "/games/snake" },
  { label: "2048", href: "/games/2048" },
];

const CASINO_GAMES = [
  { label: "Coin Flip", href: "/casino/coin-flip" },
  { label: "Hash Roulette", href: "/casino/hash-roulette" },
  { label: "Dice Roll", href: "/casino/dice-roll" },
  { label: "Crypto Crash", href: "/casino/crash" },
  { label: "Treasure Hunt", href: "/casino/treasure-hunt" },
];

const PLATFORM_LINKS = [
  { label: "Home", href: "/" },
  { label: "Play Games", href: "/games" },
  { label: "Casino", href: "/casino" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Leaderboard", href: "/leaderboard" },
];

const RESOURCE_LINKS = [
  { label: "About", href: "/about" },
  {
    label: "Whitepaper",
    href: WHITEPAPER_URL,
  },
  { label: "Provably Fair", href: "/provably-fair" },
  { label: "Contact →", href: "/contact" },
];

const GAME_PORTAL_CONTRACT =
  "0x9648be59effa27966ee8cc0a531cdefac977bb6444dcf5df96c37304eefa46b3";
const HOUSE_BANKROLL_CONTRACT =
  "0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Footer() {
  return (
    <footer className="bg-[#0d1424] border-t border-slate-700/20 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top: Logo + Columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-cyan-500/20">
                楽
              </div>
              <span className="text-base font-bold text-slate-50 tracking-tight">
                <span className="text-cyan-400">Oni</span>Games
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              Web3 arcade &amp; casino platform. Play games, earn NFTs, trade
              on-chain. Built on OneChain.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5">
              {PLATFORM_LINKS.map((link) => (
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

          {/* Arcade Games */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Arcade Games
            </h4>
            <ul className="space-y-2.5">
              {ARCADE_GAMES.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-cyan-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/games"
                  className="text-sm text-cyan-500/70 hover:text-cyan-400 transition-colors font-medium"
                >
                  More Games →
                </Link>
              </li>
            </ul>
          </div>

          {/* Casino Games */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Casino Games
            </h4>
            <ul className="space-y-2.5">
              {CASINO_GAMES.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-amber-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/casino"
                  className="text-sm text-amber-500/70 hover:text-amber-400 transition-colors font-medium"
                >
                  More Casino →
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.label === "Whitepaper" ? "_blank" : "_self"}
                    className={`text-sm transition-colors hover:text-cyan-400 ${
                      link.href === "/contact"
                        ? "font-bold text-orange-400"
                        : "text-slate-500"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider + Bottom bar */}
        <div className="border-t border-slate-700/20 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} OniGames · Built on OneChain
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://onescan.cc/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
            >
              OneScan ↗
            </a>
            <span className="text-slate-700">·</span>
            <a
              href={`https://onescan.cc/testnet/object/${GAME_PORTAL_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors font-mono"
              title={`Game Portal Contract: ${GAME_PORTAL_CONTRACT}`}
            >
              Game Portal {truncate(GAME_PORTAL_CONTRACT)} ↗
            </a>
            <span className="text-slate-700">·</span>
            <a
              href={`https://onescan.cc/testnet/object/${HOUSE_BANKROLL_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors font-mono"
              title={`House Bankroll Contract: ${HOUSE_BANKROLL_CONTRACT}`}
            >
              House Bankroll {truncate(HOUSE_BANKROLL_CONTRACT)} ↗
            </a>
            <span className="text-slate-700">·</span>
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
            >
              Whitepaper ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
