"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../registry";

// ── Constants ──────────────────────────────────────────────
const ROWS = 20;
const COLS = 10;
const TICK_BASE = 800;
const TICK_DECREMENT = 50; // ms faster per level
const TICK_MIN = 100;
const LINES_PER_LEVEL = 10;

// Scoring (NES-style)
const SCORE_TABLE = [0, 100, 300, 500, 800];

// ── Tetromino definitions ──────────────────────────────────
const TETROMINOES: { shape: number[][]; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: "#00f0f0" }, // I - cyan
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#f0f000",
  }, // O - yellow
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "#a000f0",
  }, // T - purple
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "#0000f0",
  }, // J - blue
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "#f0a000",
  }, // L - orange
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "#00f000",
  }, // S - green
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "#f00000",
  }, // Z - red
];

type Cell = { filled: boolean; color: string } | null;
type Board = Cell[][];

interface Piece {
  shape: number[][];
  color: string;
  row: number;
  col: number;
}

const createEmptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const randomPiece = (): Piece => {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return {
    shape: t.shape.map((r) => [...r]),
    color: t.color,
    row: 0,
    col: Math.floor((COLS - t.shape[0].length) / 2),
  };
};

const rotate = (shape: number[][]): number[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c]),
  );
};

const isValid = (board: Board, piece: Piece): boolean => {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const nr = piece.row + r;
        const nc = piece.col + c;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
        if (board[nr][nc]) return false;
      }
    }
  }
  return true;
};

const placePiece = (board: Board, piece: Piece): Board => {
  const newBoard = board.map((row) => row.map((cell) => cell));
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        newBoard[piece.row + r][piece.col + c] = {
          filled: true,
          color: piece.color,
        };
      }
    }
  }
  return newBoard;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...empty, ...remaining], cleared };
};

const getGhostRow = (board: Board, piece: Piece): number => {
  let ghostRow = piece.row;
  while (isValid(board, { ...piece, row: ghostRow + 1 })) {
    ghostRow++;
  }
  return ghostRow;
};

// ── Component ──────────────────────────────────────────────
export default function TetrisGame({ onGameOver, onScoreChange }: GameProps) {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [current, setCurrent] = useState<Piece>(randomPiece);
  const [next, setNext] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  // Touch state
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastMoveX = useRef(0);

  // ── Spawn new piece ──
  const spawn = useCallback(() => {
    const newPiece = next;
    const newNext = randomPiece();
    if (!isValid(board, newPiece)) {
      setGameOver(true);
      onGameOver(scoreRef.current);
      return;
    }
    setCurrent(newPiece);
    setNext(newNext);
  }, [board, next, onGameOver]);

  // ── Lock current piece ──
  const lock = useCallback(() => {
    const placed = placePiece(board, current);
    const { board: cleared, cleared: linesCleared } = clearLines(placed);
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / LINES_PER_LEVEL) + 1;
    const newScore = score + SCORE_TABLE[linesCleared] * level;

    setBoard(cleared);
    setLines(newLines);
    setLevel(newLevel);
    setScore(newScore);
    onScoreChange?.(newScore);

    // Spawn next
    const nextPiece = next;
    const newNext = randomPiece();
    if (!isValid(cleared, nextPiece)) {
      setGameOver(true);
      onGameOver(newScore);
      return;
    }
    setCurrent(nextPiece);
    setNext(newNext);
  }, [board, current, lines, score, level, next, onGameOver, onScoreChange]);

  // ── Move piece ──
  const move = useCallback(
    (dr: number, dc: number) => {
      if (gameOver || paused) return;
      const moved = {
        ...current,
        row: current.row + dr,
        col: current.col + dc,
      };
      if (isValid(board, moved)) {
        setCurrent(moved);
      } else if (dr > 0) {
        lock();
      }
    },
    [board, current, gameOver, paused, lock],
  );

  // ── Rotate ──
  const rotatePiece = useCallback(() => {
    if (gameOver || paused) return;
    const rotated = { ...current, shape: rotate(current.shape) };
    // Wall kick: try 0, -1, +1, -2, +2 offset
    for (const offset of [0, -1, 1, -2, 2]) {
      const kicked = { ...rotated, col: rotated.col + offset };
      if (isValid(board, kicked)) {
        setCurrent(kicked);
        return;
      }
    }
  }, [board, current, gameOver, paused]);

  // ── Hard drop ──
  const hardDrop = useCallback(() => {
    if (gameOver || paused) return;
    const ghostRow = getGhostRow(board, current);
    const dropped = { ...current, row: ghostRow };
    const placed = placePiece(board, dropped);
    const { board: cleared, cleared: linesCleared } = clearLines(placed);
    const dropBonus = ghostRow - current.row;
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / LINES_PER_LEVEL) + 1;
    const newScore = score + SCORE_TABLE[linesCleared] * level + dropBonus * 2;

    setBoard(cleared);
    setLines(newLines);
    setLevel(newLevel);
    setScore(newScore);
    onScoreChange?.(newScore);

    const nextPiece = next;
    const newNext = randomPiece();
    if (!isValid(cleared, nextPiece)) {
      setGameOver(true);
      onGameOver(newScore);
      return;
    }
    setCurrent(nextPiece);
    setNext(newNext);
  }, [
    board,
    current,
    lines,
    score,
    level,
    next,
    gameOver,
    paused,
    onGameOver,
    onScoreChange,
  ]);

  // ── Keyboard ──
  useEffect(() => {
    if (!started) return;
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          move(1, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          rotatePiece();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
        case "p":
        case "P":
          setPaused((p) => !p);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started, gameOver, move, rotatePiece, hardDrop]);

  // ── Touch controls ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    lastMoveX.current = touch.clientX;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || gameOver || paused) return;
      const touch = e.touches[0];
      const dx = touch.clientX - lastMoveX.current;
      const threshold = 30;

      if (Math.abs(dx) > threshold) {
        move(0, dx > 0 ? 1 : -1);
        lastMoveX.current = touch.clientX;
      }
    },
    [gameOver, paused, move],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || gameOver || paused) return;
      const touch = e.changedTouches[0];
      const dy = touch.clientY - touchStart.current.y;
      const dx = Math.abs(touch.clientX - touchStart.current.x);

      if (dy > 60 && dx < 40) {
        hardDrop();
      } else if (Math.abs(dy) < 15 && dx < 15) {
        rotatePiece();
      }
      touchStart.current = null;
    },
    [gameOver, paused, hardDrop, rotatePiece],
  );

  // ── Game tick ──
  useEffect(() => {
    if (!started || gameOver || paused) return;
    const speed = Math.max(TICK_MIN, TICK_BASE - (level - 1) * TICK_DECREMENT);
    const interval = setInterval(() => move(1, 0), speed);
    return () => clearInterval(interval);
  }, [started, gameOver, paused, level, move]);

  // ── Ghost piece position ──
  const ghostRow =
    started && !gameOver ? getGhostRow(board, current) : current.row;

  // ── Restart ──
  const restart = () => {
    setBoard(createEmptyBoard());
    setCurrent(randomPiece());
    setNext(randomPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
  };

  // ── Render helpers ──
  const getCellColor = (r: number, c: number): string | null => {
    // Existing placed block
    if (board[r][c]) return board[r][c]!.color;
    if (!started) return null;

    // Current piece
    const pr = r - current.row;
    const pc = c - current.col;
    if (
      pr >= 0 &&
      pr < current.shape.length &&
      pc >= 0 &&
      pc < current.shape[0].length &&
      current.shape[pr][pc]
    ) {
      return current.color;
    }

    // Ghost piece
    const gr = r - ghostRow;
    const gc = c - current.col;
    if (
      gr >= 0 &&
      gr < current.shape.length &&
      gc >= 0 &&
      gc < current.shape[0].length &&
      current.shape[gr][gc]
    ) {
      return "ghost";
    }

    return null;
  };

  const CELL_SIZE = "clamp(16px, 4.5vw, 32px)";

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Start Screen */}
      {!started && !gameOver && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl">🧱</div>
          <h2 className="text-2xl font-bold text-white">Tetris</h2>
          <div className="text-sm text-gray-400 text-center max-w-xs">
            <p className="mb-2">
              <b>Desktop:</b> Arrow keys to move, ↑ to rotate, Space to hard
              drop, P to pause
            </p>
            <p>
              <b>Mobile:</b> Swipe left/right, tap to rotate, swipe down to drop
            </p>
          </div>
          <button
            onClick={restart}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-cyan-900/40"
          >
            ▶ Start Game
          </button>
        </div>
      )}

      {/* Game UI */}
      {started && (
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Sidebar — Next + Stats */}
          <div className="flex flex-row md:flex-col items-center gap-4 order-2 md:order-1">
            {/* Next Piece */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">
                Next
              </div>
              <div className="flex flex-col items-center">
                {Array.from({ length: 4 }, (_, r) => (
                  <div key={r} className="flex">
                    {Array.from({ length: 4 }, (_, c) => {
                      const inShape = next.shape[r] && next.shape[r][c];
                      return (
                        <div
                          key={c}
                          style={{
                            width: 18,
                            height: 18,
                            backgroundColor: inShape
                              ? next.color
                              : "transparent",
                            borderRadius: inShape ? 3 : 0,
                            border: inShape
                              ? "1px solid rgba(255,255,255,0.2)"
                              : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-row md:flex-col gap-3">
              <StatBox label="Score" value={score} />
              <StatBox label="Level" value={level} />
              <StatBox label="Lines" value={lines} />
            </div>
          </div>

          {/* Board */}
          <div
            ref={boardRef}
            className="order-1 md:order-2 relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: "none" }}
          >
            <div
              className="border-2 border-gray-600 rounded-lg overflow-hidden bg-gray-950"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE})`,
                gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE})`,
                gap: "1px",
                backgroundColor: "#1a1a2e",
              }}
            >
              {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                  const color = getCellColor(r, c);
                  const isGhost = color === "ghost";
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        backgroundColor: isGhost
                          ? "rgba(255,255,255,0.08)"
                          : color || "#0f0f1a",
                        borderRadius: color && !isGhost ? 3 : 1,
                        border: isGhost
                          ? `1px solid ${current.color}40`
                          : color
                            ? "1px solid rgba(255,255,255,0.15)"
                            : "none",
                        boxShadow:
                          color && !isGhost
                            ? `inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.1)`
                            : "none",
                      }}
                    />
                  );
                }),
              )}
            </div>

            {/* Pause overlay */}
            {paused && !gameOver && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <div className="text-3xl mb-2">⏸️</div>
                  <p className="text-white font-bold">Paused</p>
                  <p className="text-gray-400 text-sm">Press P to resume</p>
                </div>
              </div>
            )}

            {/* Game Over overlay */}
            {gameOver && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                <div className="text-center p-6">
                  <div className="text-4xl mb-3">💀</div>
                  <p className="text-white font-bold text-xl mb-1">Game Over</p>
                  <p className="text-purple-400 font-bold text-2xl mb-4">
                    {score} pts
                  </p>
                  <button
                    onClick={restart}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden gap-2 order-3">
            <MobileBtn onClick={() => move(0, -1)}>◀</MobileBtn>
            <MobileBtn onClick={rotatePiece}>↻</MobileBtn>
            <MobileBtn onClick={() => move(1, 0)}>▼</MobileBtn>
            <MobileBtn onClick={hardDrop}>⏬</MobileBtn>
            <MobileBtn onClick={() => move(0, 1)}>▶</MobileBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──
function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-center min-w-[72px]">
      <div className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function MobileBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-white font-bold text-lg transition-colors border border-gray-700"
    >
      {children}
    </button>
  );
}
