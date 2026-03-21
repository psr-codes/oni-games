"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGameStore } from "@/hooks/useGameStore";
import { GAMES_LIST, GAMES } from "@/game-store/registry";
import { CASINO_GAMES } from "@/game-store/casino";

const POPULAR_SLUGS = ["poly-dash", "doodle-jump", "2048", "space-invaders"];
const TOP_CASINO_SLUGS = ["crash", "dice-roll", "highlow", "hash-roulette"];

export default function Home() {
  const account = useCurrentAccount();
  const { gameStore, isPending } = useGameStore();
  const games = GAMES_LIST;
  const featured = games[0]; // Poly Dash

  return (
    <div className="min-h-screen bg-[#111a2e] text-slate-50">
      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-24">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/15 via-[#111a2e] to-[#111a2e]" />
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block px-4 py-1.5 mb-8 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-400 text-sm font-medium">
            ⛓️ Built on OneChain • Score NFTs • On-Chain Leaderboards
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
            Play. Score. Mint.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-violet-400">
              Built on OneChain.
            </span>
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Retro arcade and provably fair casino games meet Web3. Every high
            score becomes an NFT. Compete on immutable leaderboards. Trade your
            achievements.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/games"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white rounded-2xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-xl shadow-cyan-500/25"
            >
              🎮 Start Playing
            </Link>
            <Link
              href="/leaderboard"
              className="px-8 py-4 bg-[#1a2540] hover:bg-[#1f2d4d] text-slate-200 rounded-2xl font-bold text-lg transition-all border border-slate-700/30 hover:border-cyan-400/20"
            >
              🏆 View Leaderboards
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-y border-slate-700/20 bg-[#1a2540]/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            {
              icon: "⚡",
              value: isPending ? "—" : (gameStore?.totalMinted ?? 0),
              label: "NFTs Minted",
            },
            { icon: "🎮", value: GAMES_LIST.length, label: "Games" },
            { icon: "⏱️", value: "~1s", label: "Finality" },
            { icon: "🔗", value: "100%", label: "On-Chain" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#1a2540] rounded-xl border border-slate-700/20 p-4 text-center hover:border-cyan-400/15 transition-colors"
            >
              <div className="text-lg mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-slate-50">
                {stat.value}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Game */}
      {featured && (
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-4">
          <Link href={`/games/${featured.slug}`} className="group block">
            <div
              className={`relative h-56 md:h-64 rounded-2xl bg-gradient-to-br ${featured.color} overflow-hidden border border-slate-700/20 hover:border-cyan-400/20 transition-all shadow-lg`}
            >
              <div className="absolute inset-0 bg-black/20" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <div className="flex gap-2 mb-3">
                  <span className="px-3 py-1 bg-green-500/20 backdrop-blur-md text-green-400 text-xs font-bold rounded-full border border-green-400/20">
                    🟢 Game of the Day
                  </span>
                  <span className="px-3 py-1 bg-black/20 backdrop-blur-md text-slate-300 text-xs rounded-full border border-white/10">
                    Platformer
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
                  {featured.name}
                </h2>
                <p className="text-white/80 text-sm mb-4 max-w-md">
                  {featured.description}. Mint your high scores as NFT badges.
                </p>
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-black/30 backdrop-blur-md text-white rounded-xl text-sm font-bold border border-white/10 w-fit group-hover:bg-white/10 transition-colors">
                  ▶ Play Now
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Games Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-50 mb-1">
              Popular Games
            </h2>
            <p className="text-slate-400 text-sm">
              Pick a game. Beat the leaderboard. Mint your score as an NFT.
            </p>
          </div>
          <Link
            href="/games"
            className="text-cyan-400 text-sm font-medium hover:text-cyan-300 transition-colors"
          >
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {POPULAR_SLUGS.map((slug) => GAMES[slug])
            .filter(Boolean)
            .map((game) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="group"
              >
                <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 h-full flex flex-col">
                  <div
                    className={`h-64 bg-gradient-to-br ${game.color} flex flex-col items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                    {game.image ? (
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full object-cover object-top filter drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-5xl group-hover:scale-110 transition-transform drop-shadow-lg relative z-10">
                        {game.emoji}
                      </span>
                    )}
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-white/80 border border-white/20 z-10 shadow-lg">
                      Score NFT
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base font-bold text-slate-50 mb-0.5 group-hover:text-cyan-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-slate-500 text-[13px] leading-snug mb-3">
                      {game.description && game.description.length > 60
                        ? game.description.slice(0, 60) + "..."
                        : game.description}
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-700/20 flex items-center justify-between">
                      <span className="text-[10px] text-slate-600">
                        OneChain
                      </span>
                      <span className="text-cyan-400 text-[13px] font-medium group-hover:translate-x-1 transition-transform">
                        Play Now →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>

        {/* Casino Row */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 mt-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-50 mb-1">
              Top Casino Games
            </h2>
            <p className="text-slate-400 text-sm">
              Instant payouts. Provably fair. No backend. Wait for nothing.
            </p>
          </div>
          <Link
            href="/casino"
            className="text-amber-400 text-sm font-medium hover:text-amber-300 transition-colors"
          >
            Enter Casino →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {TOP_CASINO_SLUGS.map(
            (slug) => CASINO_GAMES.find((g) => g.slug === slug)!,
          )
            .filter(Boolean)
            .map((game) => (
              <Link
                key={game.slug}
                href={`/casino/${game.slug}`}
                className="group"
              >
                <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-amber-400/20 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 h-full flex flex-col">
                  <div
                    className={`h-64 bg-gradient-to-br ${game.color} flex flex-col items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                    {game.image ? (
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-full h-full object-cover object-top filter drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-5xl group-hover:scale-110 transition-transform drop-shadow-lg relative z-10">
                        {game.emoji}
                      </span>
                    )}
                    <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-medium text-amber-300 border border-amber-400/20 z-10 shadow-lg">
                      {game.multiplier}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base font-bold text-slate-50 mb-0.5 group-hover:text-amber-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-slate-500 text-[13px] leading-snug mb-3">
                      {game.description && game.description.length > 60
                        ? game.description.slice(0, 60) + "..."
                        : game.description}
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-700/20 flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 bg-[#111a2e] px-2 py-0.5 rounded-full border border-slate-700/20">
                        {game.type}
                      </span>
                      <span className="text-amber-400 text-[13px] font-medium group-hover:translate-x-1 transition-transform">
                        Play Now →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-[#1a2540]/40 py-20 border-t border-slate-700/15">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-50 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                icon: "🔗",
                title: "Connect",
                desc: "Link your OneWallet to get started",
              },
              {
                step: "2",
                icon: "🎮",
                title: "Play",
                desc: "Choose a game and go for the high score",
              },
              {
                step: "3",
                icon: "🏆",
                title: "Mint",
                desc: "Turn your score into an NFT on OneChain",
              },
              {
                step: "4",
                icon: "💰",
                title: "Trade",
                desc: "Buy, sell, or show off your score NFTs",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 bg-[#1a2540] rounded-xl border border-slate-700/20 hover:border-cyan-400/15 transition-colors"
              >
                <div className="w-8 h-8 bg-cyan-400/10 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-400 text-sm font-bold border border-cyan-400/20">
                  {item.step}
                </div>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-base font-bold mb-1 text-slate-50">
                  {item.title}
                </h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
