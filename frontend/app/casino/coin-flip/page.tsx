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

// ─── Constants ──────────────────────────────────────────────
const SIDES = ["heads", "tails"] as const;
type Side = (typeof SIDES)[number];

const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1]; // in OCT
const MULTIPLIER_BPS = 19600; // 1.96x payout
const GAME_RANGE = 2;
const MIST_PER_OCT = 1_000_000_000;

// 0x8 is the well-known shared Random object on Sui/OneChain
const RANDOM_OBJECT_ID = "0x8";

// Gas budget to set explicitly — Random-based txs can't be dry-run simulated
const GAS_BUDGET = 50_000_000; // 0.05 OCT

interface FlipResult {
  side: Side;
  won: boolean;
  payout: number; // in MIST
  wagerAmount: number; // in MIST
}

export default function CoinFlipPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isTxPending } =
    useSignAndExecuteTransaction();

  const [balance, setBalance] = useState<number>(0); // in MIST
  const [bet, setBet] = useState<number>(0.01); // in OCT
  const [choice, setChoice] = useState<Side | null>(null);
  const [phase, setPhase] = useState<"idle" | "flipping" | "result">("idle");
  const [result, setResult] = useState<FlipResult | null>(null);
  const [history, setHistory] = useState<
    Array<{ choice: Side; side: Side; won: boolean; profit: number; bet: number; digest: string }>
  >([]);
  const [coinFace, setCoinFace] = useState<Side>("heads");
  const [error, setError] = useState<string>("");
  const flipCount = useRef(0);

  // Fetch OCT balance
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

  // Fetch past flips from on-chain events
  useEffect(() => {
    if (!account?.address) return;
    const loadHistory = async () => {
      try {
        const events = await suiClient.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${CASINO_MODULE}::InstantWagerPlayed`,
          },
          order: "descending",
          limit: 10,
        });

        const pastFlips = events.data
          .filter((e) => {
            const parsed = e.parsedJson as any;
            return parsed.player === account.address && parsed.game_id === "coin_flip";
          })
          .map((e) => {
            const p = e.parsedJson as any;
            const guessNum = Number(p.guess);
            const resultNum = Number(p.result);
            const won = Boolean(p.won);
            const wagerAmount = Number(p.wager_amount);
            const payout = Number(p.payout || 0);
            const choiceSide: Side = guessNum === 0 ? "heads" : "tails";
            const resultSide: Side = resultNum === 0 ? "heads" : "tails";
            return {
              choice: choiceSide,
              side: resultSide,
              won,
              profit: won
                ? (payout - wagerAmount) / MIST_PER_OCT
                : -wagerAmount / MIST_PER_OCT,
              bet: wagerAmount / MIST_PER_OCT,
              digest: e.id.txDigest,
            };
          })
          .slice(0, 8);

        if (pastFlips.length > 0) {
          setHistory(pastFlips);
        }
      } catch { /* ignore — events may not be indexed yet */ }
    };
    loadHistory();
  }, [account?.address, suiClient]);

  const balanceOCT = balance / MIST_PER_OCT;
  const canFlip =
    phase === "idle" &&
    choice !== null &&
    bet > 0 &&
    bet <= balanceOCT &&
    !!account?.address;

  const flip = async () => {
    if (!canFlip || !account?.address) return;
    flipCount.current += 1;
    const id = flipCount.current;
    setPhase("flipping");
    setResult(null);
    setError("");

    // Coin animation runs via CSS infinite loop — no JS ticking needed

    try {
      const betMist = Math.floor(bet * MIST_PER_OCT);
      const guess = choice === "heads" ? 0 : 1;

      const tx = new Transaction();
      // Set explicit gas budget so wallet skips dry-run simulation
      // (Random-dependent txs fail simulation since RNG isn't available)
      tx.setGasBudget(GAS_BUDGET);
      const [wagerCoin] = tx.splitCoins(tx.gas, [betMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${CASINO_MODULE}::play_instant_wager`,
        arguments: [
          tx.object(HOUSE_BANKROLL_ID),
          tx.object(RANDOM_OBJECT_ID),
          wagerCoin,
          tx.pure.string("coin_flip"),
          tx.pure.u64(guess),
          tx.pure.u64(GAME_RANGE),
          tx.pure.u64(MULTIPLIER_BPS),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (txResult) => {
            if (flipCount.current !== id) return;

            try {
              // Wait for the transaction and get events
              const txResponse = await suiClient.waitForTransaction({
                digest: txResult.digest,
                options: { showEvents: true, showBalanceChanges: true },
              });

              // Parse the InstantWagerPlayed event
              const events = txResponse.events || [];
              const wagerEvent = events.find(
                (e) =>
                  e.type.includes("::casino::InstantWagerPlayed")
              );

              if (wagerEvent) {
                const parsed = wagerEvent.parsedJson as any;
                const won = parsed.won;
                const resultNum = Number(parsed.result);
                const payout = Number(parsed.payout || 0);
                const wagerAmount = Number(parsed.wager_amount || 0);
                const side: Side = resultNum === 0 ? "heads" : "tails";

                setCoinFace(side);

                const flipResult: FlipResult = {
                  side,
                  won,
                  payout,
                  wagerAmount,
                };

                setResult(flipResult);
                setHistory((h) =>
                  [
                    {
                      choice: choice!,
                      side,
                      won,
                      profit: won
                        ? (payout - wagerAmount) / MIST_PER_OCT
                        : -wagerAmount / MIST_PER_OCT,
                      bet,
                      digest: txResult.digest,
                    },
                  ]
                    .concat(h)
                    .slice(0, 8)
                );
              } else {
                // Fallback: check balance changes to determine win/loss
                const balChanges = txResponse.balanceChanges || [];
                const playerChange = balChanges.find(
                  (b: any) =>
                    b.owner?.AddressOwner === account.address
                );
                const amount = Number(playerChange?.amount || 0);
                const won = amount > 0;
                const side: Side = won ? choice! : choice === "heads" ? "tails" : "heads";
                setCoinFace(side);
                setResult({
                  side,
                  won,
                  payout: won ? Math.abs(amount) : 0,
                  wagerAmount: Math.floor(bet * MIST_PER_OCT),
                });
                setHistory((h) =>
                  [
                    {
                      choice: choice!,
                      side,
                      won,
                      profit: amount / MIST_PER_OCT,
                      bet,
                      digest: txResult.digest,
                    },
                  ]
                    .concat(h)
                    .slice(0, 8)
                );
              }

              setPhase("result");
              fetchBalance();
            } catch (err: any) {
              setError("Failed to parse result: " + err.message);
              setPhase("idle");
            }
          },
          onError: (err) => {
            if (flipCount.current !== id) return;
            setError(err.message || "Transaction rejected");
            setPhase("idle");
            setCoinFace(choice || "heads");
          },
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to create transaction");
      setPhase("idle");
      setCoinFace(choice || "heads");
    }
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError("");
  };

  const formatOCT = (v: number) => {
    if (v >= 1) return v.toFixed(2);
    if (v >= 0.01) return v.toFixed(4);
    return v.toFixed(6);
  };

  return (
    <>
      <style>{`
        /* ── coin ── */
        .coin-scene { width: 140px; height: 140px; perspective: 600px; margin: 0 auto; }
        .coin-body {
          width: 100%; height: 100%;
          position: relative;
          transform-style: preserve-3d;
          border-radius: 50%;
          transition: none;
        }
        .coin-body.spinning { animation: coinSpin 1.2s linear infinite; }
        .coin-body.landing-heads { transform: rotateY(0deg); }
        .coin-body.landing-tails { transform: rotateY(180deg); }

        @keyframes coinSpin {
          0%   { transform: rotateY(0deg) rotateX(0deg); }
          20%  { transform: rotateY(360deg) rotateX(15deg); }
          45%  { transform: rotateY(720deg) rotateX(-10deg); }
          70%  { transform: rotateY(1080deg) rotateX(8deg); }
          88%  { transform: rotateY(1260deg) rotateX(0deg); }
          100% { transform: rotateY(1440deg) rotateX(0deg); }
        }

        .coin-face {
          position: absolute; inset: 0;
          border-radius: 50%;
          backface-visibility: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 52px;
          border: 4px solid #1a2640;
        }
        .coin-face.heads { background: radial-gradient(circle at 38% 38%, #ffd97a, #c89b24); }
        .coin-face.tails { background: radial-gradient(circle at 38% 38%, #d4d4d4, #888); transform: rotateY(180deg); }

        .coin-ring {
          position: absolute; inset: -6px;
          border-radius: 50%;
          border: 3px solid transparent;
          pointer-events: none;
        }
        .coin-ring.glow-win  { border-color: #00e5a0; box-shadow: 0 0 22px 4px #00e5a044; animation: pulseWin 1s ease infinite; }
        .coin-ring.glow-loss { border-color: #ff4d6d; box-shadow: 0 0 22px 4px #ff4d6d44; animation: pulseLoss 1s ease infinite; }
        @keyframes pulseWin  { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes pulseLoss { 0%,100%{opacity:1} 50%{opacity:.45} }

        /* ── side selector ── */
        .side-btn {
          flex: 1; padding: 14px 0; border-radius: 12px;
          border: 2px solid #1e2d4a; background: #0d1526;
          color: #7a8fb0; font-family: inherit;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: all .18s; display: flex; flex-direction: column;
          align-items: center; gap: 6px;
        }
        .side-btn:hover { border-color: #2a3f66; background: #121d33; color: #c0cfea; }
        .side-btn.active-heads { border-color: #f5c542; background: rgba(245,197,66,.1); color: #f5c542; }
        .side-btn.active-tails { border-color: #00d4c8; background: rgba(0,212,200,.1); color: #00d4c8; }

        /* ── flip button ── */
        .flip-btn {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          font-family: inherit; font-size: 17px; font-weight: 700;
          cursor: pointer; transition: all .18s; letter-spacing: .4px;
        }
        .flip-btn.ready  { background: #00d4c8; color: #071218; }
        .flip-btn.ready:hover { background: #00f0e0; transform: translateY(-1px); }
        .flip-btn.disabled { background: #1a2640; color: #3a4f70; cursor: not-allowed; }
        .flip-btn.flipping { background: #1a2640; color: #00d4c8; animation: pulseWin .7s ease infinite; }

        /* ── quick bet ── */
        .qbet {
          padding: 6px 12px; border-radius: 8px; border: 1px solid #1e2d4a;
          background: transparent; color: #7a8fb0; font-family: inherit;
          font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s;
        }
        .qbet:hover { border-color: #00d4c8; color: #00d4c8; background: rgba(0,212,200,.07); }

        /* ── bet input ── */
        .bet-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          background: #060c18; border: 1.5px solid #1e2d4a;
          color: #fff; font-family: inherit; font-size: 18px; font-weight: 600;
          outline: none; transition: border-color .15s; box-sizing: border-box;
        }
        .bet-input:focus { border-color: #00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }

        /* ── result banner ── */
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        .result-banner { animation: slideUp .32s ease; }

        /* ── history row ── */
        @keyframes fadeIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
        .hist-row { animation: fadeIn .25s ease; }
      `}</style>

      <div
        style={{
          background: "#0a0f1e",
          minHeight: "100vh",
          padding: "32px 20px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Back link */}
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/games"
              className="text-slate-500 hover:text-slate-200 transition-colors text-sm"
            >
              ← Back to Games
            </Link>
          </div>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#0d1526",
                border: "1px solid #1e2d4a",
                borderRadius: 999,
                padding: "5px 16px",
                marginBottom: 16,
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
                style={{ fontSize: 13, color: "#7a8fb0", fontWeight: 500 }}
              >
                Instant Play · On-chain RNG · 1.96× payout
              </span>
            </div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#fff",
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              🪙 Coin Flip
            </h1>
            <p style={{ fontSize: 14, color: "#7a8fb0", marginTop: 6 }}>
              Pick a side. Call the flip. Win 1.96× your bet.
            </p>
          </div>

          {/* Wallet / Balance */}
          {!account?.address ? (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                background: "#0d1526",
                border: "1.5px solid #f5c542",
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 14, color: "#f5c542", fontWeight: 600 }}>
                Connect your wallet to play
              </div>
              <div
                style={{ fontSize: 12, color: "#7a8fb0", marginTop: 4 }}
              >
                Use the Connect Wallet button in the navigation bar
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0d1526",
                border: "1px solid #1e2d4a",
                borderRadius: 14,
                padding: "14px 20px",
                marginBottom: 20,
              }}
            >
              <span
                style={{ fontSize: 13, color: "#7a8fb0", fontWeight: 500 }}
              >
                Wallet Balance
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {formatOCT(balanceOCT)}{" "}
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: "#7a8fb0" }}
                >
                  OCT
                </span>
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(255,77,109,.1)",
                border: "1.5px solid #ff4d6d",
                color: "#ff4d6d",
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              ❌ {error}
            </div>
          )}

          {/* Coin */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 28,
              position: "relative",
            }}
          >
            <div className="coin-scene">
              <div
                className={`coin-body ${
                  phase === "flipping"
                    ? "spinning"
                    : coinFace === "heads"
                      ? "landing-heads"
                      : "landing-tails"
                }`}
              >
                <div className="coin-face heads">
                  <span style={{ fontSize: 52, lineHeight: 1 }}>👑</span>
                </div>
                <div className="coin-face tails">
                  <span style={{ fontSize: 44, lineHeight: 1 }}>🔱</span>
                </div>
              </div>
              {phase === "result" && (
                <div
                  className={`coin-ring ${result?.won ? "glow-win" : "glow-loss"}`}
                />
              )}
            </div>
          </div>

          {/* Result banner */}
          {phase === "result" && result && (
            <div
              className="result-banner"
              style={{
                textAlign: "center",
                marginBottom: 20,
                padding: "14px 20px",
                borderRadius: 14,
                background: result.won
                  ? "rgba(0,229,160,.1)"
                  : "rgba(255,77,109,.1)",
                border: `1.5px solid ${result.won ? "#00e5a0" : "#ff4d6d"}`,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: result.won ? "#00e5a0" : "#ff4d6d",
                  letterSpacing: 0.3,
                }}
              >
                {result.won ? "You Won!" : "You Lost"}
              </div>
              <div style={{ fontSize: 14, color: "#7a8fb0", marginTop: 4 }}>
                Landed{" "}
                <strong style={{ color: "#fff", textTransform: "capitalize" }}>
                  {result.side}
                </strong>
                {" · "}
                <span
                  style={{
                    color: result.won ? "#00e5a0" : "#ff4d6d",
                    fontWeight: 600,
                  }}
                >
                  {result.won
                    ? `+${formatOCT((result.payout - result.wagerAmount) / MIST_PER_OCT)}`
                    : `-${formatOCT(result.wagerAmount / MIST_PER_OCT)}`}{" "}
                  OCT
                </span>
              </div>
            </div>
          )}

          {/* Choose side */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                color: "#7a8fb0",
                fontWeight: 600,
                letterSpacing: 0.8,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Choose Side
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {SIDES.map((s) => (
                <button
                  key={s}
                  className={`side-btn ${
                    choice === s
                      ? s === "heads"
                        ? "active-heads"
                        : "active-tails"
                      : ""
                  }`}
                  onClick={() => {
                    if (phase !== "flipping") {
                      setChoice(s);
                      if (phase === "result") reset();
                    }
                  }}
                >
                  <span style={{ fontSize: 28 }}>
                    {s === "heads" ? "👑" : "🔱"}
                  </span>
                  <span style={{ fontSize: 14, textTransform: "capitalize" }}>
                    {s}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Bet */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                color: "#7a8fb0",
                fontWeight: 600,
                letterSpacing: 0.8,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Bet Amount (OCT)
            </div>
            <input
              className="bet-input"
              type="number"
              value={bet}
              step={0.001}
              min={0.001}
              max={balanceOCT}
              disabled={phase === "flipping"}
              onChange={(e) =>
                setBet(
                  Math.max(
                    0.001,
                    Math.min(balanceOCT, Number(e.target.value) || 0.001)
                  )
                )
              }
            />
            <div
              style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}
            >
              {QUICK_BETS_OCT.map((v) => (
                <button
                  key={v}
                  className="qbet"
                  onClick={() => {
                    if (phase !== "flipping") {
                      setBet(Math.min(v, balanceOCT));
                      if (phase === "result") reset();
                    }
                  }}
                >
                  {v} OCT
                </button>
              ))}
              <button
                className="qbet"
                onClick={() => {
                  if (phase !== "flipping") {
                    setBet(Math.max(0.001, Math.floor(balanceOCT * 500) / 1000));
                    if (phase === "result") reset();
                  }
                }}
              >
                ½
              </button>
              <button
                className="qbet"
                onClick={() => {
                  if (phase !== "flipping") {
                    setBet(Math.max(0.001, Math.floor(balanceOCT * 1000) / 1000));
                    if (phase === "result") reset();
                  }
                }}
              >
                Max
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#7a8fb0", marginTop: 10 }}>
              Potential win:{" "}
              <span style={{ color: "#00e5a0", fontWeight: 600 }}>
                +{formatOCT(bet * 0.96)} OCT
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#3a4f70" }}>
                (1.96×)
              </span>
            </div>
          </div>

          {/* Flip button */}
          {phase !== "result" ? (
            <button
              className={`flip-btn ${
                phase === "flipping"
                  ? "flipping"
                  : canFlip
                    ? "ready"
                    : "disabled"
              }`}
              onClick={flip}
              disabled={!canFlip || isTxPending}
            >
              {phase === "flipping"
                ? "Flipping... (confirm in wallet)"
                : !account?.address
                  ? "Connect Wallet"
                  : "Flip Coin"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="flip-btn ready"
                style={{ flex: 1 }}
                onClick={() => reset()}
              >
                Flip Again
              </button>
              <button
                onClick={() => {
                  setBet(Math.min(bet * 2, balanceOCT));
                  reset();
                }}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1.5px solid #1e2d4a",
                  background: "transparent",
                  color: "#7a8fb0",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all .15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#00d4c8";
                  e.currentTarget.style.color = "#00d4c8";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#1e2d4a";
                  e.currentTarget.style.color = "#7a8fb0";
                }}
              >
                2× Bet
              </button>
            </div>
          )}

          {/* Stats */}
          {history.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginTop: 20,
              }}
            >
              {[
                {
                  label: "Win rate",
                  value:
                    Math.round(
                      (history.filter((h) => h.won).length / history.length) *
                        100
                    ) + "%",
                },
                { label: "Total bets", value: history.length },
                {
                  label: "Net P/L",
                  value:
                    (history.reduce((s, h) => s + h.profit, 0) > 0 ? "+" : "") +
                    formatOCT(history.reduce((s, h) => s + h.profit, 0)) +
                    " OCT",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "#0d1526",
                    border: "1px solid #1e2d4a",
                    borderRadius: 12,
                    padding: "12px 14px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#7a8fb0",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      fontWeight: 600,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div
              style={{
                marginTop: 20,
                background: "#0d1526",
                border: "1px solid #1e2d4a",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 18px",
                  fontSize: 12,
                  color: "#7a8fb0",
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  borderBottom: "1px solid #1a2640",
                }}
              >
                Recent Flips
              </div>
              {history.map((h, i) => (
                <div
                  key={i}
                  className="hist-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 18px",
                    borderBottom:
                      i < history.length - 1
                        ? "1px solid #0f1a2e"
                        : "none",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: 20 }}>
                      {h.side === "heads" ? "👑" : "🔱"}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#c0cfea",
                          textTransform: "capitalize",
                        }}
                      >
                        {h.choice} → {h.side}
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
                      {h.won ? "+" : ""}
                      {formatOCT(h.profit)} OCT
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: h.won ? "#00a870" : "#cc2d45",
                        marginTop: 1,
                        fontWeight: 500,
                      }}
                    >
                      {h.won ? "WIN" : "LOSS"}
                    </div>
                    <a
                      href={`https://onescan.cc/testnet/transactionBlocksDetail?digest=${h.digest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        color: "#00d4c8",
                        marginTop: 2,
                        display: "inline-block",
                        textDecoration: "none",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      View Tx ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: 24,
              fontSize: 12,
              color: "#3a4f70",
            }}
          >
            House edge 2% · Powered by OneChain on-chain RNG ·{" "}
            <span style={{ color: "#00d4c8" }}>Provably Fair</span>
          </div>
        </div>
      </div>
    </>
  );
}
