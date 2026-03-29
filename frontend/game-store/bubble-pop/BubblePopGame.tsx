"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../registry";

// ============= CONSTANTS =============
const GAME_W = 500;
const GAME_H = 700;
const BG = "#0a0a2e";
const MAX_FAILS = 3;
const BASE_SPAWN_INTERVAL = 2200; // ms — gets faster with score
const BUBBLE_FALL_SPEED = 1.2; // px per frame at base level

// Neon bubble colors
const BUBBLE_COLORS = [
  "#ff6b6b",
  "#51cf66",
  "#339af0",
  "#fcc419",
  "#cc5de8",
  "#22b8cf",
  "#ff8787",
  "#69db7c",
  "#5c7cfa",
  "#ffe066",
  "#e599f7",
  "#66d9e8",
];

// Pop particle
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  r: number;
  color: string;
  speed: number;
}

let nextBubbleId = 0;

// ============= MAIN COMPONENT =============
export default function BubblePopGame({
  onGameOver,
  onScoreChange,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">(
    "start",
  );
  const [displayScore, setDisplayScore] = useState(0);
  const [displayFails, setDisplayFails] = useState(0);

  const g = useRef({
    bubbles: [] as Bubble[],
    particles: [] as Particle[],
    score: 0,
    fails: 0,
    gameState: "start" as string,
    lastSpawn: 0,
    mouseX: 0,
    mouseY: 0,
    flash: 0,
  });

  const spawnBubble = () => {
    const minR = 20;
    const maxR = 45;
    const r = minR + Math.random() * (maxR - minR);
    const x = r + Math.random() * (GAME_W - r * 2);
    const color =
      BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
    const speedMultiplier = 1 + g.current.score * 0.02; // gets faster
    const speed = (BUBBLE_FALL_SPEED + Math.random() * 0.5) * speedMultiplier;

    g.current.bubbles.push({
      id: nextBubbleId++,
      x,
      y: -r,
      r,
      color,
      speed,
    });
  };

  const spawnParticles = (
    x: number,
    y: number,
    color: string,
    count: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      g.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  };

  const getSpawnInterval = () => {
    const score = g.current.score;
    let interval = BASE_SPAWN_INTERVAL;
    if (score >= 10) interval -= 400;
    if (score >= 20) interval -= 400;
    if (score >= 40) interval -= 400;
    if (score >= 60) interval -= 200;
    if (score >= 80) interval -= 100;
    return Math.max(interval, 400);
  };

  const startGame = useCallback(() => {
    g.current.bubbles = [];
    g.current.particles = [];
    g.current.score = 0;
    g.current.fails = 0;
    g.current.gameState = "playing";
    g.current.lastSpawn = Date.now();
    g.current.flash = 0;
    setGameState("playing");
    setDisplayScore(0);
    setDisplayFails(0);
  }, []);

  // Click/tap handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (g.current.gameState !== "playing") return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = GAME_W / rect.width;
      const scaleY = GAME_H / rect.height;

      let clientX: number, clientY: number;
      if ("touches" in e) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const mx = (clientX - rect.left) * scaleX;
      const my = (clientY - rect.top) * scaleY;

      // Find clicked bubble (check from top/front to bottom/back)
      let popped = false;
      for (let i = g.current.bubbles.length - 1; i >= 0; i--) {
        const b = g.current.bubbles[i];
        const dist = Math.sqrt((mx - b.x) ** 2 + (my - b.y) ** 2);
        if (dist <= b.r) {
          // Pop it!
          spawnParticles(b.x, b.y, b.color, 12);
          g.current.bubbles.splice(i, 1);
          g.current.score++;
          setDisplayScore(g.current.score);
          onScoreChange?.(g.current.score);
          popped = true;
          break;
        }
      }
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchend", handleClick);
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchend", handleClick);
    };
  }, [onScoreChange]);

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") return;
    let animId: number;

    const loop = () => {
      const state = g.current;
      if (state.gameState !== "playing") return;
      const now = Date.now();

      // Spawn bubbles
      if (now - state.lastSpawn >= getSpawnInterval()) {
        spawnBubble();
        state.lastSpawn = now;
      }

      // Move bubbles
      for (let i = state.bubbles.length - 1; i >= 0; i--) {
        const b = state.bubbles[i];
        b.y += b.speed;

        // Hit bottom
        if (b.y - b.r >= GAME_H) {
          state.bubbles.splice(i, 1);
          state.fails++;
          state.flash = 10;
          setDisplayFails(state.fails);

          if (state.fails >= MAX_FAILS) {
            state.gameState = "gameover";
            setGameState("gameover");
            onGameOver(state.score);
            return;
          }
        }
      }

      // Update particles
      state.particles = state.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15,
          life: p.life - 0.03,
        }))
        .filter((p) => p.life > 0);

      // Flash decay
      if (state.flash > 0) state.flash--;

      // Render
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d")!;

      // Background
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${state.flash * 0.04})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.fillStyle = BG;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      // Subtle grid
      ctx.strokeStyle = "rgba(100, 100, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < GAME_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_H);
        ctx.stroke();
      }
      for (let y = 0; y < GAME_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_W, y);
        ctx.stroke();
      }

      // Bubbles
      state.bubbles.forEach((b) => {
        // Glow
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 20;

        // Outer ring
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();

        // Fill with transparency
        ctx.fillStyle = b.color + "30";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();

        // Inner shine
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      });

      // Particles
      state.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // HUD - top bar
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, GAME_W, 40);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE: ${state.score}`, 14, 27);

      ctx.textAlign = "center";
      ctx.fillStyle = "#ff6b9d";
      ctx.font = "bold 16px monospace";
      ctx.fillText("BUBBLE POP", GAME_W / 2, 27);

      // Fails indicator (hearts)
      ctx.textAlign = "right";
      ctx.font = "18px monospace";
      const hearts =
        "❤️".repeat(MAX_FAILS - state.fails) + "🖤".repeat(state.fails);
      ctx.fillText(hearts, GAME_W - 14, 28);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, onGameOver]);

  // Render static overlay for non-playing states
  useEffect(() => {
    if (gameState === "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Decorative bubbles
    const decorBubbles = [
      { x: 80, y: 200, r: 35, color: BUBBLE_COLORS[0] },
      { x: 350, y: 150, r: 28, color: BUBBLE_COLORS[2] },
      { x: 200, y: 400, r: 40, color: BUBBLE_COLORS[4] },
      { x: 420, y: 350, r: 25, color: BUBBLE_COLORS[1] },
      { x: 100, y: 500, r: 30, color: BUBBLE_COLORS[3] },
      { x: 380, y: 550, r: 32, color: BUBBLE_COLORS[5] },
    ];
    decorBubbles.forEach((b) => {
      ctx.strokeStyle = b.color + "60";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = b.color + "15";
      ctx.fill();
    });
  }, [gameState]);

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.8)",
    zIndex: 10,
    borderRadius: "8px",
  };
  const btnStyle: React.CSSProperties = {
    padding: "14px 40px",
    fontSize: "18px",
    fontFamily: "monospace",
    fontWeight: "bold",
    background: "#ff6b9d",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "20px",
    boxShadow: "0 0 24px #ff6b9d55",
    transition: "transform 0.1s",
  };

  return (
    <div
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_W}
          height={GAME_H}
          style={{
            display: "block",
            background: BG,
            borderRadius: "8px",
            border: "1px solid #222",
            cursor: "pointer",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${GAME_W} / ${GAME_H}`,
          }}
        />

        {gameState === "start" && (
          <div style={overlayStyle}>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                color: "#ff6b9d",
                textShadow: "0 0 30px #ff6b9d88",
                margin: 0,
                letterSpacing: 2,
              }}
            >
              🫧 BUBBLE POP
            </h1>
            <div
              style={{
                marginTop: "20px",
                color: "#aaa",
                textAlign: "center",
                lineHeight: 2,
                fontSize: "14px",
              }}
            >
              <div>Click or tap bubbles to pop them!</div>
              <div>Don&apos;t let {MAX_FAILS} bubbles reach the bottom</div>
              <div
                style={{ marginTop: "12px", color: "#888", fontSize: "12px" }}
              >
                Bubbles speed up as your score grows 🚀
              </div>
            </div>
            <button style={btnStyle} onClick={startGame}>
              ▶ START GAME
            </button>
          </div>
        )}

        {gameState === "gameover" && (
          <div style={overlayStyle}>
            <h2
              style={{
                fontSize: "32px",
                color: "#ff4444",
                margin: 0,
                textShadow: "0 0 20px #ff444488",
              }}
            >
              GAME OVER
            </h2>
            <p
              style={{ fontSize: "22px", color: "#ff6b9d", marginTop: "18px" }}
            >
              Score: {displayScore}
            </p>
            <p style={{ fontSize: "14px", color: "#888", marginTop: "4px" }}>
              ❤️ {MAX_FAILS - displayFails} lives remaining → 💀
            </p>
            <button style={btnStyle} onClick={startGame}>
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
