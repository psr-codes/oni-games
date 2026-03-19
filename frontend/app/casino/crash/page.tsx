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
import { GAME_IMAGES } from "@/game-store/images";
import { useCasinoStore } from "@/hooks/useCasinoStore";
import { useSessionHistory } from "@/hooks/useSessionHistory";

// ─── OniGames · Crypto Crash ───────────────────────────────────────────────
// Session game: lock_wager() → watch multiplier → cashout or crash
// resolve_session(multiplier_bps) on cashout, resolve_session(0) on crash (Option B)
//
// Math: crash = (1 - HOUSE) / uniform(0,1)  →  EV = 0.97 at any cashout
// Growth: m(t) = e^(GROWTH × t)  →  2× ~6.9s, 5× ~16s, 10× ~23s

const HOUSE = 0.03; // 3% house edge
const GROWTH = 0.1; // multiplier growth rate per second
const TICK_MS = 40; // game tick ~25fps
const FALL_MS = 650; // crash fall animation duration
const FALL_TICKS = 16; // fall animation frame count

const GW = 420;
const GH = 170;
const GP = { top: 14, right: 16, bottom: 24, left: 44 };

const MIST_PER_OCT = 1_000_000_000;
const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1];

function genCrash(): number {
  const v = Math.random();
  if (v < HOUSE) return 1.0;
  return Math.max(1.0, (1 - HOUSE) / (1 - v));
}

function elapsedToMul(t: number): number {
  return Math.exp(GROWTH * t);
}
function mulToElapsed(m: number): number {
  return Math.log(Math.max(1, m)) / GROWTH;
}

function fmtMul(m: number): string {
  if (m < 10) return m.toFixed(2) + "×";
  if (m < 100) return m.toFixed(1) + "×";
  return Math.round(m) + "×";
}

function crashColor(m: number): string {
  if (m < 1.5) return "#ff4d6d";
  if (m < 2) return "#f5c542";
  if (m < 5) return "#00d4c8";
  if (m < 10) return "#00e5a0";
  return "#a78bfa";
}

interface GraphPoint {
  t: number;
  m: number;
}

// ── Graph ─────────────────────────────────────────────────────────────────
function Graph({
  points,
  phase,
  currentMul,
  autoCashout,
  falling,
}: {
  points: GraphPoint[];
  phase: string;
  currentMul: number;
  autoCashout: number | null;
  falling: boolean;
}) {
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const maxT = Math.max((last?.t ?? 0) + 2, 10);
  const maxM = Math.max(currentMul * 1.25, 2);
  const iW = GW - GP.left - GP.right;
  const iH = GH - GP.top - GP.bottom;
  const toX = (t: number) => GP.left + (t / maxT) * iW;
  const toY = (m: number) =>
    GP.top + iH - ((m - 1) / Math.max(maxM - 1, 1)) * iH;

  const crashed = phase === "crashed";
  const won = phase === "cashedout";
  const lineCol = crashed ? "#ff4d6d" : won ? "#00e5a0" : "#00d4c8";
  const ptsStr = points
    .map((p) => `${toX(p.t).toFixed(1)},${toY(p.m).toFixed(1)}`)
    .join(" ");
  const fillStr = [
    `${toX(0).toFixed(1)},${(GP.top + iH).toFixed(1)}`,
    ...points.map(
      (p) => `${toX(p.t).toFixed(1)},${toY(p.m).toFixed(1)}`
    ),
    `${toX(last.t).toFixed(1)},${(GP.top + iH).toFixed(1)}`,
  ].join(" ");

  const yTicks = [1.5, 2, 3, 5, 10].filter((v) => v <= maxM * 1.1);
  const acY =
    autoCashout && autoCashout > 1 && autoCashout <= maxM * 1.1
      ? toY(autoCashout)
      : null;
  const tipX = toX(last.t);
  const tipY = toY(last.m);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${GW} ${GH}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <rect x="0" y="0" width={GW} height={GH} fill="#060c18" rx="10" />

      {/* Grid */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={GP.left}
            y1={toY(v).toFixed(1)}
            x2={GW - GP.right}
            y2={toY(v).toFixed(1)}
            stroke="#1a2640"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={GP.left - 6}
            y={Number(toY(v).toFixed(1))}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#3a4f70"
            fontSize="9"
            fontFamily="'JetBrains Mono',monospace"
          >
            {v}×
          </text>
        </g>
      ))}
      <line
        x1={GP.left}
        y1={GP.top + iH}
        x2={GW - GP.right}
        y2={GP.top + iH}
        stroke="#1a2640"
        strokeWidth="1"
      />

      {/* Auto-cashout line */}
      {acY !== null && (
        <g>
          <line
            x1={GP.left}
            y1={acY}
            x2={GW - GP.right}
            y2={acY}
            stroke="#f5c542"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.85"
          />
          <text
            x={GW - GP.right + 3}
            y={acY}
            dominantBaseline="middle"
            fill="#f5c542"
            fontSize="9"
            fontFamily="'JetBrains Mono',monospace"
          >
            {fmtMul(autoCashout!)}
          </text>
        </g>
      )}

      {/* Fill area */}
      {points.length > 1 && (
        <polygon points={fillStr} fill={lineCol} opacity="0.08" />
      )}

      {/* Curve */}
      {points.length > 1 && (
        <polyline
          points={ptsStr}
          fill="none"
          stroke={lineCol}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Live tip dot */}
      {!crashed && !falling && points.length > 0 && (
        <>
          <circle cx={tipX} cy={tipY} r="9" fill={lineCol} opacity="0.18" />
          <circle cx={tipX} cy={tipY} r="4" fill={lineCol} opacity="0.9" />
        </>
      )}

      {/* Crash label — only shows once fall is complete */}
      {crashed && !falling && (
        <text
          x={GW / 2}
          y={GH / 2 - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ff4d6d"
          fontSize="20"
          fontWeight="800"
          fontFamily="'Outfit',sans-serif"
          style={{ filter: "drop-shadow(0 0 10px #ff4d6d)" }}
        >
          CRASHED @ {fmtMul(currentMul)}
        </text>
      )}
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function CryptoCrashPage() {
  const { casinoStore } = useCasinoStore();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Balance & Wallet
  const [balance, setBalance] = useState<number>(0);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Game UI State
  const [bet, setBet] = useState<number>(0.01);
  const [autoCashout, setAutoCashout] = useState<string>("");
  const [phase, setPhase] = useState<
    "idle" | "locking" | "playing" | "crashed" | "cashedout" | "resolving"
  >("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [falling, setFalling] = useState(false);
  const [result, setResult] = useState<{
    won: boolean;
    pnl: number;
    payout: number;
    mul: number;
    crashAt: number;
    digest?: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{
      won: boolean;
      pnl: number;
      payout: number;
      mul: number;
      crashAt: number;
      bet: number;
      digest?: string;
    }>
  >([]);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const crashRef = useRef<number>(1);
  const ptsRef = useRef<GraphPoint[]>([]);
  const mulRef = useRef<number>(1);
  const cashedRef = useRef<boolean>(false);
  const acRef = useRef<number | null>(null);

  const balanceOCT = balance / MIST_PER_OCT;
  const isPlaying = phase === "playing";
  const isDone = phase === "crashed" || phase === "cashedout";
  const acTarget = parseFloat(autoCashout) || null;
  acRef.current = acTarget;

  // On-chain history
  const { history: onChainHistory } = useSessionHistory(
    account?.address,
    "crypto_crash",
    10
  );

  const mergedHistory = (() => {
    const digestSet = new Set(
      history.map((h) => h.digest).filter(Boolean) as string[]
    );
    const onChainMapped = onChainHistory
      .filter((e) => !digestSet.has(e.digest))
      .map((e) => ({
        won: e.won,
        pnl: e.pnl,
        payout: e.payoutOCT,
        mul: e.multiplierBps / 10000,
        crashAt: e.multiplierBps / 10000 || 1,
        bet: e.wagerOCT,
        digest: e.digest,
      }));
    return [...history, ...onChainMapped].slice(0, 10);
  })();

  const netPL = mergedHistory.reduce((s, h) => s + h.pnl, 0);
  const canStart =
    phase === "idle" &&
    bet > 0 &&
    bet <= balanceOCT &&
    !!account?.address;

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

  // ── Settle — handles result/history ──────────────────────────────────────
  const settle = useCallback(
    (finalMul: number, didCash: boolean, crashAt: number, digest?: string) => {
      const payout = didCash ? bet * finalMul : 0;
      const pnl = payout - bet;
      const r = { won: didCash, pnl, payout, mul: finalMul, crashAt, digest };
      setResult(r);
      setHistory((h) =>
        [{ ...r, bet }, ...h].slice(0, 10)
      );
      fetchBalance();
    },
    [bet, fetchBalance]
  );

  // ── Crash fall animation ─────────────────────────────────────────────────
  const runFallAnimation = useCallback(
    (crashMul: number, crashT: number) => {
      setFalling(true);
      let frame = 0;
      fallRef.current = setInterval(() => {
        frame++;
        const pct = frame / FALL_TICKS;
        const eased = pct * pct;
        const m = crashMul * (1 - eased) + 1.0 * eased;
        const t = crashT + (FALL_MS / 1000) * pct;
        ptsRef.current = [...ptsRef.current, { t, m }];
        setPoints([...ptsRef.current]);
        setMultiplier(m);
        if (frame >= FALL_TICKS) {
          clearInterval(fallRef.current!);
          setFalling(false);
        }
      }, FALL_MS / FALL_TICKS);
    },
    []
  );

  // ── Cash out ──────────────────────────────────────────────────────────────
  const cashOut = useCallback(async () => {
    if (!isPlaying || cashedRef.current || !sessionId || !account) return;
    cashedRef.current = true;
    if (tickRef.current) clearInterval(tickRef.current);
    const m = mulRef.current;
    const mulBps = Math.floor(m * 10000);

    setPhase("resolving");

    try {
      // Get backend signature
      const apiRes = await fetch("/api/resolve-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          playerAddress: account.address,
          multiplierBps: mulBps,
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
          tx.pure(bcs.u64().serialize(mulBps)),
          tx.pure(bcs.u64().serialize(data.nonce)),
          tx.pure(
            "vector<u8>",
            Array.from(Buffer.from(data.signature, "hex"))
          ),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (txResult) => {
            await suiClient.waitForTransaction({ digest: txResult.digest });
            setPhase("cashedout");
            settle(m, true, crashRef.current, txResult.digest);
          },
          onError: (err) => {
            console.error("resolve_session failed:", err);
            setPhase("cashedout");
            settle(m, true, crashRef.current);
          },
        }
      );
    } catch (err) {
      console.error("Cash out error:", err);
      setPhase("cashedout");
      settle(m, true, crashRef.current);
    }
  }, [isPlaying, sessionId, account, settle, signAndExecute, suiClient]);

  // ── Game tick ─────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const elapsed = (performance.now() - startRef.current) / 1000;
    const m = elapsedToMul(elapsed);
    const crash = crashRef.current;
    mulRef.current = m;

    const np: GraphPoint = { t: elapsed, m };
    ptsRef.current = [...ptsRef.current, np];
    setMultiplier(m);
    setPoints([...ptsRef.current]);

    // Auto cashout
    const at = acRef.current;
    if (!cashedRef.current && at && m >= at) {
      cashedRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      const exactPts = [...ptsRef.current];
      exactPts[exactPts.length - 1] = { t: elapsed, m: at };
      ptsRef.current = exactPts;
      setMultiplier(at);
      setPoints([...exactPts]);
      // Auto-cashout triggers the resolve flow
      // We need to handle this asynchronously
      setTimeout(() => {
        // Trigger cash out via the ref-based approach
        const mulBps = Math.floor(at * 10000);
        setPhase("resolving");
        // We'll handle the resolve in a separate effect or inline
        handleAutoResolve(at, mulBps);
      }, 50);
      return;
    }

    // Crash check
    if (m >= crash) {
      if (tickRef.current) clearInterval(tickRef.current);
      // Snap final point to exact crash value
      ptsRef.current = [
        ...ptsRef.current.slice(0, -1),
        { t: mulToElapsed(crash), m: crash },
      ];
      setPoints([...ptsRef.current]);
      setMultiplier(crash);

      if (!cashedRef.current) {
        setPhase("crashed");
        // Option B: player lost, no transaction needed
        settle(crash, false, crash);
        // Run fall animation
        const crashT = mulToElapsed(crash);
        setTimeout(() => runFallAnimation(crash, crashT), 80);
      }
    }
  }, [settle, runFallAnimation]);

  // Handle auto-cashout resolve
  const handleAutoResolve = useCallback(
    async (mul: number, mulBps: number) => {
      if (!sessionId || !account) {
        setPhase("cashedout");
        settle(mul, true, crashRef.current);
        return;
      }

      try {
        const apiRes = await fetch("/api/resolve-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            playerAddress: account.address,
            multiplierBps: mulBps,
          }),
        });
        const data = await apiRes.json();
        if (!apiRes.ok) throw new Error(data.error);

        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::${CASINO_MODULE}::resolve_session`,
          arguments: [
            tx.object(HOUSE_BANKROLL_ID),
            tx.object(sessionId),
            tx.pure(bcs.u64().serialize(mulBps)),
            tx.pure(bcs.u64().serialize(data.nonce)),
            tx.pure(
              "vector<u8>",
              Array.from(Buffer.from(data.signature, "hex"))
            ),
          ],
        });

        signAndExecute(
          { transaction: tx },
          {
            onSuccess: async (txResult) => {
              await suiClient.waitForTransaction({ digest: txResult.digest });
              setPhase("cashedout");
              settle(mul, true, crashRef.current, txResult.digest);
            },
            onError: () => {
              setPhase("cashedout");
              settle(mul, true, crashRef.current);
            },
          }
        );
      } catch {
        setPhase("cashedout");
        settle(mul, true, crashRef.current);
      }
    },
    [sessionId, account, settle, signAndExecute, suiClient]
  );

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (!canStart || !account) return;

    const crash = genCrash();
    crashRef.current = crash;
    cashedRef.current = false;
    ptsRef.current = [{ t: 0, m: 1 }];
    mulRef.current = 1;

    setPhase("locking");
    setMultiplier(1);
    setPoints([{ t: 0, m: 1 }]);
    setResult(null);
    setFalling(false);

    // 1. lock_wager on-chain
    const betMist = Math.floor(bet * MIST_PER_OCT);
    const tx = new Transaction();
    const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betMist)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${CASINO_MODULE}::lock_wager`,
      arguments: [
        tx.object(HOUSE_BANKROLL_ID),
        wagerCoin,
        tx.pure.string("crypto_crash"),
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
              setSessionId(parsed.session_id as string);
            }

            fetchBalance();

            // 2. Start the game tick
            startRef.current = performance.now();
            setPhase("playing");
            tickRef.current = setInterval(tick, TICK_MS);
          } catch (e) {
            console.error("Failed to parse lock_wager event:", e);
            reset();
          }
        },
        onError: (err) => {
          console.error("Lock Wager failed:", err);
          reset();
        },
      }
    );
  }, [canStart, account, bet, signAndExecute, suiClient, fetchBalance, tick]);

  const reset = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (fallRef.current) clearInterval(fallRef.current);
    setPhase("idle");
    setResult(null);
    setPoints([]);
    setMultiplier(1);
    setFalling(false);
    setSessionId(null);
  };

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (fallRef.current) clearInterval(fallRef.current);
    },
    []
  );

  const displayMul = phase === "idle" || phase === "locking" ? 1 : multiplier;
  const mulCol =
    phase === "crashed"
      ? "#ff4d6d"
      : phase === "cashedout"
      ? "#00e5a0"
      : crashColor(displayMul);

  const isWaiting = phase === "locking" || phase === "resolving";

  if (isAuthChecking) {
    return <div className="min-h-screen bg-[#0a0f1e]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] font-sans pb-20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .cc   { font-family:'Outfit',sans-serif; color:#fff; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .lbl  { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:8px; }

        @keyframes mulFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes rise      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes rowIn     { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:none} }
        @keyframes breathe   { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes coGlow    { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,160,0)} 50%{box-shadow:0 0 30px 8px rgba(0,229,160,.22)} }

        .rise  { animation:rise .3s ease; }
        .hrow  { animation:rowIn .22s ease; }

        .mul-display {
          font-size:72px; font-weight:900; line-height:1;
          letter-spacing:-3px; transition:color .15s;
          font-variant-numeric:tabular-nums; font-family:'Outfit',sans-serif;
        }
        .mul-playing { animation:mulFloat 1.1s ease-in-out infinite; }

        .co-btn {
          width:100%; padding:18px; border-radius:14px; border:none;
          font-family:'Outfit',sans-serif; font-size:18px; font-weight:900;
          cursor:pointer; transition:all .15s;
        }
        .co-live { background:#00e5a0; color:#071218; animation:coGlow 1.1s ease infinite; }
        .co-live:hover  { background:#00ffb3; }
        .co-live:active { transform:scale(.98); }
        .co-off  { background:#1a2640; color:#3a4f70; cursor:not-allowed; }

        .act-btn {
          width:100%; padding:15px; border-radius:14px; border:none;
          font-family:'Outfit',sans-serif; font-size:16px; font-weight:800;
          cursor:pointer; transition:all .18s;
        }
        .act-go  { background:#00d4c8; color:#071218; }
        .act-go:hover { background:#00f0e0; transform:translateY(-1px); }
        .act-off { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .act-spin { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .75s ease infinite; }

        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        .ac-in  { width:100%; padding:9px 36px 9px 12px; border-radius:9px; background:#060c18; border:1.5px solid #1e2d4a; color:#f5c542; font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:700; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .ac-in:focus { border-color:#f5c542; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        .qb  { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }
        .qb.ac { border-color:#f5c542; color:#f5c542; background:rgba(245,197,66,.08); }
        .sc { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 8px; text-align:center; }
        .cdot { display:inline-flex; align-items:center; justify-content:center; padding:3px 9px; border-radius:99px; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; }
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
            <span className="text-cyan-400">3%</span>
          </div>
        </div>
      </div>

      <div className="cc pt-6">
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#0d1526",
                border: "1px solid #1e2d4a",
                borderRadius: 999,
                padding: "5px 16px",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#00d4c8",
                  display: "inline-block",
                }}
              />
              <span
                style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}
              >
                Session Play · 3% House Edge · EV = 0.97×
              </span>
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -0.5,
                margin: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12
              }}
            >
              {GAME_IMAGES["crash"] ? (
                <img src={GAME_IMAGES["crash"]} alt="" style={{ height: 30, width: 30, objectFit: "contain" }} />
              ) : null}
              <span>Crypto Crash</span>
            </h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>
              Watch the multiplier climb. Cash out before it crashes — or lose
              everything.
            </p>
          </div>

          {/* Balance */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#0d1526",
              border: "1px solid #1e2d4a",
              borderRadius: 13,
              padding: "12px 17px",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#7a8fb0",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              Balance
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: balanceOCT > 0 ? "#00e5a0" : "#fff",
              }}
            >
              {balanceOCT.toLocaleString()}{" "}
              <span
                style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}
              >
                OCT
              </span>
            </span>
          </div>

          {!account?.address ? (
            <div className="text-center py-10 bg-[#0d1526] rounded-xl border border-slate-700/50 mb-10">
              <span className="text-4xl mb-4 block">👛</span>
              <p className="text-slate-300 font-medium">
                Connect wallet to play
              </p>
            </div>
          ) : (
            <>
              {/* Locking overlay */}
              {isWaiting && (
                <div
                  className="rise"
                  style={{
                    textAlign: "center",
                    marginBottom: 14,
                    padding: "14px 18px",
                    borderRadius: 13,
                    background: "rgba(0,212,200,.06)",
                    border: "1.5px solid rgba(0,212,200,.3)",
                  }}
                >
                  <div className="w-6 h-6 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#00d4c8" }}
                  >
                    {phase === "locking"
                      ? "Locking wager on-chain..."
                      : "Resolving payout..."}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#7a8fb0", marginTop: 3 }}
                  >
                    Approve transaction in wallet
                  </div>
                </div>
              )}

              {/* Graph panel */}
              <div
                style={{
                  background: "#060c18",
                  border: `1.5px solid ${
                    phase === "crashed"
                      ? "rgba(255,77,109,.4)"
                      : phase === "cashedout"
                      ? "rgba(0,229,160,.3)"
                      : "#1a2640"
                  }`,
                  borderRadius: 16,
                  overflow: "hidden",
                  marginBottom: 14,
                  transition: "border-color .3s, box-shadow .3s",
                  boxShadow:
                    phase === "crashed"
                      ? "0 0 28px rgba(255,77,109,.12)"
                      : phase === "cashedout"
                      ? "0 0 28px rgba(0,229,160,.1)"
                      : "none",
                }}
              >
                {/* Big multiplier */}
                <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
                  <div
                    className={`mul-display ${
                      isPlaying ? "mul-playing" : ""
                    }`}
                    style={{ color: mulCol }}
                  >
                    {fmtMul(displayMul)}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#7a8fb0",
                      marginTop: 6,
                      minHeight: 20,
                    }}
                  >
                    {(phase === "idle" || phase === "locking") && (
                      <span style={{ color: "#3a4f70" }}>
                        Place your bet to launch
                      </span>
                    )}
                    {isPlaying && (
                      <span
                        style={{
                          color: mulCol,
                          animation: "breathe .9s ease infinite",
                        }}
                      >
                        Flying… cash out anytime!
                      </span>
                    )}
                    {phase === "cashedout" && result && (
                      <span style={{ color: "#00e5a0", fontWeight: 700 }}>
                        Cashed out! +
                        {result.pnl.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        OCT
                      </span>
                    )}
                    {phase === "crashed" && result && (
                      <span style={{ color: "#ff4d6d", fontWeight: 700 }}>
                        Crashed — lost{" "}
                        {bet.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        OCT
                      </span>
                    )}
                    {phase === "resolving" && (
                      <span
                        style={{
                          color: "#00d4c8",
                          animation: "breathe .9s ease infinite",
                        }}
                      >
                        Claiming payout...
                      </span>
                    )}
                  </div>
                </div>

                {/* Graph */}
                <div style={{ padding: "0 4px 6px" }}>
                  {(isPlaying || isDone || phase === "resolving") &&
                  points.length > 0 ? (
                    <Graph
                      points={points}
                      phase={phase}
                      currentMul={displayMul}
                      autoCashout={acTarget}
                      falling={falling}
                    />
                  ) : (
                    <div
                      style={{
                        height: GH,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
                        <div style={{ fontSize: 13, color: "#3a4f70" }}>
                          Chart appears when game starts
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent crash dots */}
              {mergedHistory.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="lbl">Recent Crashes</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {mergedHistory
                      .slice(0, 10)
                      .map((h, i) => (
                        <div
                          key={h.digest || i}
                          className="cdot"
                          style={{
                            background: `${crashColor(h.crashAt)}18`,
                            border: `1px solid ${crashColor(h.crashAt)}55`,
                            color: crashColor(h.crashAt),
                          }}
                        >
                          {h.won
                            ? `✓ ${fmtMul(h.mul)}`
                            : fmtMul(h.crashAt)}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cash Out — only shown while playing */}
              {isPlaying && (
                <button
                  className={`co-btn ${
                    !cashedRef.current ? "co-live" : "co-off"
                  }`}
                  onClick={cashOut}
                  style={{ marginBottom: 12 }}
                >
                  💰 Cash Out —{" "}
                  {(bet * multiplier).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  OCT ({fmtMul(multiplier)})
                </button>
              )}

              {/* Controls — shown when NOT playing */}
              {!isPlaying && !isWaiting && (
                <>
                  {/* Auto cashout */}
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span className="lbl" style={{ marginBottom: 0 }}>
                        Auto Cash Out
                      </span>
                      <span style={{ fontSize: 11, color: "#3a4f70" }}>
                        Optional
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        className="ac-in"
                        type="number"
                        value={autoCashout}
                        min="1.01"
                        step="0.1"
                        placeholder="e.g. 2.00"
                        onChange={(e) => setAutoCashout(e.target.value)}
                      />
                      <span
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 14,
                          color: "#f5c542",
                          fontWeight: 700,
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        ×
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        marginTop: 9,
                        flexWrap: "wrap",
                      }}
                    >
                      {[1.5, 2, 3, 5, 10].map((v) => (
                        <button
                          key={v}
                          className={`qb ${
                            parseFloat(autoCashout) === v ? "ac" : ""
                          }`}
                          onClick={() => setAutoCashout(String(v))}
                        >
                          {v}×
                        </button>
                      ))}
                      <button
                        className="qb"
                        onClick={() => setAutoCashout("")}
                      >
                        Off
                      </button>
                    </div>
                    {acTarget && acTarget > 1 && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: "#f5c542",
                        }}
                      >
                        Auto exit at <strong>{fmtMul(acTarget)}</strong> · win
                        chance:{" "}
                        <strong>
                          {(
                            Math.min(1, (1 - HOUSE) / acTarget) * 100
                          ).toFixed(1)}
                          %
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Bet */}
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
                        setBet(
                          Math.max(
                            0.01,
                            Math.min(
                              balanceOCT,
                              Number(e.target.value) || 0.01
                            )
                          )
                        )
                      }
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        marginTop: 9,
                        flexWrap: "wrap",
                      }}
                    >
                      {QUICK_BETS_OCT.map((v) => (
                        <button
                          key={v}
                          className="qb"
                          onClick={() => setBet(Math.min(v, balanceOCT))}
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        className="qb"
                        onClick={() =>
                          setBet(
                            Math.floor((balanceOCT / 2) * 100) / 100
                          )
                        }
                      >
                        ½
                      </button>
                      <button
                        className="qb"
                        onClick={() =>
                          setBet(Math.floor(balanceOCT * 100) / 100)
                        }
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* Start / Play Again button */}
                  {phase === "idle" ? (
                    <button
                      className={`act-btn ${canStart ? "act-go" : "act-off"}`}
                      onClick={startGame}
                      disabled={!canStart}
                      style={{ marginBottom: 14 }}
                    >
                      🚀 Launch — {bet} OCT
                    </button>
                  ) : isDone ? (
                    <button
                      className="act-btn act-go"
                      onClick={reset}
                      style={{ marginBottom: 14 }}
                    >
                      Play Again
                    </button>
                  ) : null}
                </>
              )}

              {/* Stats */}
              {mergedHistory.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    marginBottom: 14,
                  }}
                >
                  {[
                    {
                      lbl: "Rounds",
                      val: String(mergedHistory.length),
                    },
                    {
                      lbl: "Win rate",
                      val:
                        Math.round(
                          (mergedHistory.filter((h) => h.won).length /
                            mergedHistory.length) *
                            100
                        ) + "%",
                    },
                    {
                      lbl: "Net P/L",
                      val:
                        (netPL >= 0 ? "+" : "") +
                        netPL.toLocaleString(undefined, {
                          maximumFractionDigits: 3,
                        }) +
                        " OCT",
                      col:
                        netPL > 0
                          ? "#00e5a0"
                          : netPL < 0
                          ? "#ff4d6d"
                          : "#fff",
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
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: s.col || "#fff",
                        }}
                      >
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
                    Round History
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
                          i < mergedHistory.length - 1
                            ? "1px solid #0f1a2e"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            background: h.won
                              ? "rgba(0,229,160,.12)"
                              : "rgba(255,77,109,.12)",
                            border: `1px solid ${
                              h.won ? "#00e5a0" : "#ff4d6d"
                            }`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 15,
                          }}
                        >
                          {h.won ? "💰" : "💥"}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#c0cfea",
                            }}
                          >
                            {h.won ? (
                              <>
                                Cashed at{" "}
                                <span style={{ color: "#00e5a0" }}>
                                  {fmtMul(h.mul)}
                                </span>
                              </>
                            ) : (
                              <>
                                Crashed at{" "}
                                <span style={{ color: "#ff4d6d" }}>
                                  {fmtMul(h.crashAt)}
                                </span>
                              </>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#3a4f70",
                              marginTop: 1,
                            }}
                          >
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
                          {Math.abs(h.pnl).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}{" "}
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

              <div
                style={{
                  textAlign: "center",
                  marginTop: 20,
                  fontSize: 11,
                  color: "#3a4f70",
                }}
              >
                crash = 0.97 ÷ random · EV 0.97× at any exit · Powered by
                OneChain RNG
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
