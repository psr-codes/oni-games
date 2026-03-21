import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About OniGames — Web3 Arcade & GambleFi on OneChain",
  description:
    "Learn about OniGames: a provably fair Web3 arcade and casino platform built on OneChain. Play games, mint score NFTs, trade on-chain, and win with on-chain RNG.",
};

const GAME_PORTAL_CONTRACT =
  "0x9648be59effa27966ee8cc0a531cdefac977bb6444dcf5df96c37304eefa46b3";
const HOUSE_BANKROLL_CONTRACT =
  "0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037";

function truncate(addr: string) {
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

const ARCADE_GAMES = [
  {
    name: "Poly Dash",
    emoji: "🔺",
    desc: "A Geometry Dash–inspired endless runner. Jump and dodge spikes across procedurally generated levels. Your run score can be minted as an NFT proof of skill.",
    href: "/games/poly-dash",
  },
  {
    name: "Tetris",
    emoji: "🧱",
    desc: "The classic block-stacking game reimagined in Web3. Clear lines, build combos, and chase the highest score — then immortalise it on-chain as an NFT.",
    href: "/games/tetris",
  },
  {
    name: "Space Invaders",
    emoji: "👾",
    desc: "Defend Earth from increasingly aggressive alien waves. Destroy bosses, collect power-ups, and push your score high enough to make the leaderboard.",
    href: "/games/space-invaders",
  },
  {
    name: "Neon Snake",
    emoji: "🐍",
    desc: "A hyper-powered Snake with power-ups, obstacles, and combo chains. Navigate the neon grid and keep growing — mint your longest run as an NFT.",
    href: "/games/snake",
  },
  {
    name: "2048",
    emoji: "🔢",
    desc: "Slide and merge tiles on a 4×4 grid targeting the legendary 2048 tile. A perfect puzzle game for strategic players looking to prove their dedication on-chain.",
    href: "/games/2048",
  },
  {
    name: "Bubble Pop",
    emoji: "🫧",
    desc: "Pop falling bubbles before they touch the ground. A fast-paced reflex game where every second counts — your pop count becomes your on-chain achievement.",
    href: "/games/bubble-pop",
  },
  {
    name: "Doodle Jump",
    emoji: "🐸",
    desc: "Bounce your character ever higher, stomping monsters and grabbing jetpacks. One wrong jump ends the run — how high can you go before minting?",
    href: "/games/doodle-jump",
  },
  {
    name: "Tower Bloxx",
    emoji: "🏗️",
    desc: "Stack falling blocks from a swinging crane to build the tallest tower you can. Precision and timing are everything — build high and mint your record.",
    href: "/games/tower-bloxx",
  },
];

const CASINO_GAMES = [
  {
    name: "Coin Flip",
    emoji: "🪙",
    desc: "The purest bet: heads or tails. Predict the outcome and win ~1.96× your wager instantly. The result is derived entirely from OneChain's native RNG — no backend, no manipulation possible.",
    href: "/casino/coin-flip",
    multiplier: "~1.96×",
  },
  {
    name: "Hash Roulette",
    emoji: "🔮",
    desc: "Guess the last hex character(s) of the block hash. Betting on a single digit pays up to ~4,014×. A trustless spin on on-chain entropy that no operator can influence.",
    href: "/casino/hash-roulette",
    multiplier: "Up to ~4,014×",
  },
  {
    name: "Dice Roll",
    emoji: "🎲",
    desc: "Set your threshold (1–99) and bet 'over' or 'under'. Lower probability = higher payout, up to ~97×. You choose your own risk-reward ratio on every roll.",
    href: "/casino/dice-roll",
    multiplier: "Up to ~97×",
  },
  {
    name: "Color Prediction",
    emoji: "🎨",
    desc: "Pick Red or Green for ~2.2× or go risky with Violet for a rare ~9.8× payout. An elegant colour-based instant game with three distinct bet tiers.",
    href: "/casino/color-prediction",
    multiplier: "Up to ~9.8×",
  },
  {
    name: "Crypto Crash",
    emoji: "📈",
    desc: "Watch the multiplier rocket upwards from 1×. Cash out before the graph crashes to lock in your winnings. The longer you hold, the higher your reward — and your risk. A session-based thrill.",
    href: "/casino/crash",
    multiplier: "∞×",
  },
  {
    name: "Treasure Hunt",
    emoji: "💎",
    desc: "Flip tiles on a 5×5 grid hiding bombs. Every safe tile you reveal increases your multiplier. Cash out any time — or keep going for astronomical multipliers up to 150,000×.",
    href: "/casino/treasure-hunt",
    multiplier: "Up to 150,000×",
  },
  {
    name: "High — Low",
    emoji: "🃏",
    desc: "Guess whether the next card is higher or lower. Build an unbroken streak to compound your multiplier to infinity. One wrong call and it all resets — walk away at the right moment.",
    href: "/casino/highlow",
    multiplier: "Streak ∞×",
  },
  {
    name: "Wheel of Fortune",
    emoji: "🎡",
    desc: "Spin a weighted virtual wheel. Half the segments bust; the winning arc pays up to 3× your stake. A session-based game of nerve and timing.",
    href: "/casino/wheel-of-fortune",
    multiplier: "Up to 3×",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#111a2e]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d1424] to-[#111a2e] py-24 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.08),transparent)]" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-400 text-xs font-semibold mb-6 tracking-wider uppercase">
            About OniGames
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-50 leading-tight mb-6">
            Web3 Arcade &amp; GambleFi,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
              Fully On-Chain
            </span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            OniGames is a decentralised gaming platform built on{" "}
            <span className="text-slate-200 font-medium">OneChain</span>. Play
            skill-based arcade games, mint your scores as NFTs, trade them
            peer-to-peer, and wager in provably fair casino games — all in a
            single, on-chain ecosystem powered by the OCT token.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-24">
        {/* OneChain */}
        <section>
          <SectionLabel>The Blockchain</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-6">
            Built on <span className="text-cyan-400">OneChain</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              icon="⛓️"
              title="OneChain Network"
              body="OneChain is a high-performance Layer-1 blockchain designed for speed, low cost, and developer ergonomics. Its Move-based smart contract language guarantees resource safety and eliminates whole categories of vulnerabilities common on EVM chains."
            />
            <FeatureCard
              icon="🎲"
              title="Native On-Chain RNG"
              body="OneChain exposes a native randomness beacon that smart contracts can consume trustlessly. Every dice roll, coin flip, card draw, and crash outcome in OniGames is derived from this system — no off-chain oracle, no server-side seed, no manipulation."
            />
            <FeatureCard
              icon="🪙"
              title="OCT Token"
              body="OCT (OneChain Token) is the native gas and utility token of the network. On OniGames it is used for casino wagers, NFT trades, and marketplace activity — creating real, organic on-chain OCT utility beyond simple transfers."
            />
            <FeatureCard
              icon="⚡"
              title="Fast & Cheap"
              body="OneChain finalises blocks in under a second with negligible gas fees, making micro-wagers and high-frequency game interactions economically viable — something impossible on Ethereum mainnet."
            />
          </div>
        </section>

        {/* NFT Minting */}
        <section>
          <SectionLabel>NFT Minting</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-4">
            Your Score, Immortalised On-Chain
          </h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            After completing any arcade game, you can mint your score as a
            permanent on-chain NFT. The NFT records the game name, your score,
            the timestamp, and your wallet address — all stored in the{" "}
            <span className="text-slate-200 font-medium">GamePortal</span>{" "}
            smart contract. Minting requires a small gas fee paid in OCT; no
            other cost is involved.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <MiniCard
              icon="🏆"
              title="Proof of Skill"
              body="NFTs act as permanent, unforgeable evidence of your best runs. Your on-chain record speaks for itself."
            />
            <MiniCard
              icon="📊"
              title="Leaderboard Power"
              body="Minted scores feed the global leaderboard, letting players compete for bragging rights on-chain."
            />
            <MiniCard
              icon="💼"
              title="Fully Owned"
              body="NFTs live in your wallet. They are transferable, tradeable, and never locked to OniGames infrastructure."
            />
          </div>
        </section>

        {/* NFT Trading */}
        <section>
          <SectionLabel>NFT Marketplace</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-4">
            Trade Score NFTs Peer-to-Peer
          </h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            The OniGames Marketplace lets players list, browse, and purchase
            score NFTs directly on-chain. Rare high-score NFTs from competitive
            games carry genuine collector value. All trades settle atomically on
            OneChain — no escrow service, no custodian, no risk of counterparty
            failure.
          </p>
          <div className="rounded-xl border border-slate-700/20 bg-[#1a2540] p-6 grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl mb-2">🛒</div>
              <div className="text-sm font-semibold text-slate-200 mb-1">
                List Instantly
              </div>
              <div className="text-xs text-slate-500">
                Set an OCT price and list any NFT you own in one transaction.
              </div>
            </div>
            <div>
              <div className="text-3xl mb-2">🤝</div>
              <div className="text-sm font-semibold text-slate-200 mb-1">
                Atomic Settlement
              </div>
              <div className="text-xs text-slate-500">
                Payment and NFT transfer happen in the same on-chain step —
                zero counterparty risk.
              </div>
            </div>
            <div>
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm font-semibold text-slate-200 mb-1">
                Transparent History
              </div>
              <div className="text-xs text-slate-500">
                Every listing, sale, and price is publicly visible on OneScan.
              </div>
            </div>
          </div>
        </section>

        {/* Economics */}
        <section>
          <SectionLabel>Token Economics</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-4">
            Self-Sustaining &amp; Circular
          </h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            OniGames is designed to be economically self-sustaining without any
            dependence on external revenue. The casino&apos;s{" "}
            <span className="text-slate-200 font-medium">House Bankroll</span>{" "}
            contract accumulates OCT from the house edge on every wager. Those
            funds continuously back future payouts, meaning the platform can
            operate indefinitely as long as player volume persists.
          </p>
          <div className="relative rounded-xl border border-slate-700/20 bg-[#1a2540] p-6 overflow-hidden">
            <div className="absolute right-0 top-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-slate-400 relative z-10 flex-wrap">
              <FlowStep icon="🎮" label="Players Wager OCT" />
              <Arrow />
              <FlowStep icon="🏦" label="House Edge → Bankroll" />
              <Arrow />
              <FlowStep icon="💰" label="Bankroll Funds Payouts" />
              <Arrow />
              <FlowStep icon="♻️" label="Winners Re-wager" />
            </div>
            <p className="text-xs text-slate-600 text-center mt-5 relative z-10">
              Marketplace fees and NFT minting gas also flow back into the
              ecosystem — creating a fully circular OCT economy.
            </p>
          </div>
        </section>

        {/* Arcade Games */}
        <section>
          <SectionLabel>Arcade Games</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-2">
            8 Skill-Based Games, All Mintable
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            Every game supports score-to-NFT minting. Compete on the
            leaderboard or trade your best runs.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {ARCADE_GAMES.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="group flex gap-4 rounded-xl border border-slate-700/20 bg-[#1a2540] p-4 hover:border-cyan-400/20 hover:bg-[#1e2d50] transition-all duration-200"
              >
                <span className="text-3xl shrink-0">{g.emoji}</span>
                <div>
                  <div className="text-sm font-bold text-slate-100 group-hover:text-cyan-400 transition-colors mb-1">
                    {g.name}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {g.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Casino Games */}
        <section>
          <SectionLabel>Casino Games</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-2">
            Provably Fair GambleFi
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            All results are determined by OneChain&apos;s native RNG in a
            single transaction. No backend, no trust required.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {CASINO_GAMES.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="group flex gap-4 rounded-xl border border-slate-700/20 bg-[#1a2540] p-4 hover:border-amber-400/20 hover:bg-[#1e2d50] transition-all duration-200"
              >
                <span className="text-3xl shrink-0">{g.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                      {g.name}
                    </span>
                    <span className="text-[10px] font-bold text-amber-400/70 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/15">
                      {g.multiplier}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {g.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Smart Contracts */}
        <section>
          <SectionLabel>Smart Contracts</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-4">
            Transparent, Auditable &amp; Safe
          </h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            OniGames is powered by two core Move smart contracts deployed on
            OneChain Testnet. Both contracts are fully open and inspectable on
            OneScan. The Move language&apos;s resource model prevents reentrancy
            and double-spend by design — there is no exploitable state machine,
            no hidden admin backdoor, and no upgradeable proxy. Every game
            result, payout, and NFT mint is an immutable on-chain event that
            anyone can verify.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <ContractCard
              icon="🎮"
              name="Game Portal"
              description="Manages arcade game sessions, score submissions, NFT minting, and the leaderboard. All player scores and minted NFTs live here."
              address={GAME_PORTAL_CONTRACT}
            />
            <ContractCard
              icon="🏦"
              name="House Bankroll"
              description="Holds the casino treasury. Accepts wagers, calls OneChain RNG, calculates payouts using the configurable house edge, and transfers winnings atomically."
              address={HOUSE_BANKROLL_CONTRACT}
            />
          </div>
        </section>

        {/* Ecosystem Contribution */}
        <section>
          <SectionLabel>OneChain Ecosystem</SectionLabel>
          <h2 className="text-2xl font-bold text-slate-50 mb-4">
            Growing the OneChain Ecosystem
          </h2>
          <p className="text-slate-400 leading-relaxed mb-6">
            OniGames is one of the most feature-complete consumer dApps on
            OneChain Testnet. It combines four high-utility primitives —{" "}
            <strong className="text-slate-200">on-chain gaming</strong>,{" "}
            <strong className="text-slate-200">NFT minting</strong>,{" "}
            <strong className="text-slate-200">peer-to-peer NFT trading</strong>
            , and{" "}
            <strong className="text-slate-200">provably fair gambling</strong>{" "}
            — into a single cohesive product.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <FeatureCard
              icon="🔥"
              title="OCT Utility"
              body="Every casino wager, NFT mint, and marketplace trade consumes OCT. OniGames drives genuine, sustained demand for the native token beyond simple DeFi swaps."
            />
            <FeatureCard
              icon="📦"
              title="NFT Activity"
              body="Score NFTs create a continuous stream of on-chain minting events — demonstrating OneChain's capability to support high-frequency NFT workloads with negligible fees."
            />
            <FeatureCard
              icon="🎰"
              title="First GambleFi Protocol"
              body="OniGames pioneers provably fair GambleFi on OneChain, leveraging the native RNG beacon in ways no other project currently does on the network."
            />
            <FeatureCard
              icon="🌐"
              title="User Onboarding"
              body="Familiar gaming experiences lower the barrier to Web3 for new users. A player who comes for Tetris may stay for the casino — and both journeys happen entirely on OneChain."
            />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <div className="inline-block rounded-2xl border border-slate-700/20 bg-[#1a2540] px-10 py-10">
            <div className="text-4xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-slate-50 mb-3">
              Ready to Play?
            </h2>
            <p className="text-slate-400 text-sm mb-6 max-w-sm">
              Connect your OneChain wallet, grab some OCT, and start earning
              on-chain achievements.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/games"
                className="px-6 py-2.5 rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-colors"
              >
                Play Arcade Games
              </Link>
              <Link
                href="/casino"
                className="px-6 py-2.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm font-semibold hover:bg-amber-400/20 transition-colors"
              >
                Visit Casino
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700/30 bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/20 bg-[#1a2540] p-5">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-sm font-bold text-slate-100 mb-2">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/20 bg-[#1a2540] p-4 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-semibold text-slate-200 mb-1">{title}</div>
      <div className="text-xs text-slate-500 leading-relaxed">{body}</div>
    </div>
  );
}

function FlowStep({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-slate-300 font-medium text-center max-w-[80px]">
        {label}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-slate-600 text-lg hidden md:block">→</span>
  );
}

function ContractCard({
  icon,
  name,
  description,
  address,
}: {
  icon: string;
  name: string;
  description: string;
  address: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/20 bg-[#1a2540] p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-bold text-slate-100">{name}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-4">
        {description}
      </p>
      <a
        href={`https://onescan.cc/testnet/object/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-[11px] font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors group"
      >
        <span className="px-2 py-1 rounded-md bg-slate-900/60 border border-slate-700/20 group-hover:border-cyan-400/20">
          {truncate(address)}
        </span>
        <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">
          View on OneScan ↗
        </span>
      </a>
    </div>
  );
}
