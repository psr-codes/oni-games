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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {GAMES_LIST.map((game) => (
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
                    <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-green-400 border border-green-400/20 z-10 shadow-lg">
                      ▶ Play
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base font-bold text-slate-50 mb-0.5 group-hover:text-cyan-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-slate-500 text-[13px] leading-snug mb-3">
                      {game.description}
                    </p>
                    <div className="mt-auto pt-2 border-t border-slate-700/20 flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 bg-[#111a2e] px-2 py-0.5 rounded-full border border-slate-700/20">
                        Score NFT
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
                  className={`h-56 bg-gradient-to-br ${game.color} flex items-center justify-center relative opacity-50 overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                  <span className="text-5xl drop-shadow-lg relative z-10">{game.emoji}</span>
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-300 border border-white/10 z-10 shadow-lg">
                    Coming Soon
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-base font-bold mb-0.5 text-slate-400">
                    {game.name}
                  </h3>
                  <p className="text-slate-600 text-[13px] leading-snug">{game.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
