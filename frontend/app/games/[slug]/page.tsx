"use client";

import { useParams } from "next/navigation";
import { GAMES } from "@/game-store/registry";
import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";

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

  const [lastScore, setLastScore] = useState<number | null>(null);
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintError, setMintError] = useState<string>("");

  // Dynamically load the game component (code-split)
  const GameComponent = useMemo(() => {
    if (!game) return null;
    return dynamic(() => game.component(), {
      ssr: false,
      loading: () => (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ),
    });
  }, [game]);

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score);
    setMintStatus("idle");
    setMintResult(null);
    setMintError("");
  }, []);

  const handleScoreChange = useCallback(() => {}, []);

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
      const res = await fetch("/api/mint", {
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
        throw new Error(data.error || data.details || "Mint failed");
      }

      setMintResult({
        digest: data.digest,
        nftId: data.nftId,
      });
      setMintStatus("success");
    } catch (err: any) {
      setMintError(err.message || "Failed to mint NFT");
      setMintStatus("error");
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-800 max-w-md">
          <div className="text-4xl mb-4">🕹️</div>
          <h2 className="text-xl font-bold text-white mb-2">Game Not Found</h2>
          <p className="text-gray-400 mb-6">
            The game &quot;{slug}&quot; doesn&apos;t exist in the arcade.
          </p>
          <Link
            href="/games"
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
          >
            ← Back to Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header bar */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/games"
              className="text-gray-500 hover:text-white transition-colors text-sm"
            >
              ← Games
            </Link>
            <div className="w-px h-6 bg-gray-800" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">{game.emoji}</span>
              <h1 className="text-lg font-bold text-white">{game.name}</h1>
            </div>
          </div>

          {/* Score + Mint Status */}
          <div className="flex items-center gap-3">
            {lastScore !== null && mintStatus === "idle" && (
              <>
                <div className="text-sm text-gray-400">
                  Score:{" "}
                  <span className="text-purple-400 font-bold">{lastScore}</span>
                </div>
                {account?.address ? (
                  <button
                    onClick={handleMint}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-900/30"
                  >
                    🏆 Mint as NFT
                  </button>
                ) : (
                  <div className="text-xs text-amber-400 bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-500/20">
                    Connect wallet to mint
                  </div>
                )}
              </>
            )}

            {mintStatus === "minting" && (
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Minting on-chain...
              </div>
            )}

            {mintStatus === "success" && mintResult && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-green-400 flex items-center gap-1">
                  ✅ NFT Minted!
                </div>
                <a
                  href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${mintResult.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 underline hover:text-purple-300"
                >
                  View Tx ↗
                </a>
              </div>
            )}

            {mintStatus === "error" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">❌ {mintError}</span>
                <button
                  onClick={() => setMintStatus("idle")}
                  className="text-xs text-gray-500 hover:text-white underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-center">
          {GameComponent && (
            <GameComponent
              onGameOver={handleGameOver}
              onScoreChange={handleScoreChange}
            />
          )}
        </div>
      </div>

      {/* Mint Success Modal */}
      {mintStatus === "success" && mintResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Score Minted!
            </h3>
            <p className="text-purple-400 text-3xl font-bold mb-1">
              {lastScore} pts
            </p>
            <p className="text-gray-500 text-sm mb-6">{game.name}</p>

            {mintResult.nftId && (
              <div className="bg-gray-950 rounded-xl p-3 mb-4 text-left">
                <div className="text-xs text-gray-500 mb-1">NFT Object ID</div>
                <div className="text-xs text-gray-300 font-mono break-all">
                  {mintResult.nftId}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <a
                href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${mintResult.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                View on Explorer ↗
              </a>
              <button
                onClick={() => setMintStatus("idle")}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
