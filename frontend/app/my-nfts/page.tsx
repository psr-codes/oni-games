"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PACKAGE_ID, MODULE, GAME_STORE_ID, COIN_TYPE } from "@/config";
import { useGameStore } from "@/hooks/useGameStore";

interface ScoreNFT {
  id: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
}

// Map game_id to colors for visual flair
const GAME_COLORS: Record<string, string> = {
  tetris: "from-cyan-500 to-blue-600",
  snake: "from-green-500 to-emerald-600",
  "2048": "from-amber-500 to-orange-600",
  "flappy-bird": "from-yellow-400 to-green-500",
  "space-invaders": "from-purple-500 to-pink-600",
};

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

  // Modal state
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
      const structType = `${PACKAGE_ID}::${MODULE}::ScoreNFT`;
      const result = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: structType },
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

  // ---- Transfer (Send) ----
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
          fetchNFTs(); // refresh
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

  // ---- List on Marketplace ----
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

    // Convert OCT to MIST (1 OCT = 1e9 MIST)
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
          fetchNFTs(); // refresh — NFT leaves inventory when listed (escrowed)
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

  // Not connected
  if (!account?.address) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-800 max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400">
            Connect your wallet to view your Score NFTs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">🏆 My NFTs</h1>
          <p className="text-gray-400 text-lg">
            Your on-chain score collection —{" "}
            <span className="text-purple-400 font-medium">
              {nfts.length} NFT{nfts.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Status Toast */}
        {txStatus && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
              txStatus.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {txStatus.message}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Loading your NFTs...
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && nfts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-bold text-white mb-2">No NFTs Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Play a game, beat your high score, and mint it as an NFT to see it
              here!
            </p>
            <Link
              href="/games"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              🕹️ Play Games
            </Link>
          </div>
        )}

        {/* NFT Grid */}
        {!loading && nfts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {nfts.map((nft) => {
              const gradient =
                GAME_COLORS[nft.gameId] || "from-purple-500 to-pink-600";
              return (
                <div
                  key={nft.id}
                  className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300 group"
                >
                  {/* Card header with game gradient */}
                  <div
                    className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                  >
                    {nft.imageUrl ? (
                      <img
                        src={nft.imageUrl}
                        alt={nft.gameName}
                        className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement)
                            .parentElement!.querySelector(".fallback-emoji")!
                            .classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span
                      className={`text-5xl group-hover:scale-110 transition-transform fallback-emoji ${nft.imageUrl ? "hidden" : ""}`}
                    >
                      🏆
                    </span>
                    {/* Mint number badge */}
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                      #{nft.mintNumber}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-white">
                        {nft.gameName}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {nft.gameId}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="bg-gray-950 rounded-xl p-4 mb-4 text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                        Score
                      </div>
                      <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {nft.score.toLocaleString()}
                      </div>
                    </div>

                    {/* Object ID (truncated) */}
                    <div className="flex items-center justify-between text-xs mb-4">
                      <span className="text-gray-600">Object ID</span>
                      <a
                        href={`https://onescan.cc/testnet/objectDetail?objectId=${nft.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 font-mono transition-colors"
                      >
                        {nft.id.slice(0, 8)}...{nft.id.slice(-6)}
                      </a>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSendModal(nft);
                          setListModal(null);
                        }}
                        disabled={isTxPending}
                        className="flex-1 px-3 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        📤 Send
                      </button>
                      <button
                        onClick={() => {
                          setListModal(nft);
                          setSendModal(null);
                        }}
                        disabled={isTxPending}
                        className="flex-1 px-3 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* ======= Send Modal ======= */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">📤 Send NFT</h3>
              <button
                onClick={() => {
                  setSendModal(null);
                  setRecipientAddress("");
                }}
                className="text-gray-500 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {/* NFT preview */}
            <div className="bg-gray-950 rounded-xl p-4 mb-6 border border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <div className="text-white font-bold">
                    {sendModal.gameName}
                  </div>
                  <div className="text-sm text-gray-400">
                    Score: {sendModal.score.toLocaleString()} • Mint #
                    {sendModal.mintNumber}
                  </div>
                </div>
              </div>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSendModal(null);
                  setRecipientAddress("");
                }}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isTxPending || !recipientAddress}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
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

      {/* ======= List Modal ======= */}
      {listModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                🏷️ List on Marketplace
              </h3>
              <button
                onClick={() => {
                  setListModal(null);
                  setListPrice("");
                }}
                className="text-gray-500 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {/* NFT preview */}
            <div className="bg-gray-950 rounded-xl p-4 mb-6 border border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <div className="text-white font-bold">
                    {listModal.gameName}
                  </div>
                  <div className="text-sm text-gray-400">
                    Score: {listModal.score.toLocaleString()} • Mint #
                    {listModal.mintNumber}
                  </div>
                </div>
              </div>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Price (in OCT)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1.5"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors mb-2"
            />
            {listPrice &&
              !isNaN(parseFloat(listPrice)) &&
              parseFloat(listPrice) > 0 && (
                <p className="text-xs text-gray-500 mb-4">
                  ≈{" "}
                  {Math.floor(
                    parseFloat(listPrice) * 1_000_000_000,
                  ).toLocaleString()}{" "}
                  MIST
                  <span className="text-gray-600 ml-2">
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
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={
                  isTxPending || !listPrice || parseFloat(listPrice) <= 0
                }
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
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
