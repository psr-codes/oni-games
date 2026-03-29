"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../registry";

// ============= CONSTANTS =============
const GRID = 4;
const CELL_GAP = 12;
const CELL_SIZE = 100;
const BOARD_PAD = 14;
const BOARD_SIZE = GRID * CELL_SIZE + (GRID + 1) * CELL_GAP + BOARD_PAD * 2;
const ANIM_MS = 120;

const BG = "#0a0a1a";
const BOARD_BG = "#1a1a2e";
const CELL_BG = "#16213e";
const TEXT_LIGHT = "#f0ece5";

// Tile colors inspired by 2048 with a neon twist
const TILE_STYLES: Record<number, { bg: string; fg: string; glow?: string }> = {
  2: { bg: "#2a2a4a", fg: "#e0e0ff" },
  4: { bg: "#33335a", fg: "#d0d0ff" },
  8: { bg: "#e06030", fg: "#fff", glow: "#e0603066" },
  16: { bg: "#e04820", fg: "#fff", glow: "#e0482066" },
  32: { bg: "#e03010", fg: "#fff", glow: "#e0301066" },
  64: { bg: "#e02000", fg: "#fff", glow: "#e0200066" },
  128: { bg: "#edcb50", fg: "#333", glow: "#edcb5066" },
  256: { bg: "#edc840", fg: "#333", glow: "#edc84066" },
  512: { bg: "#edc530", fg: "#333", glow: "#edc53066" },
  1024: { bg: "#edc020", fg: "#333", glow: "#edc02066" },
  2048: { bg: "#edb510", fg: "#fff", glow: "#edb510aa" },
  4096: { bg: "#50e0a0", fg: "#333", glow: "#50e0a066" },
  8192: { bg: "#30c0e0", fg: "#333", glow: "#30c0e066" },
};

function getTileStyle(value: number) {
  return TILE_STYLES[value] || { bg: "#3c3a55", fg: "#fff" };
}

// ============= GAME LOGIC (no lodash) =============
type Board = (number | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function clone(b: Board): Board {
  return b.map((row) => [...row]);
}

function emptyPositions(b: Board): [number, number][] {
  const result: [number, number][] = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) if (b[r][c] === null) result.push([r, c]);
  return result;
}

function addRandom(b: Board): Board {
  const empty = emptyPositions(b);
  if (empty.length === 0) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const nb = clone(b);
  nb[r][c] = Math.random() < 0.9 ? 2 : 4;
  return nb;
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) if (a[r][c] !== b[r][c]) return false;
  return true;
}

function slideRow(row: (number | null)[]): {
  result: (number | null)[];
  scored: number;
} {
  const filtered = row.filter((v) => v !== null) as number[];
  const result: (number | null)[] = [];
  let scored = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);
      scored += merged;
      i += 2;
    } else {
      result.push(filtered[i]);
      i++;
    }
  }
  while (result.length < GRID) result.push(null);
  return { result, scored };
}

function moveLeft(b: Board): { board: Board; scored: number } {
  let scored = 0;
  const nb = b.map((row) => {
    const { result, scored: s } = slideRow(row);
    scored += s;
    return result;
  });
  return { board: nb, scored };
}

function moveRight(b: Board): { board: Board; scored: number } {
  let scored = 0;
  const nb = b.map((row) => {
    const { result, scored: s } = slideRow([...row].reverse());
    scored += s;
    return result.reverse();
  });
  return { board: nb, scored };
}

function transpose(b: Board): Board {
  return b[0].map((_, c) => b.map((row) => row[c]));
}

function moveUp(b: Board): { board: Board; scored: number } {
  const t = transpose(b);
  const { board: moved, scored } = moveLeft(t);
  return { board: transpose(moved), scored };
}

function moveDown(b: Board): { board: Board; scored: number } {
  const t = transpose(b);
  const { board: moved, scored } = moveRight(t);
  return { board: transpose(moved), scored };
}

function canMove(b: Board): boolean {
  // Check for empty cells
  if (emptyPositions(b).length > 0) return true;
  // Check for adjacent equal tiles
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = b[r][c];
      if (c + 1 < GRID && b[r][c + 1] === v) return true;
      if (r + 1 < GRID && b[r + 1][c] === v) return true;
    }
  }
  return false;
}

function hasWon(b: Board): boolean {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) if (b[r][c] === 2048) return true;
  return false;
}

function initBoard(): Board {
  let b = emptyBoard();
  b = addRandom(b);
  b = addRandom(b);
  return b;
}

// ============= MAIN COMPONENT =============
export default function Game2048({ onGameOver, onScoreChange }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [board, setBoard] = useState<Board>(initBoard);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  // Load best score
  useEffect(() => {
    const saved = localStorage.getItem("2048-best");
    if (saved) setBestScore(Number(saved));
  }, []);

  const doMove = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (status !== "playing") return;

      setBoard((prev) => {
        const moveFn = {
          up: moveUp,
          down: moveDown,
          left: moveLeft,
          right: moveRight,
        }[dir];
        const { board: newBoard, scored } = moveFn(prev);

        if (boardsEqual(prev, newBoard)) return prev; // no change

        const withNew = addRandom(newBoard);

        // Update score
        if (scored > 0) {
          setScore((s) => {
            const ns = s + scored;
            onScoreChange?.(ns);
            if (ns > bestScore) {
              setBestScore(ns);
              localStorage.setItem("2048-best", String(ns));
            }
            return ns;
          });
        }

        // Check game state
        setTimeout(() => {
          if (hasWon(withNew)) {
            setStatus("won");
            setScore((s) => {
              onGameOver(s);
              return s;
            });
          } else if (!canMove(withNew)) {
            setStatus("lost");
            setScore((s) => {
              onGameOver(s);
              return s;
            });
          }
        }, ANIM_MS);

        return withNew;
      });
    },
    [status, bestScore, onGameOver, onScoreChange],
  );

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || e.key === "w") doMove("up");
      if (e.key === "ArrowDown" || e.key === "s") doMove("down");
      if (e.key === "ArrowLeft" || e.key === "a") doMove("left");
      if (e.key === "ArrowRight" || e.key === "d") doMove("right");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [doMove]);

  // Touch swipe support
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let sx = 0,
      sy = 0;
    const onTouchStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        doMove(dx > 0 ? "right" : "left");
      } else {
        doMove(dy > 0 ? "down" : "up");
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [doMove]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = BOARD_SIZE;
    const H = BOARD_SIZE + 60; // extra for score

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Score row
    ctx.fillStyle = "#aaa";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", 14, 22);
    ctx.textAlign = "right";
    ctx.fillText("BEST", W - 14, 22);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(score), 14, 48);
    ctx.textAlign = "right";
    ctx.fillText(String(bestScore), W - 14, 48);
    ctx.textAlign = "left";

    // Title
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 28px monospace";
    ctx.fillText("2048", W / 2, 44);
    ctx.textAlign = "left";

    const offsetY = 60;

    // Board background
    ctx.fillStyle = BOARD_BG;
    roundRect(ctx, 0, offsetY, W, W, 12);

    // Empty cells
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const { x, y } = cellXY(r, c, offsetY);
        ctx.fillStyle = CELL_BG;
        roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, 8);
      }
    }

    // Tiles
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const val = board[r][c];
        if (val === null) continue;
        const { x, y } = cellXY(r, c, offsetY);
        const style = getTileStyle(val);

        // Glow
        if (style.glow) {
          ctx.shadowColor = style.glow;
          ctx.shadowBlur = 15;
        }
        ctx.fillStyle = style.bg;
        roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, 8);
        ctx.shadowBlur = 0;

        // Value text
        ctx.fillStyle = style.fg;
        const fontSize = val >= 1024 ? 22 : val >= 128 ? 26 : 32;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(val), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    // Overlay for won/lost
    if (status !== "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, offsetY, W, W);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (status === "won") {
        ctx.fillStyle = "#ffaa00";
        ctx.font = "bold 40px monospace";
        ctx.fillText("YOU WON! 🎉", W / 2, offsetY + W / 2 - 20);
      } else {
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 40px monospace";
        ctx.fillText("GAME OVER", W / 2, offsetY + W / 2 - 20);
      }

      ctx.fillStyle = "#ccc";
      ctx.font = "bold 18px monospace";
      ctx.fillText(`Score: ${score}`, W / 2, offsetY + W / 2 + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }, [board, score, bestScore, status]);

  const startNewGame = () => {
    setBoard(initBoard());
    setScore(0);
    setStatus("playing");
  };

  const btnStyle: React.CSSProperties = {
    padding: "12px 32px",
    fontSize: "16px",
    fontFamily: "monospace",
    fontWeight: "bold",
    background: "#ffaa00",
    color: "#111",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 0 20px #ffaa0055",
    transition: "transform 0.1s",
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        color: "#fff",
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <canvas
          ref={canvasRef}
          width={BOARD_SIZE}
          height={BOARD_SIZE + 60}
          style={{
            display: "block",
            background: BG,
            borderRadius: "12px",
            maxWidth: "100%",
            maxHeight: "90%",
            aspectRatio: `${BOARD_SIZE} / ${BOARD_SIZE + 60}`,
          }}
        />

        {status !== "playing" && (
          <div
            style={{
              position: "absolute",
              zIndex: 10,
            }}
          >
            <button style={btnStyle} onClick={startNewGame}>
              {status === "won" ? "PLAY AGAIN" : "TRY AGAIN"}
            </button>
          </div>
        )}

        {status === "playing" && (
          <div
            style={{
              fontSize: "13px",
              color: "#666",
              textAlign: "center",
            }}
          >
            ← → ↑ ↓ or WASD to move · Swipe on mobile
          </div>
        )}
      </div>
    </div>
  );
}

// ============= HELPERS =============
function cellXY(row: number, col: number, offsetY: number) {
  return {
    x: BOARD_PAD + CELL_GAP + col * (CELL_SIZE + CELL_GAP),
    y: offsetY + BOARD_PAD + CELL_GAP + row * (CELL_SIZE + CELL_GAP),
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
