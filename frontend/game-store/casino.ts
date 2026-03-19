import { GAME_IMAGES } from "./images";

export interface CasinoGame {
  slug: string;
  name: string;
  emoji: string;
  image?: string;
  color: string;
  description: string;
  multiplier: string;
  type: string;
  live: boolean;
}

export const CASINO_GAMES: CasinoGame[] = [
  {
    slug: "coin-flip",
    name: "Coin Flip",
    emoji: "🪙",
    image: GAME_IMAGES["coin-flip"],
    color: "from-amber-400 to-yellow-600",
    description: "Pick heads or tails. Win 1.96× your bet. Instant on-chain result.",
    multiplier: "1.96×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "hash-roulette",
    name: "Hash Roulette",
    emoji: "🔮",
    image: GAME_IMAGES["hash-roulette"],
    color: "from-violet-500 to-indigo-700",
    description: "Guess the last hex digit(s) of the hash. Up to 4014× payout.",
    multiplier: "Up to 4014×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "dice-roll",
    name: "Dice Roll",
    emoji: "🎲",
    image: GAME_IMAGES["dice-roll"],
    color: "from-cyan-400 to-teal-600",
    description: "Set your threshold. Roll over or under. You control the odds.",
    multiplier: "Up to 97×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "color-prediction",
    name: "Color Prediction",
    emoji: "🎨",
    image: GAME_IMAGES["color-prediction"],
    color: "from-pink-500 to-purple-700",
    description: "Pick Red, Green, or Violet. Simple bets, big payouts on Violet.",
    multiplier: "Up to 9.8×",
    type: "Instant Play",
    live: true,
  },
  {
    slug: "roulette",
    name: "Roulette",
    emoji: "🎡",
    color: "from-red-500 to-rose-700",
    description: "Place your bets on red, black, or a number. Classic casino action.",
    multiplier: "Up to 36×",
    type: "Instant Play",
    live: false,
  },
  {
    slug: "wheel-of-fortune",
    name: "Wheel of Fortune",
    emoji: "🎡",
    image: GAME_IMAGES["wheel-of-fortune"],
    color: "from-amber-500 to-orange-600",
    description: "Spin the wheel. Half the segments bust. Win up to 3× your bet.",
    multiplier: "Up to 3×",
    type: "Session",
    live: true,
  },
  {
    slug: "crash",
    name: "Crypto Crash",
    emoji: "📈",
    image: GAME_IMAGES["crash"],
    color: "from-green-400 to-emerald-600",
    description: "Watch the multiplier climb. Cash out before it crashes — or lose everything.",
    multiplier: "∞×",
    type: "Session",
    live: true,
  },
  {
    slug: "treasure-hunt",
    name: "Treasure Hunt",
    emoji: "💎",
    image: GAME_IMAGES["treasure-hunt"],
    color: "from-cyan-500 to-blue-700",
    description: "Avoid bombs to grow your multiplier. Cash out anytime in this session game.",
    multiplier: "Up to 150000×",
    type: "Session",
    live: true,
  },
  {
    slug: "highlow",
    name: "High — Low",
    emoji: "🃏",
    image: GAME_IMAGES["highlow"],
    color: "from-rose-500 to-pink-700",
    description: "Guess higher or lower. Build a streak. Cash out before you bust.",
    multiplier: "∞× Streak",
    type: "Session",
    live: true,
  },
];
