"use client";

import Link from "next/link";
import { GAMES_LIST } from "@/game-store/registry";

export default function GamesPage() {
  // Placeholder games that aren't built yet
  const comingSoon = [
    {
      name: "Snake",
      slug: "snake",
      emoji: "🐍",
      color: "from-green-500 to-emerald-600",
      description: "Grow your snake endlessly without hitting walls",
    },
    {
      name: "2048",
      slug: "2048",
      emoji: "🔢",
      color: "from-amber-500 to-orange-600",
      description: "Merge tiles strategically to reach the legendary 2048",
    },
    {
      name: "Flappy Bird",
      slug: "flappy-bird",
      emoji: "🐦",
      color: "from-yellow-400 to-green-500",
      description: "Tap to fly through tight gaps between pipes",
    },
    {
      name: "Space Invaders",
      slug: "space-invaders",
      emoji: "👾",
      color: "from-purple-500 to-pink-600",
      description: "Defend earth from waves of descending aliens",
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
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            🎮 Arcade Games
          </h1>
          <p className="text-gray-400 text-lg">
            Pick your game, compete for the top, and mint your score as an NFT.
          </p>
        </div>

        {/* Playable Games */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4">
            🟢 Playable Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {GAMES_LIST.map((game) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="group"
              >
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-900/10 transition-all duration-300 h-full flex flex-col">
                  <div
                    className={`h-40 bg-gradient-to-br ${game.color} flex items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500`}
                  >
                    <span className="text-6xl group-hover:scale-110 transition-transform drop-shadow-lg">
                      {game.emoji}
                    </span>
                    <div className="absolute top-4 right-4 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-green-500/30">
                      ▶ Play
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">
                      {game.description}
                    </p>
                    <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-xs text-gray-600 bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
                        Score NFT
                      </span>
                      <span className="text-purple-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
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
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            🔜 Coming Soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoon.map((game) => (
              <div
                key={game.slug}
                className="bg-gray-900/50 rounded-2xl border border-gray-800/50 overflow-hidden opacity-60 h-full flex flex-col"
              >
                <div
                  className={`h-40 bg-gradient-to-br ${game.color} flex items-center justify-center relative opacity-50`}
                >
                  <span className="text-6xl drop-shadow-lg">{game.emoji}</span>
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs text-gray-300 border border-white/10">
                    Coming Soon
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold mb-2 text-gray-400">
                    {game.name}
                  </h3>
                  <p className="text-gray-600 text-sm">{game.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
