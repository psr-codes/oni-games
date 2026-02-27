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
  // Future games go here:
  // snake: { ... component: () => import("./snake/SnakeGame") },
  // "2048": { ... component: () => import("./2048/Game2048") },
};

export const GAMES_LIST: GameMeta[] = Object.values(GAMES);
