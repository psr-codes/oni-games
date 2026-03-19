"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PACKAGE_ID, MODULE, GAME_STORE_ID, COIN_TYPE, PREVIOUS_PACKAGE_IDS } from "@/config";
import { useGameStore } from "@/hooks/useGameStore";
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

export default function MyNFTsPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const { gameStore } = useGameStore();
  const marketFeePercent = gameStore
    ? (gameStore.marketFeeBps / 100).toFixed(1)
    : "...";
  const [nfts, setNfts] = useState<ScoreNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterGame, setFilterGame] = useState<string>("all");

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
      const structTypes = allPackages.map((pid) => `${pid}::${MODULE}::ScoreNFT`);

      const result = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { MatchAny: structTypes.map((t) => ({ StructType: t })) },
        options: { showContent: true, showDisplay: true },
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

      parsed.sort((a, b) => b.mintNumber - a.mintNumber);
      setNfts(parsed);
    } catch (err) {
      console.error("Failed to fetch NFTs:", err);
    } finally {
      setLoading(false);
    }
  }, [account?.address, suiClient]);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  // Derived data
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

  const filtered = useMemo(
    () =>
      filterGame === "all"
        ? nfts
        : nfts.filter((n) => n.gameId === filterGame),
    [nfts, filterGame],
  );

  const highestScore = useMemo(
    () => (nfts.length > 0 ? Math.max(...nfts.map((n) => n.score)) : 0),
    [nfts],
  );

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

  if (!account?.address) {
    return (
      <div className="min-h-screen bg-[#111a2e] flex items-center justify-center">
        <div className="text-center p-8 bg-[#1a2540] rounded-2xl border border-slate-700/20 max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-50 mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-slate-400">
            Connect your wallet to view your Score NFTs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">🏆 My NFTs</h1>
          <p className="text-slate-400">
            Your on-chain score collection —{" "}
            <span className="text-cyan-400 font-medium">
              {nfts.length} NFT{nfts.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Stats Row */}
        {nfts.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {nfts.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Total NFTs</div>
            </div>
            <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {gameOptions.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Games Played</div>
            </div>
            <div className="bg-[#1a2540] rounded-xl border border-slate-700/20 p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {highestScore.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">Highest Score</div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        {gameOptions.length > 0 && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-500">Filter by game:</span>
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
                  {meta?.emoji || ""} {meta?.name || gameId} ({gameCounts[gameId]})
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              Loading your NFTs...
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && nfts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-bold text-slate-50 mb-2">
              No NFTs Yet
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Play a game, beat your high score, and mint it as an NFT to see it
              here!
            </p>
            <Link
              href="/games"
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-medium hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              🕹️ Play Games
            </Link>
          </div>
        )}

        {/* Filters */}
        {gameOptions.length > 1 && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm text-slate-500 whitespace-nowrap">Filter by game:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterGame("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterGame === "all"
                    ? "bg-cyan-500 text-slate-900 shadow-md shadow-cyan-500/20"
                    : "bg-[#1a2540] text-slate-400 border border-slate-700/50 hover:border-cyan-500/30 hover:text-cyan-400"
                }`}
              >
                All Games ({nfts.length})
              </button>
              {gameOptions.map((gameId) => {
                const gameInfo = GAMES[gameId];
                return (
                  <button
                    key={gameId}
                    onClick={() => setFilterGame(gameId)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                      filterGame === gameId
                        ? "bg-cyan-500 text-slate-900 shadow-md shadow-cyan-500/20"
                        : "bg-[#1a2540] text-slate-400 border border-slate-700/50 hover:border-cyan-500/30 hover:text-cyan-400"
                    }`}
                  >
                    <span>{gameInfo?.emoji || "🎮"}</span>
                    <span>{gameInfo?.name || gameId}</span>
                    <span className="bg-black/20 px-2 py-0.5 rounded-md text-[10px]">
                      {gameCounts[gameId]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && nfts.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-400">
              No NFTs found for &quot;{filterGame}&quot;.
            </p>
          </div>
        )}

        {/* NFT Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((nft) => {
              const meta = GAMES[nft.gameId];
              const gradient = meta?.color || "from-slate-500 to-slate-600";
              const emoji = meta?.emoji || "🏆";
              return (
                <div
                  key={nft.id}
                  className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 group"
                >
                  <div
                    className={`h-48 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`}
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
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/20 z-10 shadow-lg">
                      #{nft.mintNumber}
                    </div>
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

                    <div className="flex gap-1.5">
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
