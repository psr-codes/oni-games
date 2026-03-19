"use client";

import { useParams } from "next/navigation";
import { GAMES } from "@/game-store/registry";
import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE, GAME_STORE_ID } from "@/config";
import { useGameStore } from "@/hooks/useGameStore";

type MintStatus = "idle" | "minting" | "success" | "error";

interface MintResult {
  digest: string;
  nftId: string | null;
}

export default function GamePage() {
  const params = useParams();
  const slug = params.slug as string;
  const game = GAMES[slug];
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const { gameStore } = useGameStore();

  const [lastScore, setLastScore] = useState<number | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintError, setMintError] = useState("");

  // Dynamically load the game component (code-split)
  const GameComponent = useMemo(() => {
    if (!game) return null;
    return dynamic(() => game.component(), {
      ssr: false,
      loading: () => (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ),
    });
  }, [game]);

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score);
    setShowGameOver(true);
    setMintStatus("idle");
    setMintResult(null);
    setMintError("");
  }, []);

  const handleScoreChange = useCallback(() => {}, []);

  const handleClosePopup = useCallback(() => {
    setShowGameOver(false);
    setLastScore(null);
    setMintStatus("idle");
    setMintResult(null);
    setMintError("");
  }, []);

  // ---- Mint Flow ----
  const handleMint = async () => {
    if (lastScore === null) return;

    if (!account?.address) {
      setMintError("Please connect your wallet first!");
      setMintStatus("error");
      return;
    }

    setMintStatus("minting");
    setMintError("");

    try {
      const res = await fetch("/api/sign-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAddress: account.address,
          gameId: slug,
          score: lastScore,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || data.details || "Failed to get signature",
        );
      }

      const { signature, nonce, gameName, imageUrl } = data;
      const sigBytes = Array.from(Buffer.from(signature, "hex"));

      const storeObj = await suiClient.getObject({
        id: GAME_STORE_ID,
        options: { showContent: true },
      });
      const storeFields = (storeObj.data?.content as any)?.fields;
      const mintFee = Number(storeFields?.mint_fee || 0);
      const treasury = storeFields?.treasury || "";

      const tx = new Transaction();

      if (mintFee > 0 && treasury) {
        const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(mintFee)]);
        tx.transferObjects([feeCoin], tx.pure.address(treasury));
      }

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::mint_verified_score`,
        arguments: [
          tx.object(GAME_STORE_ID),
          tx.pure.string(slug),
          tx.pure.string(gameName),
          tx.pure.u64(lastScore),
          tx.pure.string(imageUrl),
          tx.pure.u64(nonce),
          tx.pure.vector("u8", sigBytes),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            const txResponse = await suiClient.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            let nftId: string | null = null;
            const created = txResponse.effects?.created;
            if (created && created.length > 0) {
              nftId = created[0].reference.objectId;
            }

            setMintResult({ digest: result.digest, nftId });
            setMintStatus("success");
          },
          onError: (err) => {
            setMintError(err.message || "Transaction failed");
            setMintStatus("error");
          },
        },
      );
    } catch (err: any) {
      setMintError(err.message || "Failed to mint NFT");
      setMintStatus("error");
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-[#111a2e] flex items-center justify-center">
        <div className="text-center p-8 bg-[#1a2540] rounded-2xl border border-slate-700/20 max-w-md">
          <div className="text-4xl mb-4">🕹️</div>
          <h2 className="text-xl font-bold text-slate-50 mb-2">
            Game Not Found
          </h2>
          <p className="text-slate-400 mb-6">
            The game &quot;{slug}&quot; doesn&apos;t exist in the arcade.
          </p>
          <Link
            href="/games"
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-medium transition-colors"
          >
            ← Back to Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#111a2e] flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-slate-700/20 bg-[#1a2540]/60 backdrop-blur-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/games"
              className="text-slate-500 hover:text-slate-200 transition-colors text-sm"
            >
              ← Games
            </Link>
            <div className="w-px h-5 bg-slate-700/30" />
            <div className="flex items-center gap-2">
              {game.image ? (
                <img src={game.image} alt="" className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-xl">{game.emoji}</span>
              )}
              <h1 className="text-base font-bold text-slate-50">{game.name}</h1>
            </div>
          </div>

          {/* Live score display (when not in game-over state) */}
          {lastScore !== null && !showGameOver && (
            <div className="text-sm text-slate-400">
              Score:{" "}
              <span className="text-cyan-400 font-bold">{lastScore}</span>
            </div>
          )}
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {GameComponent && (
          <GameComponent
            onGameOver={handleGameOver}
            onScoreChange={handleScoreChange}
          />
        )}

        {/* Game Over Popup Overlay */}
        {showGameOver && lastScore !== null && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: "rgba(4, 6, 16, 0.85)", backdropFilter: "blur(12px)" }}
            onClick={(e) => e.target === e.currentTarget && handleClosePopup()}
          >
            {/* Modal */}
            <div
              className="relative flex flex-col md:flex-row w-full max-w-[780px] rounded-3xl overflow-hidden"
              style={{ boxShadow: "0 0 80px rgba(0,200,255,0.12), 0 0 0 1px rgba(255,255,255,0.06)" }}
            >
              {/* Close */}
              <button
                onClick={handleClosePopup}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm"
              >
                ✕
              </button>

              {/* ── LEFT: NFT Image ── */}
              <div className="relative w-full md:w-[280px] flex-shrink-0">
                {/* Glow behind */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.color} blur-2xl opacity-40`} />
                {game.image ? (
                  <img
                    src={game.image}
                    alt={game.name}
                    className="relative w-full h-full object-cover"
                    style={{ minHeight: "380px" }}
                  />
                ) : (
                  <div
                    className={`relative w-full h-full bg-gradient-to-br ${game.color} flex items-center justify-center`}
                    style={{ minHeight: "380px" }}
                  >
                    <span className="text-8xl drop-shadow-2xl">{game.emoji}</span>
                  </div>
                )}
                {/* Score overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-16 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                  <p className="text-white/40 text-[10px] tracking-[3px] uppercase mb-0.5">Final Score</p>
                  <p
                    className="text-5xl font-black leading-none"
                    style={{
                      background: "linear-gradient(135deg, #00d4ff, #00ffaa)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {lastScore.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* ── RIGHT: Panel ── */}
              <div className="flex-1 bg-[#0d1322] flex flex-col p-7 gap-5">
                {/* Title */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    <span className="text-cyan-400 text-[10px] tracking-[3px] uppercase font-bold">
                      {mintStatus === "success" ? "Minted" : "Immortalize This"}
                    </span>
                  </div>
                  <h2 className="text-white text-2xl font-black leading-tight mb-1">
                    {mintStatus === "success" ? "🏆 Score Minted!" : "Mint Your Score Badge"}
                  </h2>
                  <p className="text-white/35 text-[12px] leading-relaxed">
                    {mintStatus === "success"
                      ? "Your achievement is now immortalized on-chain."
                      : "Unique NFT. Proved on-chain. No two alike."}
                  </p>
                </div>

                {/* Stats */}
                <div className="space-y-0 border border-white/[0.06] rounded-2xl overflow-hidden">
                  {[
                    { label: "Game", value: game.name },
                    { label: "Score", value: lastScore.toLocaleString() },
                    { label: "Network", value: "OneChain" },
                    ...(gameStore && gameStore.mintFee > 0
                      ? [{ label: "Mint Fee", value: `${(gameStore.mintFee / 1_000_000_000).toFixed(2)} OCT` }]
                      : []),
                  ].map(({ label, value }, i, arr) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                    >
                      <span className="text-white/35 text-[11px] tracking-[2px] uppercase">{label}</span>
                      <span className="text-white text-[12px] font-bold">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Success details */}
                {mintStatus === "success" && mintResult && (
                  <div className="space-y-2">
                    {mintResult.nftId && (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                        <div className="text-[10px] text-white/30 uppercase tracking-[2px] mb-1">NFT Object ID</div>
                        <div className="text-[11px] text-white/70 font-mono break-all">{mintResult.nftId}</div>
                      </div>
                    )}
                    <a
                      href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${mintResult.digest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-cyan-400 text-[11px] font-bold tracking-[1px] uppercase text-center transition-all"
                    >
                      ↗ View on Explorer
                    </a>
                  </div>
                )}

                {/* Error */}
                {mintStatus === "error" && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[12px] text-red-400">
                    ❌ {mintError}
                  </div>
                )}

                {/* Mint button (only when not yet minted) */}
                {mintStatus !== "success" && (
                  <>
                    {account?.address ? (
                      <button
                        onClick={handleMint}
                        disabled={isTxPending || mintStatus === "minting"}
                        className="w-full relative overflow-hidden rounded-xl py-3.5 text-[12px] font-black tracking-[2px] uppercase transition-all duration-300 disabled:opacity-70"
                        style={{
                          background: "linear-gradient(135deg, #00d4ff, #00ffaa)",
                          color: "#000",
                          boxShadow: "0 0 24px rgba(0,212,255,0.3)",
                        }}
                      >
                        {mintStatus === "minting" ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Minting…
                          </span>
                        ) : (
                          "✦ Mint NFT Badge"
                        )}
                      </button>
                    ) : (
                      <div className="text-[11px] text-amber-400 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-400/20 text-center tracking-[1px] uppercase font-bold">
                        Connect wallet to mint
                      </div>
                    )}
                  </>
                )}

                {/* Secondary buttons */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={handleClosePopup}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-white/50 hover:text-white text-[11px] font-bold tracking-[1px] uppercase transition-all"
                  >
                    {mintStatus === "success" ? "Close" : "Play Again"}
                  </button>
                  {mintStatus !== "success" && (
                    <Link
                      href="/games"
                      className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-white/50 hover:text-white text-[11px] font-bold tracking-[1px] uppercase transition-all text-center"
                    >
                      Other Games
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
