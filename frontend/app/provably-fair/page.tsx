"use client";

import Link from "next/link";

// ── Game data for the breakdown table ─────────────────────────────────────
const GAMES_TABLE = [
  {
    name: "Coin Flip",
    slug: "coin-flip",
    type: "Instant",
    edge: "3%",
    ev: "0.97×",
    method: "play_instant_wager",
    desc: "50/50 heads or tails. Payout = 2 × (1 − edge).",
  },
  {
    name: "Hash Roulette",
    slug: "hash-roulette",
    type: "Instant",
    edge: "3%",
    ev: "0.97×",
    method: "play_instant_wager",
    desc: "Guess hex digits of the block hash. More digits = bigger payout.",
  },
  {
    name: "Dice Roll",
    slug: "dice-roll",
    type: "Instant",
    edge: "3%",
    ev: "0.97×",
    method: "play_dice_wager",
    desc: "Pick a threshold (1–99) and direction. Payout = 100 / P(win) × (1 − edge).",
  },
  {
    name: "Color Prediction",
    slug: "color-prediction",
    type: "Instant",
    edge: "3%",
    ev: "0.97×",
    method: "play_range_wager",
    desc: "Pick Red (45%), Green (45%), or Violet (10%). Payout = 1 / P(color) × (1 − edge).",
  },
  {
    name: "Wheel of Fortune",
    slug: "wheel-of-fortune",
    type: "Session",
    edge: "~4.2%",
    ev: "0.958×",
    method: "lock_wager → resolve_session",
    desc: "12 segments: 6 bust (0×), 3×1.5×, 2×2×, 1×3×. EV = 11.5/12.",
  },
  {
    name: "Treasure Hunt",
    slug: "treasure-hunt",
    type: "Session",
    edge: "3%",
    ev: "0.97×",
    method: "lock_wager → resolve_session",
    desc: "Reveal tiles on a 5×5 grid. Each safe tile multiplies your wager. Cash out anytime.",
  },
  {
    name: "Crypto Crash",
    slug: "crash",
    type: "Session",
    edge: "3%",
    ev: "0.97×",
    method: "lock_wager → resolve_session",
    desc: "Multiplier grows exponentially. Crash = 0.97 / random(0,1). Cash out anytime.",
  },
  {
    name: "High — Low",
    slug: "highlow",
    type: "Session",
    edge: "3%",
    ev: "0.97×",
    method: "lock_wager → resolve_session",
    desc: "Guess if next card is higher or lower. Streak builds multiplier. Ties = loss.",
  },
];

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-slate-50 mb-4 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        {title}
      </h2>
      <div className="bg-[#1a2540] rounded-2xl border border-slate-700/20 p-6">
        {children}
      </div>
    </div>
  );
}

export default function ProvablyFairPage() {
  return (
    <div className="min-h-screen bg-[#111a2e] py-10">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="mb-2">
          <Link
            href="/casino"
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm mb-6"
          >
            <span>←</span> Back to Casino
          </Link>
        </div>
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-sm text-emerald-400 font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Fully Verifiable
          </div>
          <h1 className="text-4xl font-bold text-slate-50 mb-3">
            Provably Fair
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Every game on OniGames is powered by on-chain randomness and
            transparent smart contracts. No backend servers control outcomes —
            every result is determined by the blockchain and independently
            verifiable.
          </p>
        </div>

        {/* 1. On-Chain RNG */}
        <Section icon="🎲" title="On-Chain Random Number Generation">
          <p className="text-slate-400 leading-relaxed mb-4">
            OniGames uses{" "}
            <span className="text-slate-200 font-medium">
              OneChain&apos;s native on-chain RNG
            </span>{" "}
            to generate random outcomes. When you place a bet, the smart
            contract requests a random value from the blockchain&apos;s
            built-in randomness module — a cryptographic primitive that is
            unpredictable by any party, including the game developer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              {
                icon: "🔐",
                title: "Unpredictable",
                text: "No party can predict or influence the outcome before the transaction is finalized.",
              },
              {
                icon: "🔗",
                title: "On-Chain",
                text: "Random values are generated inside the Move VM during transaction execution — no off-chain oracles.",
              },
              {
                icon: "✅",
                title: "Verifiable",
                text: "Every transaction is logged on the blockchain. Inspect any game result on OneScan.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-[#111a2e] rounded-xl p-4 border border-slate-700/15"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-sm font-bold text-slate-200 mb-1">
                  {item.title}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Instant vs Session */}
        <Section icon="⚡" title="Game Models: Instant vs Session">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Instant */}
            <div>
              <h3 className="text-base font-bold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-xs font-bold">
                  Instant Play
                </span>
              </h3>
              <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                <p>
                  One transaction does everything: accept the wager, generate
                  the random result, and pay out — all in a single atomic
                  block.
                </p>
                <div className="bg-[#111a2e] rounded-lg p-3 font-mono text-xs text-slate-500 border border-slate-700/15">
                  <div className="text-cyan-400/60">// Single transaction</div>
                  <div>
                    1. Player calls{" "}
                    <span className="text-amber-400">play_instant_wager()</span>
                  </div>
                  <div>2. Contract generates random number</div>
                  <div>3. Win → payout sent immediately</div>
                  <div>4. Lose → wager kept by house</div>
                </div>
                <p className="text-xs text-slate-500">
                  Used by: Coin Flip, Hash Roulette, Dice Roll, Color
                  Prediction
                </p>
              </div>
            </div>

            {/* Session */}
            <div>
              <h3 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs font-bold">
                  Session Play
                </span>
              </h3>
              <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                <p>
                  Multi-step games where you build a multiplier over time.
                  Your wager is locked on-chain first, then resolved when you
                  cash out or lose.
                </p>
                <div className="bg-[#111a2e] rounded-lg p-3 font-mono text-xs text-slate-500 border border-slate-700/15">
                  <div className="text-amber-400/60">// Two transactions</div>
                  <div>
                    1.{" "}
                    <span className="text-amber-400">lock_wager()</span> →
                    wager collected, session created
                  </div>
                  <div>
                    2. Player builds multiplier (client-side RNG)
                  </div>
                  <div>
                    3a. Cash out →{" "}
                    <span className="text-emerald-400">resolve_session(mul)</span>
                  </div>
                  <div>
                    3b. Lose → no transaction needed (Option B)
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Used by: Wheel of Fortune, Treasure Hunt, Crypto Crash,
                  High‑Low
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* 3. Option B — Loss Handling */}
        <Section icon="🛡️" title="Option B: No-Transaction Losses">
          <p className="text-slate-400 leading-relaxed mb-4">
            In session-based games, when you{" "}
            <span className="text-slate-200 font-medium">lose</span>, no
            additional transaction is needed. Your wager was already collected
            by the house bankroll during{" "}
            <code className="text-cyan-400 text-xs bg-cyan-400/5 px-1.5 py-0.5 rounded">
              lock_wager()
            </code>
            . This means:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "💸",
                title: "No Gas on Loss",
                text: "You don't pay a second transaction fee when you lose. Only winners transact.",
              },
              {
                icon: "⚡",
                title: "Instant Feedback",
                text: "The game shows your result immediately — no waiting for blockchain confirmation on losses.",
              },
              {
                icon: "🔒",
                title: "Funds are Safe",
                text: "The house cannot resolve your session with a different multiplier — it's cryptographically signed.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-[#111a2e] rounded-xl p-4 border border-slate-700/15"
              >
                <div className="text-xl mb-2">{item.icon}</div>
                <div className="text-sm font-bold text-slate-200 mb-1">
                  {item.title}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. House Edge */}
        <Section icon="📊" title="House Edge & Expected Value">
          <p className="text-slate-400 leading-relaxed mb-4">
            Every game has a transparent{" "}
            <span className="text-slate-200 font-medium">house edge</span>,
            which represents the platform&apos;s fee for operating the game.
            The house edge is configured on-chain and can be verified by
            anyone.
          </p>
          <div className="bg-[#111a2e] rounded-xl p-4 border border-slate-700/15 mb-4">
            <div className="font-mono text-sm text-slate-400 space-y-1">
              <div>
                <span className="text-slate-500">Expected Value =</span>{" "}
                <span className="text-cyan-400">1 − house_edge</span>
              </div>
              <div>
                <span className="text-slate-500">Example (3% edge):</span>{" "}
                <span className="text-emerald-400">
                  EV = 0.97× → for every 1 OCT wagered, you get 0.97 OCT back
                  on average
                </span>
              </div>
              <div>
                <span className="text-slate-500">Payout formula:</span>{" "}
                <span className="text-amber-400">
                  multiplier = (1 − edge) ÷ P(win)
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            The house edge is adjustable by the admin and is always displayed
            on each game page. Current default:{" "}
            <span className="text-slate-300 font-medium">3%</span>.
          </p>
        </Section>

        {/* 5. Per-Game Breakdown */}
        <Section icon="🎮" title="Per-Game Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="text-left py-3 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Game
                  </th>
                  <th className="text-left py-3 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-3 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Edge
                  </th>
                  <th className="text-left py-3 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    EV
                  </th>
                  <th className="text-left py-3 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider hidden md:table-cell">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody>
                {GAMES_TABLE.map((g) => (
                  <tr
                    key={g.slug}
                    className="border-b border-slate-700/15 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <Link
                        href={`/casino/${g.slug}`}
                        className="text-slate-200 font-medium hover:text-cyan-400 transition-colors"
                      >
                        {g.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          g.type === "Instant"
                            ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                            : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                        }`}
                      >
                        {g.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-xs">
                      {g.edge}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-mono text-xs font-bold">
                      {g.ev}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-xs hidden md:table-cell">
                      {g.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-2">
            {GAMES_TABLE.map((g) => (
              <div
                key={g.slug}
                className="text-xs text-slate-500 leading-relaxed"
              >
                <span className="text-slate-300 font-medium">{g.name}:</span>{" "}
                {g.desc}
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Verify Yourself */}
        <Section icon="🔍" title="Verify It Yourself">
          <p className="text-slate-400 leading-relaxed mb-4">
            Every game result is recorded on-chain. You can inspect any
            transaction to see the exact wager, random seed, and payout.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="https://onescan.cc/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#111a2e] rounded-xl p-4 border border-slate-700/15 hover:border-cyan-400/20 transition-colors group"
            >
              <div className="text-lg mb-2">🔭</div>
              <div className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors mb-1">
                OneScan Explorer
              </div>
              <div className="text-xs text-slate-500">
                Inspect any transaction, event, or object on the OneChain
                blockchain.
              </div>
            </a>
            <div className="bg-[#111a2e] rounded-xl p-4 border border-slate-700/15">
              <div className="text-lg mb-2">📜</div>
              <div className="text-sm font-bold text-slate-200 mb-1">
                Smart Contract Source
              </div>
              <div className="text-xs text-slate-500">
                Our casino contract (
                <code className="text-cyan-400/60">casino.move</code>) and game
                portal contract (
                <code className="text-cyan-400/60">game_portal.move</code>) are
                open source and can be audited by anyone.
              </div>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <div className="text-center pt-4 pb-8">
          <Link
            href="/casino"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
          >
            🎰 Play Now
          </Link>
          <p className="text-xs text-slate-500 mt-3">
            Powered by OneChain · Fully on-chain · No backend
          </p>
        </div>
      </div>
    </div>
  );
}
