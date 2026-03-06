"use client";

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PACKAGE_ID, MODULE } from "@/config";
import { GAMES } from "@/game-store/registry";

interface LeaderboardEntry {
  nftId: string;
  gameId: string;
  player: string;
  score: number;
  mintNumber: number;
}

// Game colors for visual flair
const GAME_COLORS: Record<string, string> = {
  tetris: "from-cyan-500 to-blue-600",
  "space-invaders": "from-green-400 to-emerald-600",
  snake: "from-lime-500 to-green-600",
  "2048": "from-amber-500 to-orange-600",
  "bubble-pop": "from-pink-400 to-rose-600",
  "doodle-jump": "from-green-400 to-lime-500",
};

const RANK_STYLES: Record<number, { bg: string; text: string; glow: string }> =
  {
    1: {
      bg: "bg-gradient-to-r from-yellow-900/40 to-amber-900/20",
      text: "text-yellow-400",
      glow: "shadow-yellow-500/20",
    },
    2: {
      bg: "bg-gradient-to-r from-gray-600/30 to-gray-700/10",
      text: "text-gray-300",
      glow: "shadow-gray-400/10",
    },
    3: {
      bg: "bg-gradient-to-r from-orange-900/30 to-amber-900/10",
      text: "text-orange-400",
      glow: "shadow-orange-500/10",
    },
  };

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function truncAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function LeaderboardPage() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<string>("all");

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // Query all ScoreMinted events
      const events = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::ScoreMinted` },
        order: "descending",
        limit: 200,
      });

      const parsed: LeaderboardEntry[] = events.data
        .map((e: any) => {
          const j = e.parsedJson;
          if (!j) return null;
          return {
            nftId: j.nft_id || "",
            gameId: j.game_id || "",
            player: j.player || "",
            score: Number(j.score) || 0,
            mintNumber: Number(j.mint_number) || 0,
          };
        })
        .filter(Boolean) as LeaderboardEntry[];

      setEntries(parsed);
    } catch (err) {
      console.error("[leaderboard] Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Filter by game and sort by score descending
  const ranked = useMemo(() => {
    const filtered =
      activeGame === "all"
        ? entries
        : entries.filter((e) => e.gameId === activeGame);

    return [...filtered].sort((a, b) => b.score - a.score);
  }, [entries, activeGame]);

  // Get unique game IDs present in entries
  const gamesWithScores = useMemo(() => {
    const ids = new Set(entries.map((e) => e.gameId));
    return Array.from(ids);
  }, [entries]);

  // Count entries per game (for badges)
  const gameCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) {
      m[e.gameId] = (m[e.gameId] || 0) + 1;
    }
    return m;
  }, [entries]);

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-3">
              🏆 Leaderboard
            </h1>
            <p className="text-gray-400 text-lg">
              Top scores across all games, recorded on-chain forever.
            </p>
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="mt-1 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-all disabled:opacity-50"
          >
            {loading ? "⟳ Loading…" : "⟳ Refresh"}
          </button>
        </div>

        {/* Game Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveGame("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              activeGame === "all"
                ? "bg-purple-600/30 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-900/20"
                : "bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            🎮 All Games
            <span className="ml-1.5 text-xs opacity-60">
              ({entries.length})
            </span>
          </button>
          {gamesWithScores.map((gid) => {
            const meta = GAMES[gid];
            const emoji = meta?.emoji || "🎯";
            const name = meta?.name || gid;
            const count = gameCountMap[gid] || 0;
            const isActive = activeGame === gid;
            return (
              <button
                key={gid}
                onClick={() => setActiveGame(gid)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  isActive
                    ? "bg-purple-600/30 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-900/20"
                    : "bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {emoji} {name}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Leaderboard Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-gray-900/50 rounded-xl animate-pulse border border-gray-800/50"
              />
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <div className="text-5xl mb-4">🏗️</div>
            <h2 className="text-xl font-bold text-white mb-2">No Scores Yet</h2>
            <p className="text-gray-500">
              Play a game and mint your score as an NFT to appear here!
            </p>
          </div>
        ) : (
          <div className="bg-gray-900/40 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[60px_1fr_1fr_120px_80px] md:grid-cols-[60px_1fr_1fr_140px_100px] px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800/50 bg-gray-900/60">
              <span>Rank</span>
              <span>Player</span>
              <span>Game</span>
              <span className="text-right">Score</span>
              <span className="text-right">NFT</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800/30">
              {ranked.map((entry, idx) => {
                const rank = idx + 1;
                const isUser =
                  account?.address &&
                  entry.player.toLowerCase() === account.address.toLowerCase();
                const rankStyle = RANK_STYLES[rank];
                const meta = GAMES[entry.gameId];
                const emoji = meta?.emoji || "🎯";
                const gameName = meta?.name || entry.gameId;
                const colorClass =
                  GAME_COLORS[entry.gameId] || "from-gray-500 to-gray-600";

                return (
                  <div
                    key={`${entry.player}-${entry.gameId}-${entry.mintNumber}`}
                    className={`grid grid-cols-[60px_1fr_1fr_120px_80px] md:grid-cols-[60px_1fr_1fr_140px_100px] px-4 py-3 items-center transition-colors ${
                      rankStyle?.bg || "hover:bg-gray-800/30"
                    } ${isUser ? "ring-1 ring-purple-500/30 bg-purple-900/10" : ""} ${
                      rankStyle ? `shadow-sm ${rankStyle.glow}` : ""
                    }`}
                  >
                    {/* Rank */}
                    <span
                      className={`font-bold text-lg ${rankStyle?.text || "text-gray-500"}`}
                    >
                      {rank <= 3 ? RANK_MEDALS[rank - 1] : rank}
                    </span>

                    {/* Player */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm ${isUser ? "text-purple-300 font-semibold" : "text-gray-300"}`}
                      >
                        {truncAddr(entry.player)}
                      </span>
                      {isUser && (
                        <span className="text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Game */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-md bg-gradient-to-br ${colorClass} flex items-center justify-center text-xs`}
                      >
                        {emoji}
                      </span>
                      <span className="text-sm text-gray-300 hidden md:inline">
                        {gameName}
                      </span>
                    </div>

                    {/* Score */}
                    <span
                      className={`text-right font-bold tabular-nums ${
                        rank === 1
                          ? "text-yellow-400 text-lg"
                          : rank <= 3
                            ? "text-white"
                            : "text-gray-300"
                      }`}
                    >
                      {entry.score.toLocaleString()}
                    </span>

                    {/* NFT Link */}
                    <span className="text-right">
                      <a
                        href={`https://onescan.cc/testnet/objectDetails?address=${entry.nftId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View →
                      </a>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 text-xs text-gray-600 border-t border-gray-800/50 bg-gray-900/60 text-center">
              Showing {ranked.length} score{ranked.length !== 1 ? "s" : ""} ·
              Data sourced from on-chain events
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {!loading && entries.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {entries.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Total Mints</div>
            </div>
            <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {new Set(entries.map((e) => e.player)).size}
              </div>
              <div className="text-xs text-gray-500 mt-1">Unique Players</div>
            </div>
            <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {gamesWithScores.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Games Played</div>
            </div>
            <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {ranked.length > 0 ? ranked[0].score.toLocaleString() : "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {activeGame === "all"
                  ? "Top Score"
                  : `Top ${GAMES[activeGame]?.name || activeGame}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
