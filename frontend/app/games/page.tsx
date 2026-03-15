"use client";

import Link from "next/link";
import { GAMES_LIST } from "@/game-store/registry";

export default function GamesPage() {
  const comingSoon = [
    {
      name: "Flappy Bird",
      slug: "flappy-bird",
      emoji: "🐦",
      color: "from-yellow-400 to-green-500",
      description: "Tap to fly through tight gaps between pipes",
    },
    {
      name: "Breakout",
      slug: "breakout",
      emoji: "🏓",
      color: "from-red-500 to-rose-600",
      description: "Bounce the ball to smash all the bricks",
    },
  ];

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">
            🎮 Arcade Games
          </h1>
          <p className="text-slate-400">
            Pick your game, compete for the top, and mint your score as an NFT.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "Puzzle", "Platformer", "Shooter", "Strategy"].map(
            (cat, i) => (
              <button
                key={cat}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  i === 0
                    ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                    : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:border-cyan-400/15 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ),
          )}
        </div>

        {/* Playable Games */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">
            🟢 Playable Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {GAMES_LIST.map((game) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="group"
              >
                <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 h-full flex flex-col">
                  <div
                    className={`h-36 bg-gradient-to-br ${game.color} flex items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500`}
                  >
                    <span className="text-5xl group-hover:scale-110 transition-transform drop-shadow-lg">
                      {game.emoji}
                    </span>
                    <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-green-400/20">
                      ▶ Play
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-50 mb-1 group-hover:text-cyan-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">
                      {game.description}
                    </p>
                    <div className="mt-auto pt-3 border-t border-slate-700/20 flex items-center justify-between">
                      <span className="text-xs text-slate-600 bg-[#111a2e] px-3 py-1 rounded-full border border-slate-700/20">
                        Score NFT
                      </span>
                      <span className="text-cyan-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        Play Now →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Coming Soon */}
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
                  <span className="text-5xl drop-shadow-lg">{game.emoji}</span>
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs text-slate-300 border border-white/10">
                    Coming Soon
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold mb-1 text-slate-400">
                    {game.name}
                  </h3>
                  <p className="text-slate-600 text-sm">{game.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
