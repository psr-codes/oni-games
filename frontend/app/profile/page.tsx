"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  PACKAGE_ID,
  MODULE,
  PREVIOUS_PACKAGE_IDS,
  GAME_STORE_ID,
  COIN_TYPE,
} from "@/config";
import { GAMES } from "@/game-store/registry";
import { useGameStore } from "@/hooks/useGameStore";

interface ScoreNFT {
  id: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
  isListed?: boolean;
  listingId?: string;
  price?: number;
}

function truncAddr(addr: string) {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
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
  const [delistingId, setDelistingId] = useState<string | null>(null);

  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const { gameStore } = useGameStore();
  const marketFeePercent = gameStore
    ? (gameStore.marketFeeBps / 100).toFixed(1)
    : "...";

  const [sendModal, setSendModal] = useState<ScoreNFT | null>(null);
  const [listModal, setListModal] = useState<ScoreNFT | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const clearStatus = () => setTimeout(() => setTxStatus(null), 6000);

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

      // 1. Fetch owned objects
      const ownedResult = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { MatchAny: structTypes.map((t) => ({ StructType: t })) },
        options: { showContent: true },
      });

      const ownedNfts: ScoreNFT[] = ownedResult.data
        .map((obj) => {
          const fields = (obj.data?.content as any)?.fields;
          if (!fields) return null;
          return {
            id: obj.data?.objectId || "",
            gameId: fields.game_id || "",
            gameName: fields.game_name || GAMES[fields.game_id]?.name || fields.game_id,
            score: Number(fields.score) || 0,
            player: fields.player || "",
            imageUrl: fields.image_url || "",
            mintNumber: Number(fields.mint_number) || 0,
            isListed: false,
          };
        })
        .filter(Boolean) as ScoreNFT[];

      // 2. Fetch listed items where user is seller
      const listQueries = await Promise.all(
        allPackages.map((pid) =>
          suiClient.queryEvents({
            query: { MoveEventType: `${pid}::${MODULE}::NFTListed` },
            order: "descending",
          })
        )
      );
      const allListedEvents = listQueries.flatMap((res) => res.data);
      const myListedEvents = allListedEvents.filter(
        (e: any) => e.parsedJson?.seller?.toLowerCase() === account.address.toLowerCase()
      );

      const listedListingIds = myListedEvents
        .map((e: any) => e.parsedJson?.listing_id)
        .filter(Boolean) as string[];

      let listedNfts: ScoreNFT[] = [];
      if (listedListingIds.length > 0) {
        const objects = await suiClient.multiGetObjects({
          ids: [...new Set(listedListingIds)],
          options: { showContent: true },
        });

        listedNfts = objects
          .map((obj) => {
            if (!obj.data?.content) return null;
            const fields = (obj.data.content as any)?.fields;
            if (!fields) return null;
            const nftFields = fields.nft?.fields;
            if (!nftFields) return null;

            return {
              id: nftFields.id?.id || "",
              gameId: nftFields.game_id || "",
              gameName: nftFields.game_name || GAMES[nftFields.game_id]?.name || nftFields.game_id,
              score: Number(nftFields.score) || 0,
              player: nftFields.player || "",
              imageUrl: nftFields.image_url || "",
              mintNumber: Number(nftFields.mint_number) || 0,
              isListed: true,
              listingId: obj.data.objectId,
              price: Number(fields.price) || 0,
            };
          })
          .filter(Boolean) as ScoreNFT[];
      }

      // 3. Combine and sort
      const combined = [...ownedNfts, ...listedNfts];
      // Sort by score by default as already handled in render/useMemo
      setNfts(combined);
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

  const handleSend = () => {
    if (!sendModal || !recipientAddress) return;
    if (!recipientAddress.startsWith("0x") || recipientAddress.length < 10) {
      setTxStatus({ type: "error", message: "❌ Invalid address format" });
      clearStatus();
      return;
    }

    const tx = new Transaction();
    tx.transferObjects(
      [tx.object(sendModal.id)],
      tx.pure.address(recipientAddress),
    );

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          await suiClient.waitForTransaction({ digest: result.digest });
          setTxStatus({
            type: "success",
            message: `✅ NFT sent! Tx: ${result.digest.slice(0, 12)}...`,
          });
          setSendModal(null);
          setRecipientAddress("");
          clearStatus();
          fetchNFTs();
        },
        onError: (err) => {
          setTxStatus({
            type: "error",
            message: `❌ Transfer failed: ${err.message}`,
          });
          clearStatus();
        },
      },
    );
  };

  const handleList = () => {
    if (!listModal || !listPrice) return;
    const priceNum = parseFloat(listPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setTxStatus({
        type: "error",
        message: "❌ Price must be greater than 0",
      });
      clearStatus();
      return;
    }

    const priceInMist = Math.floor(priceNum * 1_000_000_000);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE}::list_nft_for_sale`,
      arguments: [tx.object(listModal.id), tx.pure.u64(priceInMist)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          await suiClient.waitForTransaction({ digest: result.digest });
          setTxStatus({
            type: "success",
            message: `✅ NFT listed for ${listPrice} OCT! Tx: ${result.digest.slice(0, 12)}...`,
          });
          setListModal(null);
          setListPrice("");
          clearStatus();
          fetchNFTs();
        },
        onError: (err) => {
          setTxStatus({
            type: "error",
            message: `❌ Listing failed: ${err.message}`,
          });
          clearStatus();
        },
      },
    );
  };

  const handleDelist = (listing: ScoreNFT) => {
    if (!listing.listingId) return;
    setDelistingId(listing.listingId);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE}::delist_nft`,
      arguments: [tx.object(listing.listingId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          await suiClient.waitForTransaction({ digest: result.digest });
          setTxStatus({
            type: "success",
            message: `✅ NFT delisted! Returned to your wallet. Tx: ${result.digest.slice(0, 12)}...`,
          });
          clearStatus();
          setDelistingId(null);
          fetchNFTs();
        },
        onError: (err) => {
          setTxStatus({
            type: "error",
            message: `❌ Delisting failed: ${err.message}`,
          });
          clearStatus();
          setDelistingId(null);
        },
      },
    );
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

          {/* Status Toast */}
          {txStatus && (
            <div
              className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
                txStatus.type === "success"
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {txStatus.message}
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
                    className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 group"
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
                      {nft.isListed && (
                        <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-black z-10 shadow-lg border border-emerald-400/20">
                          LISTED • {(Number(nft.price || 0) / 1_000_000_000).toFixed(2)} OCT
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-xs font-bold text-slate-50 truncate mr-1">
                          {nft.gameName}
                        </h3>
                        <span className="text-base font-bold text-transparent bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text shrink-0">
                          {nft.score.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[9px] mb-2">
                        <span className="text-slate-600">Object ID</span>
                        <a
                          href={`https://onescan.cc/testnet/objectDetails?address=${nft.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                        >
                          {nft.id.slice(0, 4)}...{nft.id.slice(-4)}
                        </a>
                      </div>

                      <div className="flex gap-1.5 mt-auto">
                        {nft.isListed ? (
                          <button
                            onClick={() => handleDelist(nft)}
                            disabled={isTxPending || delistingId === nft.listingId}
                            className="flex-1 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-400/20 text-red-400 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                          >
                            {delistingId === nft.listingId ? "Waiting..." : "❌ Delist"}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setSendModal(nft);
                                setListModal(null);
                              }}
                              disabled={isTxPending}
                              className="flex-1 px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-400/20 text-blue-400 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              📤 Send
                            </button>
                            <button
                              onClick={() => {
                                setListModal(nft);
                                setSendModal(null);
                              }}
                              disabled={isTxPending}
                              className="flex-1 px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-400/20 text-emerald-400 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              🏷️ List
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Send Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-[#111a2e]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2540] rounded-2xl border border-slate-700/30 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-50">📤 Send NFT</h3>
              <button
                onClick={() => {
                  setSendModal(null);
                  setRecipientAddress("");
                }}
                className="text-slate-500 hover:text-slate-200 transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#111a2e] rounded-xl p-4 mb-6 border border-slate-700/20">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <div className="text-slate-50 font-bold">
                    {sendModal.gameName}
                  </div>
                  <div className="text-sm text-slate-400">
                    Score: {sendModal.score.toLocaleString()} • Mint #
                    {sendModal.mintNumber}
                  </div>
                </div>
              </div>
            </div>

            <label className="block text-sm text-slate-400 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700/30 rounded-xl px-4 py-3 text-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/40 transition-colors font-mono text-sm mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSendModal(null);
                  setRecipientAddress("");
                }}
                className="flex-1 px-4 py-3 bg-[#111a2e] hover:bg-[#0f1628] text-slate-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isTxPending || !recipientAddress}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {isTxPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Confirm Send"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Modal */}
      {listModal && (
        <div className="fixed inset-0 bg-[#111a2e]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2540] rounded-2xl border border-slate-700/30 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-50">
                🏷️ List on Marketplace
              </h3>
              <button
                onClick={() => {
                  setListModal(null);
                  setListPrice("");
                }}
                className="text-slate-500 hover:text-slate-200 transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#111a2e] rounded-xl p-4 mb-6 border border-slate-700/20">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <div className="text-slate-50 font-bold">
                    {listModal.gameName}
                  </div>
                  <div className="text-sm text-slate-400">
                    Score: {listModal.score.toLocaleString()} • Mint #
                    {listModal.mintNumber}
                  </div>
                </div>
              </div>
            </div>

            <label className="block text-sm text-slate-400 mb-2">
              Price (in OCT)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1.5"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700/30 rounded-xl px-4 py-3 text-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/40 transition-colors mb-2"
            />
            {listPrice &&
              !isNaN(parseFloat(listPrice)) &&
              parseFloat(listPrice) > 0 && (
                <p className="text-xs text-slate-500 mb-4">
                  ≈{" "}
                  {Math.floor(
                    parseFloat(listPrice) * 1_000_000_000,
                  ).toLocaleString()}{" "}
                  MIST
                  <span className="text-slate-600 ml-2">
                    • {marketFeePercent}% marketplace fee on sale
                  </span>
                </p>
              )}
            {(!listPrice || isNaN(parseFloat(listPrice))) && (
              <div className="mb-4" />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setListModal(null);
                  setListPrice("");
                }}
                className="flex-1 px-4 py-3 bg-[#111a2e] hover:bg-[#0f1628] text-slate-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={
                  isTxPending || !listPrice || parseFloat(listPrice) <= 0
                }
                className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {isTxPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Listing...
                  </span>
                ) : (
                  "List for Sale"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
