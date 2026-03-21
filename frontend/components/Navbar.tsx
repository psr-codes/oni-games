"use client";

import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAdmin, isConnected } = useAdmin();
  const account = useCurrentAccount();

  const navLinks = [
    { name: "Play", href: "/games", icon: "🎮" },
    { name: "Casino", href: "/casino", icon: "🎰" },
    { name: "Marketplace", href: "/marketplace", icon: "🛒" },
    { name: "Leaderboard", href: "/leaderboard", icon: "🏆" },
    ...(isConnected
      ? [
          { name: "My NFTs", href: "/my-nfts", icon: "🖼️" },
          { name: "Profile", href: "/profile", icon: "👤" },
        ]
      : []),
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-[#111a2e]/90 backdrop-blur-xl border-b border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
            楽
          </div>
          <span className="text-lg font-bold text-slate-50 tracking-tight">
            <span className="text-cyan-400">Oni</span>Games
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive(link.href)
                    ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* Admin Link */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive("/admin")
                    ? "text-amber-400 bg-amber-500/10 border border-amber-400/20"
                    : "text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Admin
              </Link>
            )}
          </div>

          <div className="pl-4 border-l border-slate-700/40">
            <ConnectButton className="cursor-pointer" />
          </div>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <div className="scale-90">
            <ConnectButton className="cursor-pointer" />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-slate-100"
          >
            {isMobileMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#111a2e]/95 backdrop-blur-xl border-b border-slate-700/30 absolute w-full left-0 top-16 shadow-2xl">
          <div className="px-6 py-5 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-base font-medium transition-all ${
                  isActive(link.href)
                    ? "text-cyan-400 bg-cyan-400/10"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="mr-2">{link.icon}</span>
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-base font-medium ${
                  isActive("/admin")
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-amber-400/70 hover:text-amber-400"
                }`}
              >
                🛡️ Admin Panel
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
