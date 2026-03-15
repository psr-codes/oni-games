"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
  ConnectButton,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState, useCallback } from "react";
import { PACKAGE_ID, MODULE, GAME_STORE_ID, COIN_TYPE } from "@/config";
import { useGameStore } from "@/hooks/useGameStore";
import { GAMES } from "@/game-store/registry";

interface ListingData {
  listingId: string;
  nftId: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
  price: number;
  seller: string;
}

export default function MarketplacePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const { gameStore } = useGameStore();
  const marketFeePercent = gameStore
    ? (gameStore.marketFeeBps / 100).toFixed(1)
    : "...";

  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [filterGame, setFilterGame] = useState<string>("all");

  const clearStatus = () => setTimeout(() => setTxStatus(null), 6000);

  const formatOCT = (mist: number) => {
    const oct = mist / 1_000_000_000;
    if (oct >= 1) return oct.toFixed(2);
    if (oct >= 0.01) return oct.toFixed(4);
    return oct.toFixed(9);
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const listedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::NFTListed` },
        order: "descending",
        limit: 100,
      });

      const listingIds = listedEvents.data
        .map((e: any) => e.parsedJson?.listing_id)
        .filter(Boolean) as string[];

      if (listingIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      const uniqueIds = [...new Set(listingIds)];
      const objects = await suiClient.multiGetObjects({
        ids: uniqueIds,
        options: { showContent: true, showOwner: true },
      });

      const parsed: ListingData[] = objects
        .map((obj) => {
          if (!obj.data?.content) return null;
          const fields = (obj.data.content as any)?.fields;
          if (!fields) return null;
          const nftFields = fields.nft?.fields;
          if (!nftFields) return null;

          return {
            listingId: obj.data.objectId || "",
            nftId: nftFields.id?.id || "",
            gameId: nftFields.game_id || "",
            gameName: nftFields.game_name || "",
            score: Number(nftFields.score) || 0,
            player: nftFields.player || "",
            imageUrl: nftFields.image_url || "",
            mintNumber: Number(nftFields.mint_number) || 0,
            price: Number(fields.price) || 0,
            seller: fields.seller || "",
          };
        })
        .filter(Boolean) as ListingData[];

      parsed.sort((a, b) => a.price - b.price);
      setListings(parsed);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleBuy = async (listing: ListingData) => {
    if (!account?.address) return;
    setBuyingId(listing.listingId);

    try {
      const tx = new Transaction();
      const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(listing.price)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::buy_nft`,
        arguments: [
          tx.object(GAME_STORE_ID),
          tx.object(listing.listingId),
          paymentCoin,
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({ digest: result.digest });
            setTxStatus({
              type: "success",
              message: `✅ NFT purchased for ${formatOCT(listing.price)} OCT! Tx: ${result.digest.slice(0, 12)}...`,
            });
            clearStatus();
            setBuyingId(null);
            fetchListings();
          },
          onError: (err) => {
            setTxStatus({
              type: "error",
              message: `❌ Purchase failed: ${err.message}`,
            });
            clearStatus();
            setBuyingId(null);
          },
        },
      );
    } catch (err: any) {
      setTxStatus({
        type: "error",
        message: `❌ Error: ${err.message}`,
      });
      clearStatus();
      setBuyingId(null);
    }
  };

  const handleDelist = (listing: ListingData) => {
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
          fetchListings();
        },
        onError: (err) => {
          setTxStatus({
            type: "error",
            message: `❌ Delist failed: ${err.message}`,
          });
          clearStatus();
          setDelistingId(null);
        },
      },
    );
  };

  const gameOptions = [...new Set(listings.map((l) => l.gameId))];
  const filtered =
    filterGame === "all"
      ? listings
      : listings.filter((l) => l.gameId === filterGame);

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">
            🛒 NFT Marketplace
          </h1>
          <p className="text-slate-400">
            Buy, sell, and trade Score NFTs from top players.
            <span className="text-cyan-400 font-medium ml-2">
              {listings.length} listing{listings.length !== 1 ? "s" : ""} live
            </span>
          </p>
        </div>

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

        {/* Filters */}
        {gameOptions.length > 1 && (
          <div className="mb-8 flex items-center gap-3">
            <span className="text-sm text-slate-500">Filter by game:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterGame("all")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterGame === "all"
                    ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                    : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                }`}
              >
                All
              </button>
              {gameOptions.map((game) => {
                const meta = GAMES[game];
                return (
                  <button
                    key={game}
                    onClick={() => setFilterGame(game)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                      filterGame === game
                        ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                        : "bg-[#1a2540] text-slate-400 border border-slate-700/20 hover:bg-[#1f2d4d]"
                    }`}
                  >
                    {meta?.emoji || ""} {meta?.name || game}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              Loading marketplace...
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-bold text-slate-50 mb-2">
              No Listings Yet
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              No NFTs are currently listed for sale. Mint a Score NFT and list it
              from your{" "}
              <a href="/my-nfts" className="text-cyan-400 hover:underline">
                My NFTs
              </a>{" "}
              page!
            </p>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && listings.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-400">
              No listings found for &quot;{filterGame}&quot;.
            </p>
          </div>
        )}

        {/* Listing Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((listing) => {
              const meta = GAMES[listing.gameId];
              const gradient = meta?.color || "from-slate-500 to-slate-600";
              const emoji = meta?.emoji || "🏆";
              const isSeller =
                account?.address &&
                listing.seller.toLowerCase() === account.address.toLowerCase();
              const isBuying = buyingId === listing.listingId;
              const isDelisting = delistingId === listing.listingId;

              return (
                <div
                  key={listing.listingId}
                  className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 group"
                >
                  <div
                    className={`h-28 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                  >
                    <span className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform">
                      {emoji}
                    </span>
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                      #{listing.mintNumber}
                    </div>
                    {isSeller && (
                      <div className="absolute top-3 left-3 bg-amber-500/80 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-black">
                        Your Listing
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-slate-50">
                        {listing.gameName}
                      </h3>
                      <span className="text-xs text-slate-500 bg-[#111a2e] px-2 py-0.5 rounded">
                        {listing.gameId}
                      </span>
                    </div>

                    <div className="bg-[#111a2e] rounded-xl p-2.5 mb-2 text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">
                        Score
                      </div>
                      <div className="text-xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text">
                        {listing.score.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-emerald-500/8 border border-emerald-400/15 rounded-xl p-2.5 mb-3 text-center">
                      <div className="text-xs text-emerald-400/60 uppercase tracking-wider mb-0.5">
                        Price
                      </div>
                      <div className="text-lg font-bold text-emerald-400">
                        {formatOCT(listing.price)} OCT
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-slate-600">Seller</span>
                      <span className="text-slate-400 font-mono">
                        {listing.seller.slice(0, 8)}...
                        {listing.seller.slice(-4)}
                      </span>
                    </div>

                    {!account?.address ? (
                      <div className="text-center">
                        <ConnectButton />
                      </div>
                    ) : isSeller ? (
                      <button
                        onClick={() => handleDelist(listing)}
                        disabled={isTxPending || isDelisting}
                        className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-400/20 text-red-400 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDelisting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            Delisting...
                          </span>
                        ) : (
                          "❌ Delist NFT"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(listing)}
                        disabled={isTxPending || isBuying}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all"
                      >
                        {isBuying ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Buying...
                          </span>
                        ) : (
                          `💎 Buy for ${formatOCT(listing.price)} OCT`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Marketplace info */}
        <div className="mt-12 bg-[#1a2540]/50 rounded-2xl border border-slate-700/15 p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
            How it works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-500">
            <div>
              <div className="text-lg mb-1">1️⃣ List</div>
              <p>
                Go to{" "}
                <a href="/my-nfts" className="text-cyan-400 hover:underline">
                  My NFTs
                </a>{" "}
                and click &quot;List&quot; on any NFT. Set your price in OCT.
              </p>
            </div>
            <div>
              <div className="text-lg mb-1">2️⃣ Buy</div>
              <p>
                Browse listings and click &quot;Buy&quot;. Your wallet will sign
                the transaction and pay with OCT.
              </p>
            </div>
            <div>
              <div className="text-lg mb-1">3️⃣ Fees</div>
              <p>
                A {marketFeePercent}% marketplace fee is deducted from each sale
                and sent to the platform treasury. The rest goes to the seller.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
