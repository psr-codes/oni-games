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

  // ---- User-Pays Mint Flow ----
  // 1. Backend signs the score → returns {signature, nonce}
  // 2. Frontend builds tx calling mint_verified_score
  // 3. User's wallet signs & pays gas
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
      // Step 1: Get server signature from backend
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

      // Convert hex signature to byte array
      const sigBytes = Array.from(Buffer.from(signature, "hex"));

      // Step 2: Fetch live mint fee + treasury from on-chain GameStore
      const storeObj = await suiClient.getObject({
        id: GAME_STORE_ID,
        options: { showContent: true },
      });
      const storeFields = (storeObj.data?.content as any)?.fields;
      const mintFee = Number(storeFields?.mint_fee || 0);
      const treasury = storeFields?.treasury || "";

      console.log("[mint] Mint fee:", mintFee, "Treasury:", treasury);

      // Step 3: Build the transaction calling mint_verified_score
      const tx = new Transaction();

      // Collect mint fee (split from gas coin → transfer to treasury)
      if (mintFee > 0 && treasury) {
        const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(mintFee)]);
        tx.transferObjects([feeCoin], tx.pure.address(treasury));
      }

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::mint_verified_score`,
        arguments: [
          tx.object(GAME_STORE_ID),
          tx.pure.string(slug), // game_id
          tx.pure.string(gameName), // game_name
          tx.pure.u64(lastScore), // score
          tx.pure.string(imageUrl), // image_url
          tx.pure.u64(nonce), // nonce
          tx.pure.vector("u8", sigBytes), // signature
        ],
      });

      // Step 3: User's wallet signs & submits
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            // Wait for confirmation
            const txResponse = await suiClient.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            // Extract NFT object ID from created objects
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
                    disabled={isTxPending}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🏆 Mint as NFT
                    {gameStore && gameStore.mintFee > 0 && (
                      <span className="ml-1 text-xs opacity-75">
                        ({(gameStore.mintFee / 1_000_000_000).toFixed(2)} OCT)
                      </span>
                    )}
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
                Sign in wallet to mint...
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
