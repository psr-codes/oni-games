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
import { useSessionHistory } from "@/hooks/useSessionHistory";

// ─── OniGames · Card Draw High-Low ────────────────────────────────────────
// Session game: lock_wager → guess higher/lower → streak multiplier
// Cash out via resolve_session with accumulated multiplier
// On loss → Option B (no transaction needed, wager already collected)
//
// Math: multiplier = 0.97 / P(correct)
// Ties = LOSS (standard casino rule, factored into house edge)

const HOUSE = 0.03;
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];
const RED_SUITS = new Set(["♥", "♦"]);
const MIST_PER_OCT = 1_000_000_000;
const QUICK_BETS_OCT = [0.01, 0.05, 0.1, 0.5, 1];

interface Card {
  value: number;
  suit: string;
  label: string;
}

function randCard(): Card {
  const value = Math.floor(Math.random() * 13) + 1;
  const suit = SUITS[Math.floor(Math.random() * 4)];
  return { value, suit, label: VALUES[value - 1] };
}

function calcOdds(cardValue: number) {
  const higher = (13 - cardValue) * 4;
  const lower = (cardValue - 1) * 4;
  const pHigh = higher / 51;
  const pLow = lower / 51;
  return {
    pHigh,
    pLow,
    canHigh: pHigh > 0,
    canLow: pLow > 0,
    mulHigh: pHigh > 0 ? (1 - HOUSE) / pHigh : null,
    mulLow: pLow > 0 ? (1 - HOUSE) / pLow : null,
  };
}

function fmtMul(m: number | null): string {
  if (!m) return "—";
  return m < 10 ? m.toFixed(2) + "×" : m.toFixed(1) + "×";
}

// ── Card SVG ──────────────────────────────────────────────────────────────
function PlayingCard({
  card,
  size = "lg",
  glow,
  dim,
  flipping,
}: {
  card: Card | null;
  size?: "lg" | "sm";
  glow?: string;
  dim?: boolean;
  flipping?: boolean;
}) {
  if (!card) return null;
  const isRed = RED_SUITS.has(card.suit);
  const col = isRed ? "#ff6b8a" : "#c0cfea";
  const w = size === "lg" ? 110 : 66;
  const h = size === "lg" ? 154 : 92;
  const fs =
    size === "lg"
      ? { val: 28, suit: 22, corner: 13 }
      : { val: 17, suit: 14, corner: 9 };
  const borderCol = glow ? glow : "#243450";
  const shadow = glow ? `0 0 28px ${glow}66` : "none";
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: dim ? "#0d1526" : "#0f1e34",
        border: `2px solid ${borderCol}`,
        boxShadow: shadow,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flexShrink: 0,
        transition: "border-color .3s, box-shadow .3s",
        animation: flipping ? "cardFlip .35s ease" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 8,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        <div
          style={{
            fontSize: fs.corner,
            fontWeight: 800,
            color: dim ? "#3a4f70" : col,
            fontFamily: "'JetBrains Mono',monospace",
          }}
        >
          {card.label}
        </div>
        <div style={{ fontSize: fs.corner - 2, color: dim ? "#3a4f70" : col }}>
          {card.suit}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: fs.val,
            fontWeight: 900,
            color: dim ? "#3a4f70" : col,
            fontFamily: "'Outfit',sans-serif",
            lineHeight: 1,
          }}
        >
          {card.label}
        </div>
        <div
          style={{ fontSize: fs.suit, color: dim ? "#3a4f70" : col, marginTop: 2 }}
        >
          {card.suit}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 8,
          textAlign: "center",
          lineHeight: 1.15,
          transform: "rotate(180deg)",
        }}
      >
        <div
          style={{
            fontSize: fs.corner,
            fontWeight: 800,
            color: dim ? "#3a4f70" : col,
            fontFamily: "'JetBrains Mono',monospace",
          }}
        >
          {card.label}
        </div>
        <div style={{ fontSize: fs.corner - 2, color: dim ? "#3a4f70" : col }}>
          {card.suit}
        </div>
      </div>
    </div>
  );
}

function CardBack({ size = "lg" }: { size?: "lg" | "sm" }) {
  const w = size === "lg" ? 110 : 66;
  const h = size === "lg" ? 154 : 92;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: "#0a1628",
        border: "2px solid #1e3050",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: w - 18,
          height: h - 18,
          borderRadius: 7,
          border: "1.5px solid #1e3050",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 24, opacity: 0.25 }}>🂠</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function CardHighLowPage() {
  const { casinoStore } = useCasinoStore();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [balance, setBalance] = useState<number>(0);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [bet, setBet] = useState<number>(0.01);
  const [phase, setPhase] = useState<
    "idle" | "locking" | "playing" | "resolving" | "result"
  >("idle");
  const [cards, setCards] = useState<Card[]>([]);
  const [streak, setStreak] = useState(0);
  const [pot, setPot] = useState(1);
  const [history, setHistory] = useState<
    Array<{
      won: boolean;
      pnl: number;
      streak: number;
      finalMul: number;
      bet: number;
      digest?: string;
    }>
  >([]);
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<
    "win" | "lose" | "cashout" | null
  >(null);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{
    won: boolean;
    pnl: number;
    streak: number;
    finalMul: number;
    bet: number;
    dir?: string;
    digest?: string;
  } | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);

  const balanceOCT = balance / MIST_PER_OCT;
  const isPlaying = phase === "playing";
  const isDone = phase === "result";
  const canStart =
    phase === "idle" && bet > 0 && bet <= balanceOCT && !!account?.address;

  const currentCard = cards[cards.length - 1] || null;
  const odds = currentCard ? calcOdds(currentCard.value) : null;

  // On-chain history
  const { history: onChainHistory } = useSessionHistory(
    account?.address,
    "highlow",
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
        streak: 0,
        finalMul: e.multiplierBps / 10000,
        bet: e.wagerOCT,
        digest: e.digest,
      }));
    return [...history, ...onChainMapped].slice(0, 10);
  })();

  const netPL = mergedHistory.reduce((s, h) => s + h.pnl, 0);

  // Fetch Balance
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

  // ── Start ─────────────────────────────────────────────────────────────
  const startGame = () => {
    if (!canStart || !account) return;

    setPhase("locking");
    setCards([]);
    setStreak(0);
    setPot(1);
    setLastGuess(null);
    setOutcome(null);
    setResult(null);

    const betMist = Math.floor(bet * MIST_PER_OCT);
    const tx = new Transaction();
    const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(betMist)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${CASINO_MODULE}::lock_wager`,
      arguments: [
        tx.object(HOUSE_BANKROLL_ID),
        wagerCoin,
        tx.pure.string("highlow"),
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
              const parsed = createdEvent.parsedJson as Record<
                string,
                unknown
              >;
              setSessionId(parsed.session_id as string);
            }

            fetchBalance();

            // Deal first card
            const first = randCard();
            setCards([first]);
            setPhase("playing");
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
  };

  // ── Guess ─────────────────────────────────────────────────────────────
  const guess = useCallback(
    (dir: "higher" | "lower") => {
      if (!isPlaying || !currentCard || !odds) return;
      const nextCard = randCard();
      const cv = currentCard.value;
      const nv = nextCard.value;

      let won: boolean;
      if (dir === "higher") won = nv > cv;
      else won = nv < cv;
      if (nv === cv) won = false;

      setFlipping(true);
      setTimeout(() => setFlipping(false), 350);

      setLastGuess(dir);
      setCards((prev) => [...prev, nextCard]);

      if (won) {
        const mul = dir === "higher" ? odds.mulHigh! : odds.mulLow!;
        const newPot = pot * mul;
        setStreak((s) => s + 1);
        setPot(newPot);
        setOutcome("win");
      } else {
        // Lost — Option B, no transaction needed
        const pnl = -bet;
        const r = {
          won: false,
          pnl,
          streak,
          finalMul: pot,
          dir,
          bet,
        };
        setResult(r);
        setHistory((h) => [r, ...h].slice(0, 8));
        setOutcome("lose");
        setSessionId(null);
        setPhase("result");
      }
    },
    [isPlaying, currentCard, odds, pot, streak, bet]
  );

  // ── Cash out ──────────────────────────────────────────────────────────
  const cashOut = useCallback(async () => {
    if (!isPlaying || streak === 0 || !sessionId || !account) return;

    const mulBps = Math.floor(pot * 10000);
    setPhase("resolving");

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
            fetchBalance();

            const payout = bet * pot;
            const pnl = payout - bet;
            const r = {
              won: true,
              pnl,
              streak,
              finalMul: pot,
              bet,
              digest: txResult.digest,
            };
            setResult(r);
            setHistory((h) => [r, ...h].slice(0, 8));
            setOutcome("cashout");
            setSessionId(null);
            setPhase("result");
          },
          onError: (err) => {
            console.error("resolve_session failed:", err);
            alert("Failed to sign payout transaction.");
            setPhase("playing");
          },
        }
      );
    } catch (err) {
      console.error("Cash out error:", err);
      alert("Failed to resolve session.");
      setPhase("playing");
    }
  }, [
    isPlaying,
    streak,
    pot,
    bet,
    sessionId,
    account,
    signAndExecute,
    suiClient,
    fetchBalance,
  ]);

  const reset = () => {
    setPhase("idle");
    setCards([]);
    setStreak(0);
    setPot(1);
    setLastGuess(null);
    setOutcome(null);
    setResult(null);
    setFlipping(false);
    setSessionId(null);
  };

  const outcomeColor =
    outcome === "cashout"
      ? "#00e5a0"
      : outcome === "lose"
      ? "#ff4d6d"
      : outcome === "win"
      ? "#00d4c8"
      : "#c0cfea";

  const potColor =
    pot < 2
      ? "#c0cfea"
      : pot < 5
      ? "#00d4c8"
      : pot < 20
      ? "#f5c542"
      : pot < 100
      ? "#ff9f40"
      : "#a78bfa";

  const isWaiting = phase === "locking" || phase === "resolving";

  if (isAuthChecking) {
    return <div className="min-h-screen bg-[#0a0f1e]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] font-sans pb-20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .hl   { font-family:'Outfit',sans-serif; color:#fff; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .lbl  { font-size:11px; color:#7a8fb0; font-weight:600; letter-spacing:.8px; text-transform:uppercase; margin-bottom:8px; }

        @keyframes cardFlip {
          0%   { transform:rotateY(0deg) scale(1); }
          40%  { transform:rotateY(90deg) scale(.9); opacity:.4; }
          70%  { transform:rotateY(0deg) scale(1.06); opacity:1; }
          100% { transform:rotateY(0deg) scale(1); }
        }
        @keyframes slideIn  { from{opacity:0;transform:translateX(-16px) scale(.9)} to{opacity:1;transform:none} }
        @keyframes rise     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes rowIn    { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:none} }
        @keyframes breathe  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes potPop   { 0%{transform:scale(1)} 45%{transform:scale(1.22)} 100%{transform:scale(1)} }
        @keyframes coGlow   { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,160,0)} 50%{box-shadow:0 0 28px 6px rgba(0,229,160,.22)} }
        @keyframes wrongShake { 0%,100%{transform:none} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }

        .rise   { animation:rise .3s ease; }
        .hrow   { animation:rowIn .22s ease; }
        .slide-in { animation:slideIn .3s cubic-bezier(.34,1.56,.64,1); }

        .dir-btn {
          flex:1; padding:16px 10px; border-radius:13px;
          border:2px solid #1e2d4a; background:#0d1526;
          font-family:'Outfit',sans-serif; font-size:15px; font-weight:800;
          cursor:pointer; transition:all .18s; display:flex;
          flex-direction:column; align-items:center; gap:5px;
        }
        .dir-btn:hover:not(:disabled) { transform:translateY(-3px); }
        .dir-btn:active:not(:disabled) { transform:scale(.95); }
        .dir-btn:disabled { opacity:.35; cursor:not-allowed; }
        .dir-high:hover:not(:disabled) { border-color:#00e5a0; background:rgba(0,229,160,.1); }
        .dir-low:hover:not(:disabled)  { border-color:#a78bfa; background:rgba(167,139,250,.1); }

        .co-btn {
          width:100%; padding:15px; border-radius:14px; border:none;
          font-family:'Outfit',sans-serif; font-size:16px; font-weight:800;
          cursor:pointer; transition:all .18s;
        }
        .co-on  { background:#00e5a0; color:#071218; animation:coGlow 1.3s ease infinite; }
        .co-on:hover  { background:#00ffb3; transform:translateY(-1px); }
        .co-off { background:#1a2640; color:#3a4f70; cursor:not-allowed; }

        .act-btn {
          width:100%; padding:15px; border-radius:14px; border:none;
          font-family:'Outfit',sans-serif; font-size:16px; font-weight:800;
          cursor:pointer; transition:all .18s;
        }
        .ab-go  { background:#00d4c8; color:#071218; }
        .ab-go:hover { background:#00f0e0; transform:translateY(-1px); }
        .ab-off { background:#1a2640; color:#3a4f70; cursor:not-allowed; }
        .ab-spin { background:#1a2640; color:#00d4c8; cursor:not-allowed; animation:breathe .75s ease infinite; }

        .bet-in { width:100%; padding:11px 14px; border-radius:10px; background:#060c18; border:1.5px solid #1e2d4a; color:#fff; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; outline:none; transition:border-color .15s; box-sizing:border-box; }
        .bet-in:focus { border-color:#00d4c8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        .qb { padding:5px 11px; border-radius:8px; border:1px solid #1e2d4a; background:transparent; color:#7a8fb0; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; }
        .qb:hover { border-color:#00d4c8; color:#00d4c8; background:rgba(0,212,200,.07); }
        .sc { flex:1; background:#0d1526; border:1px solid #1e2d4a; border-radius:12px; padding:11px 8px; text-align:center; }
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

      <div className="hl pt-6">
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
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
                Streak Play · Ties = Loss · 3% House Edge
              </span>
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -0.5,
                margin: 0,
              }}
            >
              High — Low
            </h1>
            <p style={{ fontSize: 13, color: "#7a8fb0", marginTop: 5 }}>
              Guess the next card. Keep your streak alive. Cash out before you
              bust.
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
              {/* Locking / Resolving overlay */}
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
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#00d4c8",
                    }}
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

              {/* Streak + pot */}
              {(isPlaying || isDone) && (
                <div
                  className="rise"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: "#060c18",
                      border: `1.5px solid ${potColor}33`,
                      borderRadius: 13,
                      padding: "12px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#7a8fb0",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        marginBottom: 4,
                      }}
                    >
                      Multiplier
                    </div>
                    <div
                      key={streak}
                      className="mono"
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: potColor,
                        animation: "potPop .25s ease",
                        letterSpacing: -0.5,
                      }}
                    >
                      {fmtMul(pot)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#060c18",
                      border: "1.5px solid #1a2640",
                      borderRadius: 13,
                      padding: "12px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#7a8fb0",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        marginBottom: 4,
                      }}
                    >
                      Streak
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: streak > 0 ? "#f5c542" : "#3a4f70",
                      }}
                    >
                      {streak}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#060c18",
                      border: "1.5px solid #1a2640",
                      borderRadius: 13,
                      padding: "12px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#7a8fb0",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        marginBottom: 4,
                      }}
                    >
                      Cash Value
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: streak > 0 ? "#00e5a0" : "#3a4f70",
                      }}
                    >
                      {streak > 0
                        ? (bet * pot).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Card table */}
              <div
                style={{
                  background: "#060c18",
                  border: `1.5px solid ${
                    outcome === "lose"
                      ? "rgba(255,77,109,.4)"
                      : outcome === "cashout"
                      ? "rgba(0,229,160,.3)"
                      : "#1a2640"
                  }`,
                  borderRadius: 16,
                  padding: "20px 16px 18px",
                  marginBottom: 14,
                  transition: "border-color .3s, box-shadow .3s",
                  boxShadow:
                    outcome === "lose"
                      ? "0 0 26px rgba(255,77,109,.12)"
                      : outcome === "cashout"
                      ? "0 0 26px rgba(0,229,160,.1)"
                      : "none",
                }}
              >
                {/* Card display area */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    minHeight: 200,
                    flexWrap: "nowrap",
                    overflowX: "auto",
                  }}
                >
                  {phase === "idle" || phase === "locking" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 16,
                        padding: "8px 0 4px",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 300,
                          height: 170,
                        }}
                      >
                        {[
                          {
                            val: "A",
                            suit: "♠",
                            col: "#c0cfea",
                            rot: -32,
                            tx: -108,
                            ty: 28,
                            z: 1,
                            op: 0.7,
                          },
                          {
                            val: "K",
                            suit: "♥",
                            col: "#ff6b8a",
                            rot: -16,
                            tx: -56,
                            ty: 8,
                            z: 2,
                            op: 0.85,
                          },
                          {
                            val: "7",
                            suit: "♦",
                            col: "#ff6b8a",
                            rot: 0,
                            tx: 0,
                            ty: 0,
                            z: 5,
                            op: 1,
                          },
                          {
                            val: "Q",
                            suit: "♣",
                            col: "#c0cfea",
                            rot: 16,
                            tx: 56,
                            ty: 8,
                            z: 2,
                            op: 0.85,
                          },
                          {
                            val: "2",
                            suit: "♥",
                            col: "#ff6b8a",
                            rot: 32,
                            tx: 108,
                            ty: 28,
                            z: 1,
                            op: 0.7,
                          },
                        ].map((s, i) => (
                          <div
                            key={i}
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: `translate(-50%, -50%) translateX(${s.tx}px) translateY(${s.ty}px) rotate(${s.rot}deg)`,
                              zIndex: s.z,
                              opacity: s.op,
                              width: 96,
                              height: 134,
                              borderRadius: 10,
                              background: i === 2 ? "#0f1e34" : "#0c1628",
                              border: `2px solid ${
                                i === 2 ? "#2a4060" : "#1a2a40"
                              }`,
                              boxShadow:
                                i === 2
                                  ? "0 8px 32px rgba(0,0,0,.7), 0 0 0 1px #243450"
                                  : "0 4px 14px rgba(0,0,0,.5)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: 7,
                                left: 9,
                                textAlign: "center",
                                lineHeight: 1.2,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: s.col,
                                  fontFamily: "'JetBrains Mono',monospace",
                                }}
                              >
                                {s.val}
                              </div>
                              <div style={{ fontSize: 11, color: s.col }}>
                                {s.suit}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: i === 2 ? 32 : 26,
                                  fontWeight: 900,
                                  color: s.col,
                                  fontFamily: "'Outfit',sans-serif",
                                  lineHeight: 1,
                                }}
                              >
                                {s.val}
                              </div>
                              <div
                                style={{
                                  fontSize: i === 2 ? 26 : 20,
                                  color: s.col,
                                  marginTop: 3,
                                }}
                              >
                                {s.suit}
                              </div>
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                bottom: 7,
                                right: 9,
                                textAlign: "center",
                                lineHeight: 1.2,
                                transform: "rotate(180deg)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: s.col,
                                  fontFamily: "'JetBrains Mono',monospace",
                                }}
                              >
                                {s.val}
                              </div>
                              <div style={{ fontSize: 11, color: s.col }}>
                                {s.suit}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{ fontSize: 13, color: "#3a4f70", marginTop: 4 }}
                      >
                        Place your bet to deal the first card
                      </div>
                    </div>
                  ) : (
                    <>
                      {cards.length > 1 &&
                        cards
                          .slice(Math.max(0, cards.length - 5), -1)
                          .map((c, i, arr) => {
                            const isRecent = i === arr.length - 1;
                            return (
                              <div
                                key={i}
                                style={{
                                  opacity: isRecent ? 0.65 : 0.3,
                                  transition: "opacity .3s",
                                  flexShrink: 0,
                                }}
                              >
                                <PlayingCard card={c} size="sm" dim={true} />
                              </div>
                            );
                          })}

                      {cards.length > 1 && (
                        <div
                          style={{
                            color: "#3a4f70",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          →
                        </div>
                      )}

                      <div
                        className={cards.length > 0 ? "slide-in" : ""}
                        style={{ flexShrink: 0 }}
                      >
                        <PlayingCard
                          card={currentCard}
                          size="lg"
                          glow={
                            outcome === "cashout"
                              ? "#00e5a0"
                              : outcome === "lose"
                              ? "#ff4d6d"
                              : outcome === "win"
                              ? "#00d4c8"
                              : RED_SUITS.has(currentCard?.suit || "")
                              ? "#ff6b8a55"
                              : "#7da8c855"
                          }
                          flipping={flipping}
                        />
                      </div>

                      {isPlaying && (
                        <div style={{ flexShrink: 0, opacity: 0.5 }}>
                          <CardBack size="lg" />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Result overlay text */}
                {isDone && result && (
                  <div
                    className="rise"
                    style={{ textAlign: "center", marginTop: 12 }}
                  >
                    <div
                      style={{
                        fontSize: 19,
                        fontWeight: 800,
                        color: outcomeColor,
                      }}
                    >
                      {outcome === "cashout"
                        ? `Cashed Out! +${result.pnl.toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT`
                        : `Wrong guess — lost ${bet} OCT`}
                    </div>
                    {result.streak > 0 && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#7a8fb0",
                          marginTop: 4,
                        }}
                      >
                        {result.streak} card streak · {fmtMul(result.finalMul)}{" "}
                        final
                      </div>
                    )}
                    {result.digest && (
                      <div className="mt-2">
                        <a
                          href={`https://onescan.cc/testnet/tx/${result.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-mono text-xs transition-colors"
                        >
                          {result.digest.slice(0, 10)}...
                          {result.digest.slice(-6)} ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {isPlaying && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 10,
                      fontSize: 13,
                      color: "#7a8fb0",
                    }}
                  >
                    {streak === 0 ? (
                      "Make your first guess below"
                    ) : (
                      <span style={{ color: "#f5c542", fontWeight: 700 }}>
                        {streak} correct {streak === 1 ? "guess" : "guesses"} —
                        keep going or cash out!
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* HIGH / LOW buttons */}
              {isPlaying && odds && (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <button
                    className="dir-btn dir-high"
                    disabled={!odds.canHigh}
                    onClick={() => guess("higher")}
                    style={{
                      borderColor: odds.canHigh
                        ? "#00e5a044"
                        : "#1e2d4a",
                      color: odds.canHigh ? "#00e5a0" : "#3a4f70",
                    }}
                  >
                    <span style={{ fontSize: 26 }}>▲</span>
                    <span style={{ fontSize: 16 }}>Higher</span>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 13,
                          color: "#f5c542",
                          fontWeight: 700,
                        }}
                      >
                        {fmtMul(odds.mulHigh)}
                      </span>
                      <span
                        style={{ fontSize: 11, color: "#7a8fb0" }}
                      >
                        {odds.canHigh
                          ? (odds.pHigh * 100).toFixed(0) + "% chance"
                          : "Impossible"}
                      </span>
                    </div>
                  </button>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#3a4f70",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      Card
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: RED_SUITS.has(currentCard?.suit || "")
                          ? "#ff6b8a"
                          : "#c0cfea",
                      }}
                    >
                      {currentCard?.label}
                      {currentCard?.suit}
                    </div>
                    <div style={{ fontSize: 10, color: "#3a4f70" }}>
                      Tie = loss
                    </div>
                  </div>

                  <button
                    className="dir-btn dir-low"
                    disabled={!odds.canLow}
                    onClick={() => guess("lower")}
                    style={{
                      borderColor: odds.canLow
                        ? "#a78bfa44"
                        : "#1e2d4a",
                      color: odds.canLow ? "#a78bfa" : "#3a4f70",
                    }}
                  >
                    <span style={{ fontSize: 26 }}>▼</span>
                    <span style={{ fontSize: 16 }}>Lower</span>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 13,
                          color: "#f5c542",
                          fontWeight: 700,
                        }}
                      >
                        {fmtMul(odds.mulLow)}
                      </span>
                      <span
                        style={{ fontSize: 11, color: "#7a8fb0" }}
                      >
                        {odds.canLow
                          ? (odds.pLow * 100).toFixed(0) + "% chance"
                          : "Impossible"}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Cash out */}
              {isPlaying && (
                <button
                  className={`co-btn ${streak > 0 ? "co-on" : "co-off"}`}
                  onClick={cashOut}
                  disabled={streak === 0}
                  style={{ marginBottom: 14 }}
                >
                  {streak > 0
                    ? `💰 Cash Out — ${(bet * pot).toLocaleString(undefined, { maximumFractionDigits: 4 })} OCT (${fmtMul(pot)})`
                    : "Guess correctly to unlock cash out"}
                </button>
              )}

              {/* Odds table */}
              {isPlaying && odds && (
                <div
                  style={{
                    background: "#060c18",
                    border: "1px solid #1a2640",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 14,
                  }}
                >
                  <div className="lbl" style={{ marginBottom: 8 }}>
                    Next Card Odds
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {[
                      {
                        label: "Higher than " + currentCard?.label,
                        prob: odds.pHigh,
                        mul: odds.mulHigh,
                        col: "#00e5a0",
                        disabled: !odds.canHigh,
                      },
                      {
                        label: "Lower than " + currentCard?.label,
                        prob: odds.pLow,
                        mul: odds.mulLow,
                        col: "#a78bfa",
                        disabled: !odds.canLow,
                      },
                    ].map((o) => (
                      <div
                        key={o.label}
                        style={{
                          background: "#0d1526",
                          borderRadius: 9,
                          padding: "9px 12px",
                          opacity: o.disabled ? 0.4 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#7a8fb0",
                            marginBottom: 4,
                          }}
                        >
                          {o.label}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: o.col,
                            }}
                          >
                            {o.disabled
                              ? "—"
                              : (o.prob * 100).toFixed(1) + "%"}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#f5c542",
                            }}
                          >
                            {fmtMul(o.mul)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "#3a4f70",
                      textAlign: "center",
                    }}
                  >
                    Tie (3 remaining) → loss ·{" "}
                    {((3 / 51) * 100).toFixed(1)}% chance
                  </div>
                </div>
              )}

              {/* Bet + Start (idle) or Play Again */}
              {!isPlaying && !isWaiting && (
                <div style={{ marginBottom: 14 }}>
                  {phase === "idle" && (
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
                  )}

                  {phase === "idle" ? (
                    <button
                      className={`act-btn ${canStart ? "ab-go" : "ab-off"}`}
                      onClick={startGame}
                      disabled={!canStart}
                    >
                      🃏 Deal Cards — {bet} OCT
                    </button>
                  ) : (
                    <button className="act-btn ab-go" onClick={reset}>
                      Play Again
                    </button>
                  )}
                </div>
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
                      lbl: "Games",
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
                      lbl: "Best streak",
                      val: String(
                        Math.max(...mergedHistory.map((h) => h.streak))
                      ),
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
                          fontSize: 13,
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
                    Recent Games
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
                            fontSize: 16,
                          }}
                        >
                          {h.won ? "💰" : "💔"}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#c0cfea",
                            }}
                          >
                            {h.streak} card{h.streak !== 1 ? "s" : ""} ·{" "}
                            {fmtMul(h.finalMul)}
                            {h.won && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 11,
                                  color: "#00e5a0",
                                }}
                              >
                                cashed out
                              </span>
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
                52-card deck model · ties = loss · mul = 0.97 ÷ P(correct) ·
                Powered by OneChain RNG
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
