"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
  ConnectButton,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PACKAGE_ID, MODULE, GAME_STORE_ID, COIN_TYPE, PREVIOUS_PACKAGE_IDS } from "@/config";
import { useGameStore } from "@/hooks/useGameStore";
import { GAMES } from "@/game-store/registry";

function truncAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
}

interface ListingData {
  listingId?: string;
  nftId: string;
  gameId: string;
  gameName: string;
  score: number;
  player: string;
  imageUrl: string;
  mintNumber: number;
  price: number;
  seller: string;
  isListed: boolean;
}

export default function MarketplacePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const searchParams = useSearchParams();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const { gameStore } = useGameStore();
  const marketFeePercent = gameStore
    ? (gameStore.marketFeeBps / 100).toFixed(1)
    : "...";

  // Query-param highlighted NFT (from leaderboard "View" link)
  const highlightNft = {
    nftId: searchParams.get("nftId"),
    game: searchParams.get("game"),
    score: searchParams.get("score"),
    player: searchParams.get("player"),
    mint: searchParams.get("mint"),
  };
  const hasHighlight = !!highlightNft.nftId;

  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [filterGame, setFilterGame] = useState<string>("all");
  const [listStatus, setListStatus] = useState<"all" | "listed" | "unlisted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMine, setShowMine] = useState(false);

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
      const allPackages = [PACKAGE_ID, ...PREVIOUS_PACKAGE_IDS];
      
      // 1. Fetch all mint events to get all NFTs
      const mintQueries = await Promise.all(
        allPackages.map((pid) =>
          suiClient.queryEvents({
            query: { MoveEventType: `${pid}::${MODULE}::ScoreMinted` },
            order: "descending",
            limit: 200,
          })
        )
      );
      const allMintEvents = mintQueries.flatMap((res) => res.data);

      const allNftsMap = new Map<string, ListingData>();
      allMintEvents.forEach((e: any) => {
        const j = e.parsedJson;
        if (j && j.nft_id) {
          allNftsMap.set(j.nft_id, {
            nftId: j.nft_id,
            gameId: j.game_id || "",
            gameName: j.game_name || GAMES[j.game_id]?.name || j.game_id,
            score: Number(j.score) || 0,
            player: j.player || "",
            imageUrl: typeof j.image_url === "string" ? j.image_url : "",
            mintNumber: Number(j.mint_number) || 0,
            isListed: false,
            price: 0,
            seller: "",
          });
        }
      });

      // 1.5 Fetch all purchase events to update current owners
      const purchaseQueries = await Promise.all(
        allPackages.map((pid) =>
          suiClient.queryEvents({
            query: { MoveEventType: `${pid}::${MODULE}::NFTPurchased` },
            order: "ascending",
          })
        )
      );
      const allPurchaseEvents = purchaseQueries.flatMap((res) => res.data);
      allPurchaseEvents.forEach((e: any) => {
        const j = e.parsedJson;
        if (j && j.nft_id && j.buyer) {
          const nft = allNftsMap.get(j.nft_id);
          if (nft) {
            nft.player = j.buyer;
          }
        }
      });

      // 2. Fetch all list events to check active listings
      const listQueries = await Promise.all(
        allPackages.map((pid) =>
          suiClient.queryEvents({
            query: { MoveEventType: `${pid}::${MODULE}::NFTListed` },
            order: "descending",
            limit: 100,
          })
        )
      );

      const allListedEvents = listQueries.flatMap((res) => res.data);
      const listingIds = allListedEvents
        .map((e: any) => e.parsedJson?.listing_id)
        .filter(Boolean) as string[];

      if (listingIds.length > 0) {
        const uniqueIds = [...new Set(listingIds)];
        const objects = await suiClient.multiGetObjects({
          ids: uniqueIds,
          options: { showContent: true },
        });

        objects.forEach((obj) => {
          if (!obj.data?.content) return;
          const fields = (obj.data.content as any)?.fields;
          if (!fields) return;
          const nftFields = fields.nft?.fields;
          if (!nftFields) return;

          const nftId = nftFields.id?.id;
          if (!nftId) return;

          const lData = {
            listingId: obj.data.objectId || "",
            price: Number(fields.price) || 0,
            seller: fields.seller || "",
          };

          if (allNftsMap.has(nftId)) {
            const nft = allNftsMap.get(nftId)!;
            nft.isListed = true;
            nft.listingId = lData.listingId;
            nft.price = lData.price;
            nft.seller = lData.seller;
            nft.player = lData.seller || nftFields.player || nft.player;
          } else {
            allNftsMap.set(nftId, {
              nftId,
              listingId: lData.listingId,
              gameId: nftFields.game_id || "",
              gameName: nftFields.game_name || GAMES[nftFields.game_id]?.name || nftFields.game_id,
              score: Number(nftFields.score) || 0,
              player: nftFields.player || "",
              imageUrl: typeof nftFields.image_url === "string" ? nftFields.image_url : "",
              mintNumber: Number(nftFields.mint_number) || 0,
              isListed: true,
              price: lData.price,
              seller: lData.seller,
            });
          }
        });
      }

      const parsed = Array.from(allNftsMap.values());
      parsed.sort((a, b) => {
        if (a.isListed && !b.isListed) return -1;
        if (!a.isListed && b.isListed) return 1;
        return b.score - a.score;
      });

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
    if (!account?.address || !listing.listingId) return;
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
  const filtered = listings.filter((l) => {
    if (filterGame !== "all" && l.gameId !== filterGame) return false;
    if (listStatus === "listed" && !l.isListed) return false;
    if (listStatus === "unlisted" && l.isListed) return false;
    if (showMine && account?.address) {
      const addr = account.address.toLowerCase();
      if (l.player.toLowerCase() !== addr && l.seller.toLowerCase() !== addr) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matches =
        l.nftId.toLowerCase().includes(q) ||
        l.gameName.toLowerCase().includes(q) ||
        l.gameId.toLowerCase().includes(q) ||
        l.player.toLowerCase().includes(q) ||
        l.seller.toLowerCase().includes(q) ||
        String(l.score).includes(q) ||
        String(l.mintNumber).includes(q);
      if (!matches) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header & Stats */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 mb-2">
              🛒 NFT Marketplace
            </h1>
            <p className="text-slate-400">
              Buy, sell, and trade Score NFTs from top players.
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#1a2540] px-3 py-2 border border-slate-700/20 rounded-lg shrink-0 w-full md:w-auto overflow-x-auto">
             <div className="text-center px-1.5">
                 <div className="text-lg font-bold text-slate-50">{listings.length}</div>
                 <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Minted</div>
             </div>
             <div className="w-px h-8 bg-slate-700/50" />
             <div className="text-center px-1.5">
                 <div className="text-lg font-bold text-cyan-400">{listings.filter(l => l.isListed).length}</div>
                 <div className="text-[9px] text-cyan-500/50 uppercase tracking-wider font-semibold">Listed</div>
             </div>
             <div className="w-px h-8 bg-slate-700/50" />
             <div className="text-center px-1.5">
                 <div className="text-lg font-bold text-purple-400">{gameOptions.length}</div>
                 <div className="text-[9px] text-purple-500/50 uppercase tracking-wider font-semibold">Games</div>
             </div>
          </div>
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

        {/* Search Bar */}
        <div className="mb-5 flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by NFT address, game name, player, score..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#1a2540] border border-slate-700/30 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          {account?.address && (
            <button
              onClick={() => setShowMine(!showMine)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                showMine
                  ? "bg-amber-500/15 text-amber-400 border-amber-400/30"
                  : "bg-[#1a2540] text-slate-400 border-slate-700/30 hover:text-slate-200 hover:border-slate-600"
              }`}
            >
              👤 My NFTs
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {gameOptions.length > 1 && (
              <>
                <span className="text-sm text-slate-500 shrink-0">Filter by game:</span>
                <div className="flex gap-2 shrink-0">
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
              </>
            )}
          </div>
          
          {/* Status Filter */}
          <div className="flex bg-[#1a2540] p-1 rounded-xl border border-slate-700/20 shrink-0 w-full md:w-auto">
            <button
               onClick={() => setListStatus("all")}
               className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${listStatus === "all" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
            >All</button>
            <button
               onClick={() => setListStatus("listed")}
               className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${listStatus === "listed" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
            >Listed</button>
            <button
               onClick={() => setListStatus("unlisted")}
               className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${listStatus === "unlisted" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
            >Not Listed</button>
          </div>
        </div>

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

        {/* Highlighted NFT from leaderboard */}
        {hasHighlight && (
          <div className="mb-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
              🔎 NFT from Leaderboard
            </h3>
            {(() => {
              const meta = GAMES[highlightNft.game || ""];
              const listed = listings.find((l) => l.nftId === highlightNft.nftId && l.isListed);
              const isHighlightMine = account?.address && (
                highlightNft.player?.toLowerCase() === account.address.toLowerCase() ||
                listed?.seller.toLowerCase() === account.address.toLowerCase()
              );
              
              return (
                <div className="bg-[#1a2540] rounded-2xl border border-cyan-400/20 hover:border-cyan-400/40 transition-colors overflow-hidden shadow-lg shadow-cyan-900/10">
                  <div className="flex flex-col sm:flex-row h-full">
                    {/* BIG Image Left */}
                    <div className="sm:w-60 bg-slate-900/50 relative overflow-hidden flex items-stretch border-b sm:border-b-0 sm:border-r border-slate-700/30">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 pointer-events-none" />
                      <div className={`w-full bg-gradient-to-br ${
                        meta?.color || "from-slate-500 to-slate-600"
                      } flex items-center justify-center text-6xl relative overflow-hidden group`}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-0 opacity-80" />
                        {meta?.image ? (
                            <img src={meta.image} alt={highlightNft.game || ""} className="w-full h-full object-contain z-10 relative group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <span className="z-10 drop-shadow-lg group-hover:scale-110 transition-transform duration-500">{meta?.emoji || "🏆"}</span>
                        )}
                        {isHighlightMine && (
                          <div className="absolute top-2 right-2 bg-amber-500/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-black z-20 shadow-lg">
                            Yours
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 z-20 text-xs font-bold text-white px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/20">
                           #{highlightNft.mint}
                        </div>
                      </div>
                    </div>

                    {/* Details Right */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col justify-center relative">
                      <div className="flex items-baseline justify-between gap-4 mb-6">
                         <span className="text-3xl font-black text-slate-50 tracking-tight">
                           {meta?.name || highlightNft.game}
                         </span>
                         <span className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text shrink-0">
                           {Number(highlightNft.score || 0).toLocaleString()} PTS
                         </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
                         <div>
                           <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest font-bold">Owner</div>
                           <a href={`https://onescan.cc/testnet/objectDetails?address=${highlightNft.player}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-mono text-sm hover:text-cyan-300 transition-colors">
                             {truncAddr(highlightNft.player || "")} ↗
                           </a>
                         </div>
                         <div>
                           <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest font-bold">NFT ID</div>
                           <a href={`https://onescan.cc/testnet/objectDetails?address=${highlightNft.nftId}`} target="_blank" rel="noopener noreferrer" className="text-slate-300 font-mono text-sm hover:text-cyan-400 transition-colors">
                             {truncAddr(highlightNft.nftId || "")} ↗
                           </a>
                         </div>
                      </div>

                      {listed ? (
                         <div className="flex items-center gap-6 mt-auto pt-6 border-t border-slate-700/50">
                            <div className="flex flex-col">
                               <span className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-bold mb-1">Price</span>
                               <span className="text-2xl font-black text-emerald-400">{formatOCT(listed.price)} OCT</span>
                            </div>
                            <div className="h-10 w-px bg-slate-700/50 hidden sm:block" />
                            <div className="flex flex-col justify-center hidden sm:flex">
                               <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Seller</span>
                               <a href={`https://onescan.cc/testnet/objectDetails?address=${listed.seller}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-mono text-sm hover:text-cyan-300 transition-colors">
                                 {truncAddr(listed.seller)} ↗
                               </a>
                            </div>
                            <div className="ml-auto">
                              {!account?.address ? (
                                <ConnectButton />
                              ) : (account.address.toLowerCase() === listed.seller.toLowerCase()) ? (
                                <button
                                  onClick={() => handleDelist(listed)}
                                  disabled={isTxPending || delistingId === listed.listingId}
                                  className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-400/20 text-red-400 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {delistingId === listed.listingId ? "Wait..." : "❌ Delist"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBuy(listed)}
                                  disabled={isTxPending || buyingId === listed.listingId}
                                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                                >
                                  {buyingId === listed.listingId ? "Wait..." : "💎 Buy Now"}
                                </button>
                              )}
                            </div>
                         </div>
                      ) : (
                         <div className="mt-auto pt-6 border-t border-slate-700/50 flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 text-slate-400 text-xs font-bold rounded-lg border border-slate-700/50">
                               <span className="w-2 h-2 rounded-full bg-slate-600" />
                               Not Listed
                            </span>
                            <button disabled className="px-6 py-2.5 bg-slate-800 text-slate-600 rounded-xl font-bold cursor-not-allowed border border-slate-700/50">
                               Not Listed
                            </button>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Listing Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((listing) => {
              const meta = GAMES[listing.gameId];
              const gradient = meta?.color || "from-slate-500 to-slate-600";
              const emoji = meta?.emoji || "🏆";
              const isMine =
                account?.address &&
                (listing.seller.toLowerCase() === account.address.toLowerCase() ||
                 listing.player.toLowerCase() === account.address.toLowerCase());
              const isBuying = buyingId === listing.listingId;
              const isDelisting = delistingId === listing.listingId;

              return (
                <div
                  key={listing.listingId}
                  className="bg-[#1a2540] rounded-xl border border-slate-700/20 overflow-hidden hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-900/10 transition-all duration-300 group"
                >
                  <div
                    className={`h-48 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a2540] via-transparent to-[#1a2540]/20 opacity-90 z-0" />
                    {meta?.image ? (
                      <img 
                        src={meta.image} 
                        alt={listing.gameName} 
                        className="w-full h-full object-cover object-top filter drop-shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300" 
                      />
                    ) : (
                      <span className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform relative z-10">
                        {emoji}
                      </span>
                    )}
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/20 z-10 shadow-lg">
                      #{listing.mintNumber}
                    </div>
                    {isMine && (
                      <div className="absolute top-2 left-2 bg-amber-500/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-black z-10 shadow-lg">
                        Yours
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-50 truncate mr-1">
                        {listing.gameName}
                      </h3>
                      <span className="text-base font-bold text-transparent bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text shrink-0">
                        {listing.score.toLocaleString()}
                      </span>
                    </div>

                    {listing.isListed ? (
                       <div className="bg-emerald-500/5 border border-emerald-400/10 rounded-lg p-2 mb-3 text-center">
                         <div className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-0.5 font-semibold">
                           Price
                         </div>
                         <div className="text-sm font-bold text-emerald-400">
                           {formatOCT(listing.price)} OCT
                         </div>
                       </div>
                    ) : (
                       <div className="bg-[#1a2540] border border-slate-700/50 rounded-lg p-2 mb-3 text-center h-[54px] flex flex-col items-center justify-center">
                         <div className="text-xs font-semibold text-slate-500">Not Listed</div>
                       </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] mb-3 mt-auto">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider">{listing.isListed ? 'Seller' : 'Owner'}</span>
                      <a
                        href={`https://onescan.cc/testnet/objectDetails?address=${listing.isListed ? listing.seller : listing.player}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                      >
                        {truncAddr(listing.isListed ? listing.seller : listing.player)} ↗
                      </a>
                    </div>

                    {!account?.address ? (
                      <div className="text-center">
                        <ConnectButton />
                      </div>
                    ) : listing.isListed ? (
                      isMine ? (
                        <button
                          onClick={() => handleDelist(listing)}
                          disabled={isTxPending || isDelisting}
                          className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-400/20 text-red-400 rounded-lg font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDelisting ? "Wait..." : "❌ Delist"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(listing)}
                          disabled={isTxPending || isBuying}
                          className="w-full px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs transition-all"
                        >
                          {isBuying ? "Wait..." : "💎 Buy"}
                        </button>
                      )
                    ) : (
                      <button
                         disabled
                         className="w-full px-3 py-2 bg-slate-800 text-slate-500 rounded-lg font-bold text-xs cursor-not-allowed border border-slate-700/50"
                      >
                         Not Listed
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
                <Link href="/profile" className="text-cyan-400 hover:underline">
                  Profile
                </Link>{" "}
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
