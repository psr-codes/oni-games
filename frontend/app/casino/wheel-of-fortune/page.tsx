"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import {
  PACKAGE_ID,
  CASINO_MODULE,
  HOUSE_BANKROLL_ID,
  COIN_TYPE,
} from "@/config";
import { useCasinoStore } from "@/hooks/useCasinoStore";
import { useSessionHistory, SessionHistoryEntry } from "@/hooks/useSessionHistory";

// ─── OniGames · Wheel of Fortune ─────────────────────────────────────────
// EV math:  0×6 + 1.5×3 + 2×2 + 3×1  =  11.5 / 12  =  0.9583
// House edge ≈ 4.17%
// Segment layout interleaved so every bust sits between two wins.
// Uses session model: lock_wager → spin → resolve_session

const N = 12;
const SEG_DEG = 360 / N; // 30° per segment
const SZ = 300;
const CX = SZ / 2;
const CY = SZ / 2;
const R_OUT = 122;
const R_LBL = 84;
const R_HUB = 26;
const MIST_PER_OCT = 1_000_000_000;
const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1];

// Perfectly interleaved: bust, win, bust, win ...
// [0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2]  EV = 0.9583
interface SegData {
  mul: number;
  mulBps: number;
  label: string;
  col: string;
  bg: string;
}
const SEGS: SegData[] = [
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 1.5, mulBps: 15000, label: "1.5×", col: "#00d4c8", bg: "#021615" },
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 2,   mulBps: 20000, label: "2×",   col: "#00e5a0", bg: "#031310" },
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 1.5, mulBps: 15000, label: "1.5×", col: "#00d4c8", bg: "#021615" },
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 3,   mulBps: 30000, label: "3×",   col: "#f5c542", bg: "#161000" },
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 1.5, mulBps: 15000, label: "1.5×", col: "#00d4c8", bg: "#021615" },
  { mul: 0,   mulBps: 0,     label: "0×",   col: "#ff4d6d", bg: "#1a040a" },
  { mul: 2,   mulBps: 20000, label: "2×",   col: "#00e5a0", bg: "#031310" },
];

const UNIQUE_MULS = [0, 1.5, 2, 3];

const toRad = (d: number) => (d * Math.PI) / 180;

function slicePath(i: number) {
  const a0 = toRad(i * SEG_DEG - SEG_DEG / 2 - 90);
  const a1 = toRad(i * SEG_DEG + SEG_DEG / 2 - 90);
  const x0 = (CX + R_OUT * Math.cos(a0)).toFixed(3);
  const y0 = (CY + R_OUT * Math.sin(a0)).toFixed(3);
  const x1 = (CX + R_OUT * Math.cos(a1)).toFixed(3);
  const y1 = (CY + R_OUT * Math.sin(a1)).toFixed(3);
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} Z`;
}

function lblPos(i: number) {
  const a = toRad(i * SEG_DEG - 90);
  return {
    x: (CX + R_LBL * Math.cos(a)).toFixed(2),
    y: (CY + R_LBL * Math.sin(a)).toFixed(2),
    rot: i * SEG_DEG,
  };
}

export default function WheelOfFortunePage() {
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 250;

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Balance & Wallet
  const [balance, setBalance] = useState<number>(0);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Game UI State
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "locking" | "spinning" | "resolving" | "result">("idle");
  const [bet, setBet] = useState<number>(0.01);
  const [winIdx, setWinIdx] = useState<number | null>(null);
  const [result, setResult] = useState<{
    seg: SegData;
    segIdx: number;
    pnl: number;
    payout: number;
    won: boolean;
    digest?: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ seg: SegData; pnl: number; won: boolean; bet: number; digest?: string }>
  >([]);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);

  const rotRef = useRef(0);
  const winRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const balanceOCT = balance / MIST_PER_OCT;
  const canSpin = phase === "idle" && bet > 0 && bet <= balanceOCT && !!account?.address;

  // Fetch OCT Balance
  const fetchBalance = useCallback(async () => {
    if (!account?.address) {
      setBalance(0);
      setIsAuthChecking(false);
      return;
    }
    try {
      const { totalBalance } = await suiClient.getBalance({
        owner: account.address,
        coinType: COIN_TYPE,
      });
      setBalance(Number(totalBalance));
    } catch {
      setBalance(0);
    } finally {
      setIsAuthChecking(false);
    }
  }, [account, suiClient]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Load on-chain session history (persists across page refreshes)
  const { history: onChainHistory, refetchHistory } = useSessionHistory(
    account?.address,
    "wheel_of_fortune",
    10,
  );

  // Merge on-chain history with in-session history (dedup by digest)
  const mergedHistory = (() => {
    const digestSet = new Set(history.map((h) => h.digest).filter(Boolean));
    const onChainMapped = onChainHistory
      .filter((e) => !digestSet.has(e.digest))
      .map((e) => {
        // Map multiplierBps back to a segment color/label
        const matchSeg = SEGS.find((s) => s.mulBps === e.multiplierBps) || SEGS[0];
        return {
          seg: matchSeg,
          pnl: e.pnl,
          won: e.won,
          bet: e.wagerOCT,
          digest: e.digest,
        };
      });
    return [...history, ...onChainMapped].slice(0, 10);
  })();

  const netPL = mergedHistory.reduce((s, h) => s + h.pnl, 0);

  // ── Spin ─────────────────────────────────────────────────────────────────
  const doSpin = () => {
    if (!canSpin || !account) return;

    // Reset
    setWinIdx(null);
    setResult(null);
    firedRef.current = false;
    setPhase("locking");

    // 1. lock_wager on-chain
    const betMist = Math.floor(bet * MIST_PER_OCT);
    const tx = new Transaction();
    const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betMist)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${CASINO_MODULE}::lock_wager`,
      arguments: [
        tx.object(HOUSE_BANKROLL_ID),
        wagerCoin,
        tx.pure.string("wheel_of_fortune"),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res) => {
          try {
            const txRes = await suiClient.waitForTransaction({
              digest: res.digest,
              options: { showEvents: true },
            });

            const createdEvent = txRes.events?.find((e) =>
              e.type.includes("SessionCreated")
            );

            if (createdEvent && createdEvent.parsedJson) {
              const parsed = createdEvent.parsedJson as Record<string, unknown>;
              const sId = parsed.session_id as string;
              setSessionId(sId);
            }

            fetchBalance();

            // 2. Now determine the outcome and start spinning
            const segIdx = Math.floor(Math.random() * N);
            winRef.current = segIdx;

            const targetMod = ((-segIdx * SEG_DEG) % 360 + 360) % 360;
            const currentMod = ((rotRef.current) % 360 + 360) % 360;
            const extra = (targetMod - currentMod + 360) % 360;
            const finalRot = rotRef.current + 5 * 360 + extra;

            rotRef.current = finalRot;
            setSpinning(true);
            setPhase("spinning");
            setRotation(finalRot);
          } catch (e) {
            console.error("Failed to parse lock_wager event:", e);
            resetGame();
          }
        },
        onError: (err) => {
          console.error("Lock Wager failed:", err);
          resetGame();
        },
      }
    );
  };

  // ── Settle on transition end ──────────────────────────────────────────────
  const onSpinEnd = async (e: React.TransitionEvent<SVGGElement>) => {
    if (e.propertyName !== "transform" || firedRef.current) return;
    firedRef.current = true;
    setSpinning(false);

    const segIdx = winRef.current!;
    const seg = SEGS[segIdx];
    const won = seg.mul > 0;

    setWinIdx(segIdx);

    if (!won) {
      // Option B: Player lost. House already has the wager. No transaction needed.
      const pnl = -bet;
      const resObj = { seg, segIdx, pnl, payout: 0, won: false };
      setResult(resObj);
      setHistory((h) => [{ seg, pnl, won: false, bet }, ...h].slice(0, 8));
      setSessionId(null);
      setPhase("result");
      return;
    }

    // Player won — resolve session on-chain
    if (!sessionId || !account) {
      console.error("Missing session ID for resolution");
      resetGame();
      return;
    }

    setPhase("resolving");

    try {
      // Get backend signature
      const apiRes = await fetch("/api/resolve-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          playerAddress: account.address,
          multiplierBps: seg.mulBps,
        }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error);

      // Submit resolve_session transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::resolve_session`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(sessionId),
          tx.pure(bcs.u64().serialize(seg.mulBps)),
          tx.pure(bcs.u64().serialize(data.nonce)),
          tx.pure("vector<u8>", Array.from(Buffer.from(data.signature, "hex"))),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (txResult) => {
            await suiClient.waitForTransaction({ digest: txResult.digest });
            fetchBalance();

            const payout = bet * seg.mul;
            const pnl = payout - bet;
            const resObj = { seg, segIdx, pnl, payout, won: true, digest: txResult.digest };
            setResult(resObj);
            setHistory((h) => [{ seg, pnl, won: true, bet, digest: txResult.digest }, ...h].slice(0, 8));
            setSessionId(null);
            setPhase("result");
          },
          onError: (err) => {
            console.error("resolve_session failed:", err);
            alert("Failed to sign payout transaction.");
            setPhase("result");
          },
        }
      );
    } catch (err) {
      console.error("Resolution flow error:", err);
      alert("Failed to resolve session.");
      setPhase("result");
    }
  };

  const resetGame = () => {
    setPhase("idle");
    setWinIdx(null);
    setResult(null);
    setSessionId(null);
  };

  // Render helpers
  const ringColor =
    phase === "result" && result
      ? result.won
        ? result.seg.col
        : "#ff4d6d"
      : "#243040";

  const isWaiting = phase === "locking" || phase === "resolving";

  if (isAuthChecking) {
    return <div className="min-h-screen bg-[#0a0f1e]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] font-sans pb-20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .wf   { font-family:'Outfit',sans-serif; color:#fff; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .lbl  { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:8px; }

        @keyframes rise    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes rowIn   { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:none} }
        @keyframes breathe { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spinGlow{ 0%,100%{box-shadow:0 0 0 0 rgba(0,212,200,0)} 50%{box-shadow:0 0 28px 8px rgba(0,212,200,.28)} }
        @keyframes winPulse{ 0%,100%{opacity:.8} 50%{opacity:1} }
        @keyframes pulseResolve { 0%,100%{opacity:0.6} 50%{opacity:1} }

        .rise { animation:rise .32s ease; }
        .hrow { animation:rowIn .22s ease; }

        .spin-btn { width:100%; padding:16px; border-radius:14px; border:none; font-family:'Outfit',sans-serif; font-size:17px; font-weight:800; cursor:pointer; transition:all .18s; }
        .sb-on   { background:#00d4c8; color:#071218; animation:spinGlow 2s ease infinite; }
        .sb-on:hover { background:#00f0e0; transform:translateY(-1px); }
        .sb-off  { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .sb-spin { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .75s ease infinite; }

        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }

        .qb { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }
        .sc { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 8px; text-align:center; }

        .outcome-card { flex:1 1 60px; padding:10px 6px; border-radius:11px; background:#0d1526; text-align:center; transition:all .3s; }
      `}</style>

      {/* Top Nav */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/casino"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span> Back to Casino
        </Link>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-[#1a2540] rounded-xl border border-slate-700/50 flex gap-2 text-sm font-medium">
            <span className="text-slate-400">House Edge:</span>
            <span className="text-cyan-400">~4.17%</span>
          </div>
        </div>
      </div>

      <div className="wf pt-6">
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 999, padding: "5px 16px", marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4c8", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>Session Play · Block Hash Seeded</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5, margin: 0 }}>Wheel of Fortune</h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>Spin the wheel. Half the segments bust. Win up to 3× your bet.</p>
          </div>

          {/* Balance */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 13, padding: "12px 17px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>Balance</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: balanceOCT > 0 ? "#00e5a0" : "#fff" }}>
              {balanceOCT.toLocaleString()} <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>OCT</span>
            </span>
          </div>

          {!account?.address ? (
            <div className="text-center py-10 bg-[#0d1526] rounded-xl border border-slate-700/50 mb-10">
              <span className="text-4xl mb-4 block">👛</span>
              <p className="text-slate-300 font-medium">Connect wallet to play</p>
            </div>
          ) : (
            <>
              {/* Resolving overlay */}
              {isWaiting && (
                <div className="rise" style={{ textAlign: "center", marginBottom: 14, padding: "14px 18px", borderRadius: 13, background: "rgba(0,212,200,.06)", border: "1.5px solid rgba(0,212,200,.3)", animation: "pulseResolve 1.5s ease infinite" }}>
                  <div className="w-6 h-6 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#00d4c8" }}>
                    {phase === "locking" ? "Locking wager on-chain..." : "Resolving payout..."}
                  </div>
                  <div style={{ fontSize: 11, color: "#7a8fb0", marginTop: 3 }}>Approve transaction in wallet</div>
                </div>
              )}

              {/* SVG Wheel */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, position: "relative" }}>
                <svg
                  width={SZ}
                  height={SZ}
                  viewBox={`0 0 ${SZ} ${SZ}`}
                  style={{ overflow: "visible", maxWidth: "100%" }}
                >
                  <defs>
                    <filter id="win-glow" x="-25%" y="-25%" width="150%" height="150%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Outer decorative rings */}
                  <circle cx={CX} cy={CY} r={R_OUT + 17} fill="none" stroke="#0c1420" strokeWidth="6" />
                  <circle
                    cx={CX}
                    cy={CY}
                    r={R_OUT + 10}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="3.5"
                    style={{
                      transition: "stroke .6s ease, filter .6s ease",
                      filter: phase === "result" ? `drop-shadow(0 0 10px ${ringColor})` : "none",
                    }}
                  />
                  <circle cx={CX} cy={CY} r={R_OUT + 4} fill="none" stroke="#1a2640" strokeWidth="1" />

                  {/* Pointer — NOT inside the rotating group */}
                  <polygon
                    points={`${CX - 11},${CY - R_OUT - 18} ${CX + 11},${CY - R_OUT - 18} ${CX},${CY - R_OUT + 3}`}
                    fill="#ffffff"
                    stroke="#0a0f1e"
                    strokeWidth="2"
                    style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,.8))" }}
                  />

                  {/* Rotating group */}
                  <g
                    onTransitionEnd={onSpinEnd}
                    style={{
                      transformOrigin: `${CX}px ${CY}px`,
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning
                        ? "transform 4.8s cubic-bezier(0.08, 0.82, 0.06, 1)"
                        : "none",
                    }}
                  >
                    {/* Segment fills + labels */}
                    {SEGS.map((seg, i) => {
                      const isWin = winIdx === i && phase === "result";
                      const lp = lblPos(i);
                      return (
                        <g key={i}>
                          <path
                            d={slicePath(i)}
                            fill={seg.bg}
                            stroke={isWin ? seg.col : seg.col + "50"}
                            strokeWidth={isWin ? "2.5" : "0.8"}
                            filter={isWin ? "url(#win-glow)" : undefined}
                          />
                          <text
                            x={lp.x}
                            y={lp.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={seg.col}
                            fontSize={seg.mul === 3 ? "11.5" : "9.5"}
                            fontWeight={seg.mul >= 2 ? 800 : 700}
                            fontFamily="'JetBrains Mono', monospace"
                            transform={`rotate(${lp.rot}, ${lp.x}, ${lp.y})`}
                            style={{ userSelect: "none", pointerEvents: "none" }}
                          >
                            {seg.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Segment dividers */}
                    {SEGS.map((_, i) => {
                      const a = toRad(i * SEG_DEG - SEG_DEG / 2 - 90);
                      const x1 = (CX + (R_HUB + 2) * Math.cos(a)).toFixed(2);
                      const y1 = (CY + (R_HUB + 2) * Math.sin(a)).toFixed(2);
                      const x2 = (CX + R_OUT * Math.cos(a)).toFixed(2);
                      const y2 = (CY + R_OUT * Math.sin(a)).toFixed(2);
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#0a0f1e"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  </g>

                  {/* Fixed center hub */}
                  <circle cx={CX} cy={CY} r={R_HUB} fill="#060c18" stroke="#243040" strokeWidth="2.5" />
                  <circle
                    cx={CX}
                    cy={CY}
                    r={14}
                    fill={phase === "result" && result ? result.seg.col : "#00d4c8"}
                    stroke="#0a0f1e"
                    strokeWidth="2"
                    style={{ transition: "fill .5s" }}
                  />
                  <circle cx={CX} cy={CY} r={5} fill="#0a0f1e" />
                </svg>
              </div>

              {/* Result banner */}
              {phase === "result" && result && (
                <div
                  className="rise"
                  style={{
                    textAlign: "center",
                    marginBottom: 14,
                    padding: "14px 18px",
                    borderRadius: 13,
                    background: result.won ? "rgba(0,229,160,.08)" : "rgba(255,77,109,.08)",
                    border: `1.5px solid ${result.won ? "#00e5a0" : "#ff4d6d"}`,
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: result.won ? "#00e5a0" : "#ff4d6d" }}>
                    {result.won ? `${result.seg.label} — You Win!` : "0× — You Busted!"}
                  </div>
                  <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 4 }}>
                    {result.won ? (
                      <>
                        <span style={{ color: "#00e5a0", fontWeight: 700 }}>
                          +{result.pnl.toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT
                        </span>
                        {" · "}
                        {result.seg.label} payout
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#ff4d6d", fontWeight: 700 }}>
                          −{bet.toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT
                        </span>
                        {" · Better luck next spin"}
                      </>
                    )}
                    {result.digest && (
                      <div className="mt-2">
                        <a
                          href={`https://onescan.cc/testnet/tx/${result.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-mono text-xs transition-colors"
                        >
                          {result.digest.slice(0, 10)}...{result.digest.slice(-6)} ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Outcomes strip */}
              <div style={{ marginBottom: 14 }}>
                <div className="lbl">Outcomes &amp; Odds</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {UNIQUE_MULS.map((mul) => {
                    const seg = SEGS.find((s) => s.mul === mul)!;
                    const count = SEGS.filter((s) => s.mul === mul).length;
                    const prob = ((count / N) * 100).toFixed(0);
                    const payout = mul > 0 ? bet * mul : 0;
                    const isWinSeg = phase === "result" && result?.seg.mul === mul;
                    return (
                      <div
                        key={mul}
                        className="outcome-card"
                        style={{
                          border: `1.5px solid ${isWinSeg ? seg.col : seg.col + "35"}`,
                          background: isWinSeg ? `${seg.col}18` : "#0d1526",
                          boxShadow: isWinSeg ? `0 0 16px ${seg.col}44` : "none",
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 800, color: seg.col }}>{seg.label}</div>
                        <div style={{ fontSize: 10, color: "#3a4f70", marginTop: 2 }}>
                          {count}/{N} · {prob}%
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: mul > 0 ? "#c0cfea" : "#ff4d6d" }}
                        >
                          {mul > 0
                            ? `+${(payout - bet).toLocaleString(undefined, { maximumFractionDigits: 3 })}`
                            : `−${bet.toLocaleString(undefined, { maximumFractionDigits: 3 })}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* House edge callout */}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 13px",
                    borderRadius: 10,
                    background: "#060c18",
                    border: "1px solid #1a2640",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#3a4f70" }}>Player EV: </span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#00d4c8" }}>
                      0.9583 per OCT
                    </span>
                  </div>
                  <div style={{ width: 1, height: 24, background: "#1a2640" }} />
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#3a4f70" }}>House edge: </span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#00e5a0" }}>
                      4.17%
                    </span>
                  </div>
                </div>
              </div>

              {/* Bet */}
              {(phase === "idle" || phase === "result") && (
                <div style={{ marginBottom: 14 }}>
                  <div className="lbl">Bet Amount</div>
                  <input
                    className="bet-in"
                    type="number"
                    value={bet}
                    step={0.01}
                    min={0.01}
                    max={balanceOCT}
                    onChange={(e) =>
                      setBet(Math.max(0.01, Math.min(balanceOCT, Number(e.target.value) || 0.01)))
                    }
                  />
                  <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                    {QUICK_BETS_OCT.map((v) => (
                      <button
                        key={v}
                        className="qb"
                        onClick={() => setBet(Math.min(v, balanceOCT))}
                      >
                        {v}
                      </button>
                    ))}
                    <button className="qb" onClick={() => setBet(Math.floor((balanceOCT / 2) * 100) / 100)}>
                      ½
                    </button>
                    <button className="qb" onClick={() => setBet(Math.floor(balanceOCT * 100) / 100)}>
                      Max
                    </button>
                  </div>
                </div>
              )}

              {/* Spin button */}
              <button
                className={`spin-btn ${
                  spinning || isWaiting ? "sb-spin" : canSpin || phase === "result" ? "sb-on" : "sb-off"
                }`}
                onClick={phase === "result" ? resetGame : doSpin}
                disabled={phase === "result" ? false : (!canSpin || spinning || isWaiting)}
                style={{ marginBottom: 14 }}
              >
                {spinning || isWaiting
                  ? phase === "locking"
                    ? "Locking Wager..."
                    : phase === "resolving"
                    ? "Claiming Payout..."
                    : "Spinning..."
                  : phase === "result"
                  ? `Spin Again — ${bet} OCT`
                  : `🎡 Spin — ${bet} OCT`}
              </button>

              {/* Stats */}
              {mergedHistory.length > 0 && (
                <div className="rise" style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                  {[
                    { lbl: "Spins", val: String(mergedHistory.length) },
                    {
                      lbl: "Win rate",
                      val:
                        Math.round(
                          (mergedHistory.filter((h) => h.won).length / mergedHistory.length) * 100
                        ) + "%",
                    },
                    {
                      lbl: "Net P/L",
                      val:
                        (netPL >= 0 ? "+" : "") +
                        netPL.toLocaleString(undefined, { maximumFractionDigits: 3 }) +
                        " OCT",
                      col: netPL > 0 ? "#00e5a0" : netPL < 0 ? "#ff4d6d" : "#fff",
                    },
                  ].map((s) => (
                    <div key={s.lbl} className="sc">
                      <div
                        style={{
                          fontSize: 10,
                          color: "#7a8fb0",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          fontWeight: 600,
                        }}
                      >
                        {s.lbl}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: s.col || "#fff" }}>
                        {s.val}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {mergedHistory.length > 0 && (
                <div
                  style={{
                    background: "#0d1526",
                    border: "1px solid #1e2d4a",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 15px",
                      fontSize: 11,
                      color: "#7a8fb0",
                      fontWeight: 600,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      borderBottom: "1px solid #1a2640",
                    }}
                  >
                    Recent Spins
                  </div>
                  {mergedHistory.map((h, i) => (
                    <div
                      key={h.digest || i}
                      className="hrow"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 15px",
                        borderBottom:
                          i < mergedHistory.length - 1 ? "1px solid #0f1a2e" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            background: `${h.seg.col}18`,
                            border: `1px solid ${h.seg.col}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            className="mono"
                            style={{ fontSize: 11, fontWeight: 800, color: h.seg.col }}
                          >
                            {h.seg.label}
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#c0cfea" }}>
                            {h.won ? "Win" : "Bust"} — landed {h.seg.label}
                          </div>
                          <div style={{ fontSize: 11, color: "#3a4f70", marginTop: 1 }}>
                            Bet: {h.bet} OCT
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: h.won ? "#00e5a0" : "#ff4d6d",
                          }}
                        >
                          {h.won ? "+" : "−"}
                          {Math.abs(h.pnl).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                          OCT
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            color: h.won ? "#00a870" : "#cc2d45",
                            marginTop: 1,
                          }}
                        >
                          {h.won ? "WIN" : "LOSS"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#3a4f70" }}>
                12 segments · 6 bust · EV = 0.9583 · 4.17% house edge · Powered by OneChain RNG
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
