"use client";

import Link from "next/link";

const CASINO_GAMES = [
  {
    slug: "coin-flip",
    name: "Coin Flip",
    emoji: "🪙",
    color: "from-amber-400 to-yellow-600",
    description: "Pick heads or tails. Win 1.96× your bet. Instant on-chain result.",
    multiplier: "1.96×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "hash-roulette",
    name: "Hash Roulette",
    emoji: "🔮",
    color: "from-violet-500 to-indigo-700",
    description: "Guess the last hex digit(s) of the hash. Up to 4014× payout.",
    multiplier: "Up to 4014×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "roulette",
    name: "Roulette",
    emoji: "🎡",
    color: "from-red-500 to-rose-700",
    description: "Place your bets on red, black, or a number. Classic casino action.",
    multiplier: "Up to 36×",
    type: "Instant Play",
    live: false,
  },
  {
    slug: "crash",
    name: "Crash",
    emoji: "📈",
    color: "from-green-400 to-emerald-600",
    description: "Watch the multiplier rise. Cash out before it crashes. How far do you dare?",
    multiplier: "∞×",
    type: "Session",
    live: false,
  },
];

export default function CasinoPage() {
  const liveGames = CASINO_GAMES.filter((g) => g.live);
  const comingSoon = CASINO_GAMES.filter((g) => !g.live);

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-50">
              🎰 Casino Games
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-400/20">
              GambleFi
            </span>
          </div>
          <p className="text-slate-400">
            Wager OCT, bet on outcomes. Provably fair with on-chain RNG.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <div className="text-sm font-medium text-amber-300 mb-1">How it works</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Casino games use the on-chain <span className="text-slate-200 font-medium">HouseBankroll</span> contract.
              Your wager is sent on-chain, the result is determined by OneChain&apos;s native RNG, and winnings are paid
              out instantly — all in a single transaction. No backend, fully trustless.
            </div>
          </div>
        </div>

        {/* Live Games */}
        {liveGames.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">
              🟢 Live Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveGames.map((game) => (
                <Link
                  key={game.slug}
                  href={`/casino/${game.slug}`}
                  className="group"
                >
                  <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-amber-400/20 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 h-full flex flex-col">
                    <div
                      className={`h-36 bg-gradient-to-br ${game.color} flex items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500`}
                    >
                      <span className="text-5xl group-hover:scale-110 transition-transform drop-shadow-lg">
                        {game.emoji}
                      </span>
                      <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-green-400/20">
                        ▶ Play
                      </div>
                      <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-amber-300 border border-amber-400/20">
                        {game.multiplier}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-50 mb-1 group-hover:text-amber-400 transition-colors">
                        {game.name}
                      </h3>
                      <p className="text-slate-500 text-sm mb-4">
                        {game.description}
                      </p>
                      <div className="mt-auto pt-3 border-t border-slate-700/20 flex items-center justify-between">
                        <span className="text-xs text-slate-600 bg-[#111a2e] px-3 py-1 rounded-full border border-slate-700/20">
                          {game.type}
                        </span>
                        <span className="text-amber-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          Play Now →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Coming Soon */}
        {comingSoon.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              🔜 Coming Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {comingSoon.map((game) => (
                <div
                  key={game.slug}
                  className="bg-[#1a2540]/50 rounded-xl border border-slate-700/15 overflow-hidden opacity-60 h-full flex flex-col"
                >
                  <div
                    className={`h-36 bg-gradient-to-br ${game.color} flex items-center justify-center relative opacity-50`}
                  >
                    <span className="text-5xl drop-shadow-lg">
                      {game.emoji}
                    </span>
                    <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs text-slate-300 border border-white/10">
                      Coming Soon
                    </div>
                    <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs text-slate-400 border border-white/10">
                      {game.multiplier}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold mb-1 text-slate-400">
                      {game.name}
                    </h3>
                    <p className="text-slate-600 text-sm">
                      {game.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
