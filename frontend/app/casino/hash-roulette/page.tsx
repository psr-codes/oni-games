"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
const MIST_PER_OCT = 1_000_000_000;
const RANDOM_OBJECT_ID = "0x8";
const GAS_BUDGET = 50_000_000;

const HEX_CHARS = "0123456789abcdef";
const HEX_PAD = HEX_CHARS.split("");
const randHex = (n = 64) =>
  Array.from({ length: n }, () => HEX_CHARS[Math.floor(Math.random() * 16)]).join("");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ModeConfig {
  digits: number;
  label: string;
  sublabel: string;
  odds: string;
  gameRange: number;
  multiplierBps: number;
  displayMultiplier: string;
  color: string;
  bg: string;
}

// Multipliers will be dynamically calculated based on house edge
const BASE_MODES = [
  {
    digits: 1, label: "1 Digit", sublabel: "Last hex digit",
    odds: "1 in 16", gameRange: 16,
    color: "#00d4c8", bg: "rgba(0,212,200,.1)",
  },
  {
    digits: 2, label: "2 Digits", sublabel: "Last 2 hex digits",
    odds: "1 in 256", gameRange: 256,
    color: "#a78bfa", bg: "rgba(167,139,250,.1)",
  },
  {
    digits: 3, label: "3 Digits", sublabel: "Last 3 hex digits",
    odds: "1 in 4096", gameRange: 4096,
    color: "#f5c542", bg: "rgba(245,197,66,.1)",
  },
];

interface RoundResult {
  won: boolean;
  lastDigits: string;
  guess: string;
  profit: number; // in OCT
  hash: string;
}

interface HistoryEntry {
  won: boolean;
  lastDigits: string;
  guess: string;
  profit: number;
  bet: number;
  mode: number;
  digest: string;
}

export default function HashRoulettePage() {
  const { casinoStore } = useCasinoStore();
  const houseEdgeBps = casinoStore?.houseEdgeBps ?? 200; // default 2%

  const modes = useMemo<ModeConfig[]>(() => {
    return BASE_MODES.map((m) => {
      const fairMultiBps = m.gameRange * 10000;
      const multiplierBps = Math.floor((fairMultiBps * (10000 - houseEdgeBps)) / 10000);
      return {
        ...m,
        multiplierBps,
        displayMultiplier: `${(multiplierBps / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })}×`,
      };
    });
  }, [houseEdgeBps]);

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();

  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(0.01);
  const [modeIdx, setModeIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [phase, setPhase] = useState<"idle" | "mining" | "result">("idle");
  const [displayHash, setDisplayHash] = useState<string | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const runId = useRef(0);

  const mode = modes[modeIdx];

  // ─── Balance ──────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!account?.address) return;
    try {
      const bal = await suiClient.getBalance({ owner: account.address, coinType: COIN_TYPE });
      setBalance(Number(bal.totalBalance));
    } catch { /* ignore */ }
  }, [account?.address, suiClient]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // ─── Load history from chain ──────────────────────────────
  useEffect(() => {
    if (!account?.address) return;
    const load = async () => {
      try {
        const events = await suiClient.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::${CASINO_MODULE}::InstantWagerPlayed` },
          order: "descending",
          limit: 10,
        });
        const past = events.data
          .filter((e) => {
            const p = e.parsedJson as any;
            return p.player === account.address && p.game_id === "hash_roulette";
          })
          .map((e) => {
            const p = e.parsedJson as any;
            const won = Boolean(p.won);
            const wagerAmount = Number(p.wager_amount);
            const payout = Number(p.payout || 0);
            const resultNum = Number(p.result);
            const guessNum = Number(p.guess);
            // Determine which mode based on game_range or guess magnitude
            const gameRange = resultNum < 16 && guessNum < 16 ? 16 : resultNum < 256 && guessNum < 256 ? 256 : 4096;
            const digits = gameRange === 16 ? 1 : gameRange === 256 ? 2 : 3;
            return {
              won,
              lastDigits: resultNum.toString(16).padStart(digits, "0"),
              guess: guessNum.toString(16).padStart(digits, "0"),
              profit: won ? (payout - wagerAmount) / MIST_PER_OCT : -wagerAmount / MIST_PER_OCT,
              bet: wagerAmount / MIST_PER_OCT,
              mode: digits,
              digest: e.id.txDigest,
            };
          })
          .slice(0, 8);
        if (past.length > 0) setHistory(past);
      } catch { /* ignore */ }
    };
    load();
  }, [account?.address, suiClient]);

  const balanceOCT = balance / MIST_PER_OCT;
  const canPlay = phase === "idle" && guess.length === mode.digits && bet > 0 && bet <= balanceOCT && !!account?.address;
  const potentialWin = bet * (mode.multiplierBps / 10000) - bet;

  const formatOCT = (v: number) => {
    if (Math.abs(v) >= 1) return v.toFixed(2);
    if (Math.abs(v) >= 0.01) return v.toFixed(4);
    return v.toFixed(6);
  };

  // ─── Play ─────────────────────────────────────────────────
  const play = useCallback(async () => {
    if (!canPlay || !account?.address) return;
    runId.current += 1;
    const id = runId.current;
    setPhase("mining");
    setResult(null);
    setError("");
    setRevealIdx(0);

    // Start mining animation immediately
    const animInterval = setInterval(() => {
      setDisplayHash("0x" + randHex(64));
    }, 80);

    try {
      const betMist = Math.floor(bet * MIST_PER_OCT);
      const guessNum = parseInt(guess, 16);

      const tx = new Transaction();
      tx.setGasBudget(GAS_BUDGET);
      const [wagerCoin] = tx.splitCoins(tx.gas, [betMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::play_instant_wager`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(RANDOM_OBJECT_ID),
          wagerCoin,
          tx.pure.string("hash_roulette"),
          tx.pure.u64(guessNum),
          tx.pure.u64(mode.gameRange),
          tx.pure.u64(mode.multiplierBps),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (txResult) => {
            if (runId.current !== id) return;
            clearInterval(animInterval);

            try {
              const txResponse = await suiClient.waitForTransaction({
                digest: txResult.digest,
                options: { showEvents: true },
              });

              const events = txResponse.events || [];
              const wagerEvent = events.find((e) =>
                e.type.includes("::casino::InstantWagerPlayed")
              );

              let won = false;
              let resultNum = 0;
              let payoutAmount = 0;
              let wagerAmount = betMist;

              if (wagerEvent) {
                const parsed = wagerEvent.parsedJson as any;
                won = Boolean(parsed.won);
                resultNum = Number(parsed.result);
                payoutAmount = Number(parsed.payout || 0);
                wagerAmount = Number(parsed.wager_amount || betMist);
              }

              // Convert result number to hex digits
              const lastDigits = resultNum.toString(16).padStart(mode.digits, "0");

              // Build a cosmetic hash where the last N digits match the result
              const fakeHashBody = randHex(64 - mode.digits) + lastDigits;
              const finalHash = "0x" + fakeHashBody;

              // Reveal animation: lock digits from left to right
              for (let i = 2; i <= 66; i++) {
                await sleep(14);
                if (runId.current !== id) return;
                const tail = randHex(Math.max(0, 66 - i));
                setDisplayHash(finalHash.slice(0, i) + tail);
                setRevealIdx(i - 2);
              }

              setDisplayHash(finalHash);
              setRevealIdx(64);
              await sleep(300);
              if (runId.current !== id) return;

              const profit = won
                ? (payoutAmount - wagerAmount) / MIST_PER_OCT
                : -wagerAmount / MIST_PER_OCT;

              setResult({
                won,
                lastDigits,
                guess: guess.toLowerCase(),
                profit,
                hash: finalHash,
              });

              setHistory((h) =>
                [
                  {
                    won,
                    lastDigits,
                    guess: guess.toLowerCase(),
                    profit,
                    bet,
                    mode: mode.digits,
                    digest: txResult.digest,
                  },
                ]
                  .concat(h)
                  .slice(0, 8)
              );

              setPhase("result");
              fetchBalance();
            } catch (err: any) {
              setError("Failed to parse result: " + err.message);
              setPhase("idle");
              setDisplayHash(null);
            }
          },
          onError: (err) => {
            clearInterval(animInterval);
            if (runId.current !== id) return;
            setError(err.message || "Transaction rejected");
            setPhase("idle");
            setDisplayHash(null);
          },
        }
      );
    } catch (err: any) {
      clearInterval(animInterval);
      setError(err.message || "Failed to create transaction");
      setPhase("idle");
      setDisplayHash(null);
    }
  }, [canPlay, guess, bet, mode, account?.address, suiClient, signAndExecute, fetchBalance]);

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setDisplayHash(null);
    setRevealIdx(0);
    setGuess("");
    setError("");
  };

  const pressHex = (ch: string) => {
    if (phase !== "idle") return;
    setGuess((g) => (g.length < mode.digits ? g + ch : g));
  };

  const bodyStr = displayHash ? displayHash.slice(2) : null;
  const tailHighlight = mode.digits;
  const netPL = history.reduce((s, h) => s + h.profit, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        .mono { font-family:'JetBrains Mono',monospace; }
        .hash-box { background:#060c18; border:1.5px solid #1a2640; border-radius:14px; padding:16px 18px; transition:border-color .3s,box-shadow .3s; position:relative; overflow:hidden; }
        .hash-box.mining { border-color:#00d4c8; box-shadow:0 0 20px rgba(0,212,200,.2),inset 0 0 30px rgba(0,212,200,.04); }
        .hash-box.win    { border-color:#00e5a0; box-shadow:0 0 20px rgba(0,229,160,.25); }
        .hash-box.loss   { border-color:#ff4d6d; box-shadow:0 0 20px rgba(255,77,109,.2); }
        .hc-dim  { color:#3a4f70; }
        .hc-lock { color:#c0cfea; }
        .hc-live { color:#3a4f70; animation:flicker .09s ease infinite; }
        .hc-win  { color:#00e5a0; font-weight:700; font-size:16px; }
        .hc-loss { color:#ff4d6d; font-weight:700; font-size:16px; }
        @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:.2} }
        .scan-line { position:absolute; top:0; bottom:0; width:40%; background:linear-gradient(90deg,transparent,rgba(0,212,200,.12),transparent); animation:scan 1.1s linear infinite; pointer-events:none; }
        @keyframes scan { 0%{left:-40%} 100%{left:110%} }
        .mode-tab { flex:1; padding:12px 8px; border-radius:11px; border:1.5px solid #1e2d4a; background:#0d1526; color:#7a8fb0; font-size:13px; font-weight:600; cursor:pointer; transition:all .18s; text-align:center; }
        .mode-tab:hover:not([disabled]) { border-color:#2a3f66; color:#c0cfea; }
        .hex-key { aspect-ratio:1; border-radius:10px; border:1.5px solid #1e2d4a; background:#0d1526; color:#c0cfea; font-family:'JetBrains Mono',monospace; font-size:16px; font-weight:700; cursor:pointer; transition:all .14s; display:flex; align-items:center; justify-content:center; }
        .hex-key:hover:not([disabled]) { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.1); transform:scale(1.06); }
        .hex-key:active { transform:scale(.95); }
        .hex-key:disabled { opacity:.3; cursor:not-allowed; }
        .guess-slot { width:48px; height:56px; border-radius:11px; border:2px solid #1e2d4a; background:#060c18; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono',monospace; font-size:24px; font-weight:700; transition:all .18s; color:#fff; }
        .gs-filled  { border-color:#00d4c8; background:rgba(0,212,200,.1); }
        .gs-correct { border-color:#00e5a0; background:rgba(0,229,160,.15); color:#00e5a0; }
        .gs-wrong   { border-color:#ff4d6d; background:rgba(255,77,109,.15); color:#ff4d6d; }
        .play-btn { width:100%; padding:15px; border-radius:14px; border:none; font-size:16px; font-weight:700; cursor:pointer; transition:all .18s; }
        .pb-ready  { background:#00d4c8; color:#071218; }
        .pb-ready:hover { background:#00f0e0; transform:translateY(-1px); }
        .pb-off    { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .pb-mine   { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .8s ease infinite; }
        @keyframes breathe { 0%,100%{opacity:1} 50%{opacity:.4} }
        .qb { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }
        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .res-banner { animation:slideUp .3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:none} }
        .hrow { animation:fadeIn .25s ease; }
        .stat-card { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 10px; text-align:center; }
        .ctrl-btn { border-radius:10px; border:1.5px solid #1e2d4a; background:#0d1526; color:#7a8fb0; font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:600; cursor:pointer; transition:all .14s; padding:9px 0; }
        .ctrl-btn:hover { border-color:#2a3f66; color:#c0cfea; }
      `}</style>

      <div style={{ background: "#0a0f1e", minHeight: "100vh", padding: "28px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>

          {/* Back link */}
          <div style={{ marginBottom: 16 }}>
            <Link href="/casino" className="text-slate-500 hover:text-slate-200 transition-colors text-sm">
              ← Back to Casino
            </Link>
          </div>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 999, padding: "5px 16px", marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4c8", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>Provably Fair · On-chain RNG</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5, margin: 0 }}>
              🔮 Hash Roulette
            </h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 6 }}>
              Guess the last hex digit(s) of the hash. Powered by on-chain randomness.
            </p>
          </div>

          {/* Wallet / Balance */}
          {!account?.address ? (
            <div style={{ textAlign: "center", padding: "20px", background: "#0d1526", border: "1.5px solid #f5c542", borderRadius: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 14, color: "#f5c542", fontWeight: 600 }}>Connect your wallet to play</div>
              <div style={{ fontSize: 12, color: "#7a8fb0", marginTop: 4 }}>Use the Connect Wallet button in the navigation bar</div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 13, padding: "13px 18px", marginBottom: 18 }}>
              <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>Balance</span>
              <span style={{ fontSize: 21, fontWeight: 700, color: "#fff" }}>
                {formatOCT(balanceOCT)} <span style={{ fontSize: 12, color: "#7a8fb0", fontWeight: 500 }}>OCT</span>
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,77,109,.1)", border: "1.5px solid #ff4d6d", color: "#ff4d6d", fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
              ❌ {error}
            </div>
          )}

          {/* Mode selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", marginBottom: 9 }}>Difficulty</div>
            <div style={{ display: "flex", gap: 10 }}>
              {modes.map((m, i) => (
                <button key={i} className="mode-tab"
                  style={modeIdx === i ? { borderColor: m.color, background: m.bg, color: m.color } : {}}
                  onClick={() => { if (phase === "idle") { setModeIdx(i); setGuess(""); } }}
                  disabled={phase !== "idle"}
                >
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{m.label}</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: .75 }}>{m.odds}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: modeIdx === i ? m.color : "#f5c542" }}>{m.displayMultiplier}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hash display */}
          <div className={`hash-box ${phase === "mining" ? "mining" : phase === "result" ? (result?.won ? "win" : "loss") : ""}`} style={{ marginBottom: 18 }}>
            {phase === "mining" && <div className="scan-line" />}
            <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", marginBottom: 10, display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              <span>Block Hash</span>
              {phase === "mining" && <span style={{ color: "#00d4c8", animation: "breathe .8s ease infinite" }}>⛏ Mining...</span>}
              {phase === "result" && result && (
                <span className="mono" style={{ color: result.won ? "#00e5a0" : "#ff4d6d", letterSpacing: 1 }}>
                  Last {mode.digits}: <strong>{result.lastDigits.toUpperCase()}</strong>
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.85, wordBreak: "break-all", position: "relative", zIndex: 1 }}>
              <span className="hc-dim">0x</span>
              {bodyStr === null
                ? <span className="hc-dim">{"·".repeat(64)}</span>
                : bodyStr.split("").map((ch, i) => {
                    const isTail = i >= 64 - tailHighlight;
                    if (phase === "result") {
                      return <span key={i} className={isTail ? (result?.won ? "hc-win" : "hc-loss") : "hc-lock"}>{ch}</span>;
                    }
                    if (i < revealIdx) return <span key={i} className={isTail ? "hc-lock" : "hc-lock"}>{ch}</span>;
                    return <span key={i} className="hc-live">{ch}</span>;
                  })
              }
            </div>
          </div>

          {/* Guess + hex pad */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", marginBottom: 10 }}>
              Your Guess — {mode.sublabel}
            </div>

            {/* Slots */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 14 }}>
              {Array.from({ length: mode.digits }).map((_, i) => {
                const ch = guess[i] || "";
                const isCorrect = phase === "result" && result && ch === result.lastDigits[i];
                const isWrong = phase === "result" && result && !!ch && ch !== result.lastDigits[i];
                return (
                  <div key={i} className={`guess-slot ${ch && phase !== "result" ? "gs-filled" : ""} ${isCorrect ? "gs-correct" : ""} ${isWrong ? "gs-wrong" : ""}`}>
                    {ch ? ch.toUpperCase() : <span style={{ color: "#3a4f70", fontSize: 18 }}>?</span>}
                  </div>
                );
              })}
            </div>

            {/* Hex pad */}
            {phase === "idle" && (
              <div style={{ background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 8 }}>
                  {HEX_PAD.map((ch) => (
                    <button key={ch} className="hex-key" onClick={() => pressHex(ch)} disabled={guess.length >= mode.digits}>
                      {ch.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ctrl-btn" style={{ flex: 1 }} onClick={() => setGuess((g) => g.slice(0, -1))}>← DEL</button>
                  <button className="ctrl-btn" style={{ flex: 1, color: "#ff4d6d", borderColor: "#2a1a2e" }} onClick={() => setGuess("")}>CLEAR</button>
                </div>
              </div>
            )}

            {phase === "result" && result && (
              <div className="res-banner" style={{ textAlign: "center", marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 13, color: "#7a8fb0" }}>
                  Guess <strong style={{ color: "#fff", letterSpacing: 2 }}>{result.guess.toUpperCase()}</strong>
                  {" vs result "}
                  <strong style={{ color: result.won ? "#00e5a0" : "#ff4d6d", letterSpacing: 2 }}>{result.lastDigits.toUpperCase()}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Bet */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", marginBottom: 9 }}>Bet Amount (OCT)</div>
            <input className="bet-in" type="number" value={bet} step={0.001} min={0.001} max={balanceOCT} disabled={phase !== "idle"}
              onChange={(e) => setBet(Math.max(0.001, Math.min(balanceOCT, Number(e.target.value) || 0.001)))} />
            <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
              {[0.01, 0.05, 0.1, 0.5, 1].map((v) => (
                <button key={v} className="qb" onClick={() => { if (phase === "idle") setBet(Math.min(v, balanceOCT)); }}>{v} OCT</button>
              ))}
              <button className="qb" onClick={() => { if (phase === "idle") setBet(Math.max(0.001, Math.floor(balanceOCT * 500) / 1000)); }}>½</button>
              <button className="qb" onClick={() => { if (phase === "idle") setBet(Math.max(0.001, Math.floor(balanceOCT * 1000) / 1000)); }}>Max</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13, color: "#7a8fb0" }}>
              <span>Potential win: <span style={{ color: "#00e5a0", fontWeight: 600 }}>+{formatOCT(potentialWin)} OCT</span></span>
              <span style={{ fontSize: 11, color: "#3a4f70" }}>{mode.displayMultiplier} · {houseEdgeBps / 100}% edge</span>
            </div>
          </div>

          {/* Result banner */}
          {phase === "result" && result && (
            <div className="res-banner" style={{ textAlign: "center", marginBottom: 16, padding: "14px 18px", borderRadius: 13, background: result.won ? "rgba(0,229,160,.1)" : "rgba(255,77,109,.1)", border: `1.5px solid ${result.won ? "#00e5a0" : "#ff4d6d"}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: result.won ? "#00e5a0" : "#ff4d6d" }}>
                {result.won ? "Correct Hash!" : "Wrong Guess"}
              </div>
              <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>
                <span style={{ color: result.won ? "#00e5a0" : "#ff4d6d", fontWeight: 700 }}>
                  {result.won ? `+${formatOCT(result.profit)}` : `${formatOCT(result.profit)}`} OCT
                </span>
                {result.won && <span style={{ marginLeft: 8, color: "#f5c542" }}>{mode.displayMultiplier} payout</span>}
              </div>
            </div>
          )}

          {/* Action button */}
          {phase !== "result" ? (
            <button className={`play-btn ${phase === "mining" ? "pb-mine" : canPlay ? "pb-ready" : "pb-off"}`}
              onClick={play} disabled={!canPlay || isTxPending}>
              {phase === "mining" ? "⛏  Mining... (confirm in wallet)" : !account?.address ? "Connect Wallet" : "⛏  Mine Block"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="play-btn pb-ready" style={{ flex: 1 }} onClick={reset}>Play Again</button>
              <button onClick={() => { setBet(Math.min(bet * 2, balanceOCT)); reset(); }}
                style={{ padding: "15px 18px", borderRadius: 14, border: "1.5px solid #1e2d4a", background: "transparent", color: "#7a8fb0", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "#00d4c8"; e.currentTarget.style.color = "#00d4c8"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "#1e2d4a"; e.currentTarget.style.color = "#7a8fb0"; }}>
                2× Bet
              </button>
            </div>
          )}

          {/* Stats */}
          {history.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {[
                { label: "Win rate", value: Math.round(history.filter((h) => h.won).length / history.length * 100) + "%" },
                { label: "Total bets", value: String(history.length) },
                { label: "Net P/L", value: (netPL >= 0 ? "+" : "") + formatOCT(netPL) + " OCT", color: netPL > 0 ? "#00e5a0" : netPL < 0 ? "#ff4d6d" : "#fff" },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div style={{ fontSize: 10, color: "#7a8fb0", marginBottom: 5, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color || "#fff" }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: 18, background: "#0d1526", border: "1px solid #1e2d4a", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", fontSize: 11, color: "#7a8fb0", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", borderBottom: "1px solid #1a2640" }}>
                Recent Rounds
              </div>
              {history.map((h, i) => (
                <div key={i} className="hrow" style={{ borderBottom: i < history.length - 1 ? "1px solid #0f1a2e" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: h.won ? "rgba(0,229,160,.12)" : "rgba(255,77,109,.12)", border: `1px solid ${h.won ? "#00e5a0" : "#ff4d6d"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: h.won ? "#00e5a0" : "#ff4d6d", fontWeight: 700 }}>
                        {h.won ? "✓" : "✗"}
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "#c0cfea", letterSpacing: 2 }}>
                          <span style={{ color: "#7a8fb0" }}>{h.mode}d · </span>
                          {h.guess.toUpperCase()}
                          <span style={{ color: "#3a4f70" }}> → </span>
                          <span style={{ color: h.won ? "#00e5a0" : "#ff4d6d" }}>{h.lastDigits.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#3a4f70", marginTop: 2 }}>
                          Bet: {formatOCT(h.bet)} OCT
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: h.won ? "#00e5a0" : "#ff4d6d" }}>
                        {h.won ? "+" : ""}{formatOCT(h.profit)} OCT
                      </div>
                      <div style={{ fontSize: 10, color: h.won ? "#00a870" : "#cc2d45", marginTop: 1, fontWeight: 600, textTransform: "uppercase" }}>
                        {h.won ? "win" : "loss"}
                      </div>
                      <a
                        href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${h.digest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: "#00d4c8", marginTop: 2, display: "inline-block", textDecoration: "none" }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        View Tx ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#3a4f70" }}>
            House edge {houseEdgeBps / 100}% · Powered by OneChain on-chain RNG ·{" "}
            <a href="https://onescan.cc/testnet/object/0x209cd73356acc6c529b627ae4d6e83493a3e2598159afe9948b95c6251c40b52"
              target="_blank" rel="noopener noreferrer" style={{ color: "#00d4c8", textDecoration: "none" }}>
              Provably Fair
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
