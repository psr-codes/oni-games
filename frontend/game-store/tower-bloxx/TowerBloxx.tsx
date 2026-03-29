"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreChange?: (score: number) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const CW = 500;
const CH = 700;
const BLOCK_W = 80;
const BLOCK_H = 24;
const CRANE_Y = 40;
const CRANE_CABLE_X = CW / 2;
const SWING_AMPLITUDE = 180;
const SWING_SPEED_BASE = 0.025;
const GRAVITY = 0.45;
const WOBBLE_DECAY = 0.96;
const WOBBLE_SPRING = 0.08;
const MAX_LIVES = 3;
const PERFECT_THRESHOLD = 4;
const GOOD_THRESHOLD = 15;
const WIND_CHANGE_INTERVAL = 300;
const PARTICLE_COUNT = 12;
const STAR_COUNT = 40;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Block {
  x: number;
  y: number;
  w: number;
  placed: boolean;
  wobbleOffset: number;
  wobbleVel: number;
  color: string;
  perfectCombo: boolean;
}

interface FallingPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx: number;
  rot: number;
  rotVel: number;
  color: string;
  side: "left" | "right";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  speed: number;
}

type GameState = "menu" | "playing" | "gameover";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function randomColor(level: number): string {
  const hue = (level * 37 + 200) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function darken(color: string, amount: number): string {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return color;
  const h = parseInt(match[1]);
  const s = parseInt(match[2]);
  const l = Math.max(0, parseInt(match[3]) - amount);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function lighten(color: string, amount: number): string {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return color;
  const h = parseInt(match[1]);
  const s = parseInt(match[2]);
  const l = Math.min(100, parseInt(match[3]) + amount);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export default function TowerBloxx({ onGameOver, onScoreChange }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Game state refs (using refs for animation loop access)
  const stateRef = useRef<GameState>("menu");
  const blocksRef = useRef<Block[]>([]);
  const fallingPiecesRef = useRef<FallingPiece[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const highScoreRef = useRef(0);
  const swingAngleRef = useRef(0);
  const swingSpeedRef = useRef(SWING_SPEED_BASE);
  const windRef = useRef(0);
  const windTargetRef = useRef(0);
  const windTimerRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraTargetRef = useRef(0);
  const currentBlockRef = useRef<{
    x: number;
    y: number;
    w: number;
    dropping: boolean;
    vy: number;
    color: string;
  } | null>(null);
  const flashRef = useRef(0);
  const flashColorRef = useRef("");
  const shakeRef = useRef(0);
  const messageRef = useRef("");
  const messageTimerRef = useRef(0);
  const levelRef = useRef(1);
  const frameRef = useRef(0);
  const pendingDropRef = useRef(false);
  const powerupCountRef = useRef(0);
  const perfectTotalRef = useRef(0);
  const pausedRef = useRef(false);
  const [, forceUpdate] = useState(0);

  // Info icon hit area (top-right corner)
  const INFO_ICON_X = CW - 40;
  const INFO_ICON_Y = 12;
  const INFO_ICON_R = 14;

  // ─── Init stars ────────────────────────────────────────────────────────────
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * CW,
        y: Math.random() * CH * 3,
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
      });
    }
    starsRef.current = stars;
  }, []);

  // ─── Game logic functions ──────────────────────────────────────────────────
  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number = PARTICLE_COUNT) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 4 - 1,
          life: 1,
          maxLife: 30 + Math.random() * 20,
          color,
          size: Math.random() * 4 + 2,
        });
      }
    },
    [],
  );

  const showMessage = useCallback((msg: string) => {
    messageRef.current = msg;
    messageTimerRef.current = 90;
  }, []);

  const resetGame = useCallback(() => {
    const baseY = CH - BLOCK_H - 10;
    blocksRef.current = [
      {
        x: CW / 2 - BLOCK_W / 2,
        y: baseY,
        w: BLOCK_W,
        placed: true,
        wobbleOffset: 0,
        wobbleVel: 0,
        color: randomColor(0),
        perfectCombo: false,
      },
    ];
    fallingPiecesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    livesRef.current = MAX_LIVES;
    swingAngleRef.current = 0;
    swingSpeedRef.current = SWING_SPEED_BASE;
    windRef.current = 0;
    windTargetRef.current = 0;
    windTimerRef.current = 0;
    cameraYRef.current = 0;
    cameraTargetRef.current = 0;
    currentBlockRef.current = null;
    flashRef.current = 0;
    shakeRef.current = 0;
    messageRef.current = "";
    messageTimerRef.current = 0;
    levelRef.current = 1;
    powerupCountRef.current = 0;
    perfectTotalRef.current = 0;
    stateRef.current = "playing";
    onScoreChange?.(0);
    spawnNextBlock();
    forceUpdate((n) => n + 1);
  }, [onScoreChange]);

  const spawnNextBlock = useCallback(() => {
    const blocks = blocksRef.current;
    const topBlock = blocks[blocks.length - 1];
    const color = randomColor(blocks.length);
    currentBlockRef.current = {
      x: 0,
      y: topBlock.y - BLOCK_H - 60,
      w: topBlock.w,
      dropping: false,
      vy: 0,
      color,
    };
  }, []);

  const dropBlock = useCallback(() => {
    if (!currentBlockRef.current || currentBlockRef.current.dropping) return;
    currentBlockRef.current.dropping = true;
    currentBlockRef.current.vy = 0;
    pendingDropRef.current = false;
  }, []);

  const handleDrop = useCallback(() => {
    if (stateRef.current === "menu") {
      resetGame();
      return;
    }
    if (stateRef.current === "gameover") {
      stateRef.current = "menu";
      forceUpdate((n) => n + 1);
      return;
    }
    if (stateRef.current === "playing") {
      dropBlock();
    }
  }, [dropBlock, resetGame]);

  // ─── Input handlers ───────────────────────────────────────────────────────
  const useRebuildPowerup = useCallback(() => {
    if (stateRef.current !== "playing") return;
    if (powerupCountRef.current <= 0) return;
    powerupCountRef.current--;
    livesRef.current = MAX_LIVES;
    // Rebuild: set top block width to full base width
    const blocks = blocksRef.current;
    if (blocks.length > 0) {
      const topBlock = blocks[blocks.length - 1];
      const centerX = topBlock.x + topBlock.w / 2;
      topBlock.w = BLOCK_W;
      topBlock.x = centerX - BLOCK_W / 2;
      topBlock.perfectCombo = true; // highlight it gold
      // Also update current swinging block width
      if (currentBlockRef.current && !currentBlockRef.current.dropping) {
        currentBlockRef.current.w = BLOCK_W;
      }
    }
    flashRef.current = 25;
    flashColorRef.current = "rgba(0,255,136,0.35)";
    shakeRef.current = 8;
    showMessage("🔧 REBUILT! Full width + lives restored!");
    spawnParticles(CW / 2, CH / 2, "#00ff88", 30);
    forceUpdate((n) => n + 1);
  }, [showMessage, spawnParticles]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === "Space" ||
        e.code === "ArrowDown" ||
        e.key === "s" ||
        e.key === "S"
      ) {
        e.preventDefault();
        handleDrop();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        useRebuildPowerup();
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        if (stateRef.current === "playing") {
          pausedRef.current = !pausedRef.current;
          forceUpdate((n) => n + 1);
        }
      }
      if (e.key === "Escape") {
        if (pausedRef.current) {
          pausedRef.current = false;
          forceUpdate((n) => n + 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDrop, useRebuildPowerup]);

  // ─── Main game loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      frameRef.current++;
      const frame = frameRef.current;
      const state = stateRef.current;

      // ─── Update ──────────────────────────────────────────────────────
      if (state === "playing" && !pausedRef.current) {
        // Wind
        windTimerRef.current++;
        if (windTimerRef.current > WIND_CHANGE_INTERVAL) {
          windTimerRef.current = 0;
          const lvl = Math.min(blocksRef.current.length / 5, 3);
          windTargetRef.current = (Math.random() - 0.5) * lvl * 0.8;
        }
        windRef.current = lerp(windRef.current, windTargetRef.current, 0.01);

        // Swing
        swingAngleRef.current += swingSpeedRef.current;
        const swingX =
          CRANE_CABLE_X +
          Math.sin(swingAngleRef.current) * SWING_AMPLITUDE +
          windRef.current * 20;

        // Current block
        const cur = currentBlockRef.current;
        if (cur && !cur.dropping) {
          cur.x = swingX - cur.w / 2;
          cur.y =
            blocksRef.current[blocksRef.current.length - 1].y -
            BLOCK_H -
            60 -
            cameraYRef.current;
        }

        if (cur && cur.dropping) {
          cur.vy += GRAVITY;
          cur.y += cur.vy;

          const topBlock = blocksRef.current[blocksRef.current.length - 1];
          const landY = topBlock.y - BLOCK_H;

          if (cur.y + cameraYRef.current >= landY) {
            cur.y = landY - cameraYRef.current;
            const actualY = landY;

            // Clear current block BEFORE spawning next
            currentBlockRef.current = null;

            // Calculate overlap
            const curLeft = cur.x;
            const curRight = cur.x + cur.w;
            const topLeft = topBlock.x;
            const topRight = topBlock.x + topBlock.w;

            const overlapLeft = Math.max(curLeft, topLeft);
            const overlapRight = Math.min(curRight, topRight);
            const overlapW = overlapRight - overlapLeft;

            if (overlapW <= 0) {
              // Total miss
              livesRef.current--;
              shakeRef.current = 15;
              showMessage("MISS!");

              fallingPiecesRef.current.push({
                x: cur.x,
                y: actualY,
                w: cur.w,
                h: BLOCK_H,
                vy: 2,
                vx: cur.x < topBlock.x ? -3 : 3,
                rot: 0,
                rotVel: (Math.random() - 0.5) * 0.1,
                color: cur.color,
                side: cur.x < topBlock.x ? "left" : "right",
              });

              comboRef.current = 0;

              if (livesRef.current <= 0) {
                stateRef.current = "gameover";
                if (scoreRef.current > highScoreRef.current) {
                  highScoreRef.current = scoreRef.current;
                }
                onGameOver(scoreRef.current);
                forceUpdate((n) => n + 1);
              } else {
                spawnNextBlock();
              }
            } else {
              // Landed!
              const offset = overlapLeft - topBlock.x;
              const diff = Math.abs(
                cur.x + cur.w / 2 - (topBlock.x + topBlock.w / 2),
              );
              let isPerfect = diff < PERFECT_THRESHOLD;
              let isGood = diff < GOOD_THRESHOLD;

              if (curLeft < topLeft) {
                const trimW = topLeft - curLeft;
                fallingPiecesRef.current.push({
                  x: curLeft,
                  y: actualY,
                  w: trimW,
                  h: BLOCK_H,
                  vy: 1,
                  vx: -2 - Math.random() * 2,
                  rot: 0,
                  rotVel: -0.05 - Math.random() * 0.05,
                  color: cur.color,
                  side: "left",
                });
              }
              if (curRight > topRight) {
                const trimW = curRight - topRight;
                fallingPiecesRef.current.push({
                  x: topRight,
                  y: actualY,
                  w: trimW,
                  h: BLOCK_H,
                  vy: 1,
                  vx: 2 + Math.random() * 2,
                  rot: 0,
                  rotVel: 0.05 + Math.random() * 0.05,
                  color: cur.color,
                  side: "right",
                });
              }

              let finalW = overlapW;
              let finalX = overlapLeft;
              if (isPerfect && blocksRef.current.length > 2) {
                finalW = Math.min(topBlock.w + 2, BLOCK_W);
                finalX = topBlock.x + topBlock.w / 2 - finalW / 2;
              }

              const wobbleVel =
                (cur.x + cur.w / 2 - (topBlock.x + topBlock.w / 2)) * 0.15;

              blocksRef.current.push({
                x: finalX,
                y: actualY,
                w: finalW,
                placed: true,
                wobbleOffset: 0,
                wobbleVel: wobbleVel,
                color: cur.color,
                perfectCombo: isPerfect,
              });

              let points = 10;
              if (isPerfect) {
                comboRef.current++;
                perfectTotalRef.current++;
                points = 10 + comboRef.current * 5;
                if (comboRef.current > bestComboRef.current)
                  bestComboRef.current = comboRef.current;
                flashRef.current = 20;
                flashColorRef.current = "rgba(255,215,0,0.3)";
                // Grant powerup every 5 perfects
                if (
                  perfectTotalRef.current > 0 &&
                  perfectTotalRef.current % 5 === 0
                ) {
                  powerupCountRef.current++;
                  showMessage(`🔧 REBUILD EARNED! (R to use)`);
                  spawnParticles(CW / 2, actualY, "#00ff88", 25);
                } else {
                  showMessage(
                    comboRef.current >= 3
                      ? `🔥 PERFECT x${comboRef.current}!`
                      : "PERFECT!",
                  );
                }
                spawnParticles(CW / 2, actualY, "#FFD700", 20);
              } else if (isGood) {
                comboRef.current = 0;
                points = 8;
                showMessage("GOOD!");
                spawnParticles(CW / 2, actualY, cur.color, 8);
              } else {
                comboRef.current = 0;
                points = 5;
                showMessage("OK");
              }

              scoreRef.current += points;
              onScoreChange?.(scoreRef.current);

              levelRef.current = Math.floor(blocksRef.current.length / 10) + 1;
              swingSpeedRef.current =
                SWING_SPEED_BASE + blocksRef.current.length * 0.0008;

              if (actualY < CH * 0.45) {
                cameraTargetRef.current = CH * 0.45 - actualY;
              }

              spawnNextBlock();
            }
          }
        }

        // Camera smooth follow
        cameraYRef.current = lerp(
          cameraYRef.current,
          cameraTargetRef.current,
          0.06,
        );

        // Wobble physics
        for (let i = blocksRef.current.length - 1; i >= 1; i--) {
          const b = blocksRef.current[i];
          const below = blocksRef.current[i - 1];
          const centerDiff = b.x + b.w / 2 - (below.x + below.w / 2);
          b.wobbleVel +=
            -b.wobbleOffset * WOBBLE_SPRING + windRef.current * 0.02;
          b.wobbleVel *= WOBBLE_DECAY;
          b.wobbleOffset += b.wobbleVel;
        }

        // Falling pieces
        fallingPiecesRef.current = fallingPiecesRef.current.filter((p) => {
          p.vy += GRAVITY * 0.5;
          p.y += p.vy;
          p.x += p.vx;
          p.rot += p.rotVel;
          return p.y < CH + 200;
        });

        // Particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1;
          p.life -= 1 / p.maxLife;
          return p.life > 0;
        });

        // Flash/shake decay
        if (flashRef.current > 0) flashRef.current--;
        if (shakeRef.current > 0) shakeRef.current--;
        if (messageTimerRef.current > 0) messageTimerRef.current--;
      }

      // Star twinkle
      starsRef.current.forEach((s) => {
        s.twinkle += s.speed;
      });

      // ─── Render ────────────────────────────────────────────────────────
      ctx.save();

      // Shake
      if (shakeRef.current > 0) {
        const intensity = shakeRef.current * 0.8;
        ctx.translate(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
        );
      }

      // Sky gradient (gets darker as tower grows)
      const skyDarkness = Math.min(blocksRef.current.length * 2, 40);
      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, `hsl(220, 60%, ${Math.max(8, 25 - skyDarkness)}%)`);
      grad.addColorStop(
        0.5,
        `hsl(240, 50%, ${Math.max(12, 35 - skyDarkness)}%)`,
      );
      grad.addColorStop(1, `hsl(260, 40%, ${Math.max(18, 50 - skyDarkness)}%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);

      // Stars
      starsRef.current.forEach((s) => {
        const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
        const sy = (s.y + cameraYRef.current * 0.1) % (CH * 3);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, sy % CH, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Camera transform for blocks
      ctx.save();
      ctx.translate(0, cameraYRef.current);

      // Ground
      ctx.fillStyle = "#2a1a3a";
      ctx.fillRect(0, CH - 8, CW, 10);
      const groundGrad = ctx.createLinearGradient(0, CH - 8, 0, CH + 2);
      groundGrad.addColorStop(0, "#4a2a6a");
      groundGrad.addColorStop(1, "#2a1a3a");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, CH - 8, CW, 10);

      // Blocks
      blocksRef.current.forEach((b, i) => {
        ctx.save();
        // Apply cumulative wobble
        let totalWobble = 0;
        for (let j = 1; j <= i; j++) {
          totalWobble += blocksRef.current[j].wobbleOffset;
        }
        ctx.translate(totalWobble, 0);

        // Block body
        const bGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BLOCK_H);
        bGrad.addColorStop(0, lighten(b.color, 10));
        bGrad.addColorStop(0.5, b.color);
        bGrad.addColorStop(1, darken(b.color, 15));
        ctx.fillStyle = bGrad;

        // Rounded rect
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(b.x + r, b.y);
        ctx.lineTo(b.x + b.w - r, b.y);
        ctx.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + r);
        ctx.lineTo(b.x + b.w, b.y + BLOCK_H - r);
        ctx.quadraticCurveTo(
          b.x + b.w,
          b.y + BLOCK_H,
          b.x + b.w - r,
          b.y + BLOCK_H,
        );
        ctx.lineTo(b.x + r, b.y + BLOCK_H);
        ctx.quadraticCurveTo(b.x, b.y + BLOCK_H, b.x, b.y + BLOCK_H - r);
        ctx.lineTo(b.x, b.y + r);
        ctx.quadraticCurveTo(b.x, b.y, b.x + r, b.y);
        ctx.closePath();
        ctx.fill();

        // Highlight line
        ctx.strokeStyle = `rgba(255,255,255,0.2)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + 4, b.y + 3);
        ctx.lineTo(b.x + b.w - 4, b.y + 3);
        ctx.stroke();

        // Window dots for placed blocks
        if (b.placed && b.w > 30) {
          const windowCount = Math.floor(b.w / 18);
          const spacing = b.w / (windowCount + 1);
          for (let wi = 1; wi <= windowCount; wi++) {
            const wx = b.x + spacing * wi;
            const wy = b.y + BLOCK_H / 2;
            ctx.fillStyle = `rgba(255,255,180,${0.4 + Math.sin(frame * 0.05 + wi + i) * 0.2})`;
            ctx.fillRect(wx - 3, wy - 3, 6, 6);
          }
        }

        // Perfect combo glow
        if (b.perfectCombo) {
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 8 + Math.sin(frame * 0.1) * 4;
          ctx.strokeStyle = "rgba(255,215,0,0.5)";
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.w, BLOCK_H);
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      });

      // Falling pieces
      fallingPiecesRef.current.forEach((p) => {
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.globalAlpha = 1;
        ctx.restore();
      });

      ctx.restore(); // end camera

      // Crane (fixed to screen)
      if (
        state === "playing" &&
        currentBlockRef.current &&
        !currentBlockRef.current.dropping
      ) {
        const cur = currentBlockRef.current;
        const blockScreenY = cur.y;
        const blockCenterX = cur.x + cur.w / 2;

        // Cable
        ctx.strokeStyle = "rgba(200,200,200,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CRANE_CABLE_X, 0);
        ctx.lineTo(blockCenterX, blockScreenY);
        ctx.stroke();

        // Hook
        ctx.fillStyle = "#ccc";
        ctx.beginPath();
        ctx.arc(blockCenterX, blockScreenY - 4, 5, 0, Math.PI * 2);
        ctx.fill();

        // Swinging block
        const bGrad = ctx.createLinearGradient(
          cur.x,
          blockScreenY,
          cur.x,
          blockScreenY + BLOCK_H,
        );
        bGrad.addColorStop(0, lighten(cur.color, 10));
        bGrad.addColorStop(1, darken(cur.color, 10));
        ctx.fillStyle = bGrad;
        ctx.fillRect(cur.x, blockScreenY, cur.w, BLOCK_H);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cur.x, blockScreenY, cur.w, BLOCK_H);
      }

      // Dropping block
      if (
        state === "playing" &&
        currentBlockRef.current &&
        currentBlockRef.current.dropping
      ) {
        const cur = currentBlockRef.current;
        const screenY = cur.y;
        ctx.fillStyle = cur.color;
        ctx.fillRect(cur.x, screenY, cur.w, BLOCK_H);
      }

      // Particles
      particlesRef.current.forEach((p) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + cameraYRef.current, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Flash overlay
      if (flashRef.current > 0) {
        ctx.fillStyle = flashColorRef.current;
        ctx.globalAlpha = flashRef.current / 20;
        ctx.fillRect(0, 0, CW, CH);
        ctx.globalAlpha = 1;
      }

      // Wind indicator
      if (state === "playing") {
        const windStrength = Math.abs(windRef.current);
        if (windStrength > 0.1) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(windStrength * 0.5, 0.7)})`;
          ctx.font = "12px monospace";
          ctx.textAlign = "right";
          const windDir = windRef.current > 0 ? "→" : "←";
          const windBars = "▮".repeat(
            Math.min(Math.floor(windStrength * 4), 5),
          );
          ctx.fillText(`WIND ${windDir} ${windBars}`, CW - 15, 25);
        }
      }

      // HUD
      if (state === "playing") {
        // Score
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(10, 10, 140, 55);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${scoreRef.current}`, 20, 35);
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(
          `FLOOR ${blocksRef.current.length}  LVL ${levelRef.current}`,
          20,
          55,
        );

        // Lives
        for (let i = 0; i < MAX_LIVES; i++) {
          ctx.fillStyle =
            i < livesRef.current ? "#ff4466" : "rgba(255,255,255,0.2)";
          ctx.font = "18px sans-serif";
          ctx.fillText("♥", CW - 30 - i * 24, CH - 15);
        }

        // Combo
        if (comboRef.current >= 2) {
          ctx.fillStyle = "#FFD700";
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`🔥 COMBO x${comboRef.current}`, CW / 2, 30);
        }

        // Rebuild powerup indicator
        if (powerupCountRef.current > 0) {
          const pulse = 0.8 + Math.sin(frame * 0.08) * 0.2;
          ctx.fillStyle = `rgba(0,255,136,${pulse})`;
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            `🔧 REBUILD x${powerupCountRef.current}  [R]`,
            CW / 2,
            CH - 15,
          );
        }

        // Perfect progress toward next powerup
        const toNext = 5 - (perfectTotalRef.current % 5);
        if (toNext < 5 && toNext > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            `${toNext} more perfect${toNext > 1 ? "s" : ""} → 🔧`,
            CW / 2,
            CH - 35,
          );
        }
      }

      // Message popup
      if (messageTimerRef.current > 0 && messageRef.current) {
        const alpha = Math.min(messageTimerRef.current / 20, 1);
        const yOff = (1 - alpha) * -20;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 10;
        ctx.fillText(messageRef.current, CW / 2, CH / 2 - 100 + yOff);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // ─── Shared info panel helper ──────────────────────────────────────
      const drawInfoPanel = (startY: number) => {
        ctx.textAlign = "center";

        // Gameplay section
        ctx.fillStyle = "rgba(255,215,0,0.9)";
        ctx.font = "bold 13px monospace";
        ctx.fillText("─── HOW TO PLAY ───", CW / 2, startY);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "11px monospace";
        const tips = [
          "🏗️ Stack blocks from a swinging crane",
          "🎯 Align blocks perfectly for bonus points",
          "💨 Wind gets stronger as you build higher",
          "♥ You have 3 lives — miss = lose a life",
        ];
        tips.forEach((t, i) => {
          ctx.fillText(t, CW / 2, startY + 20 + i * 18);
        });

        // Controls section
        ctx.fillStyle = "rgba(255,215,0,0.9)";
        ctx.font = "bold 13px monospace";
        ctx.fillText("─── CONTROLS ───", CW / 2, startY + 100);

        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "11px monospace";
        ctx.fillText("SPACE / S / ↓ / TAP = Drop block", CW / 2, startY + 118);
        ctx.fillText("R = Use Rebuild powerup", CW / 2, startY + 136);
        ctx.fillText("I = Pause / Info", CW / 2, startY + 154);

        // Powerup section
        ctx.fillStyle = "rgba(0,255,136,0.9)";
        ctx.font = "bold 13px monospace";
        ctx.fillText("─── 🔧 REBUILD POWERUP ───", CW / 2, startY + 184);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "11px monospace";
        const pwInfo = [
          "Land 5 PERFECT stacks → earn a Rebuild",
          "Press R to rebuild top block to full width",
          "Also restores all ♥ lives!",
        ];
        pwInfo.forEach((t, i) => {
          ctx.fillText(t, CW / 2, startY + 204 + i * 18);
        });

        // Scoring
        ctx.fillStyle = "rgba(255,215,0,0.9)";
        ctx.font = "bold 13px monospace";
        ctx.fillText("─── SCORING ───", CW / 2, startY + 268);

        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "11px monospace";
        ctx.fillText(
          "PERFECT = 10 + combo×5  |  GOOD = 8  |  OK = 5",
          CW / 2,
          startY + 288,
        );
      };

      // ─── Menu ────────────────────────────────────────────────────────
      if (state === "menu") {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, CW, CH);

        // Title
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 20;
        ctx.fillText("TOWER BLOXX", CW / 2, 70);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "14px monospace";
        ctx.fillText("THE BALANCE BUILDER", CW / 2, 95);

        // Info panel
        drawInfoPanel(140);

        // Animated prompt
        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText("TAP or SPACE to START", CW / 2, CH - 60);

        if (highScoreRef.current > 0) {
          ctx.fillStyle = "#FFD700";
          ctx.font = "14px monospace";
          ctx.fillText(`BEST: ${highScoreRef.current}`, CW / 2, CH - 30);
        }
      }

      // ─── Paused / Info overlay ─────────────────────────────────────────
      if (state === "playing" && pausedRef.current) {
        ctx.fillStyle = "rgba(0,0,0,0.80)";
        ctx.fillRect(0, 0, CW, CH);

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillText("⏸ PAUSED", CW / 2, 60);

        drawInfoPanel(110);

        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("TAP or press I to RESUME", CW / 2, CH - 40);
      }

      // ─── Info icon (always visible during gameplay) ─────────────────
      if (state === "playing" && !pausedRef.current) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.arc(
          INFO_ICON_X,
          INFO_ICON_Y + INFO_ICON_R,
          INFO_ICON_R,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ℹ", INFO_ICON_X, INFO_ICON_Y + INFO_ICON_R + 1);
        ctx.textBaseline = "alphabetic";
      }

      // ─── Game Over ───────────────────────────────────────────────────
      if (state === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, CW, CH);

        ctx.fillStyle = "#ff4466";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CW / 2, CH / 2 - 60);

        ctx.fillStyle = "#fff";
        ctx.font = "22px monospace";
        ctx.fillText(`SCORE: ${scoreRef.current}`, CW / 2, CH / 2 - 10);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "16px monospace";
        ctx.fillText(
          `FLOORS: ${blocksRef.current.length}`,
          CW / 2,
          CH / 2 + 25,
        );
        ctx.fillText(
          `BEST COMBO: x${bestComboRef.current}`,
          CW / 2,
          CH / 2 + 50,
        );

        if (
          scoreRef.current >= highScoreRef.current &&
          highScoreRef.current > 0
        ) {
          ctx.fillStyle = "#FFD700";
          ctx.font = "bold 18px monospace";
          ctx.fillText("★ NEW HIGH SCORE! ★", CW / 2, CH / 2 + 85);
        }

        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font = "16px monospace";
        ctx.fillText("TAP to CONTINUE", CW / 2, CH / 2 + 130);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onGameOver, onScoreChange, spawnParticles, showMessage, spawnNextBlock]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        onClick={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const cx = (e.clientX - rect.left) * (CW / rect.width);
          const cy = (e.clientY - rect.top) * (CH / rect.height);
          const dx = cx - INFO_ICON_X;
          const dy = cy - (INFO_ICON_Y + INFO_ICON_R);
          if (
            stateRef.current === "playing" &&
            Math.sqrt(dx * dx + dy * dy) < INFO_ICON_R + 5
          ) {
            pausedRef.current = !pausedRef.current;
            forceUpdate((n) => n + 1);
            return;
          }
          if (pausedRef.current) {
            pausedRef.current = false;
            forceUpdate((n) => n + 1);
            return;
          }
          handleDrop();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          const rect = canvasRef.current!.getBoundingClientRect();
          const cx = (e.touches[0].clientX - rect.left) * (CW / rect.width);
          const cy = (e.touches[0].clientY - rect.top) * (CH / rect.height);
          const dx = cx - INFO_ICON_X;
          const dy = cy - (INFO_ICON_Y + INFO_ICON_R);
          if (
            stateRef.current === "playing" &&
            Math.sqrt(dx * dx + dy * dy) < INFO_ICON_R + 5
          ) {
            pausedRef.current = !pausedRef.current;
            forceUpdate((n) => n + 1);
            return;
          }
          if (pausedRef.current) {
            pausedRef.current = false;
            forceUpdate((n) => n + 1);
            return;
          }
          handleDrop();
        }}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: `${CW} / ${CH}`,
          borderRadius: "8px",
          boxShadow: "0 0 40px rgba(100,60,180,0.3)",
          cursor: "pointer",
          display: "block",
        }}
      />
    </div>
  );
}
