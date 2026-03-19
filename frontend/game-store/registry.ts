import dynamic from "next/dynamic";
import { ComponentType } from "react";
import { GAME_IMAGES } from "./images";

export interface GameProps {
  onGameOver: (score: number) => void;
  onScoreChange?: (score: number) => void;
}

export interface GameMeta {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  image?: string;
  component: () => Promise<{ default: ComponentType<GameProps> }>;
}

export const GAMES: Record<string, GameMeta> = {
  "poly-dash": {
    slug: "poly-dash",
    name: "Poly Dash",
    emoji: "🔺",
    color: "from-pink-500 to-fuchsia-600",
    description: "Geometry Dash inspired — jump, dodge spikes, reach the finish!",
    image: GAME_IMAGES["poly-dash"],
    component: () => import("./poly-dash/PolyDashGame"),
  },
  tetris: {
    slug: "tetris",
    name: "Tetris",
    emoji: "🧱",
    color: "from-cyan-500 to-blue-600",
    description: "Stack blocks, clear lines, chase the high score",
    image: GAME_IMAGES["tetris"],
    component: () => import("./tetris/TetrisGame"),
  },
  "space-invaders": {
    slug: "space-invaders",
    name: "Space Invaders",
    emoji: "👾",
    color: "from-green-400 to-emerald-600",
    description: "Defend Earth from alien waves, defeat bosses, collect power-ups",
    image: GAME_IMAGES["space-invaders"],
    component: () => import("./space-invaders/SpaceInvadersGame"),
  },
  snake: {
    slug: "snake",
    name: "Neon Snake",
    emoji: "🐍",
    color: "from-lime-400 to-green-600",
    description: "Collect power-ups, dodge obstacles, chain combos for max score",
    image: GAME_IMAGES["snake"],
    component: () => import("./snake/SnakeGame"),
  },
  "2048": {
    slug: "2048",
    name: "2048",
    emoji: "🔢",
    color: "from-amber-400 to-orange-600",
    description: "Slide tiles, merge numbers, reach the legendary 2048 tile",
    image: GAME_IMAGES["2048"],
    component: () => import("./2048/Game2048"),
  },
  "bubble-pop": {
    slug: "bubble-pop",
    name: "Bubble Pop",
    emoji: "🫧",
    color: "from-pink-400 to-rose-600",
    description: "Pop falling bubbles before they hit the ground — how many can you get?",
    image: GAME_IMAGES["bubble-pop"],
    component: () => import("./bubble-pop/BubblePopGame"),
  },
  "doodle-jump": {
    slug: "doodle-jump",
    name: "Doodle Jump",
    emoji: "🐸",
    color: "from-green-400 to-lime-500",
    description: "Jump higher, stomp monsters, grab jetpacks — don't fall!",
    image: GAME_IMAGES["doodle-jump"],
    component: () => import("./doodle-jump/DoodleJumpGame"),
  },
  "tower-bloxx": {
    slug: "tower-bloxx",
    name: "Tower Bloxx",
    emoji: "🏗️",
    color: "from-indigo-400 to-violet-600",
    description: "Stack blocks from a swinging crane — build the tallest tower!",
    image: GAME_IMAGES["tower-bloxx"],
    component: () => import("./tower-bloxx/TowerBloxx"),
  },
};

// Explicit array to guarantee display order (JS objects sort numeric keys first)
export const GAMES_LIST: GameMeta[] = [
  GAMES["poly-dash"],
  GAMES["tetris"],
  GAMES["space-invaders"],
  GAMES["snake"],
  GAMES["2048"],
  GAMES["bubble-pop"],
  GAMES["doodle-jump"],
  GAMES["tower-bloxx"],
];
