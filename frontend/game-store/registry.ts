import dynamic from "next/dynamic";
import { ComponentType } from "react";

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
  component: () => Promise<{ default: ComponentType<GameProps> }>;
}

export const GAMES: Record<string, GameMeta> = {
  tetris: {
    slug: "tetris",
    name: "Tetris",
    emoji: "🧱",
    color: "from-cyan-500 to-blue-600",
    description: "Stack blocks, clear lines, chase the high score",
    component: () => import("./tetris/TetrisGame"),
  },
  "space-invaders": {
    slug: "space-invaders",
    name: "Space Invaders",
    emoji: "👾",
    color: "from-green-400 to-emerald-600",
    description: "Defend Earth from alien waves, defeat bosses, collect power-ups",
    component: () => import("./space-invaders/SpaceInvadersGame"),
  },
  snake: {
    slug: "snake",
    name: "Neon Snake",
    emoji: "🐍",
    color: "from-lime-400 to-green-600",
    description: "Collect power-ups, dodge obstacles, chain combos for max score",
    component: () => import("./snake/SnakeGame"),
  },
  "2048": {
    slug: "2048",
    name: "2048",
    emoji: "🔢",
    color: "from-amber-400 to-orange-600",
    description: "Slide tiles, merge numbers, reach the legendary 2048 tile",
    component: () => import("./2048/Game2048"),
  },
  "bubble-pop": {
    slug: "bubble-pop",
    name: "Bubble Pop",
    emoji: "🫧",
    color: "from-pink-400 to-rose-600",
    description: "Pop falling bubbles before they hit the ground — how many can you get?",
    component: () => import("./bubble-pop/BubblePopGame"),
  },
  "doodle-jump": {
    slug: "doodle-jump",
    name: "Doodle Jump",
    emoji: "🐸",
    color: "from-green-400 to-lime-500",
    description: "Jump higher, stomp monsters, grab jetpacks — don't fall!",
    component: () => import("./doodle-jump/DoodleJumpGame"),
  },
};

export const GAMES_LIST: GameMeta[] = Object.values(GAMES);
