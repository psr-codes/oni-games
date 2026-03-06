"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGameStore } from "@/hooks/useGameStore";
import { GAMES_LIST } from "@/game-store/registry";

export default function Home() {
  const account = useCurrentAccount();
  const { gameStore, isPending } = useGameStore();

  const games = GAMES_LIST;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden pt-24 pb-32">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-gray-950 to-gray-950" />
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-pink-500/8 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block px-4 py-1.5 mb-8 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm font-medium">
            ⛓️ Built on OneChain • Score NFTs • On-Chain Leaderboards
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
            Play. Score. Mint.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600">
              Own Your Dominance.
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Retro arcade games meet Web3. Every high score becomes an NFT.
            Compete on immutable leaderboards. Trade your achievements.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/games"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-2xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-xl shadow-purple-900/40"
            >
              🎮 Start Playing
            </Link>
            <Link
              href="/leaderboard"
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-gray-200 rounded-2xl font-bold text-lg transition-all border border-gray-800 hover:border-purple-500/30"
            >
              🏆 View Leaderboards
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-y border-gray-800/50 bg-gray-900/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white">
              {isPending ? "—" : (gameStore?.totalMinted ?? 0)}
            </div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mt-1">
              NFTs Minted
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {GAMES_LIST.length}
            </div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mt-1">
              Games
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">~1s</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mt-1">
              Finality
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">100%</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mt-1">
              On-Chain
            </div>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">🎮 Arcade Games</h2>
            <p className="text-gray-400">
              Pick a game. Beat the leaderboard. Mint your score as an NFT.
            </p>
          </div>
          {!account && (
            <span className="text-purple-400 text-sm font-medium border border-purple-500/30 bg-purple-500/10 px-4 py-2 rounded-xl">
              Connect wallet to play →
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="group"
            >
              <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-900/10 transition-all duration-300 h-full flex flex-col">
                {/* Card Header */}
                <div
                  className={`h-40 bg-gradient-to-br ${game.color} flex items-center justify-center relative group-hover:scale-[1.02] transition-transform duration-500`}
                >
                  <span className="text-6xl group-hover:scale-110 transition-transform drop-shadow-lg">
                    {game.emoji}
                  </span>
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-white/80 border border-white/10">
                    Score NFT
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">
                    {game.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {game.description}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-600">OneChain</span>
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

      {/* How It Works */}
      <div className="bg-gray-900/50 py-24 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                className="p-6 bg-gray-950 rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400 text-sm font-bold">
                  {item.step}
                </div>
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-white">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span className="text-lg">鬼</span>
            <span>Oni Games — Built on OneChain</span>
          </div>
          <div className="flex gap-6 text-gray-500 text-sm">
            <a
              href="https://onescan.cc/testnet"
              target="_blank"
              rel="noopener"
              className="hover:text-purple-400 transition-colors"
            >
              Explorer
            </a>
            <a
              href="https://onechain.org"
              target="_blank"
              rel="noopener"
              className="hover:text-purple-400 transition-colors"
            >
              OneChain
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
