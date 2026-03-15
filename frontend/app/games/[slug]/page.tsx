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
              <span className="text-xl">{game.emoji}</span>
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
          <div className="absolute inset-0 bg-[#111a2e]/70 backdrop-blur-md z-40 flex items-center justify-center p-4">
            <div className="bg-[#1a2540] border border-slate-700/30 rounded-2xl shadow-2xl shadow-cyan-900/20 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              {/* Score Header */}
              <div className="text-center pt-8 pb-6 px-6 border-b border-slate-700/20">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3 font-medium">
                  Your Final Score
                </p>
                <div className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-violet-400 mb-2">
                  {lastScore.toLocaleString()}
                </div>
                <p className="text-slate-500 text-sm">
                  {game.name} • Game Complete
                </p>
              </div>

              {/* Content */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* NFT Preview Card */}
                  <div className="md:w-48 flex-shrink-0 mx-auto md:mx-0">
                    <div
                      className={`aspect-square rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center relative border-2 border-white/10 shadow-lg`}
                    >
                      <span className="text-6xl drop-shadow-lg">
                        {game.emoji}
                      </span>
                      <div className="absolute bottom-3 left-3 right-3 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 text-center">
                        <div className="text-xs text-slate-400 uppercase tracking-wider">
                          Score
                        </div>
                        <div className="text-lg font-bold text-white">
                          {lastScore.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mint Section */}
                  <div className="flex-1 min-w-0">
                    {mintStatus === "success" && mintResult ? (
                      <>
                        <h3 className="text-xl font-bold text-slate-50 mb-2">
                          🏆 Score Minted!
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">
                          Your achievement is now immortalized on-chain as a
                          unique NFT.
                        </p>

                        {mintResult.nftId && (
                          <div className="bg-[#111a2e] rounded-xl p-3 mb-4">
                            <div className="text-xs text-slate-500 mb-1">
                              NFT Object ID
                            </div>
                            <div className="text-xs text-slate-300 font-mono break-all">
                              {mintResult.nftId}
                            </div>
                          </div>
                        )}

                        <a
                          href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${mintResult.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-3 bg-[#111a2e] border border-cyan-400/20 text-cyan-400 rounded-xl text-sm font-medium text-center hover:bg-cyan-400/5 transition-colors mb-3"
                        >
                          ↗ View on Explorer
                        </a>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold text-slate-50 mb-2">
                          Mint Your Score Badge
                        </h3>
                        <p className="text-slate-400 text-sm mb-5">
                          Immortalize this achievement on-chain as a unique NFT.
                          Prove your skills forever.
                        </p>

                        {/* Score details */}
                        <div className="space-y-3 mb-5">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Game</span>
                            <span className="text-slate-200 font-medium">
                              {game.name}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Score</span>
                            <span className="text-slate-200 font-bold">
                              {lastScore.toLocaleString()}
                            </span>
                          </div>
                          {gameStore && gameStore.mintFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Mint Fee</span>
                              <span className="text-slate-200">
                                {(gameStore.mintFee / 1_000_000_000).toFixed(2)}{" "}
                                OCT
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Mint status messages */}
                        {mintStatus === "minting" && (
                          <div className="flex items-center gap-2 text-sm text-cyan-400 mb-4">
                            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            Sign in wallet to mint...
                          </div>
                        )}

                        {mintStatus === "error" && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-sm text-red-400">
                            ❌ {mintError}
                          </div>
                        )}

                        {/* Mint button */}
                        {account?.address ? (
                          <button
                            onClick={handleMint}
                            disabled={
                              isTxPending || mintStatus === "minting"
                            }
                            className="w-full px-5 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ✨ Mint NFT Badge
                          </button>
                        ) : (
                          <div className="text-xs text-amber-400 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-400/20 text-center">
                            Connect wallet to mint your score
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-6 md:px-8 pb-6 flex gap-3">
                <button
                  onClick={handleClosePopup}
                  className="flex-1 px-4 py-3 bg-[#111a2e] border border-slate-700/30 text-slate-300 rounded-xl font-medium text-sm hover:bg-[#0f1628] transition-colors"
                >
                  {mintStatus === "success" ? "Close" : "Play Again"}
                </button>
                {mintStatus !== "success" && (
                  <Link
                    href="/games"
                    className="px-4 py-3 bg-[#111a2e] border border-slate-700/30 text-slate-400 rounded-xl font-medium text-sm hover:bg-[#0f1628] transition-colors text-center"
                  >
                    Other Games
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
