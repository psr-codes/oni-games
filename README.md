# 👺 OniGames - Web3 Arcade & GambleFi on OneChain

**OniGames** is a decentralized arcade and casino platform built on the **OneChain** network. Play retro-style minigames, compete for high scores, mint your best runs as exclusive NFTs, and trade them on our on-chain marketplace. Feeling lucky? Try out our provably fair casino games!

## 🌟 Features

### 🎮 Arcade Games

A collection of classic games where skill pays off. Score high and mint your achievements as verifiable NFTs on OneChain!

- **Poly Dash**
- **Tetris**
- **Space Invaders**
- **Neon Snake**
- **2048**
- **Bubble Pop**, **Tower Bloxx**, **Doodle Jump**, and more!

### 🎰 Casino (GambleFi)

Test your luck with our on-chain casino games featuring a **Provably Fair** system.

- **Coin Flip**
- **Hash Roulette**
- **Dice Roll**
- **Crypto Crash**
- **Treasure Hunt**

### 🛒 NFT Marketplace & Trophy Room

- **Mint & Collect:** Turn your highest arcade scores into permanent NFTs.
- **Trophy Room (Profile):** A unified dashboard to view, send, list, and delist your owned NFTs.
- **Marketplace:** Buy and sell player-minted score NFTs. Accurate ownership tracking ensures your assets are secure.

---

## 🏗️ Technology Stack

- **Frontend:** Next.js, React, Tailwind CSS, TypeScript
- **Web3 Integration:** `@mysten/dapp-kit`, `@mysten/sui/transactions`
- **Smart Contracts:** Move (deployed on OneChain)
- **Deployment:** Vercel

---

## 🌐 OneChain Details

OniGames is proudly built on **OneChain** (Testnet).

- **Network:** OneChain Testnet
- **RPC URL:** `https://rpc-testnet.onelabs.cc:443`
- **Explorer:** [OneScan](https://onescan.cc/testnet)
- **Developer Docs:** [OneLabs Development](https://docs.onelabs.cc/DevelopmentDocument)
- **Coin Type:** `0x2::oct::OCT`

### Smart Contracts (Testnet)

- **Game Portal:** https://onescan.cc/testnet/objectDetails?address=0x9648be59effa27966ee8cc0a531cdefac977bb6444dcf5df96c37304eefa46b3
- **House Bankroll:** https://onescan.cc/testnet/objectDetails?address=0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js (v18+)
- npm or yarn
- A OneChain compatible wallet (e.g., Nightly, Surf) set to the **OneChain Testnet**.

### Installation

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd oni-games/frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the frontend directory with the following variables:
   _(Note: The `ADMIN_PRIVATE_KEY` is required on the server side to sign game scores so users can mint them. Do not expose this to the client!)_

   ```env
   NEXT_PUBLIC_PACKAGE_ID=0x9648be59effa27966ee8cc0a531cdefac977bb6444dcf5df96c37304eefa46b3
   NEXT_PUBLIC_GAME_STORE_ID=0x01ab2998fc05734282f9fdb99a6d3e083a3c17d0389bb12694f9d585dcae2965
   NEXT_PUBLIC_ADMIN_CAP_ID=0x62e15e10b85ec01000f0d23b072f49fa8c23d20edc4f7c3da42983f04015b910
   NEXT_PUBLIC_ADMIN_ADDRESS=0x6aab5af269952885e12db557a7e7b3b808476ea3aeb6986ca0fb5b2251d41e17
   NEXT_PUBLIC_RPC_URL=https://rpc-testnet.onelabs.cc:443
   NEXT_PUBLIC_MODULE=game_portal
   NEXT_PUBLIC_COIN_TYPE=0x2::oct::OCT

   # Casino module
   NEXT_PUBLIC_CASINO_MODULE=casino
   NEXT_PUBLIC_HOUSE_BANKROLL_ID=0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037
   NEXT_PUBLIC_CASINO_ADMIN_CAP_ID=0x05981e384bdddeed41f200dd451c6c18fcc9373b0eb748d255ca0c811ccfff83

   # Server-side signing key
   ADMIN_PRIVATE_KEY=your_private_key_here
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 📬 Contact & Support

Whether you're a player, builder, or partner, feel free to reach out to the creator:

- **Email:** [Prakash.rawat.dev@gmail.com](mailto:Prakash.rawat.dev@gmail.com) -> _Best for detailed questions, partnership proposals, or bug reports._
- **Telegram:** [@kalki2991](https://t.me/kalki2991) -> _Fastest response. DM for quick questions or real-time support._
- **Discord:** `kalki299` ([Add Friend](https://discord.com/users/kalki299)) -> _Find me in the Oni Games community server._
- **Twitter / X:** [@psr2991](https://twitter.com/psr2991) -> _Follow for project updates and Web3 thoughts._

---

_Building on OneChain · Oni Games © 2026_
