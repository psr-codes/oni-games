"use client";

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PACKAGE_ID, MODULE, PREVIOUS_PACKAGE_IDS } from "@/config";
import { GAMES } from "@/game-store/registry";

interface ScoreNFT {
  id: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
}

function truncAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type SortMode = "score" | "mint";

export default function ProfilePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [nfts, setNfts] = useState<ScoreNFT[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterGame, setFilterGame] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  const fetchNFTs = useCallback(async () => {
    if (!account?.address) {
      setNfts([]);
      return;
    }
    setLoading(true);
    try {
      const allPackages = [PACKAGE_ID, ...PREVIOUS_PACKAGE_IDS];
      const structTypes = allPackages.map(
        (pid) => `${pid}::${MODULE}::ScoreNFT`,
      );

      const result = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { MatchAny: structTypes.map((t) => ({ StructType: t })) },
        options: { showContent: true },
      });

      const parsed: ScoreNFT[] = result.data
        .map((obj) => {
          const fields = (obj.data?.content as any)?.fields;
          if (!fields) return null;
          return {
            id: obj.data?.objectId || "",
            gameId: fields.game_id || "",
            gameName: fields.game_name || "",
            score: Number(fields.score) || 0,
            player: fields.player || "",
            imageUrl: fields.image_url || "",
            mintNumber: Number(fields.mint_number) || 0,
          };
        })
        .filter(Boolean) as ScoreNFT[];

      parsed.sort((a, b) => b.score - a.score);
      setNfts(parsed);
    } catch (err) {
      console.error("Failed to fetch NFTs:", err);
    } finally {
      setLoading(false);
    }
  }, [account?.address, suiClient]);

  const fetchBalance = useCallback(async () => {
    if (!account?.address) return;
    try {
      const bal = await suiClient.getBalance({ owner: account.address });
      const oct = Number(bal.totalBalance) / 1_000_000_000;
      setBalance(oct.toFixed(4));
    } catch {
      setBalance("—");
    }
  }, [account?.address, suiClient]);

  useEffect(() => {
    fetchNFTs();
    fetchBalance();
  }, [fetchNFTs, fetchBalance]);

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Stats
  const totalNFTs = nfts.length;
  const uniqueGames = useMemo(
    () => new Set(nfts.map((n) => n.gameId)).size,
    [nfts],
  );
  const totalScore = useMemo(
    () => nfts.reduce((sum, n) => sum + n.score, 0),
    [nfts],
  );

  // Per-game counts
  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nfts.forEach((n) => {
      counts[n.gameId] = (counts[n.gameId] || 0) + 1;
    });
    return counts;
  }, [nfts]);

  const gameOptions = useMemo(
    () => Object.keys(gameCounts).sort(),
    [gameCounts],
  );

  // Per-game highest scores
  const gameHighScores = useMemo(() => {
    const map: Record<
      string,
      { gameName: string; score: number; gameId: string; count: number }
    > = {};
    for (const nft of nfts) {
      if (!map[nft.gameId] || nft.score > map[nft.gameId].score) {
        map[nft.gameId] = {
          gameName: nft.gameName,
          score: nft.score,
          gameId: nft.gameId,
          count: gameCounts[nft.gameId] || 0,
        };
      }
    }
    return Object.values(map).sort((a, b) => b.score - a.score);
  }, [nfts, gameCounts]);

  // Filtered + sorted NFTs
  const displayNfts = useMemo(() => {
    let list =
      filterGame === "all"
        ? [...nfts]
        : nfts.filter((n) => n.gameId === filterGame);
    if (sortMode === "score") {
      list.sort((a, b) => b.score - a.score);
    } else {
      list.sort((a, b) => b.mintNumber - a.mintNumber);
    }
    return list;
  }, [nfts, filterGame, sortMode]);

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen bg-[#111a2e] flex items-center justify-center">
        <div className="text-center p-8 bg-[#1a2540] rounded-2xl border border-slate-700/20 max-w-md">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-xl font-bold text-slate-50 mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-slate-400">
            Connect your wallet to view your profile and stats.
          </p>
        </div>
      </div>
    );
  }

  // Avatar gradient from address
  const addrHash = account.address.slice(2, 10);
  const hue1 = parseInt(addrHash.slice(0, 4), 16) % 360;
  const hue2 = (hue1 + 120) % 360;

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-5xl mx-auto px-6">
        {/* Profile Header Card */}
        <div className="bg-[#1a2540] rounded-2xl border border-slate-700/20 p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 50%))`,
              }}
            >
              {account.address.slice(2, 4).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-slate-50 mb-1">
                Player Profile
              </h1>
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <span className="text-slate-400 font-mono text-sm">
                  {truncAddr(account.address)}
                </span>
                <button
                  onClick={copyAddress}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {copied ? "✓ Copied" : "📋"}
                </button>
              </div>

              {/* Balance */}
              {balance && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#111a2e] rounded-lg border border-slate-700/20 text-sm">
                  <span className="text-slate-500">Balance:</span>
                  <span className="text-slate-200 font-bold">
                    {balance} OCT
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 shrink-0">
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {totalNFTs}
                </div>
                <div className="text-xs text-slate-500">NFTs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {uniqueGames}
                </div>
                <div className="text-xs text-slate-500">Games</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {totalScore >= 1000
                    ? `${(totalScore / 1000).toFixed(1)}K`
                    : totalScore}
                </div>
                <div className="text-xs text-slate-500">Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game High Scores */}
        {gameHighScores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-50 mb-4">
              🏅 Highest Scores
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameHighScores.map((gs) => {
                const meta = GAMES[gs.gameId];
                const color = meta?.color || "from-slate-500 to-slate-600";
                const emoji = meta?.emoji || "🎯";
                return (
                  <Link
                    key={gs.gameId}
                    href={`/games/${gs.gameId}`}
                    className="group"
                  >
                    <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 p-4 flex items-center gap-4 hover:border-cyan-400/20 transition-colors">
                      <div
                        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-2xl shrink-0`}
                      >
                        {emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-50 group-hover:text-cyan-400 transition-colors">
                          {gs.gameName}
                        </div>
                        <div className="text-xs text-slate-500">
                          Best Score · {gs.count} NFT{gs.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-cyan-400">
                        {gs.score.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Trophy Room */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-50">🏆 Trophy Room</h2>
            {/* Sort */}
            {nfts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Sort:</span>
                <button
                  onClick={() => setSortMode("score")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    sortMode === "score"
                      ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                      : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                  }`}
                >
                  By Score
                </button>
                <button
                  onClick={() => setSortMode("mint")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    sortMode === "mint"
                      ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                      : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                  }`}
                >
                  By Mint #
                </button>
              </div>
            )}
          </div>

          {/* Filter bar */}
          {gameOptions.length > 0 && (
            <div className="mb-5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-500">Filter:</span>
              <button
                onClick={() => setFilterGame("all")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterGame === "all"
                    ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                    : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                }`}
              >
                All ({nfts.length})
              </button>
              {gameOptions.map((gameId) => {
                const meta = GAMES[gameId];
                return (
                  <button
                    key={gameId}
                    onClick={() => setFilterGame(gameId)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                      filterGame === gameId
                        ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                        : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                    }`}
                  >
                    {meta?.emoji || ""} {meta?.name || gameId} (
                    {gameCounts[gameId]})
                  </button>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Loading trophies...
              </div>
            </div>
          )}

          {!loading && nfts.length === 0 && (
            <div className="text-center py-16 bg-[#1a2540] rounded-2xl border border-slate-700/20">
              <div className="text-5xl mb-4">🎮</div>
              <h3 className="text-lg font-bold text-slate-50 mb-2">
                No Trophies Yet
              </h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Play games and mint your scores as NFTs to fill your trophy
                room!
              </p>
              <Link
                href="/games"
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-medium hover:from-cyan-400 hover:to-teal-400 transition-all"
              >
                🕹️ Play Games
              </Link>
            </div>
          )}

          {/* Filtered empty */}
          {!loading && nfts.length > 0 && displayNfts.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-400">
                No trophies found for &quot;{filterGame}&quot;.
              </p>
            </div>
          )}

          {!loading && displayNfts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayNfts.map((nft) => {
                const meta = GAMES[nft.gameId];
                const color = meta?.color || "from-slate-500 to-slate-600";
                const emoji = meta?.emoji || "🏆";
                return (
                  <div
                    key={nft.id}
                    className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 transition-all group"
                  >
                    <div
                      className={`h-48 bg-gradient-to-br ${color} flex flex-col items-center justify-center relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                      {meta?.image ? (
                        <img
                          src={meta.image}
                          alt={nft.gameName}
                          className="w-full h-full object-cover object-top filter drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform relative z-10">
                          {emoji}
                        </span>
                      )}
                      {/* Mint number badge */}
                      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/20 z-10 shadow-lg">
                        #{nft.mintNumber}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-xs font-bold text-slate-50 truncate mr-1">
                          {nft.gameName}
                        </h3>
                        <span className="text-base font-bold text-cyan-400 shrink-0">
                          {nft.score.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500">Score Badge</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
