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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Color definitions ──────────────────────────────────────
// Red: 45% (range 0–44), Green: 45% (range 45–89), Violet: 10% (range 90–99)
interface ColorDef {
  label: string;
  hex: string;
  glow: string;
  dark: string;
  light: string;
  fairMulLabel: string;
  id: number;
  rangeLow: number;   // inclusive
  rangeHigh: number;   // exclusive
  chance: number;      // 0.0 - 1.0
}

const COLORS: Record<string, ColorDef> = {
  red: {
    label: "Red", hex: "#ff4d6d", glow: "rgba(255,77,109,.4)", dark: "#cc1a35",
    light: "rgba(255,77,109,.12)", fairMulLabel: "2×", id: 0,
    rangeLow: 0, rangeHigh: 45, chance: 0.45,
  },
  green: {
    label: "Green", hex: "#00e5a0", glow: "rgba(0,229,160,.4)", dark: "#00a870",
    light: "rgba(0,229,160,.12)", fairMulLabel: "2×", id: 1,
    rangeLow: 45, rangeHigh: 90, chance: 0.45,
  },
  violet: {
    label: "Violet", hex: "#a78bfa", glow: "rgba(167,139,250,.4)", dark: "#7c5fe6",
    light: "rgba(167,139,250,.12)", fairMulLabel: "4.5×", id: 2,
    rangeLow: 90, rangeHigh: 100, chance: 0.10,
  },
};

const COLOR_KEYS = ["red", "green", "violet"];

function getColorMul(colorKey: string, houseEdgeBps: number): { mul: number; mulBps: number } {
  const c = COLORS[colorKey];
  const fairMulBps = Math.floor(10000 / c.chance);
  const mulBps = Math.floor((fairMulBps * (10000 - houseEdgeBps)) / 10000);
  return { mul: Math.max(1.01, mulBps / 10000), mulBps: Math.max(10100, mulBps) };
}

function resultToColor(resultNum: number): string {
  if (resultNum < 45) return "red";
  if (resultNum < 90) return "green";
  return "violet";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COLOR PREDICTION PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ColorPredictionPage() {
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 200;

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [balance, setBalance] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [bet, setBet] = useState<number>(0.01);
  const [phase, setPhase] = useState<"idle" | "revealing" | "result">("idle");
  const [result, setResult] = useState<{
    color: string;
    won: boolean;
    payout: number;
    wagerAmount: number;
  } | null>(null);
  const [orb, setOrb] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ color: string; won: boolean; profit: number; bet: number; chosenColor: string; digest: string }>
  >([]);
  const [error, setError] = useState<string>("");
  const runId = useRef(0);

  const balanceOCT = balance / MIST_PER_OCT;
  const canPlay = phase === "idle" && selectedColor !== null && bet > 0 && bet <= balanceOCT && !!account?.address;
  const houseEdgePct = (houseEdgeBps / 100).toFixed(1);

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

  // ── Fetch past rounds from on-chain events ──
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

        const pastRounds = events.data
          .filter((e) => {
            const parsed = e.parsedJson as any;
            return parsed.player === account.address && parsed.game_id === "color_prediction";
          })
          .map((e) => {
            const p = e.parsedJson as any;
            const won = Boolean(p.won);
            const wagerAmount = Number(p.wager_amount);
            const payout = Number(p.payout || 0);
            const resultNum = Number(p.result);
            const gLow = Number(p.guess_low);
            const resultColor = resultToColor(resultNum);
            // Determine what color was chosen based on guess_low
            let chosenColor = "red";
            if (gLow === 0) chosenColor = "red";
            else if (gLow === 45) chosenColor = "green";
            else if (gLow === 90) chosenColor = "violet";

            return {
              color: resultColor,
              won,
              profit: won ? (payout - wagerAmount) / MIST_PER_OCT : -wagerAmount / MIST_PER_OCT,
              bet: wagerAmount / MIST_PER_OCT,
              chosenColor,
              digest: e.id.txDigest,
            };
          })
          .slice(0, 15);

        if (pastRounds.length > 0) setHistory(pastRounds);
      } catch { /* ignore */ }
    };
    loadHistory();
  }, [account?.address, suiClient]);

  // ── Play ──
  const play = useCallback(async () => {
    if (!canPlay || !account?.address || !selectedColor) return;
    runId.current += 1;
    const id = runId.current;
    setPhase("revealing");
    setResult(null);
    setError("");

    try {
      const betMist = Math.floor(bet * MIST_PER_OCT);
      const colorDef = COLORS[selectedColor];
      const { mulBps } = getColorMul(selectedColor, houseEdgeBps);

      const tx = new Transaction();
      tx.setGasBudget(GAS_BUDGET);
      const [wagerCoin] = tx.splitCoins(tx.gas, [betMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::play_range_wager`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(RANDOM_OBJECT_ID),
          wagerCoin,
          tx.pure.string("color_prediction"),
          tx.pure.u64(colorDef.rangeLow),
          tx.pure.u64(colorDef.rangeHigh),
          tx.pure.u64(GAME_RANGE),
          tx.pure.u64(mulBps),
        ],
      });

      let sequenceFinished = false;
      // Orb animation while waiting
      const animPromise = (async () => {
        const cycle = ["red", "green", "violet"];
        let i = 0;
        while (!sequenceFinished && runId.current === id) {
          setOrb(cycle[i % 3]);
          i++;
          await sleep(80);
        }
        if (runId.current !== id) return;
        const slowSteps = [120, 180, 260, 360];
        for (const delay of slowSteps) {
          await sleep(delay);
          if (runId.current !== id) return;
          setOrb(cycle[Math.floor(Math.random() * 3)]);
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
                const resColor = resultToColor(resultNum);

                // Land orb on result color
                setOrb(resColor);
                await sleep(300);
                if (runId.current !== id) return;

                setResult({
                  color: resColor,
                  won,
                  payout,
                  wagerAmount,
                });

                setHistory((h) =>
                  [
                    {
                      color: resColor,
                      won,
                      profit: won ? (payout - wagerAmount) / MIST_PER_OCT : -wagerAmount / MIST_PER_OCT,
                      bet,
                      chosenColor: selectedColor,
                      digest: txResult.digest,
                    },
                  ]
                    .concat(h)
                    .slice(0, 15)
                );
                setPhase("result");
                fetchBalance();
              } else {
                runId.current += 1;
                setPhase("idle");
                setOrb(null);
                setError("Could not parse result");
              }
            } catch (err: any) {
              if (runId.current !== id) return;
              runId.current += 1;
              setPhase("idle");
              setOrb(null);
              setError(err?.message || "Transaction failed");
            }
          },
          onError: (err) => {
            if (runId.current !== id) return;
            runId.current += 1;
            setPhase("idle");
            setOrb(null);
            setError(err?.message || "Transaction rejected");
          },
        }
      );
    } catch (err: any) {
      runId.current += 1;
      setPhase("idle");
      setOrb(null);
      setError(err?.message || "Failed to build transaction");
    }
  }, [canPlay, account?.address, selectedColor, bet, houseEdgeBps, signAndExecute, suiClient, fetchBalance]);

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setOrb(null);
  };

  const netPL = history.reduce((s, h) => s + h.profit, 0);
  const orbColor = orb ? COLORS[orb] : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .cp-wrap { font-family:'Outfit',sans-serif; background:#0a0f1e; min-height:100vh; padding:28px 16px; }
        .mono    { font-family:'JetBrains Mono',monospace; }
        .lbl     { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:9px; }

        .orb-wrap { position:relative; display:flex; align-items:center; justify-content:center; width:150px; height:150px; margin:0 auto; }
        .orb { width:120px; height:120px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:38px; font-weight:900; letter-spacing:-1px; transition:background .12s, box-shadow .12s; position:relative; z-index:1; font-family:'Outfit',sans-serif; }
        .orb-ring { position:absolute; inset:-12px; border-radius:50%; border:2px solid transparent; transition:all .15s; }
        .orb-ring.active { animation:orbPulse 1.2s ease infinite; }
        @keyframes orbPulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.06);opacity:1} }
        .orb-idle { background:#0d1526; border:2px solid #1e2d4a; }

        .color-card { flex:1; border-radius:14px; border:2px solid transparent; background:#0d1526; padding:14px 10px 16px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:all .18s; position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; }
        .color-card:hover:not(.locked) { transform:translateY(-2px); }
        .color-card:active:not(.locked) { transform:scale(.97); }
        .color-card.locked { cursor:not-allowed; opacity:.7; }

        .chip { width:44px; height:44px; border-radius:50%; border:2px solid #1e2d4a; background:#0d1526; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; color:#7a8fb0; font-family:'Outfit',sans-serif; }
        .chip:hover  { border-color:#00d4c8; color:#00d4c8; transform:scale(1.08); }
        .chip.active { background:#00d4c8; color:#071218; border-color:#00d4c8; }

        @keyframes popIn { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        .pop { animation:popIn .4s cubic-bezier(.34,1.56,.64,1) forwards; }

        .hdot { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; flex-shrink:0; }

        .sc { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 10px; text-align:center; }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:none} }
        @keyframes breathe { 0%,100%{opacity:1} 50%{opacity:.35} }

        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }

        .qb { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }

        .play-btn { width:100%; padding:16px; border-radius:14px; border:none; font-family:'Outfit',sans-serif; font-size:17px; font-weight:800; cursor:pointer; transition:all .18s; letter-spacing:.3px; }
        .pb-ready  { background:#00d4c8; color:#071218; }
        .pb-ready:hover { background:#00f0e0; transform:translateY(-1px); }
        .pb-off    { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .pb-roll   { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .7s ease infinite; }
      `}</style>

      <div className="cp-wrap">
        <div style={{ maxWidth: 500, margin: "0 auto" }}>

          {/* ── Back + Header ── */}
          <div style={{ marginBottom: 12 }}>
            <Link href="/casino" style={{ fontSize: 13, color: "#7a8fb0", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ← Back to Casino
            </Link>
          </div>

          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 999, padding: "5px 16px", marginBottom: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4c8", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>Instant Play · Weighted RNG</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5, margin: 0 }}>🎨 Color Prediction</h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 6 }}>
              Pick a color. Red &amp; Green pay {getColorMul("red", houseEdgeBps).mul.toFixed(2)}×, Violet pays {getColorMul("violet", houseEdgeBps).mul.toFixed(2)}×.
            </p>
          </div>

          {/* ── Wallet gate ── */}
          {!account?.address && (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Connect your wallet</div>
              <div style={{ fontSize: 13, color: "#7a8fb0" }}>Connect a OneChain wallet to start playing</div>
            </div>
          )}

          {account?.address && (
            <>
              {/* ── Balance ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 13, padding: "12px 17px", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>Balance</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
                  {balanceOCT.toFixed(4)} <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>OCT</span>
                </span>
              </div>

              {/* ── Orb ── */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div className="orb-wrap">
                  {orbColor && (
                    <div className="orb-ring active" style={{ borderColor: orbColor.hex, boxShadow: `0 0 30px ${orbColor.glow}` }} />
                  )}
                  <div
                    className={`orb ${orbColor ? "" : "orb-idle"}`}
                    style={orbColor ? {
                      background: orbColor.light,
                      border: `3px solid ${orbColor.hex}`,
                      boxShadow: `0 0 40px ${orbColor.glow}, inset 0 0 30px ${orbColor.light}`,
                      color: orbColor.hex,
                    } : {}}
                  >
                    {phase === "result" && result ? (
                      <span className="pop" style={{ fontSize: 22, color: COLORS[result.color].hex, fontWeight: 900 }}>
                        {COLORS[result.color].label.toUpperCase()}
                      </span>
                    ) : orbColor ? (
                      <span style={{ fontSize: 20, fontWeight: 900, color: orbColor.hex }}>?</span>
                    ) : (
                      <span style={{ fontSize: 13, color: "#3a4f70", fontWeight: 600 }}>PICK</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Result summary ── */}
              {phase === "result" && result && (
                <div className="pop" style={{
                  textAlign: "center", marginBottom: 16, padding: "14px 18px", borderRadius: 13,
                  background: result.won ? "rgba(0,229,160,.08)" : "rgba(255,77,109,.08)",
                  border: `1.5px solid ${result.won ? "#00e5a0" : "#ff4d6d"}`,
                }}>
                  {result.won ? (
                    <>
                      <div style={{ fontSize: 19, fontWeight: 800, color: "#00e5a0" }}>
                        +{((result.payout - result.wagerAmount) / MIST_PER_OCT).toFixed(4)} OCT
                      </div>
                      <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 4 }}>
                        Result was <strong style={{ color: COLORS[result.color].hex }}>{result.color}</strong> — paid{" "}
                        <strong style={{ color: COLORS[result.color].hex }}>{getColorMul(result.color, houseEdgeBps).mul.toFixed(2)}×</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 19, fontWeight: 800, color: "#ff4d6d" }}>
                        -{(result.wagerAmount / MIST_PER_OCT).toFixed(4)} OCT
                      </div>
                      <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 4 }}>
                        Result was <strong style={{ color: COLORS[result.color].hex }}>{result.color}</strong> — better luck next round
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Color Cards ── */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                {COLOR_KEYS.map((key) => {
                  const c = COLORS[key];
                  const { mul: colorMul } = getColorMul(key, houseEdgeBps);
                  const isSelected = selectedColor === key;
                  const isWinner = phase === "result" && result?.color === key;
                  return (
                    <div
                      key={key}
                      className={`color-card ${phase !== "idle" ? "locked" : ""}`}
                      style={{
                        borderColor: isWinner ? c.hex : isSelected ? c.hex : "transparent",
                        background: isWinner ? c.light : isSelected ? c.light : "#0d1526",
                        boxShadow: isWinner ? `0 0 24px ${c.glow}` : isSelected ? `0 0 12px ${c.glow}` : "none",
                      }}
                      onClick={() => { if (phase === "idle") setSelectedColor(key); }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.light, border: `3px solid ${c.hex}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isWinner ? `0 0 18px ${c.glow}` : "none" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: c.hex }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isSelected || isWinner ? c.hex : "#c0cfea" }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#f5c542", fontWeight: 700 }}>{colorMul.toFixed(2)}×</div>
                      <div style={{ fontSize: 10, color: "#3a4f70" }}>{(c.chance * 100).toFixed(0)}% chance</div>

                      {isSelected && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: c.hex, color: "#071218", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 99 }}>
                          BET
                        </div>
                      )}
                      {isWinner && (
                        <div className="pop" style={{ position: "absolute", top: 8, left: 8, background: c.hex, color: "#071218", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 99 }}>
                          WIN
                        </div>
                      )}
                      {phase === "idle" && (
                        <div style={{ fontSize: 10, color: "#3a4f70", marginTop: 2 }}>tap to select</div>
                      )}
                    </div>
                  );
                })}
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

              {/* ── Play / Reset button ── */}
              {phase !== "result" ? (
                <button
                  className={`play-btn ${phase === "revealing" ? "pb-roll" : canPlay ? "pb-ready" : "pb-off"}`}
                  onClick={play}
                  disabled={!canPlay}
                >
                  {phase === "revealing"
                    ? "Revealing..."
                    : selectedColor
                      ? `Bet on ${COLORS[selectedColor].label}`
                      : "Select a Color"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="play-btn pb-ready" style={{ flex: 1 }} onClick={reset}>Play Again</button>
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

              {/* ── Recent results strip ── */}
              {history.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="lbl">Recent Results</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {history.slice(0, 15).map((h, i) => (
                      <div key={i} className="hdot" style={{
                        background: COLORS[h.color].light,
                        border: `2px solid ${COLORS[h.color].hex}`,
                        color: COLORS[h.color].hex,
                        fontSize: h.color === "violet" ? 8 : 9,
                      }}>
                        {h.color[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Stats ── */}
              {history.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  {[
                    { lbl: "Rounds", val: String(history.length) },
                    { lbl: "Win rate", val: Math.round(history.filter(h => h.won).length / history.length * 100) + "%" },
                    { lbl: "Net P/L", val: (netPL >= 0 ? "+" : "") + netPL.toFixed(4) + " OCT", col: netPL > 0 ? "#00e5a0" : netPL < 0 ? "#ff4d6d" : "#fff" },
                  ].map((s) => (
                    <div key={s.lbl} className="sc">
                      <div style={{ fontSize: 10, color: "#7a8fb0", marginBottom: 4, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>{s.lbl}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: (s as any).col || "#fff" }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Color frequency ── */}
              {history.length >= 3 && (
                <div style={{ marginTop: 16, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, padding: "14px 17px" }}>
                  <div className="lbl">Color Frequency</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {COLOR_KEYS.map((k) => {
                      const c = COLORS[k];
                      const count = history.filter((h) => h.color === k).length;
                      const pct = Math.round((count / history.length) * 100);
                      return (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.hex, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: c.hex, fontWeight: 700, width: 50 }}>{c.label}</span>
                          <div style={{ flex: 1, height: 6, background: "#1a2640", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: c.hex, borderRadius: 3, transition: "width .5s ease", opacity: .8 }} />
                          </div>
                          <span className="mono" style={{ fontSize: 12, color: "#7a8fb0", width: 44, textAlign: "right" }}>{count}× ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, color: "#3a4f70" }}>
                On-chain RNG · Red 45% · Green 45% · Violet 10% · House edge {houseEdgePct}%
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
