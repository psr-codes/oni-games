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
import { PACKAGE_ID, CASINO_MODULE, HOUSE_BANKROLL_ID, COIN_TYPE } from "@/config";
import { GAME_IMAGES } from "@/game-store/images";
import { useCasinoStore } from "@/hooks/useCasinoStore";
import { useSessionHistory } from "@/hooks/useSessionHistory";

// ─── Constants ──────────────────────────────────────────────
const GRID = 25;
const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1];
const MIST_PER_OCT = 1_000_000_000;

interface ConfigItem {
  bombs: number;
  label: string;
  color: string;
  risk: string;
}

const CONFIGS: ConfigItem[] = [
  { bombs: 1, label: "1 Bomb", color: "#00e5a0", risk: "Minimal" },
  { bombs: 2, label: "2 Bombs", color: "#00d4c8", risk: "Low" },
  { bombs: 3, label: "3 Bombs", color: "#7dd3fc", risk: "Medium" },
  { bombs: 4, label: "4 Bombs", color: "#f5c542", risk: "High" },
  { bombs: 5, label: "5 Bombs", color: "#ff9f40", risk: "Extreme" },
  { bombs: 6, label: "6 Bombs", color: "#ff4d6d", risk: "Insane" },
];

function calcMultiplier(bombs: number, safeRevealed: number, houseEdgeBps: number): { mulBps: number; mul: number } {
  if (safeRevealed === 0) return { mulBps: 10000, mul: 1.0 };
  
  const housePercentage = (10000 - houseEdgeBps) / 10000;
  const safe = GRID - bombs;
  let prob = 1;
  for (let i = 0; i < safeRevealed; i++) {
    prob *= (safe - i) / (GRID - i);
  }
  
  // payout = (1 / prob) * houseEdge
  const fairMul = 1 / prob;
  const mul = fairMul * housePercentage;
  const mulBps = Math.floor(mul * 10000);
  
  return { 
    mulBps, 
    mul 
  };
}

function nextSurvival(bombs: number, safeRevealed: number): number {
  const remaining = GRID - safeRevealed;
  if (remaining <= 0) return 0;
  return (GRID - bombs - safeRevealed) / remaining;
}

function placeBombs(count: number, avoid: number): Set<number> {
  const set = new Set<number>();
  while (set.size < count) {
    const p = Math.floor(Math.random() * GRID);
    if (p !== avoid) set.add(p);
  }
  return set;
}

function mulColor(m: number): string {
  if (m < 1.5) return "#7a8fb0";
  if (m < 2) return "#c0cfea";
  if (m < 5) return "#00d4c8";
  if (m < 15) return "#f5c542";
  if (m < 50) return "#ff9f40";
  return "#a78bfa";
}

function fmtMul(m: number): string {
  if (m < 10) return m.toFixed(2) + "×";
  if (m < 100) return m.toFixed(1) + "×";
  return Math.round(m) + "×";
}

export default function TreasureHuntPage() {
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 200;

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Balance & Wallet
  const [balance, setBalance] = useState<number>(0);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Game UI State
  const [phase, setPhase] = useState<"idle" | "playing" | "won" | "lost" | "resolving">("idle");
  const [bet, setBet] = useState<number>(0.01);
  const [cfgIdx, setCfgIdx] = useState<number>(2);
  const [cells, setCells] = useState<string[]>(Array(GRID).fill("hidden"));
  const [revealed, setRevealed] = useState<number>(0);
  
  // Session / Results State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bombSet, setBombSet] = useState<Set<number> | null>(null);
  const [lastResult, setLastResult] = useState<{
    won: boolean;
    pnl: number;
    revealed: number;
    bombs: number;
    bet: number;
    mul: number;
    digest?: string;
  } | null>(null);
  const [history, setHistory] = useState<typeof lastResult[]>([]);

  const bsetRef = useRef<Set<number> | null>(null);
  const revRef = useRef<number>(0);

  // Helper bindings for render
  const cfg = CONFIGS[cfgIdx];
  const { mul, mulBps: currentMulBps } = calcMultiplier(cfg.bombs, revealed, houseEdgeBps);
  const surviv = nextSurvival(cfg.bombs, revealed);
  const potWin = bet * mul;
  const maxSafe = GRID - cfg.bombs;
  const isPlaying = phase === "playing";
  const isResolving = phase === "resolving";
  const canCashout = isPlaying && revealed > 0;

  // Load on-chain session history (persists across page refreshes)
  const { history: onChainHistory } = useSessionHistory(
    account?.address,
    "treasure_hunt",
    10,
  );

  // Merge on-chain history with in-session history (dedup by digest)
  const mergedHistory = (() => {
    const validHistory = history.filter((h): h is NonNullable<typeof h> => h != null);
    const digestSet = new Set(validHistory.map((h) => h.digest).filter(Boolean) as string[]);
    const onChainMapped = onChainHistory
      .filter((e) => !digestSet.has(e.digest))
      .map((e) => ({
        won: e.won,
        pnl: e.pnl,
        revealed: 0,
        bombs: 0,
        bet: e.wagerOCT,
        mul: e.multiplierBps / 10000,
        digest: e.digest,
      }));
    return [...validHistory, ...onChainMapped].slice(0, 10);
  })();

  const netPL = mergedHistory.reduce((s, h) => s + (h?.pnl || 0), 0);

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
      setBalance(Number(totalBalance) / MIST_PER_OCT);
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

  // Sync refs so click handler sees fresh state
  useEffect(() => {
    bsetRef.current = bombSet;
    revRef.current = revealed;
  }, [bombSet, revealed]);

  // ── Start Game (Lock Wager) ──────────────────────────────────────────────
  const startGame = () => {
    if (bet > balance || bet <= 0 || !account) return;
    
    // UI Reset
    setCells(Array(GRID).fill("hidden"));
    setBombSet(null);
    setRevealed(0);
    setLastResult(null);
    setSessionId(null);
    setPhase("resolving"); // Treat lock stage as resolving (spinner)
    
    const betMist = Math.floor(bet * MIST_PER_OCT);
    const tx = new Transaction();
    const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betMist)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${CASINO_MODULE}::lock_wager`,
      arguments: [
        tx.object(HOUSE_BANKROLL_ID),
        wagerCoin,
        tx.pure.string("treasure_hunt")
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res) => {
          try {
            // Fetch tx to emit SessionCreated event
            const txRes = await suiClient.waitForTransaction({ 
              digest: res.digest,
              options: { showEvents: true } 
            });
            
            // Find SessionCreated event
            const createdEvent = txRes.events?.find(
              (e) => e.type.includes("SessionCreated")
            );
            
            if (createdEvent && createdEvent.parsedJson) {
              const parsed = createdEvent.parsedJson as Record<string, unknown>;
              const sId = parsed.session_id as string;
              setSessionId(sId);
            }
            
            fetchBalance();
            setPhase("playing");
          } catch (e) {
            console.error("Failed to parse lock_wager event:", e);
            resetGame(); // rollback
          }
        },
        onError: (err) => {
          console.error("Lock Wager failed:", err);
          resetGame();
        }
      }
    );
  };

  // ── Finalize Game (Resolve Session) ──────────────────────────────────────
  const finalizeGame = async (
    win: boolean, 
    finalCurRev: number, 
    finalMulBps: number, 
    finalMulDisplay: number,
    finalCells: string[]
  ) => {
    if (!sessionId || !account) {
      console.error("No active session ID found to finalize.");
      resetGame();
      return;
    }
    setPhase("resolving");

    // Option B: If the player loses, the house already has the wager.
    // We don't need to force them to sign a transaction to resolve a loss!
    if (!win) {
      const resObj = {
        won: false,
        pnl: -bet,
        revealed: finalCurRev,
        bombs: cfg.bombs,
        bet,
        mul: 1.0,
        digest: undefined
      };
      setLastResult(resObj);
      setHistory((h) => [resObj, ...h].slice(0, 8));
      setSessionId(null);
      setCells(finalCells);
      setPhase("lost");
      return;
    }

    try {
      // 1. Get Signature from backend for a WIN
      const res = await fetch("/api/resolve-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          playerAddress: account.address,
          multiplierBps: finalMulBps 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 2. Submit resolve_session transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::resolve_session`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(sessionId),
          tx.pure(bcs.u64().serialize(win ? finalMulBps : 0)),
          tx.pure(bcs.u64().serialize(data.nonce)),
          tx.pure("vector<u8>", Array.from(Buffer.from(data.signature, 'hex')))
        ]
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({ digest: result.digest });
            fetchBalance();
            
            const pnl = win ? (bet * finalMulDisplay) - bet : -bet;
            const resObj = {
              won: win,
              pnl,
              revealed: finalCurRev,
              bombs: cfg.bombs,
              bet,
              mul: win ? finalMulDisplay : 1.0,
              digest: result.digest
            };
            
            setLastResult(resObj);
            setHistory((h) => [resObj, ...h].slice(0, 8));
            setSessionId(null);
            
            // Set final board state
            setCells(finalCells);
            setRevealed(finalCurRev);
            setPhase(win ? "won" : "lost");
          },
          onError: (err) => {
            console.error(err);
            alert("Failed to sign transaction. Wager is escrowed but not resolved.");
            setPhase("playing"); 
          }
        }
      );
    } catch (e) {
      console.error("Resolution flow error:", e);
      alert("Failed to hit backend API for signature.");
      setPhase("playing");
    }
  };

  // ── Game Moves ────────────────────────────────────────────────────────────
  const clickCell = useCallback((idx: number) => {
    if (phase !== "playing") return;
    if (cells[idx] !== "hidden") return;

    // Place bombs safely on first click
    let bset = bsetRef.current;
    if (!bset) {
      bset = placeBombs(cfg.bombs, idx);
      setBombSet(bset);
      bsetRef.current = bset; 
    }

    const curRev = revRef.current;

    if (bset.has(idx)) {
      // 💥 BOMB HIT
      const nextCells = cells.map((c, i) =>
        i === idx ? "bomb_hit" : bset!.has(i) ? "bomb" : c
      );
      // Wait for chain resolution before showing lost state
      finalizeGame(false, curRev, 0, 1.0, nextCells);
    } else {
      // 💎 SAFE HIT
      const nextCells = [...cells];
      nextCells[idx] = "safe";
      const newRev = curRev + 1;
      
      setCells(nextCells);
      setRevealed(newRev);

      // Auto jackpot if fully cleared
      if (newRev === maxSafe) {
        // Calculate max multiplier
        const jInfo = calcMultiplier(cfg.bombs, newRev, houseEdgeBps);
        finalizeGame(true, newRev, jInfo.mulBps, jInfo.mul, nextCells);
      }
    }
  }, [phase, cells, cfg, bet, maxSafe, houseEdgeBps, finalizeGame]);

  const cashOut = useCallback(() => {
    if (!canCashout) return;
    // Payout calculation is locked based on current revealed count
    const { mulBps, mul: curMulDisplay } = calcMultiplier(cfg.bombs, revealed, houseEdgeBps);
    
    // Reveal everything as safe since they won
    const bset = bsetRef.current!;
    const nextCells = cells.map((c, i) => (bset.has(i) ? "bomb" : c === "hidden" ? "safe" : c));
    
    finalizeGame(true, revealed, mulBps, curMulDisplay, nextCells);
  }, [canCashout, bet, revealed, cfg, cells, houseEdgeBps, finalizeGame]);

  const resetGame = () => {
    setPhase("idle");
    setCells(Array(GRID).fill("hidden"));
    setBombSet(null);
    setRevealed(0);
    setLastResult(null);
    setSessionId(null);
  };

  // ── Render Helpers ────────────────────────────────────────────────────────
  if (isAuthChecking) {
    return <div className="min-h-screen bg-[#0a0f1e]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] font-sans pb-20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .ms { font-family:'Outfit',sans-serif; color:#fff; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .lbl { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:9px; }

        @keyframes cellIn { from{transform:scale(.25) rotateY(80deg);opacity:0} to{transform:none;opacity:1} }
        @keyframes explode { 0%{transform:scale(1)} 30%{transform:scale(1.6)} 65%{transform:scale(.8)} 100%{transform:scale(1)} }
        @keyframes mulBump { 0%{transform:scale(1)} 45%{transform:scale(1.24)} 100%{transform:scale(1)} }
        @keyframes rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes rowIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:none} }
        @keyframes gridShake { 0%,100%{transform:none} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes coGlow { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,200,0)} 50%{box-shadow:0 0 24px 6px rgba(0,212,200,.28)} }
        @keyframes pulseResolve { 0%,100%{opacity:0.6} 50%{opacity:1} }

        .cell {
          width:100%; aspect-ratio:1; border-radius:10px;
          border:1.5px solid #1e2d4a; background:#0d1526;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:background .1s, border-color .1s, transform .08s;
          padding:0; outline:none; font-size:0;
        }
        .cell.play:hover { background:#13203a; border-color:#2a3f66; }
        .cell.play:active { transform:scale(.86); }
        .co-btn { width:100%; padding:16px; border-radius:14px; border:none; font-family:'Outfit',sans-serif; font-size:16px; font-weight:800; cursor:pointer; transition:all .18s; }
        .co-on { background:#00d4c8; color:#071218; animation:coGlow 1.4s ease infinite; }
        .co-on:hover { background:#00f0e0; transform:translateY(-1px); }
        .co-off { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
      `}</style>

      {/* Basic Top Nav Integration (same as other games) */}
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
            <span className="text-cyan-400">
              {(houseEdgeBps / 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="ms pt-6">
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 999, padding: "5px 16px", marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4c8", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>Session Escrow · Cash Out Anytime</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: -0.5, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              {GAME_IMAGES["treasure-hunt"] ? (
                <img src={GAME_IMAGES["treasure-hunt"]} alt="" style={{ height: 32, width: 32, objectFit: "contain" }} />
              ) : "🏴‍☠️"}
              <span>Treasure Hunt</span>
            </h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>Reveal gems to grow your multiplier. Hit a bomb and lose it all.</p>
          </div>

          {/* Balance */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 13, padding: "12px 17px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>Balance</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: balance > 0 ? "#00e5a0" : "#fff" }}>
              {balance.toLocaleString()} <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>OCT</span>
            </span>
          </div>

          {!account?.address ? (
            <div className="text-center py-10 bg-[#0d1526] rounded-xl border border-slate-700/50 mb-10">
              <span className="text-4xl mb-4 block">👛</span>
              <p className="text-slate-300 font-medium">Connect wallet to play</p>
            </div>
          ) : (
            <>
              {/* Play UI / Grid */}
              <div style={{ position: "relative" }}>
                {isResolving && (
                  <div style={{ position: "absolute", inset: -10, background: "rgba(10,15,30,0.7)", backdropFilter: "blur(4px)", zIndex: 10, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "pulseResolve 1.5s ease infinite" }}>
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#00d4c8" }}>Confirming on-chain...</div>
                    <div style={{ fontSize: 11, color: "#7a8fb0", marginTop: 4 }}>Approve transaction in wallet</div>
                  </div>
                )}
              
                {/* Live stats strip */}
                {(isPlaying || phase === "won" || phase === "lost") && (
                  <div style={{ animation: "rise .3s ease", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: "#060c18", border: `1.5px solid ${mulColor(mul)}33`, borderRadius: 13, padding: "12px 8px", textAlign: "center" }}>
                      <div className="lbl" style={{ marginBottom: 4 }}>Multiplier</div>
                      <div key={revealed} className="mono" style={{ fontSize: 22, fontWeight: 800, color: mulColor(mul), animation: "mulBump .25s ease", letterSpacing: -0.5 }}>
                        {fmtMul(mul)}
                      </div>
                    </div>
                    <div style={{ background: "#060c18", border: "1.5px solid #1a2640", borderRadius: 13, padding: "12px 8px", textAlign: "center" }}>
                      <div className="lbl" style={{ marginBottom: 4 }}>Next Tile</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: surviv > .7 ? "#00e5a0" : surviv > .4 ? "#f5c542" : "#ff4d6d" }}>
                        {(surviv * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ background: "#060c18", border: "1.5px solid #1a2640", borderRadius: 13, padding: "12px 8px", textAlign: "center" }}>
                      <div className="lbl" style={{ marginBottom: 4 }}>Cleared</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: "#c0cfea" }}>
                        {revealed}<span style={{ fontSize: 13, color: "#3a4f70" }}>/{maxSafe}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result banner */}
                {(phase === "won" || phase === "lost") && lastResult && (
                  <div style={{ animation: "rise .3s ease", textAlign: "center", marginBottom: 14, padding: "14px 18px", borderRadius: 13, background: phase === "won" ? "rgba(0,229,160,.08)" : "rgba(255,77,109,.08)", border: `1.5px solid ${phase === "won" ? "#00e5a0" : "#ff4d6d"}` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: phase === "won" ? "#00e5a0" : "#ff4d6d" }}>
                      {phase === "won"
                        ? lastResult.revealed === maxSafe ? "🏆 All Tiles Cleared!" : "Cashed Out!"
                        : "💥 Hit a Bomb!"}
                    </div>
                    <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>
                      {phase === "won"
                        ? <><span style={{ color: "#00e5a0", fontWeight: 700 }}>+{lastResult.pnl.toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT</span>{" · "}{lastResult.revealed} gems · {fmtMul(lastResult.mul)} payout</>
                        : <><span style={{ color: "#ff4d6d", fontWeight: 700 }}>−{bet.toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT</span>{" · "}{lastResult.revealed} gems survived</>
                      }
                      {lastResult.digest && (
                        <div className="mt-2">
                          <a href={`https://onescan.cc/testnet/tx/${lastResult.digest}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 font-mono text-xs transition-colors">
                            {lastResult.digest.slice(0, 10)}...{lastResult.digest.slice(-6)} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grid */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, background: "#060c18", border: `1.5px solid ${phase === "lost" ? "rgba(255,77,109,.4)" : phase === "won" ? "rgba(0,229,160,.3)" : "#1a2640"}`, borderRadius: 16, padding: 12, maxWidth: 320, margin: "0 auto", transition: "border-color .3s, box-shadow .3s", boxShadow: phase === "lost" ? "0 0 26px rgba(255,77,109,.13)" : phase === "won" ? "0 0 26px rgba(0,229,160,.1)" : "none", animation: phase === "lost" ? "gridShake .45s ease" : "none" }}>
                    {cells.map((state, idx) => {
                      const hit = state === "bomb_hit";
                      const bomb = state === "bomb";
                      const safe = state === "safe";
                      const hidden = state === "hidden";
                      return (
                        <button
                          key={idx}
                          className={`cell ${hidden && isPlaying ? "play" : ""}`}
                          onClick={() => clickCell(idx)}
                          disabled={!hidden || !isPlaying || isResolving}
                          style={{
                            borderColor: hit ? "#ff4d6d" : bomb ? "rgba(255,77,109,.3)" : safe ? "rgba(0,229,160,.38)" : "#1e2d4a",
                            background: hit ? "rgba(255,77,109,.2)" : bomb ? "rgba(255,77,109,.07)" : safe ? "rgba(0,229,160,.11)" : "#0d1526",
                            boxShadow: hit ? "0 0 20px rgba(255,77,109,.5)" : safe ? "0 0 10px rgba(0,229,160,.2)" : "none",
                            animation: hit ? "explode .4s ease" : safe ? "cellIn .2s ease both" : "none",
                            fontSize: hit ? 28 : bomb ? 22 : safe ? 26 : 0,
                          }}
                        >
                          {safe && "💎"}
                          {bomb && "💣"}
                          {hit && "💥"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  {(isPlaying || phase === "won" || phase === "lost") && (
                    <div style={{ maxWidth: 320, margin: "0 auto" }}>
                      <div style={{ height: 5, borderRadius: 3, background: "#1a2640", overflow: "hidden", marginTop: 8 }}>
                        <div style={{ height: "100%", borderRadius: 3, transition: "width .3s ease, background .3s", width: `${(revealed / maxSafe) * 100}%`, background: mulColor(mul) }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Cash Out (during play) */}
                {isPlaying && (
                  <button
                    className={`co-btn ${canCashout ? "co-on" : "co-off"}`}
                    onClick={cashOut}
                    disabled={!canCashout || isResolving}
                    style={{ marginBottom: 10 }}
                  >
                    {canCashout
                      ? `Cash Out — ${potWin.toLocaleString(undefined, { maximumFractionDigits: 3 })} OCT (${fmtMul(mul)})`
                      : "Reveal a tile to start winning"}
                  </button>
                )}

                {/* Idle Mode: Bomb Selector & Bets */}
                {phase === "idle" && (
                  <div style={{ animation: "rise .3s ease" }}>
                    <div className="lbl">Bomb Count</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      {CONFIGS.map((c, i) => (
                        <div
                          key={i}
                          onClick={() => setCfgIdx(i)}
                          style={{ flex: 1, padding: "11px 6px", borderRadius: 12, minWidth: 0, border: "1.5px solid", cursor: "pointer", transition: "all .16s", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, ...(cfgIdx === i ? { borderColor: c.color, background: `${c.color}15`, color: c.color } : { borderColor: "#1e2d4a", background: "#0d1526", color: "#7a8fb0" }) }}
                        >
                          <span style={{ fontSize: 20, fontWeight: 900 }}>{c.bombs}</span>
                          <span style={{ fontSize: 10, fontWeight: 600 }}>{c.risk}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, marginBottom: 16, background: "#060c18", border: "1px solid #1a2640", borderRadius: 12, padding: "12px 14px" }}>
                      <div className="lbl" style={{ marginBottom: 8 }}>Multiplier Preview — {cfg.bombs} bomb{cfg.bombs > 1 ? "s" : ""}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                        {[1, 2, 3, 5, 8, 10, 13, 16, 19, maxSafe].filter((v, i, a) => v <= maxSafe && a.indexOf(v) === i).slice(0, 10).map((k) => {
                          const { mul: m } = calcMultiplier(cfg.bombs, k, houseEdgeBps);
                          return (
                            <div key={k} style={{ textAlign: "center", background: "#0d1526", borderRadius: 8, padding: "7px 4px", border: `1px solid ${mulColor(m)}33` }}>
                              <div style={{ fontSize: 10, color: "#3a4f70", marginBottom: 2 }}>{k} tile{k > 1 ? "s" : ""}</div>
                              <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: mulColor(m) }}>{fmtMul(m)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lbl">Bet Amount</div>
                    <input
                      type="number"
                      value={bet}
                      step={0.01}
                      min={0.01}
                      max={balance}
                      onChange={(e) => setBet(Math.max(0.01, Math.min(balance, Number(e.target.value) || 0.01)))}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "#060c18", border: "1.5px solid #1e2d4a", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: 17, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap", marginBottom: 14 }}>
                      {QUICK_BETS_OCT.map((v) => (
                        <button key={v} onClick={() => setBet(Math.min(v, balance))} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid #1e2d4a", background: "transparent", color: "#7a8fb0", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>{v}</button>
                      ))}
                      <button onClick={() => setBet(Math.floor((balance / 2) * 100) / 100)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid #1e2d4a", background: "transparent", color: "#7a8fb0", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>½</button>
                      <button onClick={() => setBet(Math.floor(balance * 100) / 100)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid #1e2d4a", background: "transparent", color: "#7a8fb0", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>Max</button>
                    </div>
                  </div>
                )}

                {/* Status Tags */}
                {isPlaying && (
                  <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: 12, color: "#7a8fb0" }}>Mode:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, padding: "3px 11px", borderRadius: 99, background: `${cfg.color}15`, border: `1px solid ${cfg.color}` }}>
                      {cfg.bombs} bomb{cfg.bombs > 1 ? "s" : ""} · {cfg.risk}
                    </span>
                    <span style={{ fontSize: 12, color: "#3a4f70" }}>Bet: <strong style={{ color: "#c0cfea" }}>{bet} OCT</strong></span>
                  </div>
                )}

                {/* Start / Again Action */}
                {(phase === "idle" || phase === "won" || phase === "lost") && (
                  <button
                    onClick={phase === "idle" ? startGame : resetGame}
                    disabled={bet <= 0 || bet > balance || isResolving}
                    style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", fontFamily: "'Outfit',sans-serif", fontSize: 16, fontWeight: 800, cursor: (bet <= 0 || bet > balance) ? "not-allowed" : "pointer", transition: "all .18s", background: (bet > 0 && bet <= balance) ? "#00d4c8" : "#1a2640", color: (bet > 0 && bet <= balance) ? "#071218" : "#3a4f70", marginBottom: 14 }}
                  >
                    {phase === "idle"
                      ? `⛏  Start Hunt — ${bet} OCT`
                      : phase === "won" ? "Hunt Again" : "Try Again"}
                  </button>
                )}

                {/* History Section */}
                {mergedHistory.length > 0 && (
                  <div style={{ animation: "rise .3s ease", display: "flex", gap: 9, marginBottom: 14 }}>
                    {[
                      { lbl: "Games", val: mergedHistory.length },
                      { lbl: "Win rate", val: Math.round((mergedHistory.filter((h) => h?.won).length / mergedHistory.length) * 100) + "%" },
                      { lbl: "Net P/L", val: (netPL >= 0 ? "+" : "") + netPL.toLocaleString(undefined, { maximumFractionDigits: 3 }) + " OCT", col: netPL > 0 ? "#00e5a0" : netPL < 0 ? "#ff4d6d" : "#fff" },
                    ].map((s) => (
                      <div key={s.lbl} style={{ flex: 1, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 12, padding: "11px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#7a8fb0", marginBottom: 4, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>{s.lbl}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: s.col || "#fff" }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
