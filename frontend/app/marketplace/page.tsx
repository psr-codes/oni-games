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

interface ListingData {
  listingId: string;
  nftId: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
  price: number; // in MIST
  seller: string;
}

// Map game_id to colors
const GAME_COLORS: Record<string, string> = {
  tetris: "from-cyan-500 to-blue-600",
  snake: "from-green-500 to-emerald-600",
  "2048": "from-amber-500 to-orange-600",
  "flappy-bird": "from-yellow-400 to-green-500",
  "space-invaders": "from-purple-500 to-pink-600",
};

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

  // Fetch all Listing objects via querying by type
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const listingType = `${PACKAGE_ID}::${MODULE}::Listing`;

      // Query all events of type NFTListed to discover listing IDs.
      // Since Listings are shared objects, we can't use getOwnedObjects.
      // Instead, we use queryEvents and then multi-get the objects.
      const listedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::${MODULE}::NFTListed` },
        order: "descending",
        limit: 100,
      });

      // Get all listing IDs from events
      const listingIds = listedEvents.data
        .map((e: any) => e.parsedJson?.listing_id)
        .filter(Boolean) as string[];

      if (listingIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      // De-duplicate
      const uniqueIds = [...new Set(listingIds)];

      // Multi-get listing objects
      const objects = await suiClient.multiGetObjects({
        ids: uniqueIds,
        options: { showContent: true, showOwner: true },
      });

      const parsed: ListingData[] = objects
        .map((obj) => {
          // If object doesn't exist (was bought/delisted), skip
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

      // Sort by price ascending
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

  // ---- Buy NFT ----
  const handleBuy = async (listing: ListingData) => {
    if (!account?.address) return;
    setBuyingId(listing.listingId);

    try {
      const tx = new Transaction();

      // Split exact price from gas coin — avoids conflicts with wallet gas selection.
      // On OneChain, gas is OCT, so this pulls payment from the same gas coin.
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

  // ---- Delist NFT ----
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

  // Unique games for filter
  const gameOptions = [...new Set(listings.map((l) => l.gameId))];
  const filtered =
    filterGame === "all"
      ? listings
      : listings.filter((l) => l.gameId === filterGame);

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">
            🛒 NFT Marketplace
          </h1>
          <p className="text-gray-400 text-lg">
            Buy, sell, and trade Score NFTs from top players.
            <span className="text-purple-400 font-medium ml-2">
              {listings.length} listing{listings.length !== 1 ? "s" : ""} live
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

        {/* Filters */}
        {gameOptions.length > 1 && (
          <div className="mb-8 flex items-center gap-3">
            <span className="text-sm text-gray-500">Filter by game:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterGame("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterGame === "all"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                All
              </button>
              {gameOptions.map((game) => (
                <button
                  key={game}
                  onClick={() => setFilterGame(game)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    filterGame === game
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {game}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Loading marketplace...
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-bold text-white mb-2">
              No Listings Yet
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              No NFTs are currently listed for sale. Mint a Score NFT and list
              it from your{" "}
              <a href="/my-nfts" className="text-purple-400 hover:underline">
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
            <p className="text-gray-400">
              No listings found for "{filterGame}".
            </p>
          </div>
        )}

        {/* Listing Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((listing) => {
              const gradient =
                GAME_COLORS[listing.gameId] || "from-purple-500 to-pink-600";
              const isSeller =
                account?.address &&
                listing.seller.toLowerCase() === account.address.toLowerCase();
              const isBuying = buyingId === listing.listingId;
              const isDelisting = delistingId === listing.listingId;

              return (
                <div
                  key={listing.listingId}
                  className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300 group"
                >
                  {/* Card header */}
                  <div
                    className={`h-32 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                  >
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={listing.gameName}
                        className="w-14 h-14 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement)
                            .parentElement!.querySelector(".fallback-emoji")!
                            .classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span
                      className={`text-4xl group-hover:scale-110 transition-transform fallback-emoji ${listing.imageUrl ? "hidden" : ""}`}
                    >
                      🏆
                    </span>
                    {/* Mint badge */}
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                      #{listing.mintNumber}
                    </div>
                    {/* Seller badge */}
                    {isSeller && (
                      <div className="absolute top-3 left-3 bg-amber-500/80 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-black">
                        Your Listing
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {listing.gameName}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {listing.gameId}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="bg-gray-950 rounded-xl p-3 mb-3 text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
                        Score
                      </div>
                      <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {listing.score.toLocaleString()}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-3 text-center">
                      <div className="text-xs text-emerald-400/60 uppercase tracking-wider mb-0.5">
                        Price
                      </div>
                      <div className="text-xl font-bold text-emerald-400">
                        {formatOCT(listing.price)} OCT
                      </div>
                    </div>

                    {/* Seller */}
                    <div className="flex items-center justify-between text-xs mb-4">
                      <span className="text-gray-600">Seller</span>
                      <span className="text-gray-400 font-mono">
                        {listing.seller.slice(0, 8)}...
                        {listing.seller.slice(-4)}
                      </span>
                    </div>

                    {/* Actions */}
                    {!account?.address ? (
                      <div className="text-center">
                        <ConnectButton />
                      </div>
                    ) : isSeller ? (
                      <button
                        onClick={() => handleDelist(listing)}
                        disabled={isTxPending || isDelisting}
                        className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all"
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
        <div className="mt-12 bg-gray-900/50 rounded-2xl border border-gray-800/50 p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            How it works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-500">
            <div>
              <div className="text-lg mb-1">1️⃣ List</div>
              <p>
                Go to{" "}
                <a href="/my-nfts" className="text-purple-400 hover:underline">
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
