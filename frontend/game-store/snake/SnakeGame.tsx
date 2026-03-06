"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../registry";

// ============= CONSTANTS =============
const GRID_SIZE = 25;
const INITIAL_SPEED = 120;
const GAME_W = 500;
const GAME_H = 500;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };
type PowerUpType = "speed" | "slow" | "ghost" | "magnet" | "shrink" | "double";
type GameState = "idle" | "playing" | "paused" | "gameover";

interface PowerUp {
  pos: Position;
  type: PowerUpType;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface ActiveEffect {
  type: PowerUpType;
  endsAt: number;
}

const NEON_GREEN = "#00ff88";
const BG_COLOR = "#0a0a1a";

const POWER_UP_COLORS: Record<PowerUpType, string> = {
  speed: "#ffaa00",
  slow: "#00aaff",
  ghost: "#aa55ff",
  magnet: "#ff55aa",
  shrink: "#ff5555",
  double: "#55ff55",
};

const POWER_UP_ICONS: Record<PowerUpType, string> = {
  speed: "⚡",
  slow: "🐢",
  ghost: "👻",
  magnet: "🧲",
  shrink: "✂",
  double: "2x",
};

const POWER_UP_LABELS: Record<PowerUpType, string> = {
  speed: "⚡ Speed",
  slow: "🐢 Slow",
  ghost: "👻 Ghost",
  magnet: "🧲 Magnet",
  shrink: "✂️ Shrink",
  double: "✨ 2x Points",
};

function randomPos(exclude: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (exclude.some((p) => p.x === pos.x && p.y === pos.y));
  return pos;
}

function randomPowerUpType(): PowerUpType {
  const types: PowerUpType[] = [
    "speed",
    "slow",
    "ghost",
    "magnet",
    "shrink",
    "double",
  ];
  return types[Math.floor(Math.random() * types.length)];
}

// ============= MAIN COMPONENT =============
export default function SnakeGame({ onGameOver, onScoreChange }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(1);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [scale, setScale] = useState(1);

  // Responsive scaling
  useEffect(() => {
    const updateScale = () => {
      const vw = window.innerWidth - 32;
      const vh = window.innerHeight - 200;
      const s = Math.min(vw / GAME_W, vh / GAME_H);
      setScale(Math.max(s, 0.5));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Game state ref
  const s = useRef({
    snake: [{ x: 12, y: 12 }] as Position[],
    food: { x: 5, y: 5 } as Position,
    dir: "RIGHT" as Direction,
    nextDir: "RIGHT" as Direction,
    gameState: "idle" as GameState,
    score: 0,
    level: 1,
    combo: 0,
    lastEatTime: 0,
    powerUps: [] as PowerUp[],
    activeEffects: [] as ActiveEffect[],
    particles: [] as Particle[],
    obstacles: [] as Position[],
  });

  const hasEffect = (type: PowerUpType): boolean => {
    return s.current.activeEffects.some(
      (e) => e.type === type && e.endsAt > Date.now(),
    );
  };

  const getSpeed = (): number => {
    let speed = INITIAL_SPEED - (s.current.level - 1) * 8;
    if (hasEffect("speed")) speed *= 0.6;
    if (hasEffect("slow")) speed *= 1.5;
    return Math.max(speed, 40);
  };

  const spawnParticles = (x: number, y: number, color: string, count = 8) => {
    const cellSize = GAME_W / GRID_SIZE;
    for (let i = 0; i < count; i++) {
      s.current.particles.push({
        x: x * cellSize + cellSize / 2,
        y: y * cellSize + cellSize / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color,
      });
    }
  };

  const startGame = useCallback(() => {
    const g = s.current;
    g.snake = [{ x: 12, y: 12 }];
    g.food = randomPos([{ x: 12, y: 12 }]);
    g.dir = "RIGHT";
    g.nextDir = "RIGHT";
    g.score = 0;
    g.level = 1;
    g.combo = 0;
    g.lastEatTime = 0;
    g.powerUps = [];
    g.activeEffects = [];
    g.particles = [];
    g.obstacles = [];
    g.gameState = "playing";
    setGameState("playing");
    setDisplayScore(0);
    setDisplayLevel(1);
    setDisplayCombo(0);
  }, []);

  // Tick function
  const tick = useCallback(() => {
    const g = s.current;
    if (g.gameState !== "playing") return;

    const now = Date.now();

    // Apply buffered direction
    g.dir = g.nextDir;

    const currentSnake = [...g.snake];
    const head = { ...currentSnake[0] };

    switch (g.dir) {
      case "UP":
        head.y -= 1;
        break;
      case "DOWN":
        head.y += 1;
        break;
      case "LEFT":
        head.x -= 1;
        break;
      case "RIGHT":
        head.x += 1;
        break;
    }

    // Wall wrapping
    if (head.x < 0) head.x = GRID_SIZE - 1;
    if (head.x >= GRID_SIZE) head.x = 0;
    if (head.y < 0) head.y = GRID_SIZE - 1;
    if (head.y >= GRID_SIZE) head.y = 0;

    const isGhost = hasEffect("ghost");

    // Self collision
    if (
      !isGhost &&
      currentSnake.some((seg) => seg.x === head.x && seg.y === head.y)
    ) {
      g.gameState = "gameover";
      setGameState("gameover");
      spawnParticles(head.x, head.y, "#ff3355", 20);
      onGameOver(g.score);
      return;
    }

    // Obstacle collision
    if (!isGhost && g.obstacles.some((o) => o.x === head.x && o.y === head.y)) {
      g.gameState = "gameover";
      setGameState("gameover");
      spawnParticles(head.x, head.y, "#ff3355", 20);
      onGameOver(g.score);
      return;
    }

    const newSnake = [head, ...currentSnake];

    // Food check (with magnet proximity)
    const fd = g.food;
    const dist = Math.abs(head.x - fd.x) + Math.abs(head.y - fd.y);
    if (
      (head.x === fd.x && head.y === fd.y) ||
      (hasEffect("magnet") && dist <= 2)
    ) {
      const timeSinceEat = now - g.lastEatTime;
      const newCombo = timeSinceEat < 3000 ? g.combo + 1 : 1;
      g.combo = newCombo;
      g.lastEatTime = now;

      let points = 10 * newCombo;
      if (hasEffect("double")) points *= 2;
      g.score += points;

      const allPositions = [
        ...newSnake,
        ...g.obstacles,
        ...g.powerUps.map((p) => p.pos),
      ];
      g.food = randomPos(allPositions);
      spawnParticles(head.x, head.y, NEON_GREEN, 12);

      // Level up every 50 points
      const newLevel = Math.floor(g.score / 50) + 1;
      if (newLevel > g.level) {
        g.level = newLevel;
        if (newLevel > 1) {
          const obsPos = randomPos([...newSnake, ...g.obstacles, g.food]);
          g.obstacles.push(obsPos);
        }
      }

      // Random power-up spawn (35% chance)
      if (Math.random() < 0.35) {
        const puPos = randomPos(allPositions);
        g.powerUps.push({ pos: puPos, type: randomPowerUpType() });
      }

      setDisplayScore(g.score);
      setDisplayLevel(g.level);
      setDisplayCombo(g.combo);
      onScoreChange?.(g.score);
    } else {
      newSnake.pop();
    }

    // Power-up collection
    const collectedIdx = g.powerUps.findIndex(
      (p) => p.pos.x === head.x && p.pos.y === head.y,
    );
    if (collectedIdx >= 0) {
      const collected = g.powerUps[collectedIdx];
      g.powerUps.splice(collectedIdx, 1);

      if (collected.type === "shrink") {
        const shrinkAmount = Math.min(3, newSnake.length - 1);
        newSnake.splice(newSnake.length - shrinkAmount, shrinkAmount);
        spawnParticles(head.x, head.y, POWER_UP_COLORS.shrink, 10);
      } else {
        g.activeEffects = [
          ...g.activeEffects.filter((e) => e.type !== collected.type),
          { type: collected.type, endsAt: now + 6000 },
        ];
        spawnParticles(head.x, head.y, POWER_UP_COLORS[collected.type], 10);
      }
    }

    // Clean expired effects
    g.activeEffects = g.activeEffects.filter((e) => e.endsAt > now);

    // Update particles
    g.particles = g.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 0.04,
        vy: p.vy + 0.1,
      }))
      .filter((p) => p.life > 0);

    g.snake = newSnake;
  }, [onGameOver, onScoreChange]);

  // Keyboard
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
          " ",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }

      if (e.key === " ") {
        const g = s.current;
        if (g.gameState === "idle" || g.gameState === "gameover") {
          startGame();
        } else if (g.gameState === "playing") {
          g.gameState = "paused";
          setGameState("paused");
        } else if (g.gameState === "paused") {
          g.gameState = "playing";
          setGameState("playing");
        }
        return;
      }

      const dir = s.current.dir;
      if ((e.key === "ArrowUp" || e.key === "w") && dir !== "DOWN")
        s.current.nextDir = "UP";
      if ((e.key === "ArrowDown" || e.key === "s") && dir !== "UP")
        s.current.nextDir = "DOWN";
      if ((e.key === "ArrowLeft" || e.key === "a") && dir !== "RIGHT")
        s.current.nextDir = "LEFT";
      if ((e.key === "ArrowRight" || e.key === "d") && dir !== "LEFT")
        s.current.nextDir = "RIGHT";
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [startGame]);

  // Game loop + rendering
  useEffect(() => {
    if (gameState !== "playing") return;
    let animId: number;
    let lastTick = Date.now();

    const loop = () => {
      const now = Date.now();
      if (now - lastTick >= getSpeed()) {
        tick();
        lastTick = now;
      }

      // Render
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d")!;
      const g = s.current;
      const cellSize = GAME_W / GRID_SIZE;

      // Background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Grid
      ctx.strokeStyle = "rgba(0, 255, 136, 0.04)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, GAME_H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(GAME_W, i * cellSize);
        ctx.stroke();
      }

      // Obstacles
      g.obstacles.forEach((o) => {
        ctx.fillStyle = "#ff2244";
        ctx.shadowColor = "#ff2244";
        ctx.shadowBlur = 8;
        const pad = 2;
        ctx.fillRect(
          o.x * cellSize + pad,
          o.y * cellSize + pad,
          cellSize - pad * 2,
          cellSize - pad * 2,
        );
        ctx.shadowBlur = 0;
      });

      // Food (pulsing)
      const pulse = Math.sin(Date.now() / 200) * 2 + 2;
      ctx.fillStyle = NEON_GREEN;
      ctx.shadowColor = NEON_GREEN;
      ctx.shadowBlur = 12 + pulse;
      ctx.beginPath();
      ctx.arc(
        g.food.x * cellSize + cellSize / 2,
        g.food.y * cellSize + cellSize / 2,
        cellSize / 2.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      // Power-ups (diamond)
      g.powerUps.forEach((pu) => {
        const color = POWER_UP_COLORS[pu.type];
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        const cx = pu.pos.x * cellSize + cellSize / 2;
        const cy = pu.pos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize / 2.5);
        ctx.lineTo(cx + cellSize / 2.5, cy);
        ctx.lineTo(cx, cy + cellSize / 2.5);
        ctx.lineTo(cx - cellSize / 2.5, cy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Icon
        ctx.fillStyle = "#000";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(POWER_UP_ICONS[pu.type], cx, cy + 3);
        ctx.textAlign = "left";
      });

      // Snake
      const isGhost = hasEffect("ghost");
      g.snake.forEach((seg, i) => {
        const isHead = i === 0;
        const progress = i / g.snake.length;
        const alpha = isGhost ? 0.4 : 1;

        if (isHead) {
          ctx.fillStyle = `hsla(160, 100%, 50%, ${alpha})`;
          ctx.shadowColor = NEON_GREEN;
          ctx.shadowBlur = 15;
        } else {
          const hue = 160 - progress * 40;
          const lightness = 50 - progress * 15;
          ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
          ctx.shadowColor = `hsl(${hue}, 100%, ${lightness}%)`;
          ctx.shadowBlur = 6;
        }

        const pad = isHead ? 1 : 2;
        const r = isHead ? 4 : 3;
        const x = seg.x * cellSize + pad;
        const y = seg.y * cellSize + pad;
        const w = cellSize - pad * 2;
        const h = cellSize - pad * 2;

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
        ctx.shadowBlur = 0;

        // Eyes on head
        if (isHead) {
          ctx.fillStyle = "#000";
          const eyeSize = 2.5;
          ctx.beginPath();
          ctx.arc(
            seg.x * cellSize + cellSize * 0.35,
            seg.y * cellSize + cellSize * 0.35,
            eyeSize,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.beginPath();
          ctx.arc(
            seg.x * cellSize + cellSize * 0.65,
            seg.y * cellSize + cellSize * 0.35,
            eyeSize,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      });

      // Particles
      g.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, GAME_W, 34);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px monospace";
      ctx.fillText(`SCORE: ${g.score}`, 12, 23);
      ctx.textAlign = "center";
      ctx.fillText(`LEVEL ${g.level}`, GAME_W / 2, 23);
      ctx.textAlign = "right";
      if (g.combo > 1) {
        ctx.fillStyle = "#ffaa00";
        ctx.fillText(`x${g.combo} COMBO`, GAME_W - 12, 23);
      }
      ctx.textAlign = "left";

      // Active effects bar
      const liveEffects = g.activeEffects.filter((e) => e.endsAt > Date.now());
      if (liveEffects.length > 0) {
        let ex = 12;
        liveEffects.forEach((e) => {
          const remaining = Math.ceil((e.endsAt - Date.now()) / 1000);
          const color = POWER_UP_COLORS[e.type];
          ctx.fillStyle = color;
          ctx.font = "bold 10px monospace";
          const label = `${POWER_UP_LABELS[e.type]} ${remaining}s`;
          ctx.fillText(label, ex, GAME_H - 10);
          ex += ctx.measureText(label).width + 12;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, tick]);

  // Render overlays for non-playing states
  useEffect(() => {
    if (gameState === "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = s.current;
    const cellSize = GAME_W / GRID_SIZE;

    // Draw the last frame background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Grid
    ctx.strokeStyle = "rgba(0, 255, 136, 0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, GAME_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(GAME_W, i * cellSize);
      ctx.stroke();
    }

    // Draw snake, food, etc. for gameover/idle states
    g.obstacles.forEach((o) => {
      ctx.fillStyle = "#ff2244";
      ctx.fillRect(
        o.x * cellSize + 2,
        o.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4,
      );
    });
    ctx.fillStyle = NEON_GREEN;
    ctx.beginPath();
    ctx.arc(
      g.food.x * cellSize + cellSize / 2,
      g.food.y * cellSize + cellSize / 2,
      cellSize / 2.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    g.snake.forEach((seg, i) => {
      const progress = i / Math.max(g.snake.length, 1);
      const hue = 160 - progress * 40;
      const lightness = 50 - progress * 15;
      ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
      const pad = i === 0 ? 1 : 2;
      ctx.fillRect(
        seg.x * cellSize + pad,
        seg.y * cellSize + pad,
        cellSize - pad * 2,
        cellSize - pad * 2,
      );
    });
    // Particles
    g.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, [gameState]);

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.85)",
    zIndex: 10,
    borderRadius: "8px",
  };
  const btnStyle: React.CSSProperties = {
    padding: "14px 40px",
    fontSize: "18px",
    fontFamily: "monospace",
    fontWeight: "bold",
    background: NEON_GREEN,
    color: BG_COLOR,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "20px",
    boxShadow: `0 0 24px ${NEON_GREEN}55`,
    transition: "transform 0.1s",
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        fontFamily: "monospace",
        color: "#fff",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          width: GAME_W,
          height: GAME_H,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_W}
          height={GAME_H}
          style={{
            display: "block",
            background: BG_COLOR,
            borderRadius: "8px",
            border: "1px solid #222",
          }}
        />

        {gameState === "idle" && (
          <div style={overlayStyle}>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                color: NEON_GREEN,
                textShadow: `0 0 30px ${NEON_GREEN}`,
                margin: 0,
                letterSpacing: 3,
              }}
            >
              NEON SNAKE
            </h1>
            <div
              style={{
                marginTop: "24px",
                color: "#aaa",
                textAlign: "center",
                lineHeight: 2,
                fontSize: "14px",
              }}
            >
              <div>← → ↑ ↓ or WASD to move</div>
              <div>SPACE to start · Walls wrap around</div>
              <div
                style={{ marginTop: "12px", color: "#888", fontSize: "12px" }}
              >
                ⚡ Speed &nbsp; 🐢 Slow &nbsp; 👻 Ghost &nbsp; 🧲 Magnet &nbsp;
                ✂️ Shrink &nbsp; ✨ 2x
              </div>
              <div
                style={{ marginTop: "8px", color: "#ff8800", fontSize: "12px" }}
              >
                ⚠ New obstacles appear each level · Combos for fast eating!
              </div>
            </div>
            <button style={btnStyle} onClick={startGame}>
              ▶ START GAME
            </button>
          </div>
        )}

        {gameState === "paused" && (
          <div style={overlayStyle}>
            <h2
              style={{
                fontSize: "32px",
                color: "#fff",
                margin: 0,
                letterSpacing: "8px",
              }}
            >
              PAUSED
            </h2>
            <p style={{ color: "#888", marginTop: "14px", fontSize: "14px" }}>
              Press SPACE to resume
            </p>
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
              style={{ fontSize: "22px", color: NEON_GREEN, marginTop: "18px" }}
            >
              Score: {displayScore}
            </p>
            <p style={{ fontSize: "14px", color: "#888", marginTop: "4px" }}>
              Level {displayLevel}
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
