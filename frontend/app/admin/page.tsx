"use client";

import { useAdmin } from "@/hooks/useAdmin";
import { useGameStore } from "@/hooks/useGameStore";
import { useCasinoStore } from "@/hooks/useCasinoStore";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  PACKAGE_ID,
  MODULE,
  GAME_STORE_ID,
  ADMIN_CAP_ID,
  CASINO_MODULE,
  HOUSE_BANKROLL_ID,
  CASINO_ADMIN_CAP_ID,
} from "@/config";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, isConnected, address } = useAdmin();
  const { gameStore, isPending, refetch } = useGameStore();
  const { casinoStore, isPending: isCasinoPending, refetch: refetchCasino } = useCasinoStore();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();
  const client = useSuiClient();

  // Game Portal state
  const [mintFee, setMintFee] = useState("");
  const [treasury, setTreasury] = useState("");
  const [marketFeeBps, setMarketFeeBps] = useState("");
  const [serverKey, setServerKey] = useState("");

  // Casino state
  const [casinoHouseEdge, setCasinoHouseEdge] = useState("");
  const [casinoMinBet, setCasinoMinBet] = useState("");
  const [casinoMaxBet, setCasinoMaxBet] = useState("");
  const [casinoMaxPayout, setCasinoMaxPayout] = useState("");
  const [casinoServerKey, setCasinoServerKey] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"arcade" | "casino">("arcade");

  // Redirect non-admin users
  useEffect(() => {
    if (isConnected && !isAdmin) {
      router.push("/");
    }
  }, [isConnected, isAdmin, router]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-800 max-w-md">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Admin Access Required
          </h2>
          <p className="text-gray-400">
            Connect your admin wallet to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center p-8 bg-gray-900 rounded-2xl border border-red-800/50 max-w-md">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-xl font-bold text-white mb-2">Unauthorized</h2>
          <p className="text-gray-400">This wallet is not the admin wallet.</p>
        </div>
      </div>
    );
  }

  const clearStatus = () => setTimeout(() => setTxStatus(null), 5000);

  const executeAdminTx = (
    fnName: string,
    buildTx: (tx: Transaction) => void,
    successMsg: string,
    onSuccessCallback?: () => void,
  ) => {
    const tx = new Transaction();
    buildTx(tx);

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          await client.waitForTransaction({ digest: result.digest });
          setTxStatus({
            type: "success",
            message: `✅ ${successMsg} (tx: ${result.digest.slice(0, 12)}...)`,
          });
          refetch();
          refetchCasino();
          if (onSuccessCallback) onSuccessCallback();
          clearStatus();
        },
        onError: (err) => {
          setTxStatus({
            type: "error",
            message: `❌ ${fnName} failed: ${err.message}`,
          });
          clearStatus();
        },
      },
    );
  };

  const handleSetMintFee = () => {
    const feeInMist = Math.floor(parseFloat(mintFee) * 1_000_000_000);
    if (isNaN(feeInMist) || feeInMist < 0) return;

    executeAdminTx(
      "set_mint_fee",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::set_mint_fee`,
          arguments: [
            tx.object(ADMIN_CAP_ID),
            tx.object(GAME_STORE_ID),
            tx.pure.u64(feeInMist),
          ],
        });
      },
      `Mint fee updated to ${mintFee} OCT`,
      () => setMintFee(""),
    );
  };

  const handleSetTreasury = () => {
    if (!treasury.startsWith("0x") || treasury.length < 10) return;

    executeAdminTx(
      "set_treasury",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::set_treasury`,
          arguments: [
            tx.object(ADMIN_CAP_ID),
            tx.object(GAME_STORE_ID),
            tx.pure.address(treasury),
          ],
        });
      },
      `Treasury updated to ${treasury.slice(0, 10)}...`,
      () => setTreasury(""),
    );
  };

  const handleSetMarketFee = () => {
    const bps = parseInt(marketFeeBps);
    if (isNaN(bps) || bps < 0 || bps > 10000) return;

    executeAdminTx(
      "set_market_fee_bps",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::set_market_fee_bps`,
          arguments: [
            tx.object(ADMIN_CAP_ID),
            tx.object(GAME_STORE_ID),
            tx.pure.u64(bps),
          ],
        });
      },
      `Marketplace fee updated to ${bps} BPS (${(bps / 100).toFixed(2)}%)`,
      () => setMarketFeeBps(""),
    );
  };

  const handleSetServerKey = () => {
    // Accept hex string (64 chars = 32 bytes)
    const cleanKey = serverKey.replace(/^0x/, "").replace(/\s/g, "");
    if (cleanKey.length !== 64) {
      setTxStatus({
        type: "error",
        message: "❌ Server key must be 32 bytes (64 hex characters)",
      });
      clearStatus();
      return;
    }

    const keyBytes = Array.from(Buffer.from(cleanKey, "hex"));

    executeAdminTx(
      "set_server_public_key",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::set_server_public_key`,
          arguments: [
            tx.object(ADMIN_CAP_ID),
            tx.object(GAME_STORE_ID),
            tx.pure.vector("u8", keyBytes),
          ],
        });
      },
      "Server public key updated",
      () => setServerKey(""),
    );
  };

  // ============= Casino Handlers =============

  const handleSetCasinoHouseEdge = () => {
    const pct = parseFloat(casinoHouseEdge);
    if (isNaN(pct) || pct < 0) return;
    const bps = Math.round(pct * 100);
    executeAdminTx(
      "set_house_edge_bps",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::set_house_edge_bps`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.u64(bps),
          ],
        });
      },
      `House edge updated to ${pct}% (${bps} BPS)`,
      () => setCasinoHouseEdge(""),
    );
  };

  const handleSetBetLimits = () => {
    const minMist = Math.floor(parseFloat(casinoMinBet) * 1_000_000_000);
    const maxMist = Math.floor(parseFloat(casinoMaxBet) * 1_000_000_000);
    if (isNaN(minMist) || isNaN(maxMist) || minMist <= 0 || maxMist < minMist) return;
    executeAdminTx(
      "set_bet_limits",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::set_bet_limits`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.u64(minMist),
            tx.pure.u64(maxMist),
          ],
        });
      },
      `Bet limits: ${casinoMinBet} - ${casinoMaxBet} OCT`,
      () => { setCasinoMinBet(""); setCasinoMaxBet(""); },
    );
  };

  const handleSetMaxPayout = () => {
    const pct = parseFloat(casinoMaxPayout);
    if (isNaN(pct) || pct <= 0) return;
    const bps = Math.round(pct * 100);
    executeAdminTx(
      "set_max_payout_bps",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::set_max_payout_bps`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.u64(bps),
          ],
        });
      },
      `Max payout updated to ${pct}% (${bps} BPS)`,
      () => setCasinoMaxPayout(""),
    );
  };

  const handleSetCasinoServerKey = () => {
    const cleanKey = casinoServerKey.replace(/^0x/, "").replace(/\s/g, "");
    if (cleanKey.length !== 64) {
      setTxStatus({ type: "error", message: "❌ Server key must be 32 bytes (64 hex characters)" });
      clearStatus();
      return;
    }
    const keyBytes = Array.from(Buffer.from(cleanKey, "hex"));
    executeAdminTx(
      "set_server_public_key (casino)",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::set_server_public_key`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.vector("u8", keyBytes),
          ],
        });
      },
      "Casino server public key updated",
      () => setCasinoServerKey(""),
    );
  };

  const handleTogglePause = () => {
    const newPaused = !casinoStore?.paused;
    executeAdminTx(
      "set_paused",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::set_paused`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.bool(newPaused),
          ],
        });
      },
      `Casino ${newPaused ? "PAUSED" : "UNPAUSED"}`,
    );
  };

  const handleFundBankroll = () => {
    const amountMist = Math.floor(parseFloat(fundAmount) * 1_000_000_000);
    if (isNaN(amountMist) || amountMist <= 0) return;
    executeAdminTx(
      "fund_bankroll",
      (tx) => {
        const [coin] = tx.splitCoins(tx.gas, [amountMist]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::fund_bankroll`,
          arguments: [
            tx.object(HOUSE_BANKROLL_ID),
            coin,
          ],
        });
      },
      `Bankroll funded with ${fundAmount} OCT`,
      () => setFundAmount(""),
    );
  };

  const handleWithdrawBankroll = () => {
    const amountMist = Math.floor(parseFloat(withdrawAmount) * 1_000_000_000);
    if (isNaN(amountMist) || amountMist <= 0) return;
    executeAdminTx(
      "withdraw_bankroll",
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::withdraw_bankroll`,
          arguments: [
            tx.object(CASINO_ADMIN_CAP_ID),
            tx.object(HOUSE_BANKROLL_ID),
            tx.pure.u64(amountMist),
          ],
        });
      },
      `Withdrew ${withdrawAmount} OCT from bankroll`,
      () => setWithdrawAmount(""),
    );
  };

  const formatOCT = (mist: number) => (mist / 1_000_000_000).toFixed(4);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-amber-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          </div>
          <div className="flex gap-3 ml-auto">
            <button
              onClick={() => setActiveTab("arcade")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "arcade"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              🕹️ Arcade
            </button>
            <button
              onClick={() => setActiveTab("casino")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "casino"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              🎰 Casino
            </button>
          </div>
          <p className="text-gray-400">
            Manage smart contract configuration on OneChain testnet.
          </p>
          <p className="text-xs text-gray-600 mt-1 font-mono">
            Wallet: {address}
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
        {isPending ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* =============== ARCADE TAB =============== */}
            {activeTab === "arcade" && (
              <>
                {/* Overview Card */}
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold text-white mb-4">
                    📊 Arcade Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {gameStore?.totalMinted ?? 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Total NFTs Minted</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {formatOCT(gameStore?.mintFee ?? 0)} OCT
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Mint Fee</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {((gameStore?.marketFeeBps ?? 0) / 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Market Fee</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white truncate text-sm" title={gameStore?.treasury}>
                        {gameStore?.treasury ? `${gameStore.treasury.slice(0, 8)}...` : "N/A"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Treasury</div>
                    </div>
                  </div>
                </div>

                <ConfigCard
                  title="💰 Mint Fee"
                  description="Fee charged when minting Score NFTs (in OCT). Set to 0 for free minting."
                  currentValue={`${formatOCT(gameStore?.mintFee ?? 0)} OCT (${gameStore?.mintFee ?? 0} MIST)`}
                >
                  <div className="flex gap-3">
                    <input type="number" step="0.01" min="0" placeholder="Fee in OCT (e.g. 0.1)" value={mintFee} onChange={(e) => setMintFee(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
                    <button onClick={handleSetMintFee} disabled={isTxPending || !mintFee} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                </ConfigCard>

                <ConfigCard title="🏦 Treasury Address" description="Where mint fees and marketplace cuts are sent." currentValue={gameStore?.treasury ?? "N/A"}>
                  <div className="flex gap-3">
                    <input type="text" placeholder="0x..." value={treasury} onChange={(e) => setTreasury(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm" />
                    <button onClick={handleSetTreasury} disabled={isTxPending || !treasury} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                </ConfigCard>

                <ConfigCard title="🏷️ Marketplace Fee (BPS)" description="Fee taken from NFT sales. 100 BPS = 1%, 250 BPS = 2.5%, max 10000." currentValue={`${gameStore?.marketFeeBps ?? 0} BPS (${((gameStore?.marketFeeBps ?? 0) / 100).toFixed(2)}%)`}>
                  <div className="flex gap-3">
                    <input type="number" min="0" max="10000" placeholder="BPS (e.g. 250 for 2.5%)" value={marketFeeBps} onChange={(e) => setMarketFeeBps(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors" />
                    <button onClick={handleSetMarketFee} disabled={isTxPending || !marketFeeBps} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                  {marketFeeBps && !isNaN(parseInt(marketFeeBps)) && (
                    <p className="text-xs text-gray-500 mt-2">Preview: {(parseInt(marketFeeBps) / 100).toFixed(2)}% of each sale</p>
                  )}
                </ConfigCard>

                <ConfigCard title="🔑 Server Public Key (ed25519)" description="Backend server's public key for verifying user-submitted mint signatures. 32 bytes (64 hex chars)." currentValue={gameStore?.serverPublicKey ? `0x${gameStore.serverPublicKey}` : "⚠️ Not set — mint_verified_score will fail"} warning={!gameStore?.serverPublicKey}>
                  <div className="flex gap-3">
                    <input type="text" placeholder="64 hex characters (32 bytes)" value={serverKey} onChange={(e) => setServerKey(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm" />
                    <button onClick={handleSetServerKey} disabled={isTxPending || !serverKey} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                  {serverKey && <p className="text-xs text-gray-500 mt-2">Length: {serverKey.replace(/^0x/, "").replace(/\s/g, "").length}/64 hex chars</p>}
                </ConfigCard>

                <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 p-6">
                  <h2 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Contract Info</h2>
                  <div className="space-y-2 text-sm font-mono">
                    <InfoRow label="Package ID" value={PACKAGE_ID} />
                    <InfoRow label="GameStore ID" value={GAME_STORE_ID} />
                    <InfoRow label="AdminCap ID" value={ADMIN_CAP_ID} />
                    <InfoRow label="Module" value={MODULE} />
                  </div>
                </div>
              </>
            )}

            {/* =============== CASINO TAB =============== */}
            {activeTab === "casino" && (
              <>
                {/* Casino Overview */}
                <div className="bg-gray-900 rounded-2xl border border-amber-800/30 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">🎰 Casino Overview</h2>
                    <button
                      onClick={handleTogglePause}
                      disabled={isTxPending}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        casinoStore?.paused
                          ? "bg-green-600 hover:bg-green-500 text-white"
                          : "bg-red-600 hover:bg-red-500 text-white"
                      }`}
                    >
                      {casinoStore?.paused ? "▶ Unpause Casino" : "⏸ Pause Casino"}
                    </button>
                  </div>
                  {casinoStore?.paused && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                      ⚠️ Casino is currently PAUSED — no wagers can be placed.
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-950 rounded-xl p-4 border border-amber-800/20">
                      <div className="text-2xl font-bold text-amber-400">
                        {formatOCT(casinoStore?.bankrollBalance ?? 0)} OCT
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Bankroll Balance</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {casinoStore?.totalGames ?? 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Total Games</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {formatOCT(casinoStore?.totalWagers ?? 0)} OCT
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Total Wagered</div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-2xl font-bold text-white">
                        {formatOCT(casinoStore?.totalPayouts ?? 0)} OCT
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Total Payouts</div>
                    </div>
                  </div>
                </div>

                {/* Fund / Withdraw Bankroll */}
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold text-white mb-1">💰 Bankroll Management</h2>
                  <p className="text-sm text-gray-500 mb-4">Add or remove liquidity from the house bankroll.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-sm font-medium text-green-400 mb-2">Fund Bankroll</div>
                      <div className="flex gap-3">
                        <input type="number" step="0.01" min="0" placeholder="Amount in OCT" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-500 transition-colors" />
                        <button onClick={handleFundBankroll} disabled={isTxPending || !fundAmount} className="px-5 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">Fund</button>
                      </div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                      <div className="text-sm font-medium text-red-400 mb-2">Withdraw (Admin Only)</div>
                      <div className="flex gap-3">
                        <input type="number" step="0.01" min="0" placeholder="Amount in OCT" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 transition-colors" />
                        <button onClick={handleWithdrawBankroll} disabled={isTxPending || !withdrawAmount} className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">Withdraw</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* House Edge */}
                <ConfigCard title="📊 House Edge (%)" description="House advantage on games. Enter a percentage (e.g., 2.5 for 2.5%)." currentValue={`${casinoStore?.houseEdgeBps ?? 0} BPS (${((casinoStore?.houseEdgeBps ?? 0) / 100).toFixed(2)}%)`}>
                  <div className="flex gap-3">
                    <input type="number" min="0" step="0.1" placeholder="% (e.g. 2.5 for 2.5%)" value={casinoHouseEdge} onChange={(e) => setCasinoHouseEdge(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    <button onClick={handleSetCasinoHouseEdge} disabled={isTxPending || !casinoHouseEdge} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                </ConfigCard>

                {/* Bet Limits */}
                <ConfigCard title="🎯 Bet Limits" description="Min and max wager amounts in OCT." currentValue={`Min: ${formatOCT(casinoStore?.minBet ?? 0)} OCT — Max: ${formatOCT(casinoStore?.maxBet ?? 0)} OCT`}>
                  <div className="flex gap-3">
                    <input type="number" step="0.001" min="0" placeholder="Min bet (OCT)" value={casinoMinBet} onChange={(e) => setCasinoMinBet(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    <input type="number" step="0.01" min="0" placeholder="Max bet (OCT)" value={casinoMaxBet} onChange={(e) => setCasinoMaxBet(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    <button onClick={handleSetBetLimits} disabled={isTxPending || !casinoMinBet || !casinoMaxBet} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                </ConfigCard>

                {/* Max Payout */}
                <ConfigCard title="🛡️ Max Payout (% of Bankroll)" description="Maximum payout as a % of bankroll per game. Enter a percentage (e.g., 50 for 50%)." currentValue={`${casinoStore?.maxPayoutBps ?? 0} BPS (${((casinoStore?.maxPayoutBps ?? 0) / 100).toFixed(2)}%)`}>
                  <div className="flex gap-3">
                    <input type="number" min="0.1" step="0.1" placeholder="% (e.g. 50 for 50%)" value={casinoMaxPayout} onChange={(e) => setCasinoMaxPayout(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    <button onClick={handleSetMaxPayout} disabled={isTxPending || !casinoMaxPayout} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                </ConfigCard>

                {/* Casino Server Key */}
                <ConfigCard title="🔑 Casino Server Key (ed25519)" description="Server's public key for verifying session resolution signatures. Same key as Arcade or a separate one." currentValue={casinoStore?.serverPublicKey ? `0x${casinoStore.serverPublicKey}` : "⚠️ Not set — resolve_session will fail"} warning={!casinoStore?.serverPublicKey}>
                  <div className="flex gap-3">
                    <input type="text" placeholder="64 hex characters (32 bytes)" value={casinoServerKey} onChange={(e) => setCasinoServerKey(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition-colors font-mono text-sm" />
                    <button onClick={handleSetCasinoServerKey} disabled={isTxPending || !casinoServerKey} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors">{isTxPending ? "..." : "Update"}</button>
                  </div>
                  {casinoServerKey && <p className="text-xs text-gray-500 mt-2">Length: {casinoServerKey.replace(/^0x/, "").replace(/\s/g, "").length}/64 hex chars</p>}
                </ConfigCard>

                {/* Casino Contract Info */}
                <div className="bg-gray-900/50 rounded-2xl border border-gray-800/50 p-6">
                  <h2 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Casino Contract Info</h2>
                  <div className="space-y-2 text-sm font-mono">
                    <InfoRow label="Package ID" value={PACKAGE_ID} />
                    <InfoRow label="Bankroll ID" value={HOUSE_BANKROLL_ID} />
                    <InfoRow label="AdminCap ID" value={CASINO_ADMIN_CAP_ID} />
                    <InfoRow label="Module" value={CASINO_MODULE} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Sub-components --

function ConfigCard({
  title,
  description,
  currentValue,
  warning,
  children,
}: {
  title: string;
  description: string;
  currentValue: string;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div
        className={`mb-4 px-4 py-3 rounded-xl text-sm font-mono break-all ${
          warning
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
            : "bg-gray-950 border border-gray-800 text-gray-300"
        }`}
      >
        <span className="text-xs text-gray-500 block mb-1">Current:</span>
        {currentValue}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span className="text-gray-500 min-w-[120px]">{label}:</span>
      <span className="text-gray-300 break-all">{value}</span>
    </div>
  );
}
