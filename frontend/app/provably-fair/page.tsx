"use client";

import { useState, useEffect, useRef } from "react";

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCountUp(target: number | string, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start || typeof target !== "number") return;
    let t0: number | null = null;
    const raf = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [start, target, duration]);
  return val;
}

function useInView(
  threshold = 0.15,
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVis(true);
      },
      { threshold },
    );
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [threshold]);
  return [ref, vis];
}

// ─── Design tokens (matches your site exactly) ────────────────────────────────
const C = {
  bg: "#0b0f1e",
  bgCard: "rgba(255,255,255,0.04)",
  bgCard2: "rgba(255,255,255,0.02)",
  cyan: "#00e5cc",
  cyanDim: "rgba(0,229,204,0.10)",
  purple: "#9b59f5",
  purpleDim: "rgba(155,89,245,0.10)",
  pink: "#f472b6",
  amber: "#fbbf24",
  green: "#34d399",
  border: "rgba(255,255,255,0.08)",
  borderC: "rgba(0,229,204,0.18)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.18)",
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const ShieldIcon = ({ s = 20, c = C.cyan }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
      fill={c}
      fillOpacity=".15"
      stroke={c}
      strokeWidth="1.5"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke={c}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const ChainIcon = ({ s = 20, c = C.cyan }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const DiceIcon = ({ s = 20, c = C.purple }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="4"
      stroke={c}
      strokeWidth="1.8"
    />
    <circle cx="8" cy="8" r="1.5" fill={c} />
    <circle cx="16" cy="8" r="1.5" fill={c} />
    <circle cx="8" cy="16" r="1.5" fill={c} />
    <circle cx="16" cy="16" r="1.5" fill={c} />
    <circle cx="12" cy="12" r="1.5" fill={c} />
  </svg>
);
const LockIcon = ({ s = 20, c = C.pink }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="11"
      width="18"
      height="11"
      rx="2"
      stroke={c}
      strokeWidth="1.8"
    />
    <path
      d="M7 11V7a5 5 0 0110 0v4"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16" r="1.5" fill={c} />
  </svg>
);
const EyeIcon = ({ s = 20, c = C.green }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      stroke={c}
      strokeWidth="1.8"
    />
    <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8" />
  </svg>
);
const BanIcon = ({ s = 20, c = C.amber }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8" />
    <path
      d="M4.93 4.93l14.14 14.14"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);
const CheckMini = ({ c = C.cyan }: { c?: string }) => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 13l4 4L19 7"
      stroke={c}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const WarnIcon = ({ s = 18, c = C.amber }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L2 19h20L12 2z"
      stroke={c}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M12 9v5M12 16.5v.5"
      stroke={c}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: C.cyanDim,
        border: `1px solid ${C.borderC}`,
        borderRadius: 99,
        padding: "6px 16px",
        fontSize: 11,
        fontWeight: 700,
        color: C.cyan,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Tag({ label, color = C.cyan }: { label: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: `${color}15`,
        border: `1px solid ${color}35`,
        borderRadius: 6,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 700,
        color,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        fontFamily: "monospace",
      }}
    >
      {label}
    </span>
  );
}

function Card({
  children,
  accent = C.cyan,
  style = {},
}: {
  children: React.ReactNode;
  accent?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${accent}20`,
        borderRadius: 18,
        padding: "26px 22px",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg,transparent,${accent},transparent)`,
        }}
      />
      {children}
    </div>
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.45)",
        border: `1px solid rgba(155,89,245,0.2)`,
        borderRadius: 12,
        padding: "16px 18px",
        fontFamily: "'Fira Code','Courier New',monospace",
        fontSize: 12.5,
        lineHeight: 1.85,
        overflowX: "auto",
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <span
            style={{
              color: C.faint,
              userSelect: "none",
              minWidth: 18,
              fontSize: 10,
              paddingTop: 2,
            }}
          >
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: l }} />
        </div>
      ))}
    </div>
  );
}

function Callout({
  icon,
  label,
  body,
  accent = C.cyan,
}: {
  icon: React.ReactNode;
  label: string;
  body: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        background: `${accent}08`,
        border: `1px solid ${accent}28`,
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function CheckItem({
  title,
  desc,
  color = C.cyan,
}: {
  title: string;
  desc: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <CheckMini c={color} />
      </div>
      <div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: C.text,
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  n,
  title,
  desc,
  isLast,
}: {
  n: string;
  title: string;
  desc: string;
  isLast?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            flexShrink: 0,
            background: "linear-gradient(135deg,#7c3aed,#00e5cc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 14,
            color: "#fff",
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          {n}
        </div>
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 32,
              background:
                "linear-gradient(to bottom,rgba(124,58,237,0.4),transparent)",
              marginTop: 4,
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 26, paddingTop: 4 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: C.text,
            marginBottom: 4,
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  emoji,
  value,
  suffix = "",
  label,
  start,
  delay = 0,
}: {
  emoji: string;
  value: number | string;
  suffix?: string;
  label: string;
  start: boolean;
  delay?: number;
}) {
  const n = useCountUp(typeof value === "number" ? value : 0, 1600, start);
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.borderC}`,
        borderRadius: 16,
        padding: "26px 18px",
        textAlign: "center",
        transition: `opacity .6s ${delay}ms,transform .6s ${delay}ms`,
        opacity: start ? 1 : 0,
        transform: start ? "translateY(0)" : "translateY(18px)",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 8 }}>{emoji}</div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: C.cyan,
          fontFamily: "'Space Grotesk',sans-serif",
          letterSpacing: "-1px",
        }}
      >
        {typeof value === "number" ? n : value}
        {suffix}
      </div>
      <div
        style={{
          fontSize: 11,
          color: C.muted,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          marginTop: 6,
          fontFamily: "monospace",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProvablyFairPage() {
  const [heroRef, heroVis] = useInView(0.1);
  const [statsRef, statsVis] = useInView(0.2);
  const [rngRef, rngVis] = useInView(0.1);
  const [sessionRef, sessionVis] = useInView(0.1);
  const [fakeRef, fakeVis] = useInView(0.1);
  const [featRef, featVis] = useInView(0.1);
  const [verifyRef, verifyVis] = useInView(0.1);

  const S: React.CSSProperties = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "80px 24px",
  };
  const fv = (vis: boolean, d = 0): React.CSSProperties => ({
    transition: `opacity .7s ${d}ms,transform .7s ${d}ms`,
    opacity: vis ? 1 : 0,
    transform: vis ? "translateY(0)" : "translateY(24px)",
  });
  const hr: React.CSSProperties = {
    height: 1,
    background: `linear-gradient(90deg,transparent,${C.border},transparent)`,
    margin: "0 24px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter',system-ui,sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient bg */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-15%",
            left: "5%",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(0,229,204,0.055) 0%,transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "35%",
            right: "-8%",
            width: 550,
            height: 550,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(124,58,237,0.07) 0%,transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(0,229,204,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,204,0.022) 1px,transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ══ HERO ══ */}
      <div
        ref={heroRef}
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 860,
          margin: "0 auto",
          padding: "110px 24px 70px",
          textAlign: "center",
        }}
      >
        <div style={fv(heroVis)}>
          <div style={{ marginBottom: 28 }}>
            <Pill>
              <ShieldIcon s={15} /> Provably Fair
            </Pill>
          </div>
          <h1
            style={{
              fontSize: "clamp(38px,6.5vw,70px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk',sans-serif",
              letterSpacing: "-1.5px",
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            Every outcome.{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg,#00e5cc 0%,#9b59f5 50%,#f472b6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Verifiable on-chain.
            </span>
          </h1>
          <p
            style={{
              fontSize: 17,
              color: C.muted,
              lineHeight: 1.75,
              maxWidth: 620,
              margin: "0 auto 44px",
            }}
          >
            Oni Games doesn&apos;t ask you to trust us. Every wager, payout, and
            score is governed by open smart contracts on OneChain — not our
            servers.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="https://onescan.cc/testnet"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg,#00c4ae,#00e5cc)",
                color: "#061a18",
                borderRadius: 12,
                padding: "13px 28px",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
                boxShadow: "0 0 32px rgba(0,229,204,0.28)",
              }}
            >
              <ChainIcon s={17} c="#061a18" /> View Contracts
            </a>
            <a
              href="#verify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${C.border}`,
                color: C.text,
                borderRadius: 12,
                padding: "13px 28px",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              How to Verify ↓
            </a>
            <a
              href="https://docs.google.com/document/d/1Kd4wXG72WtT0QA0aFTY_CHZRu7TiCgqn/edit?usp=sharing&ouid=116479139271503954993&rtpof=true&sd=true"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background:
                  "linear-gradient(135deg,rgba(155,89,245,0.15),rgba(155,89,245,0.05))",
                border: `1px solid rgba(155,89,245,0.3)`,
                color: "#c4a6ff",
                borderRadius: 12,
                padding: "13px 28px",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              📄 Whitepaper ↗
            </a>
          </div>
        </div>
      </div>

      {/* ══ STATS ══ */}
      <div
        ref={statsRef}
        style={{ ...S, paddingTop: 0, position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 14,
          }}
        >
          <StatCard
            emoji="⚡"
            value={100}
            suffix="%"
            label="On-Chain Logic"
            start={statsVis}
            delay={0}
          />
          <StatCard
            emoji="🎲"
            value={0}
            suffix=" servers"
            label="RNG Control"
            start={statsVis}
            delay={80}
          />
          <StatCard
            emoji="🔒"
            value={0}
            suffix=" hidden fees"
            label="Transparency"
            start={statsVis}
            delay={160}
          />
          <StatCard
            emoji="🔗"
            value={"∞"}
            label="Audit History"
            start={statsVis}
            delay={240}
          />
        </div>
      </div>

      <div style={hr} />

      {/* ══ RNG ══ */}
      <div ref={rngRef} style={{ ...S, position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div style={fv(rngVis)}>
            <div style={{ marginBottom: 18 }}>
              <Pill>
                <DiceIcon s={14} /> Randomness
              </Pill>
            </div>
            <h2
              style={{
                fontSize: "clamp(26px,3.5vw,38px)",
                fontWeight: 800,
                fontFamily: "'Space Grotesk',sans-serif",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              We don&apos;t control
              <br />
              the dice roll.
            </h2>
            <p
              style={{
                fontSize: 14.5,
                color: C.muted,
                lineHeight: 1.75,
                marginBottom: 26,
              }}
            >
              Instant games use OneChain&apos;s native{" "}
              <code
                style={{
                  color: C.cyan,
                  background: C.cyanDim,
                  padding: "1px 6px",
                  borderRadius: 3,
                }}
              >
                one::random
              </code>{" "}
              module — a core blockchain primitive outside Oni Games&apos;
              control. We cannot influence, predict, or change any result.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 13,
                marginBottom: 24,
              }}
            >
              <CheckItem
                title="Seeded from on-chain context"
                desc="Block hash, epoch data, and transaction digest seed every RNG call — determined by the network, not Oni Games."
              />
              <CheckItem
                title="Generated after wager is locked"
                desc="The outcome is computed after your bet is committed. Nobody knows the result in advance."
              />
              <CheckItem
                title="Validator manipulation is impossible"
                desc="Unlike older chains, OneChain's RNG is generated alongside consensus — validators cannot withhold blocks to influence results."
              />
            </div>
            <Callout
              icon={<WarnIcon />}
              accent={C.amber}
              label="PTB Rollback Protection"
              body={
                <>
                  All instant-play functions use the{" "}
                  <code
                    style={{
                      color: C.purple,
                      background: C.purpleDim,
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    entry
                  </code>{" "}
                  keyword — not{" "}
                  <code
                    style={{
                      color: C.purple,
                      background: C.purpleDim,
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    public
                  </code>
                  . This prevents composing them in a Programmable Transaction
                  Block, completely blocking the rollback exploit where a player
                  sees the result and aborts if they lose.
                </>
              }
            />
          </div>
          <div style={fv(rngVis, 150)}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Tag label="oni_games::casino" color={C.purple} />
              <span
                style={{
                  fontSize: 10.5,
                  color: C.faint,
                  fontFamily: "monospace",
                }}
              >
                play_instant_wager()
              </span>
            </div>
            <CodeBlock
              lines={[
                `<span style="color:#7c3aed">entry fun</span> <span style="color:#00e5cc">play_instant_wager</span>(`,
                `  bankroll: <span style="color:#a78bfa">&mut HouseBankroll</span>,`,
                `  rng: <span style="color:#a78bfa">&Random</span>,`,
                `  wager: <span style="color:#a78bfa">Coin&lt;OCT&gt;</span>,`,
                `  guess: <span style="color:#fbbf24">u64</span>, game_range: <span style="color:#fbbf24">u64</span>,`,
                `  multiplier_bps: <span style="color:#fbbf24">u64</span>,`,
                `) {`,
                `  <span style="color:#4a5568">// OneChain native RNG — not our server</span>`,
                `  <span style="color:#7c3aed">let mut</span> generator =`,
                `    random::<span style="color:#00e5cc">new_generator</span>(rng, ctx);`,
                ``,
                `  <span style="color:#7c3aed">let</span> result =`,
                `    random::<span style="color:#00e5cc">generate_u64_in_range</span>(`,
                `      &mut generator, <span style="color:#fbbf24">0</span>, game_range - <span style="color:#fbbf24">1</span>`,
                `    );`,
                ``,
                `  <span style="color:#7c3aed">let</span> won = (result == guess);`,
                `  <span style="color:#4a5568">// win/loss handled transparently below...</span>`,
                `}`,
              ]}
            />
            <div
              style={{
                marginTop: 12,
                padding: "13px 15px",
                background: C.cyanDim,
                border: `1px solid ${C.borderC}`,
                borderRadius: 10,
                fontSize: 13,
                color: C.muted,
              }}
            >
              💡{" "}
              <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                The <code style={{ color: C.cyan }}>entry</code> keyword
              </strong>{" "}
              makes this the terminal step of any transaction — a player cannot
              inspect the result and abort.
            </div>
          </div>
        </div>
      </div>

      <div style={hr} />

      {/* ══ SESSION GAMES ══ */}
      <div ref={sessionRef} style={{ ...S, position: "relative", zIndex: 1 }}>
        <div
          style={{ textAlign: "center", marginBottom: 50, ...fv(sessionVis) }}
        >
          <div style={{ marginBottom: 18 }}>
            <Pill>
              <LockIcon s={14} /> Session Games
            </Pill>
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,40px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk',sans-serif",
              letterSpacing: "-0.5px",
              marginBottom: 14,
            }}
          >
            Two-step escrow.
            <br />
            Zero trust required.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: C.muted,
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            Crash, Minesweeper, and High-Low use a cryptographically secure
            escrow model — funds are locked on-chain before you play a single
            move.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 44,
            alignItems: "start",
          }}
        >
          <div style={fv(sessionVis, 100)}>
            <Card style={{ padding: "26px 22px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.faint,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 22,
                }}
              >
                Game Flow
              </div>
              <FlowStep
                n="1"
                title="lock_wager() on-chain"
                desc="Your wager is deposited into HouseBankroll immediately. A SessionReceipt NFT proves your bet exists — it cannot be backdated or forged."
              />
              <FlowStep
                n="2"
                title="Play the game"
                desc="You play Crash, Minesweeper, or High-Low in the frontend. The backend tracks session state."
              />
              <FlowStep
                n="3"
                title="Backend signs the outcome"
                desc="The server calculates your multiplier and signs a tamper-evident payload with its Ed25519 private key."
              />
              <FlowStep
                n="4"
                title="resolve_session() verifies on-chain"
                desc="The contract verifies the Ed25519 signature before releasing any payout. Invalid signature = transaction aborted."
                isLast
              />
            </Card>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              ...fv(sessionVis, 200),
            }}
          >
            <Tag label="Signed Message Payload" color={C.pink} />
            <CodeBlock
              lines={[
                `<span style="color:#4a5568">// BCS payload the server signs</span>`,
                `<span style="color:#7c3aed">let mut</span> msg = vector::<span style="color:#00e5cc">empty</span>&lt;u8&gt;();`,
                ``,
                `vector::<span style="color:#00e5cc">append</span>(&mut msg,`,
                `  bcs::<span style="color:#00e5cc">to_bytes</span>(&session_id));   <span style="color:#4a5568">// unique ID</span>`,
                `vector::<span style="color:#00e5cc">append</span>(&mut msg,`,
                `  bcs::<span style="color:#00e5cc">to_bytes</span>(&player));      <span style="color:#4a5568">// wallet locked</span>`,
                `vector::<span style="color:#00e5cc">append</span>(&mut msg,`,
                `  bcs::<span style="color:#00e5cc">to_bytes</span>(&multiplier_bps)); <span style="color:#4a5568">// outcome</span>`,
                `vector::<span style="color:#00e5cc">append</span>(&mut msg,`,
                `  bcs::<span style="color:#00e5cc">to_bytes</span>(&nonce));       <span style="color:#4a5568">// single-use</span>`,
                ``,
                `<span style="color:#7c3aed">assert!</span>(ed25519::<span style="color:#00e5cc">ed25519_verify</span>(`,
                `  &signature, &server_key, &msg`,
                `), <span style="color:#fbbf24">E_INVALID_SIGNATURE</span>);`,
              ]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  k: "session_id",
                  d: "Unique per game — the server can't reuse a winning resolution",
                  c: C.cyan,
                },
                {
                  k: "player",
                  d: "Your wallet is encoded — nobody can redirect your payout",
                  c: C.purple,
                },
                {
                  k: "multiplier_bps",
                  d: "The exact outcome in BPS — cannot be swapped after signing",
                  c: C.pink,
                },
                {
                  k: "nonce",
                  d: "Single-use, tracked on-chain forever — replay is impossible",
                  c: C.amber,
                },
              ].map(({ k, d, c }) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    background: C.bgCard2,
                    border: `1px solid ${c}18`,
                    borderRadius: 10,
                  }}
                >
                  <Tag label={k} color={c} />
                  <span
                    style={{
                      fontSize: 12,
                      color: C.muted,
                      lineHeight: 1.55,
                      paddingTop: 2,
                    }}
                  >
                    {d}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={hr} />

      {/* ══ ANTI-FAKE MINT ══ */}
      <div ref={fakeRef} style={{ ...S, position: "relative", zIndex: 1 }}>
        <div style={fv(fakeVis)}>
          <div style={{ marginBottom: 18 }}>
            <Pill>
              <BanIcon s={14} c={C.amber} /> Anti-Cheat
            </Pill>
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,40px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk',sans-serif",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              marginBottom: 10,
            }}
          >
            Can someone call the mint function directly
            <br />
            <span
              style={{
                background: `linear-gradient(90deg,${C.amber},${C.pink})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              and fake a score?
            </span>
          </h2>
          <p
            style={{
              fontSize: 14.5,
              color: C.muted,
              marginBottom: 40,
              maxWidth: 620,
            }}
          >
            This is the #1 question skeptics raise — and the answer is solid.
            Here&apos;s exactly why direct contract calls cannot produce fake
            NFTs.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 44,
            alignItems: "start",
          }}
        >
          {/* Left — gates */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              ...fv(fakeVis, 100),
            }}
          >
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75 }}>
              <strong style={{ color: C.text }}>Short answer: No.</strong> The
              function{" "}
              <code
                style={{
                  color: C.purple,
                  background: C.purpleDim,
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                mint_verified_score
              </code>{" "}
              is{" "}
              <code
                style={{
                  color: C.purple,
                  background: C.purpleDim,
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                public
              </code>{" "}
              — anyone can call it directly from any wallet or script. But it
              immediately demands a valid Ed25519 signature from the
              server&apos;s private key. Without it, the transaction aborts.
              Full stop.
            </p>

            <Card accent={C.cyan}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.cyan,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Gate 1 — Cryptographic (mint_verified_score)
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 11 }}
              >
                <CheckItem
                  color={C.cyan}
                  title="Server private key required"
                  desc="Forging a valid Ed25519 signature without the private key is computationally infeasible. The key never touches the frontend."
                />
                <CheckItem
                  color={C.cyan}
                  title="Intercepted signatures can't be replayed"
                  desc="Your wallet address is encoded in the signed payload. A signature issued for Wallet A fails when submitted from Wallet B — the message won't match."
                />
                <CheckItem
                  color={C.cyan}
                  title="Score is baked into the signature"
                  desc="A signature for a 5,000-point Tetris score cannot mint a 5,000,000-point score or a score in any other game."
                />
                <CheckItem
                  color={C.cyan}
                  title="Every nonce is single-use"
                  desc="Nonces are permanently recorded in the used_nonces table on-chain. Even a valid captured signature is rejected on resubmission."
                />
              </div>
            </Card>

            <Card accent={C.purple}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.purple,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Gate 2 — Object Capability (admin_mint_score_nft)
              </div>
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7 }}>
                The admin minting path requires passing a reference to the{" "}
                <code
                  style={{
                    color: C.purple,
                    background: C.purpleDim,
                    padding: "1px 5px",
                    borderRadius: 3,
                  }}
                >
                  AdminCap
                </code>{" "}
                object — a unique on-chain object held exclusively by the Oni
                Games deployer wallet. Move&apos;s object model makes it
                impossible to spoof or borrow from another account. Non-admins
                are rejected at the VM level, before any contract logic
                executes.
              </p>
            </Card>

            <Callout
              icon={<BanIcon s={18} c={C.amber} />}
              accent={C.amber}
              label="Cannot Fake"
              body="Minting a fake score requires either breaking Ed25519 cryptography or stealing the Oni Games server private key. Neither is achievable through any smart contract interaction."
            />
          </div>

          {/* Right — code + attack table */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              ...fv(fakeVis, 200),
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Tag label="mint_verified_score" color={C.amber} />
              <span
                style={{
                  fontSize: 10.5,
                  color: C.faint,
                  fontFamily: "monospace",
                }}
              >
                public fun
              </span>
            </div>
            <CodeBlock
              lines={[
                `<span style="color:#7c3aed">public fun</span> <span style="color:#00e5cc">mint_verified_score</span>(`,
                `  store: <span style="color:#a78bfa">&mut GameStore</span>,`,
                `  game_id: <span style="color:#a78bfa">String</span>, score: <span style="color:#fbbf24">u64</span>,`,
                `  nonce: <span style="color:#fbbf24">u64</span>, signature: <span style="color:#a78bfa">vector&lt;u8&gt;</span>,`,
                `  ctx: <span style="color:#a78bfa">&mut TxContext</span>,`,
                `) {`,
                `  <span style="color:#4a5568">// ① Server key must be set</span>`,
                `  <span style="color:#7c3aed">assert!</span>(vector::<span style="color:#00e5cc">length</span>(`,
                `    &store.server_public_key) == <span style="color:#fbbf24">32</span>,`,
                `    <span style="color:#fbbf24">E_SERVER_KEY_NOT_SET</span>);`,
                ``,
                `  <span style="color:#4a5568">// ② Nonce must be unused</span>`,
                `  <span style="color:#7c3aed">assert!</span>(!table::<span style="color:#00e5cc">contains</span>(`,
                `    &store.used_nonces, nonce),`,
                `    <span style="color:#fbbf24">E_NONCE_ALREADY_USED</span>);`,
                ``,
                `  <span style="color:#4a5568">// ③ Ed25519 — no bypass exists</span>`,
                `  <span style="color:#7c3aed">assert!</span>(ed25519::<span style="color:#00e5cc">ed25519_verify</span>(`,
                `    &signature,`,
                `    &store.server_public_key,`,
                `    &msg  <span style="color:#4a5568">// player|game|score|nonce</span>`,
                `  ), <span style="color:#fbbf24">E_INVALID_SIGNATURE</span>);`,
                ``,
                `  <span style="color:#4a5568">// Only THEN: mint the NFT ✓</span>`,
                `}`,
              ]}
            />

            {/* Attack scenario table */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.faint,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "monospace",
                  marginBottom: 10,
                }}
              >
                What happens if you try to cheat?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  {
                    a: "Submit a fake signature",
                    r: "E_INVALID_SIGNATURE",
                    c: C.pink,
                  },
                  {
                    a: "Replay another player's signature",
                    r: "Address mismatch → abort",
                    c: C.pink,
                  },
                  {
                    a: "Reuse a valid signature",
                    r: "E_NONCE_ALREADY_USED",
                    c: C.amber,
                  },
                  {
                    a: "Change score in the payload",
                    r: "Signature invalid → abort",
                    c: C.pink,
                  },
                  {
                    a: "Call admin_mint without AdminCap",
                    r: "Move VM rejects — not owned",
                    c: C.purple,
                  },
                ].map(({ a, r, c }) => (
                  <div
                    key={a}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      padding: "9px 12px",
                      background: C.bgCard2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.muted }}>🔴 {a}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: c,
                        fontFamily: "monospace",
                      }}
                    >
                      → {r}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={hr} />

      {/* ══ FEATURES ══ */}
      <div ref={featRef} style={{ ...S, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 48, ...fv(featVis) }}>
          <div style={{ marginBottom: 18 }}>
            <Pill>
              <EyeIcon s={14} /> Full Transparency
            </Pill>
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,40px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk',sans-serif",
              letterSpacing: "-0.5px",
            }}
          >
            Nothing is hidden.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 14,
          }}
        >
          {[
            {
              icon: <DiceIcon s={22} />,
              title: "House Edge is Public",
              accent: C.purple,
              body: "The multiplier_bps on every game encodes the house edge directly. A coin flip paying 1.96x (19,600 bps) instead of 2.0x represents 2% — both are publicly readable on-chain, always.",
            },
            {
              icon: <ShieldIcon s={22} />,
              title: "Payout Caps Enforced On-Chain",
              accent: C.cyan,
              body: "No single payout can exceed 5% of the total bankroll. This is enforced by the smart contract before every bet — not a policy document that can be quietly changed.",
            },
            {
              icon: <EyeIcon s={22} />,
              title: "Leaderboards Can't Be Edited",
              accent: C.green,
              body: "Score rankings live inside the GameStore contract and are updated automatically on every mint. Our team has no function to manually alter, delete, or reorder any entry.",
            },
            {
              icon: <LockIcon s={22} />,
              title: "Replay Attacks Are Impossible",
              accent: C.pink,
              body: "Every session nonce is permanently stored in the used_nonces table on-chain. A valid signature resubmitted after its first use is always rejected — no exceptions, no backdoors.",
            },
            {
              icon: <ChainIcon s={22} />,
              title: "Full Audit Trail",
              accent: C.amber,
              body: "Every game emits an on-chain event with your address, guess, random result, and payout. Events are permanent and immutable — verify your entire history on any blockchain explorer.",
            },
            {
              icon: <BanIcon s={22} c="#fb923c" />,
              title: "Admin Power Has Hard Limits",
              accent: "#fb923c",
              body: "Admins can adjust bet limits and fees. They cannot alter any outcome, redirect any payout, or modify event history. Every admin action is a signed transaction — permanently attributable.",
            },
          ].map(({ icon, title, accent, body }, i) => (
            <div key={title} style={fv(featVis, i * 70)}>
              <Card accent={accent} style={{ height: "100%" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    background: `${accent}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {icon}
                </div>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                    fontFamily: "'Space Grotesk',sans-serif",
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                  {body}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <div style={hr} />

      {/* ══ VERIFY ══ */}
      <div
        id="verify"
        ref={verifyRef}
        style={{ ...S, position: "relative", zIndex: 1 }}
      >
        <div
          style={{ textAlign: "center", marginBottom: 48, ...fv(verifyVis) }}
        >
          <div style={{ marginBottom: 18 }}>
            <Pill>🔍 Verify Yourself</Pill>
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,40px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk',sans-serif",
              letterSpacing: "-0.5px",
              marginBottom: 14,
            }}
          >
            Don&apos;t trust. Verify.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: C.muted,
              lineHeight: 1.7,
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            Everything on this page is publicly checkable on-chain. No account,
            API key, or special access required.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 12,
          }}
        >
          {[
            {
              n: "01",
              title: "Read the contracts",
              color: C.cyan,
              desc: "Look up the oni_games package on the OneChain explorer. View full source of both modules — casino and game_portal.",
            },
            {
              n: "02",
              title: "Check bankroll status",
              color: C.purple,
              desc: "Look up the HouseBankroll shared object. Read balance, bet limits, payout cap, and lifetime stats — all public fields.",
            },
            {
              n: "03",
              title: "Verify your game history",
              color: C.green,
              desc: "Query InstantWagerPlayed and SessionResolved events filtered by your wallet. Every result is permanently on-chain.",
            },
            {
              n: "04",
              title: "Inspect leaderboards",
              color: C.amber,
              desc: "Look up the GameStore object and inspect the leaderboards table for any game_id. The ranking logic is in the contract.",
            },
          ].map(({ n, title, color, desc }, i) => (
            <div key={n} style={fv(verifyVis, i * 80)}>
              <Card accent={color} style={{ height: "100%" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color,
                    fontFamily: "monospace",
                    marginBottom: 10,
                    opacity: 0.6,
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                    fontFamily: "'Space Grotesk',sans-serif",
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
                  {desc}
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div
          style={{ marginTop: 40, textAlign: "center", ...fv(verifyVis, 360) }}
        >
          <a
            href="https://onescan.cc/testnet"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: `linear-gradient(135deg,rgba(0,229,204,0.1),rgba(124,58,237,0.1))`,
              border: `1px solid ${C.borderC}`,
              color: C.cyan,
              borderRadius: 12,
              padding: "14px 32px",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            <ChainIcon s={18} /> Open OneChain Explorer
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "26px 24px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 13, color: C.faint }}>
          Oni Games · Transparency &amp; Provably Fair · Built on OneChain
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 768px) {
          [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
