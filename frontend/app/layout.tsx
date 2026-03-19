import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oni Games — Web3 Arcade Portal",
  description:
    "Play retro arcade games, earn Score NFTs, and compete on-chain leaderboards. Built on OneChain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.className} bg-[#111a2e] text-slate-50 min-h-screen flex flex-col`}
      >
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
