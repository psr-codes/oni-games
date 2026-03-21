"use client";

import { useState } from "react";

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
  border: "rgba(255,255,255,0.08)",
  borderC: "rgba(0,229,204,0.18)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.15)",
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const EmailIcon = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="3" stroke={C.cyan} strokeWidth="1.8" />
    <path d="M2 7l10 7 10-7" stroke={C.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TelegramIcon = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M21.8 3.2L2.5 10.8c-1.3.5-1.3 1.3-.2 1.6l4.8 1.5 1.8 5.6c.2.7.4.9 1 .9.4 0 .7-.2 1-.5l2.5-2.4 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.1c.4-1.6-.6-2.3-1.5-2z" stroke="#2AABEE" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9.1 13.9l-.3 4c.4 0 .6-.2.8-.4l2-1.9" stroke="#2AABEE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DiscordIcon = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M20.3 4.4A19.3 19.3 0 0015.5 3c-.2.4-.5.9-.7 1.3a17.9 17.9 0 00-5.5 0C9.1 3.9 8.8 3.4 8.5 3A19.4 19.4 0 003.7 4.4C.5 9.3-.3 14 .1 18.6a19.5 19.5 0 005.9 3c.5-.7.9-1.4 1.3-2.1-.7-.3-1.4-.6-2-.9l.5-.4a13.9 13.9 0 0012.4 0l.5.4c-.7.3-1.4.7-2 .9.4.8.8 1.5 1.3 2.1a19.4 19.4 0 005.9-3c.5-5.2-.8-9.8-3.5-13.6zM8.7 15.9c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4zm6.6 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4z" fill="#5865F2" />
  </svg>
);
const TwitterIcon = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M3 5h4l3.5 5L14 5h4L13 12l5 7h-4l-3.5-5L7 19H3l5.5-7L3 5z" fill="#1DA1F2" />
  </svg>
);
const OniIcon = () => (
  <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill="url(#og)" />
    <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8z" fill="white" fillOpacity=".15" />
    <path d="M16 18c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v3c0 2.2-1.8 4-4 4s-4-1.8-4-4v-3z" fill="white" />
    <circle cx="17.5" cy="14" r="1.5" fill="white" />
    <circle cx="22.5" cy="14" r="1.5" fill="white" />
    <defs>
      <linearGradient id="og" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00e5cc" />
        <stop offset="1" stopColor="#9b59f5" />
      </linearGradient>
    </defs>
  </svg>
);

// ─── Contact card ─────────────────────────────────────────────────────────────
function ContactCard({
  icon,
  platform,
  handle,
  href,
  accent,
  desc,
  index,
}: {
  icon: React.ReactNode;
  platform: string;
  handle: string;
  href: string;
  accent: string;
  desc: string;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        textDecoration: "none",
        background: hovered ? `${accent}08` : C.bgCard,
        border: `1px solid ${hovered ? accent + "40" : accent + "18"}`,
        borderRadius: 20,
        padding: "28px 26px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? `0 16px 40px ${accent}15` : "none",
        animationDelay: `${index * 100}ms`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.25s",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            flexShrink: 0,
            background: `${accent}15`,
            border: `1px solid ${accent}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: hovered ? "scale(1.08)" : "scale(1)",
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontFamily: "monospace",
              marginBottom: 4,
            }}
          >
            {platform}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.3px",
              marginBottom: 6,
              wordBreak: "break-all",
            }}
          >
            {handle}
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {desc}
          </div>
        </div>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            background: `${accent}12`,
            border: `1px solid ${accent}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s, background 0.2s",
            transform: hovered ? "translate(2px, -2px)" : "translate(0,0)",
            marginTop: 2,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path
              d="M7 17L17 7M17 7H7M17 7v10"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </a>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText("Prakash.rawat.dev@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contacts = [
    {
      icon: <EmailIcon s={24} />,
      platform: "Email",
      handle: "Prakash.rawat.dev@gmail.com",
      href: "mailto:Prakash.rawat.dev@gmail.com",
      accent: C.cyan,
      desc: "Best for detailed questions, partnership proposals, or bug reports.",
    },
    {
      icon: <TelegramIcon s={24} />,
      platform: "Telegram",
      handle: "@kalki2991",
      href: "https://t.me/kalki2991",
      accent: "#2AABEE",
      desc: "Fastest response. DM for quick questions or real-time support.",
    },
    {
      icon: <DiscordIcon s={24} />,
      platform: "Discord",
      handle: "kalki299",
      href: "https://discord.com/users/kalki299",
      accent: "#5865F2",
      desc: "Find me in the Oni Games community server or send a direct message.",
    },
    {
      icon: <TwitterIcon s={24} />,
      platform: "Twitter / X",
      handle: "@psr2991",
      href: "https://twitter.com/psr2991",
      accent: "#1DA1F2",
      desc: "Follow for project updates, announcements, and Web3 thoughts.",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient bg ── */}
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
            top: "-10%",
            left: "-5%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,229,204,0.06) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "-5%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(155,89,245,0.07) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(0,229,204,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,204,0.022) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ── Page content ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 760,
          margin: "0 auto",
          padding: "100px 24px 80px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: C.cyanDim,
              border: `1px solid ${C.borderC}`,
              borderRadius: 99,
              padding: "8px 18px 8px 12px",
              marginBottom: 32,
            }}
          >
            <OniIcon />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.cyan,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Oni Games
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(40px, 7vw, 68px)",
              fontWeight: 800,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-2px",
              lineHeight: 1.05,
              marginBottom: 20,
            }}
          >
            Let&apos;s{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, #00e5cc 0%, #9b59f5 50%, #f472b6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              connect.
            </span>
          </h1>

          <p
            style={{
              fontSize: 17,
              color: C.muted,
              lineHeight: 1.75,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            Whether you&apos;re a player, builder, or partner — reach out on
            whatever platform works best for you.
          </p>
        </div>

        {/* Contact cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 40,
          }}
        >
          {contacts.map((c, i) => (
            <ContactCard key={c.platform} {...c} index={i} />
          ))}
        </div>

        {/* Email copy shortcut */}
        <div
          style={{
            background: C.bgCard2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: C.cyan,
                boxShadow: `0 0 8px ${C.cyan}`,
              }}
            />
            <span style={{ fontSize: 13, color: C.muted }}>
              Or copy the email directly:
            </span>
            <code
              style={{
                fontSize: 13,
                color: C.cyan,
                background: C.cyanDim,
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              Prakash.rawat.dev@gmail.com
            </code>
          </div>
          <button
            onClick={copyEmail}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: copied ? "rgba(0,229,204,0.15)" : C.bgCard,
              border: `1px solid ${copied ? C.cyan + "60" : C.border}`,
              color: copied ? C.cyan : C.muted,
              borderRadius: 9,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {copied ? (
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke={C.cyan}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                Copied!
              </>
            ) : (
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>{" "}
                Copy
              </>
            )}
          </button>
        </div>

        {/* Bottom note */}
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: C.faint,
            marginTop: 48,
            lineHeight: 1.6,
          }}
        >
          Building on OneChain · Oni Games © 2025
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 600px) {
          [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
