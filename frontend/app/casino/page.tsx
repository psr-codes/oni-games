"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCasinoStore } from "@/hooks/useCasinoStore";

import { CASINO_GAMES } from "@/game-store/casino";

export default function CasinoPage() {
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 200;

  const dynamicGames = useMemo(() => {
    const coinFlipBps = Math.floor((20000 * (10000 - houseEdgeBps)) / 10000);
    const coinFlipMult = (coinFlipBps / 10000).toFixed(2);
    
    const hashRouletteBps = Math.floor((40960000 * (10000 - houseEdgeBps)) / 10000);
    const hashRouletteMult = (hashRouletteBps / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 });

    // Dice Roll: max payout at threshold 2 (over) => 98% win chance is wrong, threshold 99 (over) => 1% chance => ~100x
    // Fair mul at 1% = 10000/0.01 = 1000000 bps, after edge
    const diceMaxBps = Math.floor((10000 / 0.01 * (10000 - houseEdgeBps)) / 10000);
    const diceMaxMult = Math.floor(diceMaxBps / 10000);

    // Color: Violet at 10% = 100000 bps, after edge
    const violetBps = Math.floor((100000 * (10000 - houseEdgeBps)) / 10000);
    const violetMult = (violetBps / 10000).toFixed(1);
    const redBps = Math.floor((22222 * (10000 - houseEdgeBps)) / 10000);
    const redMult = (redBps / 10000).toFixed(2);

    return CASINO_GAMES.map(g => {
      if (g.slug === "coin-flip") {
        return {
          ...g,
          description: `Pick heads or tails. Win ${coinFlipMult}× your bet. Instant on-chain result.`,
          multiplier: `${coinFlipMult}×`,
        };
      }
      if (g.slug === "hash-roulette") {
        return {
          ...g,
          description: `Guess the last hex digit(s) of the hash. Up to ${hashRouletteMult}× payout.`,
          multiplier: `Up to ${hashRouletteMult}×`,
        };
      }
      if (g.slug === "dice-roll") {
        return {
          ...g,
          description: `Set your threshold. Roll over or under. Up to ${diceMaxMult}× payout.`,
          multiplier: `Up to ${diceMaxMult}×`,
        };
      }
      if (g.slug === "color-prediction") {
        return {
          ...g,
          description: `Pick Red or Green (${redMult}×) or Violet (${violetMult}×). On-chain instant result.`,
          multiplier: `Up to ${violetMult}×`,
        };
      }
      if (g.slug === "treasure-hunt") {
        // At 1 bomb, max safe is 24 tiles. Fair mult ~25x. Edge drops it slightly.
        // At 6 bombs, max safe is 19 tiles. Fair mult is Choose(25, 19) / Choose(19, 19) = 177,100.
        // So potential multipliers are astronomical, capped only by bankroll.
        return {
          ...g,
          description: `Avoid bombs to grow your multiplier. Cash out anytime.`,
          multiplier: `Up to 25× - 150000×`,
        };
      }
      return g;
    });
  }, [houseEdgeBps]);

  const liveGames = dynamicGames.filter((g) => g.live);
  const comingSoon = dynamicGames.filter((g) => !g.live);

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
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-300 mb-1">How it works</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Casino games use the on-chain <span className="text-slate-200 font-medium">HouseBankroll</span> contract.
              Your wager is sent on-chain, the result is determined by OneChain&apos;s native RNG, and winnings are paid
              out instantly — all in a single transaction. No backend, fully trustless.
            </div>
          </div>
          <Link
            href="/provably-fair"
            className="shrink-0 self-center px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-medium hover:bg-amber-400/20 transition-colors"
          >
            Learn More →
          </Link>
        </div>

        {/* Live Games */}
        {liveGames.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">
              🟢 Live Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {liveGames.map((game) => (
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
                      <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-green-400 border border-green-400/20 z-10">
                        ▶ Play
                      </div>
                      <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-medium text-amber-300 border border-amber-400/20 z-10">
                        {game.multiplier}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-base font-bold text-slate-50 mb-0.5 group-hover:text-amber-400 transition-colors">
                        {game.name}
                      </h3>
                      <p className="text-slate-500 text-[13px] leading-snug mb-3 text-line-clamp-2">
                        {game.description && game.description.length > 60 ? game.description.slice(0, 60) + '...' : game.description}
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
        )}

        {/* Coming Soon */}
        {comingSoon.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              🔜 Coming Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {comingSoon.map((game) => (
                <div
                  key={game.slug}
                  className="bg-[#1a2540]/50 rounded-xl border border-slate-700/15 overflow-hidden opacity-60 h-full flex flex-col"
                >
                  <div
                    className={`h-64 bg-gradient-to-br ${game.color} flex flex-col items-center justify-center relative opacity-50 overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                    {game.image ? (
                      <img 
                        src={game.image} 
                        alt={game.name} 
                        className="w-full h-full object-cover object-top filter drop-shadow-2xl relative z-10" 
                      />
                    ) : (
                      <span className="text-5xl drop-shadow-lg relative z-10">
                        {game.emoji}
                      </span>
                    )}
                    <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-300 border border-white/10 z-10">
                      Coming Soon
                    </div>
                    <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-400 border border-white/10 z-10">
                      {game.multiplier}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base font-bold mb-0.5 text-slate-400">
                      {game.name}
                    </h3>
                    <p className="text-slate-600 text-[13px] leading-snug">
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
