"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  PACKAGE_ID,
  CASINO_MODULE,
  HOUSE_BANKROLL_ID,
  COIN_TYPE,
} from "@/config";
import { useCasinoStore } from "@/hooks/useCasinoStore";

// ─── Constants ──────────────────────────────────────────────
const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1];
const GAME_RANGE = 100;
const MIST_PER_OCT = 1_000_000_000;
const RANDOM_OBJECT_ID = "0x8";
const GAS_BUDGET = 50_000_000;
const THRESHOLD_MIN = 2;
const THRESHOLD_MAX = 98;

type Side = "over" | "under";

interface RollResult {
  finalRoll: number;
  won: boolean;
  payout: number;
  wagerAmount: number;
  side: Side;
  threshold: number;
}

// ─── Helpers ──────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function calcOdds(threshold: number, side: Side, houseEdgeBps: number) {
  const winCount = side === "over" ? GAME_RANGE - threshold : threshold - 1;
  const winChance = winCount / GAME_RANGE;
  const fairMulBps = Math.floor(10000 / winChance);
  const mulBps = Math.floor((fairMulBps * (10000 - houseEdgeBps)) / 10000);
  const mul = Math.max(1.01, mulBps / 10000);
  return { winChance, mul, mulBps: Math.max(10100, mulBps), winCount };
}

// ─── Dice face SVG ──────────────────────────────────────────
const DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({ value, size = 80, color = "#c0cfea", bg = "#0d1526", border = "#1e2d4a" }: {
  value: number; size?: number; color?: string; bg?: string; border?: string;
}) {
  const face = Math.max(1, Math.min(6, Math.round((value / 100) * 6) || 1));
  const dots = DOTS[face] || DOTS[1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="92" rx="18" fill={bg} stroke={border} strokeWidth="3" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill={color} />
      ))}
    </svg>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DICE ROLL PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function DiceRollPage() {
  // ── Casino store (dynamic house edge) ──
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 200;

  // ── Wallet ──
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } =
    useSignAndExecuteTransaction();

  // ── State ──
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(0.01);
  const [threshold, setThreshold] = useState<number>(50);
  const [side, setSide] = useState<Side>("over");
  const [phase, setPhase] = useState<"idle" | "rolling" | "result">("idle");
  const [rollNum, setRollNum] = useState<number | null>(null);
  const [result, setResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<
    Array<{ finalRoll: number; won: boolean; profit: number; bet: number; side: Side; threshold: number; mul: number; digest: string }>
  >([]);
  const [error, setError] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);

  // ── Derived values ──
  const { winChance, mul, mulBps, winCount } = calcOdds(threshold, side, houseEdgeBps);
  const potentialWin = bet * mul;
  const profit = potentialWin - bet;
  const balanceOCT = balance / MIST_PER_OCT;
  const canRoll = phase === "idle" && bet > 0 && bet <= balanceOCT && !!account?.address;

  // ── Range params for contract ──
  // Over threshold: win if result in [threshold, 100) → guess_low=threshold, guess_high=100
  //                 BUT our range is 0..99 on-chain, so over 50 means result >= 50 → [50, 100)
  // Under threshold: win if result in [0, threshold-1) → guess_low=0, guess_high=threshold-1  
  //                 Under 50 means result < 50 → [0, 50) → result 0..49
  const guessLow = side === "over" ? threshold : 0;
  const guessHigh = side === "over" ? GAME_RANGE : threshold - 1;

  // ── Fetch balance ──
  const fetchBalance = useCallback(async () => {
    if (!account?.address) return;
    try {
      const bal = await suiClient.getBalance({
        owner: account.address,
        coinType: COIN_TYPE,
      });
      setBalance(Number(bal.totalBalance));
    } catch { /* ignore */ }
  }, [account?.address, suiClient]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // ── Fetch past rolls from on-chain events ──
  useEffect(() => {
    if (!account?.address) return;
    const loadHistory = async () => {
      try {
        const events = await suiClient.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${CASINO_MODULE}::RangeWagerPlayed`,
          },
          order: "descending",
          limit: 20,
        });

        const pastRolls = events.data
          .filter((e) => {
            const parsed = e.parsedJson as any;
            return parsed.player === account.address && parsed.game_id === "dice_roll";
          })
          .map((e) => {
            const p = e.parsedJson as any;
            const won = Boolean(p.won);
            const wagerAmount = Number(p.wager_amount);
            const payout = Number(p.payout || 0);
            const gLow = Number(p.guess_low);
            const gHigh = Number(p.guess_high);
            const resultNum = Number(p.result);
            const rollSide: Side = gLow === 0 ? "under" : "over";
            const rollThreshold = rollSide === "over" ? gLow : gHigh + 1;
            const rollMul = Number(p.multiplier_bps) / 10000;
            return {
              finalRoll: resultNum + 1, // display as 1-100
              won,
              profit: won ? (payout - wagerAmount) / MIST_PER_OCT : -wagerAmount / MIST_PER_OCT,
              bet: wagerAmount / MIST_PER_OCT,
              side: rollSide,
              threshold: rollThreshold,
              mul: rollMul,
              digest: e.id.txDigest,
            };
          })
          .slice(0, 8);

        if (pastRolls.length > 0) setHistory(pastRolls);
      } catch { /* ignore */ }
    };
    loadHistory();
  }, [account?.address, suiClient]);

  // ── Roll logic ──
  const roll = useCallback(async () => {
    if (!canRoll || !account?.address) return;
    runId.current += 1;
    const id = runId.current;
    setPhase("rolling");
    setResult(null);
    setError("");

    try {
      const betMist = Math.floor(bet * MIST_PER_OCT);
      const tx = new Transaction();
      tx.setGasBudget(GAS_BUDGET);
      const [wagerCoin] = tx.splitCoins(tx.gas, [betMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::play_range_wager`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(RANDOM_OBJECT_ID),
          wagerCoin,
          tx.pure.string("dice_roll"),
          tx.pure.u64(guessLow),
          tx.pure.u64(guessHigh),
          tx.pure.u64(GAME_RANGE),
          tx.pure.u64(mulBps),
        ],
      });

      let sequenceFinished = false;
      // Run roll animation while waiting
      const animPromise = (async () => {
        while (!sequenceFinished && runId.current === id) {
          setRollNum(Math.floor(Math.random() * 100) + 1);
          await sleep(60);
        }
        if (runId.current !== id) return;
        const steps = [90, 130, 180, 260];
        for (const delay of steps) {
          await sleep(delay);
          if (runId.current !== id) return;
          setRollNum(Math.floor(Math.random() * 100) + 1);
        }
      })();

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (txResult) => {
            if (runId.current !== id) return;
            try {
              const txResponse = await suiClient.waitForTransaction({
                digest: txResult.digest,
                options: { showEvents: true, showBalanceChanges: true },
              });

              const events = txResponse.events || [];
              const wagerEvent = events.find((e) =>
                e.type.includes("::casino::RangeWagerPlayed")
              );

              sequenceFinished = true;
              await animPromise;

              if (wagerEvent) {
                const parsed = wagerEvent.parsedJson as any;
                const won = parsed.won;
                const resultNum = Number(parsed.result);
                const payout = Number(parsed.payout || 0);
                const wagerAmount = Number(parsed.wager_amount || 0);
                const displayRoll = resultNum + 1; // show 1-100 to user

                setRollNum(displayRoll);
                await sleep(280);
                if (runId.current !== id) return;

                const flipResult: RollResult = {
                  finalRoll: displayRoll,
                  won,
                  payout,
                  wagerAmount,
                  side,
                  threshold,
                };

                setResult(flipResult);
                setHistory((h) =>
                  [
                    {
                      finalRoll: displayRoll,
                      won,
                      profit: won ? (payout - wagerAmount) / MIST_PER_OCT : -wagerAmount / MIST_PER_OCT,
                      bet,
                      side,
                      threshold,
                      mul,
                      digest: txResult.digest,
                    },
                  ]
                    .concat(h)
                    .slice(0, 8)
                );
                setPhase("result");
                fetchBalance();
              } else {
                runId.current += 1;
                setPhase("idle");
                setError("Could not parse roll result");
              }
            } catch (err: any) {
              if (runId.current !== id) return;
              runId.current += 1;
              setPhase("idle");
              setError(err?.message || "Transaction failed");
            }
          },
          onError: (err) => {
            if (runId.current !== id) return;
            runId.current += 1;
            setPhase("idle");
            setError(err?.message || "Transaction rejected");
          },
        }
      );
    } catch (err: any) {
      runId.current += 1;
      setPhase("idle");
      setError(err?.message || "Failed to build transaction");
    }
  }, [canRoll, account?.address, bet, side, threshold, guessLow, guessHigh, mulBps, mul, signAndExecute, suiClient, fetchBalance]);

  const reset = () => { setPhase("idle"); setResult(null); };

  // ── Slider drag ──
  const getThresholdFromEvent = (e: any) => {
    const el = sliderRef.current;
    if (!el) return threshold;
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(clamp(pct * 100, THRESHOLD_MIN, THRESHOLD_MAX));
  };

  const netPL = history.reduce((s, h) => s + h.profit, 0);
  const thumbPct = ((threshold - 1) / 98) * 100;
  const numColor = phase !== "result" ? "#fff" : result?.won ? "#00e5a0" : "#ff4d6d";
  const houseEdgePct = (houseEdgeBps / 100).toFixed(1);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .dr-wrap { font-family:'Outfit',sans-serif; background:#0a0f1e; min-height:100vh; padding:28px 16px; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .roll-num { font-family:'Outfit',sans-serif; font-size:88px; font-weight:900; line-height:1; letter-spacing:-4px; transition:color .2s; font-variant-numeric:tabular-nums; }
        @keyframes rollCount { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .rolling-num { animation:rollCount .12s ease infinite; }
        .track-wrap { position:relative; height:40px; cursor:pointer; user-select:none; -webkit-user-select:none; }
        .track { position:absolute; top:50%; transform:translateY(-50%); left:0; right:0; height:10px; border-radius:6px; overflow:hidden; }
        .thumb { position:absolute; top:50%; transform:translate(-50%,-50%); width:22px; height:22px; border-radius:50%; background:#fff; border:3px solid #0a0f1e; box-shadow:0 0 0 2px #00d4c8; cursor:grab; z-index:2; transition:box-shadow .15s; }
        .thumb:hover, .thumb.dragging { box-shadow:0 0 0 4px rgba(0,212,200,.4); cursor:grabbing; }
        .track-label { position:absolute; top:50%; transform:translateY(-50%); font-size:12px; font-weight:700; pointer-events:none; font-family:'Outfit',sans-serif; }
        .side-btn { flex:1; padding:13px 0; border-radius:12px; border:2px solid #1e2d4a; background:#0d1526; font-family:'Outfit',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all .18s; display:flex; flex-direction:column; align-items:center; gap:5px; }
        .side-btn:hover:not(:disabled) { border-color:#2a3f66; }
        .sb-over.active  { border-color:#00d4c8; background:rgba(0,212,200,.1); color:#00d4c8; }
        .sb-under.active { border-color:#a78bfa; background:rgba(167,139,250,.1); color:#a78bfa; }
        .roll-btn { width:100%; padding:16px; border-radius:14px; border:none; font-family:'Outfit',sans-serif; font-size:17px; font-weight:800; cursor:pointer; transition:all .18s; letter-spacing:.3px; }
        .rb-ready  { background:#00d4c8; color:#071218; }
        .rb-ready:hover { background:#00f0e0; transform:translateY(-1px); }
        .rb-off    { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .rb-roll   { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .7s ease infinite; }
        @keyframes breathe { 0%,100%{opacity:1} 50%{opacity:.35} }
        .qb { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }
        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .res { animation:slideUp .3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:none} }
        .hrow { animation:fadeIn .25s ease; }
        .sc { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 10px; text-align:center; }
        .lbl { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:9px; }
        .odds-strip { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; background:#060c18; border:1.5px solid #1a2640; border-radius:13px; padding:14px 18px; gap:8px; }
      `}</style>

      <div className="dr-wrap">
        <div style={{ maxWidth: 500, margin: "0 auto" }}>

          {/* ── Back + Header ── */}
          <div style={{ marginBottom: 12 }}>
            <Link href="/casino" style={{ fontSize: 13, color: "#7a8fb0", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ← Back to Casino
            </Link>
          </div>

          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 999, padding: "5px 16px", marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4c8", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>Instant Play · Custom Risk</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5, margin: 0 }}>🎲 Dice Roll</h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 6 }}>Set your threshold. Go over or under. You control the odds.</p>
          </div>

          {/* ── Wallet gate ── */}
          {!account?.address && (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Connect your wallet</div>
              <div style={{ fontSize: 13, color: "#7a8fb0" }}>Connect a OneChain wallet to start rolling</div>
            </div>
          )}

          {account?.address && (
            <>
              {/* ── Balance ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 13, padding: "13px 18px", marginBottom: 18 }}>
                <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>Balance</span>
                <span style={{ fontSize: 21, fontWeight: 700, color: "#fff" }}>
                  {balanceOCT.toFixed(4)} <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>OCT</span>
                </span>
              </div>

              {/* ── Big number display ── */}
              <div style={{
                background: "#060c18",
                border: `1.5px solid ${phase === "result" ? (result?.won ? "#00e5a0" : "#ff4d6d") : phase === "rolling" ? "#00d4c8" : "#1a2640"}`,
                borderRadius: 18, padding: "28px 20px 20px", marginBottom: 18, textAlign: "center",
                transition: "border-color .3s, box-shadow .3s",
                boxShadow: phase === "rolling" ? "0 0 24px rgba(0,212,200,.18), inset 0 0 40px rgba(0,212,200,.04)"
                  : phase === "result" ? (result?.won ? "0 0 24px rgba(0,229,160,.2)" : "0 0 24px rgba(255,77,109,.18)") : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                  <DieFace value={rollNum || 50} size={64}
                    color={phase === "result" ? (result?.won ? "#00e5a0" : "#ff4d6d") : phase === "rolling" ? "#00d4c8" : "#3a4f70"}
                    bg="#0a0f1e"
                    border={phase === "result" ? (result?.won ? "#00e5a0" : "#ff4d6d") : phase === "rolling" ? "#00d4c8" : "#1e2d4a"}
                  />
                </div>
                <div className={`roll-num ${phase === "rolling" ? "rolling-num" : ""}`} style={{ color: numColor }}>
                  {rollNum !== null ? String(rollNum).padStart(2, "0") : "--"}
                </div>
                <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 8 }}>
                  {phase === "idle" && "Set your bet and roll"}
                  {phase === "rolling" && <span style={{ color: "#00d4c8", animation: "breathe .7s ease infinite" }}>Rolling on-chain...</span>}
                  {phase === "result" && result && (
                    <span>
                      Roll <strong style={{ color: result.won ? "#00e5a0" : "#ff4d6d" }}>{result.finalRoll}</strong>
                      <span style={{ color: "#3a4f70" }}> — needed {side} {threshold} — </span>
                      <strong style={{ color: result.won ? "#00e5a0" : "#ff4d6d" }}>{result.won ? "WIN" : "LOSE"}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* ── Odds strip ── */}
              <div className="odds-strip" style={{ marginBottom: 18 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>Win Chance</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#00d4c8" }}>{(winChance * 100).toFixed(1)}%</div>
                </div>
                <div style={{ textAlign: "center", padding: "0 12px", borderLeft: "1px solid #1a2640", borderRight: "1px solid #1a2640" }}>
                  <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>Payout</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f5c542" }}>{mul.toFixed(2)}×</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>Profit</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#00e5a0" }}>+{profit.toFixed(4)}</div>
                </div>
              </div>

              {/* ── Over / Under ── */}
              <div style={{ marginBottom: 18 }}>
                <div className="lbl">Predict</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {([
                    { key: "under" as Side, label: "Roll Under", sub: `< ${threshold}`, accent: "#a78bfa" },
                    { key: "over" as Side, label: "Roll Over", sub: `> ${threshold}`, accent: "#00d4c8" },
                  ]).map(({ key, label, sub, accent }) => (
                    <button key={key} className={`side-btn sb-${key} ${side === key ? "active" : ""}`}
                      style={{ color: side === key ? accent : "#7a8fb0" }}
                      onClick={() => { if (phase === "idle") { setSide(key); } }}
                      disabled={phase !== "idle"}>
                      <span style={{ fontSize: 22 }}>{key === "over" ? "▲" : "▼"}</span>
                      <span style={{ fontSize: 14 }}>{label}</span>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{sub}</span>
                      <span style={{ fontSize: 11, opacity: .7 }}>({(calcOdds(threshold, key, houseEdgeBps).winChance * 100).toFixed(1)}% chance)</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Threshold slider ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className="lbl" style={{ marginBottom: 0 }}>Threshold</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" value={threshold} min={THRESHOLD_MIN} max={THRESHOLD_MAX}
                      disabled={phase !== "idle"}
                      onChange={(e) => { if (phase === "idle") setThreshold(clamp(Number(e.target.value), THRESHOLD_MIN, THRESHOLD_MAX)); }}
                      className="mono"
                      style={{ width: 64, padding: "5px 8px", background: "#060c18", border: "1.5px solid #1e2d4a", borderRadius: 8, color: "#fff", fontSize: 18, fontWeight: 700, outline: "none", textAlign: "center" }}
                    />
                    <span style={{ fontSize: 13, color: "#3a4f70" }}>/ 100</span>
                  </div>
                </div>

                <div ref={sliderRef} className="track-wrap"
                  onMouseDown={(e) => { if (phase !== "idle") return; setDragging(true); setThreshold(getThresholdFromEvent(e)); }}
                  onMouseMove={(e) => { if (!dragging || phase !== "idle") return; setThreshold(getThresholdFromEvent(e)); }}
                  onMouseUp={() => setDragging(false)}
                  onMouseLeave={() => setDragging(false)}
                  onTouchStart={(e) => { if (phase !== "idle") return; setDragging(true); setThreshold(getThresholdFromEvent(e)); }}
                  onTouchMove={(e) => { if (!dragging || phase !== "idle") return; setThreshold(getThresholdFromEvent(e)); }}
                  onTouchEnd={() => setDragging(false)}
                >
                  <div className="track">
                    <div style={{ position: "absolute", left: 0, width: `${thumbPct}%`, top: 0, bottom: 0, background: "rgba(167,139,250,.35)" }} />
                    <div style={{ position: "absolute", left: `${thumbPct}%`, width: "2px", top: 0, bottom: 0, background: "#fff" }} />
                    <div style={{ position: "absolute", left: `calc(${thumbPct}% + 2px)`, right: 0, top: 0, bottom: 0, background: "rgba(0,212,200,.3)" }} />
                  </div>
                  <span className="track-label" style={{ left: `${Math.min(thumbPct * 0.5, thumbPct - 4)}%`, color: "#a78bfa", transform: "translate(-50%, -50%)", fontSize: 11, display: thumbPct < 12 ? "none" : "block" }}>UNDER</span>
                  <span className="track-label" style={{ left: `${thumbPct + (100 - thumbPct) * 0.5}%`, color: "#00d4c8", transform: "translate(-50%, -50%)", fontSize: 11, display: thumbPct > 88 ? "none" : "block" }}>OVER</span>
                  <div className={`thumb${dragging ? " dragging" : ""}`} style={{ left: `${thumbPct}%` }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingInline: 4 }}>
                  {[1, 25, 50, 75, 100].map((n) => (
                    <span key={n} className="mono" style={{ fontSize: 11, color: "#3a4f70" }}>{n}</span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                  {[25, 35, 50, 65, 75].map((v) => (
                    <button key={v} className="qb"
                      style={threshold === v ? { borderColor: "#00d4c8", color: "#00d4c8", background: "rgba(0,212,200,.08)" } : {}}
                      onClick={() => { if (phase === "idle") setThreshold(v); }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Bet ── */}
              <div style={{ marginBottom: 18 }}>
                <div className="lbl">Bet Amount (OCT)</div>
                <input className="bet-in" type="number" value={bet} min={0.01} step={0.01}
                  disabled={phase !== "idle"}
                  onChange={(e) => setBet(Math.max(0.001, Number(e.target.value) || 0.01))}
                />
                <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  {QUICK_BETS_OCT.map((v) => (
                    <button key={v} className="qb" onClick={() => { if (phase === "idle") setBet(v); }}>{v}</button>
                  ))}
                  <button className="qb" onClick={() => { if (phase === "idle") setBet(Math.floor(balanceOCT * 50) / 100); }}>½</button>
                  <button className="qb" onClick={() => { if (phase === "idle") setBet(Math.floor(balanceOCT * 100) / 100); }}>Max</button>
                </div>
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,77,109,.1)", border: "1px solid #ff4d6d", color: "#ff4d6d", fontSize: 13, marginBottom: 14, textAlign: "center" }}>
                  {error}
                </div>
              )}

              {/* ── Result Banner ── */}
              {phase === "result" && result && (
                <div className="res" style={{ textAlign: "center", marginBottom: 16, padding: "14px 18px", borderRadius: 13, background: result.won ? "rgba(0,229,160,.1)" : "rgba(255,77,109,.1)", border: `1.5px solid ${result.won ? "#00e5a0" : "#ff4d6d"}` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: result.won ? "#00e5a0" : "#ff4d6d" }}>
                    {result.won ? "You Won!" : "You Lost"}
                  </div>
                  <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>
                    Rolled <strong style={{ color: "#fff" }}>{result.finalRoll}</strong>
                    {" · "}
                    <span style={{ color: result.won ? "#00e5a0" : "#ff4d6d", fontWeight: 600 }}>
                      {result.won ? `+${((result.payout - result.wagerAmount) / MIST_PER_OCT).toFixed(4)}` : `-${(result.wagerAmount / MIST_PER_OCT).toFixed(4)}`} OCT
                    </span>
                    {result.won && <span style={{ marginLeft: 8, color: "#f5c542" }}>{mul.toFixed(2)}× payout</span>}
                  </div>
                </div>
              )}

              {/* ── Roll button ── */}
              {phase !== "result" ? (
                <button
                  className={`roll-btn ${phase === "rolling" ? "rb-roll" : canRoll ? "rb-ready" : "rb-off"}`}
                  onClick={roll}
                  disabled={!canRoll}
                >
                  {phase === "rolling" ? "Rolling..." : `Roll — ${side === "over" ? "Over" : "Under"} ${threshold}`}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="roll-btn rb-ready" style={{ flex: 1 }} onClick={reset}>Roll Again</button>
                  <button
                    onClick={() => { setBet(Math.min(bet * 2, balanceOCT)); reset(); }}
                    style={{ padding: "16px 20px", borderRadius: 14, border: "1.5px solid #1e2d4a", background: "transparent", color: "#7a8fb0", fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00d4c8"; (e.currentTarget as HTMLElement).style.color = "#00d4c8"; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d4a"; (e.currentTarget as HTMLElement).style.color = "#7a8fb0"; }}
                  >
                    2× Bet
                  </button>
                </div>
              )}

              {/* ── Stats ── */}
              {history.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  {[
                    { label: "Win rate", value: Math.round(history.filter((h) => h.won).length / history.length * 100) + "%" },
                    { label: "Total rolls", value: history.length },
                    { label: "Net P/L", value: (netPL >= 0 ? "+" : "") + netPL.toFixed(4) + " OCT", col: netPL > 0 ? "#00e5a0" : netPL < 0 ? "#ff4d6d" : "#fff" },
                  ].map((s) => (
                    <div key={s.label} className="sc">
                      <div style={{ fontSize: 10, color: "#7a8fb0", marginBottom: 5, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: (s as any).col || "#fff" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── History ── */}
              {history.length > 0 && (
                <div style={{ marginTop: 18, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "11px 16px", fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", borderBottom: "1px solid #1a2640" }}>
                    Recent Rolls
                  </div>
                  {history.map((h, i) => (
                    <div key={i} className="hrow" style={{ borderBottom: i < history.length - 1 ? "1px solid #0f1a2e" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: h.won ? "rgba(0,229,160,.12)" : "rgba(255,77,109,.12)", border: `1px solid ${h.won ? "#00e5a0" : "#ff4d6d"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DieFace value={h.finalRoll} size={26} color={h.won ? "#00e5a0" : "#ff4d6d"} bg="transparent" border="transparent" />
                          </div>
                          <div>
                            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "#c0cfea" }}>
                              Rolled <span style={{ color: h.won ? "#00e5a0" : "#ff4d6d" }}>{String(h.finalRoll).padStart(2, "0")}</span>
                              <span style={{ color: "#3a4f70" }}> — {h.side} {h.threshold}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#3a4f70", marginTop: 1 }}>
                              {h.mul.toFixed(2)}× · Bet: {h.bet} OCT
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: h.won ? "#00e5a0" : "#ff4d6d" }}>
                            {h.won ? "+" : ""}{h.profit.toFixed(4)} OCT
                          </div>
                          <div style={{ fontSize: 10, color: h.won ? "#00a870" : "#cc2d45", marginTop: 1, fontWeight: 600, textTransform: "uppercase" }}>
                            {h.won ? "win" : "loss"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#3a4f70" }}>
                1–100 RNG · House edge {houseEdgePct}% · Powered by OneChain on-chain randomness
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
