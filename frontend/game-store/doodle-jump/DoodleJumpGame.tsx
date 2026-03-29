"use client";
import { useRef, useEffect, useCallback, useState } from "react";

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreChange?: (score: number) => void;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  type: "normal" | "moving" | "breaking" | "spring" | "jetpack";
  dir?: number;
  broken?: boolean;
}

interface Star {
  x: number;
  y: number;
  collected: boolean;
  angle: number;
}

interface Heart {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

interface Monster {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  alive: boolean;
  type: "blob" | "bat";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface GameState {
  playerX: number;
  playerY: number;
  playerVX: number;
  playerVY: number;
  platforms: Platform[];
  stars: Star[];
  hearts: Heart[];
  monsters: Monster[];
  particles: Particle[];
  score: number;
  highScore: number;
  maxHeight: number;
  gameOver: boolean;
  started: boolean;
  jetpackTimer: number;
  facing: number;
  dayCycle: number;
  lives: number;
  respawnTimer: number;
}

const CW = 400;
const CH = 640;
const PW = 32;
const PH = 32;
const GRAVITY = 0.35;
const JUMP = -10;
const SPRING = -15;
const JETPACK_F = -0.8;
const MOVE_SPD = 5;
const PLAT_H = 12;

function rand(a: number, b: number) {
  return Math.random() * (b - a) + a;
}

function genPlats(startY: number, count: number, diff: number): Platform[] {
  const p: Platform[] = [];
  let y = startY;
  for (let i = 0; i < count; i++) {
    y -= rand(50, 80 + diff * 2);
    const w = rand(55, 85 - Math.min(diff, 20));
    const x = rand(10, CW - w - 10);
    const r = Math.random();
    let type: Platform["type"] = "normal";
    if (diff > 2) {
      if (r < 0.08) type = "jetpack";
      else if (r < 0.18) type = "spring";
      else if (r < 0.3) type = "breaking";
      else if (r < 0.45) type = "moving";
    } else if (diff > 0) {
      if (r < 0.05) type = "spring";
      else if (r < 0.12) type = "breaking";
      else if (r < 0.22) type = "moving";
    }
    p.push({
      x,
      y,
      w,
      type,
      dir: type === "moving" ? (Math.random() > 0.5 ? 1 : -1) : 0,
    });
  }
  return p;
}

function genStars(plats: Platform[]): Star[] {
  return plats
    .filter(() => Math.random() < 0.15)
    .map((p) => ({
      x: p.x + p.w / 2,
      y: p.y - 25,
      collected: false,
      angle: 0,
    }));
}

function genMonsters(plats: Platform[], diff: number): Monster[] {
  if (diff < 3) return [];
  return plats
    .filter(() => Math.random() < 0.04 * Math.min(diff, 8))
    .map((p) => ({
      x: p.x,
      y: p.y - 40,
      w: 30,
      h: 30,
      dir: Math.random() > 0.5 ? 1 : -1,
      alive: true,
      type: Math.random() > 0.5 ? ("blob" as const) : ("bat" as const),
    }));
}

function genHearts(plats: Platform[]): Heart[] {
  return plats
    .filter(() => Math.random() < 0.03)
    .map((p) => ({
      x: p.x + p.w / 2,
      y: p.y - 25,
      collected: false,
      pulse: 0,
    }));
}

export default function DoodleJumpGame({
  onGameOver,
  onScoreChange,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const touchRef = useRef<number | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    const s = localStorage.getItem("doodle-high");
    return s ? parseInt(s) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [starsCollected, setStarsCollected] = useState(0);
  const [lives, setLives] = useState(0);

  const spawnParticles = (
    x: number,
    y: number,
    color: string,
    count: number,
  ) => {
    const s = stateRef.current;
    if (!s) return;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-4, 1),
        life: rand(20, 40),
        color,
        size: rand(2, 5),
      });
    }
  };

  const initGame = useCallback(() => {
    const plats = genPlats(CH - 50, 20, 0);
    plats.push({ x: CW / 2 - 40, y: CH - 30, w: 80, type: "normal" });
    stateRef.current = {
      playerX: CW / 2 - PW / 2,
      playerY: CH - 60,
      playerVX: 0,
      playerVY: 0,
      platforms: plats,
      stars: genStars(plats),
      hearts: genHearts(plats),
      monsters: [],
      particles: [],
      score: 0,
      highScore,
      maxHeight: CH - 60,
      gameOver: false,
      started: true,
      jetpackTimer: 0,
      facing: 1,
      dayCycle: 0,
      lives: 0,
      respawnTimer: 0,
    };
    setScore(0);
    setGameOver(false);
    setStarted(true);
    setStarsCollected(0);
    setLives(0);
  }, [highScore]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Touch
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ts = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current = e.touches[0].clientX;
    };
    const tm = (e: TouchEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      if (!s || touchRef.current === null) return;
      const dx = e.touches[0].clientX - touchRef.current;
      touchRef.current = e.touches[0].clientX;
      s.playerVX = dx * 0.8;
      s.facing = dx > 0 ? 1 : dx < 0 ? -1 : s.facing;
    };
    const te = () => {
      touchRef.current = null;
      if (stateRef.current) stateRef.current.playerVX = 0;
    };
    c.addEventListener("touchstart", ts, { passive: false });
    c.addEventListener("touchmove", tm, { passive: false });
    c.addEventListener("touchend", te);
    return () => {
      c.removeEventListener("touchstart", ts);
      c.removeEventListener("touchmove", tm);
      c.removeEventListener("touchend", te);
    };
  }, []);

  // Drawing helpers
  const drawBg = (ctx: CanvasRenderingContext2D, dc: number) => {
    const dr = Math.sin(dc * Math.PI);
    const top = `hsl(${200}, ${70 - (1 - dr) * 50}%, ${65 * dr + 12 * (1 - dr)}%)`;
    const bot = `hsl(${190}, ${60 - (1 - dr) * 40}%, ${82 * dr + 25 * (1 - dr)}%)`;
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    if (dr < 0.4) {
      const a = (0.4 - dr) / 0.4;
      ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.arc(
          (i * 137.5) % CW,
          (i * 97.3) % (CH * 0.6),
          1 + (i % 3),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  };

  const drawPlat = (ctx: CanvasRenderingContext2D, p: Platform) => {
    if (p.broken) return;
    ctx.save();
    const colors: Record<Platform["type"], string> = {
      normal: "#4ade80",
      moving: "#60a5fa",
      breaking: "#f97316",
      spring: "#4ade80",
      jetpack: "#a78bfa",
    };
    ctx.fillStyle = colors[p.type];
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, PLAT_H, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.roundRect(p.x + 2, p.y + 1, p.w - 4, 4, 3);
    ctx.fill();
    if (p.type === "spring") {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(p.x + p.w / 2 - 4, p.y - 10, 8, 10);
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.type === "jetpack") {
      ctx.fillStyle = "#c084fc";
      ctx.fillRect(p.x + p.w / 2 - 5, p.y - 16, 10, 14);
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, p.y - 1, 4, 5, 0, 0, Math.PI);
      ctx.fill();
    }
    if (p.type === "breaking") {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.3, p.y + 2);
      ctx.lineTo(p.x + p.w * 0.5, p.y + PLAT_H - 2);
      ctx.moveTo(p.x + p.w * 0.6, p.y + 1);
      ctx.lineTo(p.x + p.w * 0.7, p.y + PLAT_H - 3);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, star: Star) => {
    if (star.collected) return;
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.rotate(star.angle);
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 8 : 4;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      i === 0
        ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, h: Heart) => {
    if (h.collected) return;
    const s = 1 + Math.sin(h.pulse) * 0.15;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(s, s);
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-8, -4, -14, -2, -8, -8);
    ctx.bezierCurveTo(-4, -12, 0, -8, 0, -5);
    ctx.bezierCurveTo(0, -8, 4, -12, 8, -8);
    ctx.bezierCurveTo(14, -2, 8, -4, 0, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster) => {
    if (!m.alive) return;
    ctx.save();
    ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
    if (m.type === "blob") {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.ellipse(0, 0, m.w / 2, m.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(-6, -4, 4, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(6, -4, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(-5, -3, 2, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(7, -3, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      const wf = Math.sin(Date.now() / 100) * 8;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.quadraticCurveTo(-20, -10 + wf, -18, 5);
      ctx.moveTo(8, 0);
      ctx.quadraticCurveTo(20, -10 + wf, 18, 5);
      ctx.fillStyle = "#6d28d9";
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(-3, -3, 2, 0, Math.PI * 2);
      ctx.arc(3, -3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, s: GameState) => {
    ctx.save();
    ctx.translate(s.playerX + PW / 2, s.playerY + PH / 2);
    ctx.scale(s.facing, 1);
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#86efac";
    ctx.beginPath();
    ctx.ellipse(10, 0, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(3, -5, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.ellipse(5, -5, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-10, 14, 8, 4);
    ctx.fillRect(2, 14, 8, 4);
    if (s.jetpackTimer > 0) {
      ctx.fillStyle = "#f97316";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(
          rand(-8, 0),
          rand(14, 28),
          rand(3, 6),
          rand(4, 8),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // Game loop
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = () => {
      const s = stateRef.current;
      if (!s || s.gameOver) return;

      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("a")) {
        s.playerVX = -MOVE_SPD;
        s.facing = -1;
      } else if (keys.has("ArrowRight") || keys.has("d")) {
        s.playerVX = MOVE_SPD;
        s.facing = 1;
      } else if (touchRef.current === null) {
        s.playerVX *= 0.85;
      }

      if (s.jetpackTimer > 0) {
        s.playerVY += JETPACK_F;
        s.jetpackTimer--;
        spawnParticles(s.playerX + PW / 2, s.playerY + PH, "#f97316", 1);
      } else {
        s.playerVY += GRAVITY;
      }

      s.playerX += s.playerVX;
      s.playerY += s.playerVY;
      if (s.playerX > CW) s.playerX = -PW;
      if (s.playerX < -PW) s.playerX = CW;

      for (const p of s.platforms) {
        if (p.type === "moving" && p.dir) {
          p.x += p.dir * 1.5;
          if (p.x <= 0 || p.x + p.w >= CW) p.dir *= -1;
        }
      }
      for (const m of s.monsters) {
        if (!m.alive) continue;
        m.x += m.dir * (m.type === "bat" ? 2 : 1);
        if (m.x <= 0 || m.x + m.w >= CW) m.dir *= -1;
        if (m.type === "bat") m.y += Math.sin(Date.now() / 300) * 0.5;
      }

      if (s.playerVY > 0) {
        for (const p of s.platforms) {
          if (p.broken) continue;
          const py = s.playerY + PH;
          if (
            s.playerX + PW > p.x &&
            s.playerX < p.x + p.w &&
            py >= p.y &&
            py <= p.y + PLAT_H + s.playerVY
          ) {
            if (p.type === "breaking") {
              s.playerY = p.y - PH;
              s.playerVY = JUMP;
              spawnParticles(s.playerX + PW / 2, s.playerY + PH, "#4ade80", 3);
              p.broken = true;
              spawnParticles(p.x + p.w / 2, p.y, "#f97316", 8);
              continue;
            }
            s.playerY = p.y - PH;
            if (p.type === "spring") {
              s.playerVY = SPRING;
              spawnParticles(p.x + p.w / 2, p.y, "#facc15", 6);
            } else if (p.type === "jetpack") {
              s.playerVY = JUMP;
              s.jetpackTimer = 80;
              spawnParticles(p.x + p.w / 2, p.y, "#c084fc", 10);
            } else {
              s.playerVY = JUMP;
            }
            spawnParticles(s.playerX + PW / 2, s.playerY + PH, "#4ade80", 3);
          }
        }
      }

      for (const star of s.stars) {
        if (star.collected) continue;
        star.angle += 0.03;
        const dx = s.playerX + PW / 2 - star.x,
          dy = s.playerY + PH / 2 - star.y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          star.collected = true;
          s.score += 50;
          spawnParticles(star.x, star.y, "#fbbf24", 8);
          setStarsCollected((c) => c + 1);
          onScoreChange?.(s.score);
        }
      }

      // Heart collection
      for (const h of s.hearts) {
        if (h.collected) continue;
        h.pulse += 0.08;
        const dx = s.playerX + PW / 2 - h.x,
          dy = s.playerY + PH / 2 - h.y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          h.collected = true;
          s.lives++;
          spawnParticles(h.x, h.y, "#f43f5e", 10);
          setLives(s.lives);
        }
      }

      for (const m of s.monsters) {
        if (!m.alive) continue;
        if (
          s.playerX + PW > m.x &&
          s.playerX < m.x + m.w &&
          s.playerY + PH > m.y &&
          s.playerY < m.y + m.h
        ) {
          if (s.playerVY > 0 && s.playerY + PH < m.y + m.h / 2 + 5) {
            m.alive = false;
            s.playerVY = JUMP;
            s.score += 100;
            spawnParticles(m.x + m.w / 2, m.y + m.h / 2, "#ef4444", 12);
            onScoreChange?.(s.score);
          } else {
            if (s.lives > 0) {
              s.lives--;
              setLives(s.lives);
              s.playerVY = JUMP;
              s.playerY = m.y - PH - 10;
              spawnParticles(
                s.playerX + PW / 2,
                s.playerY + PH / 2,
                "#f43f5e",
                8,
              );
              m.alive = false;
            } else {
              s.gameOver = true;
              setGameOver(true);
              if (s.score > s.highScore) {
                localStorage.setItem("doodle-high", s.score.toString());
                setHighScore(s.score);
              }
              onGameOver(s.score);
              return;
            }
          }
        }
      }

      const scrollT = CH * 0.35;
      if (s.playerY < scrollT) {
        const diff = scrollT - s.playerY;
        s.playerY = scrollT;
        s.maxHeight += diff;
        s.score = Math.max(s.score, Math.floor(s.maxHeight / 10));
        setScore(s.score);
        onScoreChange?.(s.score);
        for (const p of s.platforms) p.y += diff;
        for (const st of s.stars) st.y += diff;
        for (const h of s.hearts) h.y += diff;
        for (const m of s.monsters) m.y += diff;
        for (const pt of s.particles) pt.y += diff;
        s.platforms = s.platforms.filter((p) => p.y < CH + 50);
        s.stars = s.stars.filter((st) => st.y < CH + 50);
        s.hearts = s.hearts.filter((h) => h.y < CH + 50);
        s.monsters = s.monsters.filter((m) => m.y < CH + 50);
        const difficulty = Math.floor(s.score / 200);
        if (s.platforms.length < 15) {
          const topY = Math.min(...s.platforms.map((p) => p.y));
          const np = genPlats(topY, 8, difficulty);
          s.platforms.push(...np);
          s.stars.push(...genStars(np));
          s.hearts.push(...genHearts(np));
          s.monsters.push(...genMonsters(np, difficulty));
        }
      }

      s.dayCycle = (s.dayCycle + 0.0003) % 2;

      if (s.playerY > CH) {
        if (s.lives > 0) {
          s.lives--;
          setLives(s.lives);
          // Respawn on the highest visible platform
          const safePlats = s.platforms.filter(
            (p) => !p.broken && p.y > 50 && p.y < CH - 100,
          );
          if (safePlats.length > 0) {
            const best = safePlats.reduce((a, b) => (a.y < b.y ? a : b));
            s.playerX = best.x + best.w / 2 - PW / 2;
            s.playerY = best.y - PH;
          } else {
            s.playerY = CH * 0.4;
          }
          s.playerVY = JUMP;
          s.playerVX = 0;
          spawnParticles(s.playerX + PW / 2, s.playerY + PH / 2, "#f43f5e", 12);
        } else {
          s.gameOver = true;
          setGameOver(true);
          if (s.score > s.highScore) {
            localStorage.setItem("doodle-high", s.score.toString());
            setHighScore(s.score);
          }
          onGameOver(s.score);
          return;
        }
      }

      s.particles = s.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
        return p.life > 0;
      });

      // Draw
      drawBg(ctx, s.dayCycle > 1 ? 2 - s.dayCycle : s.dayCycle);
      for (const p of s.platforms) drawPlat(ctx, p);
      for (const st of s.stars) drawStar(ctx, st);
      for (const h of s.hearts) drawHeart(ctx, h);
      for (const m of s.monsters) drawMonster(ctx, m);
      drawPlayer(ctx, s);
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / 40;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14px monospace";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(`★ ${s.score}`, 10, 25);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "9px monospace";
      ctx.fillText(`⭐ ${starsCollected}`, 10, 45);
      // Lives HUD
      ctx.fillStyle = "#f43f5e";
      ctx.font = "bold 14px monospace";
      const livesText = "♥".repeat(s.lives);
      ctx.fillText(
        livesText || "♡",
        CW - 10 - ctx.measureText(livesText || "♡").width,
        25,
      );
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, starsCollected, lives, onGameOver, onScoreChange]);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Courier New', monospace",
  };

  const canvasStyle: React.CSSProperties = {
    maxWidth: "100%",
    maxHeight: "100%",
    aspectRatio: `${CW} / ${CH}`,
    borderRadius: 12,
    border: "2px solid #334155",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
    display: "block",
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  };

  const panelStyle: React.CSSProperties = {
    background: "rgba(15,23,42,0.92)",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: "32px 40px",
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    alignItems: "center",
    backdropFilter: "blur(12px)",
    maxWidth: 340,
  };

  const btnStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #4ade80, #22c55e)",
    color: "#0f172a",
    border: "none",
    borderRadius: 8,
    padding: "10px 28px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 1,
    fontFamily: "inherit",
  };

  const tagStyle = (bg: string, fg: string): React.CSSProperties => ({
    background: bg,
    color: fg,
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 9,
  });

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} width={CW} height={CH} style={canvasStyle} />
      {!started && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <h1
              style={{
                color: "#4ade80",
                fontSize: 24,
                margin: 0,
                letterSpacing: 2,
              }}
            >
              🐸 DOODLE JUMP
            </h1>
            <p
              style={{
                color: "#94a3b8",
                fontSize: 11,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Arrow keys or touch to move. Jump on platforms, collect stars,
              stomp monsters!
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
              }}
            >
              <span style={tagStyle("rgba(74,222,128,0.2)", "#4ade80")}>
                🟢 Normal
              </span>
              <span style={tagStyle("rgba(96,165,250,0.2)", "#60a5fa")}>
                🔵 Moving
              </span>
              <span style={tagStyle("rgba(249,115,22,0.2)", "#f97316")}>
                🟠 Breaking
              </span>
              <span style={tagStyle("rgba(250,204,21,0.2)", "#facc15")}>
                ⚡ Spring
              </span>
              <span style={tagStyle("rgba(167,139,250,0.2)", "#a78bfa")}>
                🚀 Jetpack
              </span>
              <span style={tagStyle("rgba(244,63,94,0.2)", "#f43f5e")}>
                ❤️ Extra Life
              </span>
            </div>
            <button onClick={initGame} style={btnStyle}>
              START GAME
            </button>
            {highScore > 0 && (
              <p style={{ color: "#4ade80", fontSize: 11, margin: 0 }}>
                Best: {highScore}
              </p>
            )}
          </div>
        </div>
      )}
      {gameOver && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <h2
              style={{
                color: "#f87171",
                fontSize: 20,
                margin: 0,
                letterSpacing: 2,
              }}
            >
              GAME OVER
            </h2>
            <p
              style={{
                color: "#fbbf24",
                fontSize: 28,
                margin: 0,
                fontWeight: 700,
              }}
            >
              {score}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 11, margin: 0 }}>
              ⭐ Stars: {starsCollected}
            </p>
            {score >= highScore && score > 0 && (
              <p style={{ color: "#4ade80", fontSize: 11, margin: 0 }}>
                🎉 NEW HIGH SCORE!
              </p>
            )}
            <button onClick={initGame} style={btnStyle}>
              PLAY AGAIN
            </button>
            <p style={{ color: "#64748b", fontSize: 10, margin: 0 }}>
              Best: {Math.max(score, highScore)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
