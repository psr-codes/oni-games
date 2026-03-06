"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../registry";

type GameState = "start" | "playing" | "paused" | "gameover";
type PowerUpType = "shield" | "rapid" | "triple" | "speed" | "life" | "backup";

interface Position {
  x: number;
  y: number;
}
interface Alien extends Position {
  alive: boolean;
  row: number;
}
interface Bullet extends Position {
  dy: number;
  dx?: number;
}
interface Particle extends Position {
  vx: number;
  vy: number;
  life: number;
  color: string;
  size?: number;
}
interface PowerUp extends Position {
  type: PowerUpType;
  dy: number;
}
interface Boss extends Position {
  hp: number;
  maxHp: number;
  dir: number;
  shootTimer: number;
  phase: number;
}
interface BackupShip extends Position {
  vx: number;
  vy: number;
  color: string;
  hp: number;
  shootTimer: number;
  shootInterval: number;
  powerType: string; // visual label
  targetX: number;
  targetY: number;
  changeTimer: number;
}

const GAME_W = 600;
const GAME_H = 700;
const PLAYER_W = 40;
const PLAYER_H = 24;
const ALIEN_W = 32;
const ALIEN_H = 24;
const ALIEN_COLS = 5;
const ALIEN_ROWS = 4;
const BULLET_W = 3;
const BULLET_H = 12;
const PLAYER_SPEED = 5;
const BASE_BULLET_SPEED = 3.5;
const MAX_BULLET_SPEED = 7;
const PLAYER_Y_DEFAULT = GAME_H - 50;
const PLAYER_Y_MIN = GAME_H * 0.55; // can move up to ~55% of screen
const PLAYER_Y_MAX = GAME_H - 30; // near bottom
const BASE_ALIEN_BULLET_SPEED = 1.5;
const ALIEN_SHOOT_CHANCE = 0.006;
const BOSS_W = 72;
const BOSS_H = 44;

const ALIEN_COLORS = ["#ff4444", "#ff8844", "#44ddff", "#44ff88"];
const NEON_GREEN = "#39ff14";
const BG_COLOR = "#0a0a1a";
const POWERUP_COLORS: Record<PowerUpType, string> = {
  shield: "#44aaff",
  rapid: "#ffaa00",
  triple: "#ff44ff",
  speed: "#00ffcc",
  life: "#ff4466",
  backup: "#ffd700",
};
const POWERUP_ICONS: Record<PowerUpType, string> = {
  shield: "S",
  rapid: "R",
  triple: "T",
  speed: "»",
  life: "♥",
  backup: "★",
};
const POWERUP_DURATION = 300;
const POWERUP_DROP_CHANCE = 0.15;

const BACKUP_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6fff"];
const BACKUP_POWERS = ["Laser", "Plasma", "Ion", "Pulse", "Nova"];

function createAliens(offsetY = 0): Alien[] {
  const aliens: Alien[] = [];
  const startX = (GAME_W - ALIEN_COLS * (ALIEN_W + 14)) / 2 + 7;
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      aliens.push({
        x: startX + c * (ALIEN_W + 14),
        y: 50 + r * (ALIEN_H + 16) + offsetY,
        alive: true,
        row: r,
      });
    }
  }
  return aliens;
}

function createBoss(level: number): Boss {
  return {
    x: GAME_W / 2 - BOSS_W / 2,
    y: 50,
    hp: 15 + level * 5,
    maxHp: 15 + level * 5,
    dir: 1,
    shootTimer: 0,
    phase: 0,
  };
}

function isBossLevel(level: number) {
  return level > 0 && level % 2 === 0;
}

function createBackupShips(playerX: number): BackupShip[] {
  const ships: BackupShip[] = [];
  for (let i = 0; i < 5; i++) {
    const tx = playerX - 80 + i * 40;
    ships.push({
      x: playerX - 80 + i * 40,
      y: GAME_H + 20 + i * 30,
      vx: 0,
      vy: -2 - Math.random() * 2,
      color: BACKUP_COLORS[i],
      hp: 2,
      shootTimer: Math.floor(Math.random() * 40),
      shootInterval: 30 + Math.floor(Math.random() * 30),
      powerType: BACKUP_POWERS[i],
      targetX: tx,
      targetY: GAME_H - 90 - Math.random() * 60,
      changeTimer: 60 + Math.floor(Math.random() * 60),
    });
  }
  return ships;
}

export default function SpaceInvadersGame({
  onGameOver,
  onScoreChange,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("start");
  const [finalScore, setFinalScore] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [scale, setScale] = useState(1);

  // Responsive scaling — fill viewport width
  useEffect(() => {
    const updateScale = () => {
      const vw = window.innerWidth - 32; // 16px padding each side
      const vh = window.innerHeight - 140; // navbar + score bar
      const s = Math.min(vw / GAME_W, vh / GAME_H);
      setScale(Math.max(s, 0.5)); // floor at 0.5x for very small screens
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const stateRef = useRef({
    player: { x: GAME_W / 2 - PLAYER_W / 2, y: PLAYER_Y_DEFAULT },
    aliens: createAliens(),
    playerBullets: [] as Bullet[],
    alienBullets: [] as Bullet[],
    particles: [] as Particle[],
    powerUps: [] as PowerUp[],
    boss: null as Boss | null,
    backupShips: [] as BackupShip[],
    backupBullets: [] as Bullet[],
    backupCount: 0,
    score: 0,
    lives: 3,
    level: 1,
    alienDir: 1,
    alienSpeed: 1,
    keys: {} as Record<string, boolean>,
    lastShot: 0,
    gameState: "start" as GameState,
    starField: [] as {
      x: number;
      y: number;
      speed: number;
      brightness: number;
    }[],
    shieldActive: 0,
    rapidActive: 0,
    tripleActive: 0,
    speedActive: 0,
    flash: 0,
    flashColor: "",
    bossDefeatedTimer: 0,
  });

  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        speed: 0.2 + Math.random() * 0.5,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
    stateRef.current.starField = stars;
  }, []);

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count = 8, size = 3) => {
      const s = stateRef.current;
      for (let i = 0; i < count; i++) {
        s.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 20 + Math.random() * 15,
          color,
          size,
        });
      }
    },
    [],
  );

  const getBulletSpeed = useCallback(() => {
    const s = stateRef.current;
    return Math.min(BASE_BULLET_SPEED + s.level * 0.35, MAX_BULLET_SPEED);
  }, []);

  const getShootCooldown = useCallback(() => {
    return stateRef.current.rapidActive > 0 ? 120 : 300;
  }, []);

  const getPlayerSpeed = useCallback(() => {
    return stateRef.current.speedActive > 0 ? PLAYER_SPEED * 1.6 : PLAYER_SPEED;
  }, []);

  const dropPowerUp = useCallback((x: number, y: number) => {
    if (Math.random() > POWERUP_DROP_CHANCE) return;
    const types: PowerUpType[] = ["shield", "rapid", "triple", "speed", "life"];
    const type = types[Math.floor(Math.random() * types.length)];
    stateRef.current.powerUps.push({ x, y, type, dy: 1.2 });
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.player.x = GAME_W / 2 - PLAYER_W / 2;
    s.player.y = PLAYER_Y_DEFAULT;
    s.aliens = createAliens();
    s.playerBullets = [];
    s.alienBullets = [];
    s.particles = [];
    s.powerUps = [];
    s.boss = null;
    s.backupShips = [];
    s.backupBullets = [];
    s.backupCount = 0;
    s.score = 0;
    s.lives = 3;
    s.level = 1;
    s.alienDir = 1;
    s.alienSpeed = 1;
    s.lastShot = 0;
    s.shieldActive = 0;
    s.rapidActive = 0;
    s.tripleActive = 0;
    s.speedActive = 0;
    s.flash = 0;
    s.bossDefeatedTimer = 0;
    s.gameState = "playing";
    setGameState("playing");
  }, []);

  const nextLevel = useCallback(() => {
    const s = stateRef.current;
    s.level++;
    s.alienBullets = [];
    s.playerBullets = [];
    s.alienDir = 1;
    s.alienSpeed = 1 + s.level * 0.2;
    if (isBossLevel(s.level)) {
      s.aliens = [];
      s.boss = createBoss(s.level);
    } else {
      s.aliens = createAliens();
      s.boss = null;
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = true;
      if (e.key === "p" || e.key === "P") {
        const s = stateRef.current;
        if (s.gameState === "playing") {
          s.gameState = "paused";
          setGameState("paused");
        } else if (s.gameState === "paused") {
          s.gameState = "playing";
          setGameState("playing");
        }
      }
      // Manual backup deploy with B key
      if (e.key === "b" || e.key === "B") {
        const s = stateRef.current;
        if (
          s.gameState === "playing" &&
          s.backupCount > 0 &&
          s.backupShips.length === 0
        ) {
          s.backupCount--;
          s.backupShips = createBackupShips(s.player.x);
          s.flash = 20;
          s.flashColor = "#ffd700";
        }
      }
      if (
        [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      )
        e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") return;
    let animId: number;
    let prevScore = stateRef.current.score;

    const endGame = (s: typeof stateRef.current) => {
      s.gameState = "gameover";
      setFinalScore(s.score);
      setGameState("gameover");
      onGameOver(s.score);
    };

    const activateBackup = (s: typeof stateRef.current) => {
      s.backupCount--;
      s.lives = 1;
      s.backupShips = createBackupShips(s.player.x);
      s.flash = 20;
      s.flashColor = "#ffd700";
      spawnParticles(s.player.x + PLAYER_W / 2, s.player.y, "#ffd700", 20, 4);
    };

    const loop = () => {
      const s = stateRef.current;
      if (s.gameState !== "playing") {
        animId = requestAnimationFrame(loop);
        return;
      }

      const pSpeed = getPlayerSpeed();
      if (s.keys["ArrowLeft"] || s.keys["a"])
        s.player.x = Math.max(0, s.player.x - pSpeed);
      if (s.keys["ArrowRight"] || s.keys["d"])
        s.player.x = Math.min(GAME_W - PLAYER_W, s.player.x + pSpeed);
      if (s.keys["ArrowUp"] || s.keys["w"])
        s.player.y = Math.max(PLAYER_Y_MIN, s.player.y - pSpeed);
      if (s.keys["ArrowDown"] || s.keys["s"])
        s.player.y = Math.min(PLAYER_Y_MAX, s.player.y + pSpeed);

      // Shoot
      const now = Date.now();
      const cooldown = getShootCooldown();
      if (s.keys[" "] && now - s.lastShot > cooldown) {
        const bx = s.player.x + PLAYER_W / 2 - BULLET_W / 2;
        const by = s.player.y - 5;
        const bSpeed = getBulletSpeed();
        if (s.tripleActive > 0) {
          s.playerBullets.push({ x: bx, y: by, dy: -bSpeed });
          s.playerBullets.push({ x: bx - 10, y: by + 4, dy: -bSpeed * 0.95 });
          s.playerBullets.push({ x: bx + 10, y: by + 4, dy: -bSpeed * 0.95 });
        } else {
          s.playerBullets.push({ x: bx, y: by, dy: -bSpeed });
        }
        s.lastShot = now;
      }

      // Decrement powerup timers
      if (s.shieldActive > 0) s.shieldActive--;
      if (s.rapidActive > 0) s.rapidActive--;
      if (s.tripleActive > 0) s.tripleActive--;
      if (s.speedActive > 0) s.speedActive--;
      if (s.flash > 0) s.flash--;
      if (s.bossDefeatedTimer > 0) s.bossDefeatedTimer--;

      // Auto-shield while backup ships are active
      if (s.backupShips.length > 0 && s.shieldActive < 30) {
        s.shieldActive = 30; // keep shield topped up while backups fly
      }

      // Move bullets
      s.playerBullets = s.playerBullets.filter((b) => {
        b.y += b.dy;
        return b.y > -BULLET_H;
      });
      s.alienBullets = s.alienBullets.filter((b) => {
        b.y += b.dy;
        if (b.dx) b.x += b.dx;
        return b.y < GAME_H;
      });

      // Particles
      s.particles = s.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
      });

      // PowerUps fall
      s.powerUps = s.powerUps.filter((pu) => {
        pu.y += pu.dy;
        return pu.y < GAME_H;
      });

      // Stars
      s.starField.forEach((star) => {
        star.y += star.speed;
        if (star.y > GAME_H) {
          star.y = 0;
          star.x = Math.random() * GAME_W;
        }
      });

      // === BACKUP SHIPS LOGIC ===
      s.backupBullets = s.backupBullets.filter((b) => {
        b.y += b.dy;
        return b.y > -BULLET_H;
      });

      s.backupShips = s.backupShips.filter((ship) => {
        // Move toward target with some randomness
        ship.changeTimer--;
        if (ship.changeTimer <= 0) {
          ship.targetX = s.player.x + (Math.random() - 0.5) * 200;
          ship.targetX = Math.max(20, Math.min(GAME_W - 20, ship.targetX));
          ship.targetY = GAME_H - 70 - Math.random() * 80;
          ship.changeTimer = 40 + Math.floor(Math.random() * 80);
        }

        // Approach phase
        if (ship.y > ship.targetY) {
          ship.y += Math.max(-3, (ship.targetY - ship.y) * 0.05);
        } else {
          ship.y += (ship.targetY - ship.y) * 0.03;
        }
        ship.x += (ship.targetX - ship.x) * 0.04 + (Math.random() - 0.5) * 1.5;

        // Shoot
        ship.shootTimer++;
        if (ship.shootTimer >= ship.shootInterval) {
          ship.shootTimer = 0;
          s.backupBullets.push({
            x: ship.x,
            y: ship.y - 5,
            dy: -5 - Math.random() * 2,
          });
        }

        return ship.hp > 0;
      });

      // Backup bullets vs aliens
      if (s.backupBullets.length > 0) {
        s.backupBullets = s.backupBullets.filter((b) => {
          // vs aliens
          for (const a of s.aliens) {
            if (
              a.alive &&
              b.x < a.x + ALIEN_W &&
              b.x + BULLET_W > a.x &&
              b.y < a.y + ALIEN_H &&
              b.y + BULLET_H > a.y
            ) {
              a.alive = false;
              s.score += a.row === 0 ? 20 : 10;
              spawnParticles(
                a.x + ALIEN_W / 2,
                a.y + ALIEN_H / 2,
                ALIEN_COLORS[a.row],
                10,
              );
              return false;
            }
          }
          // vs boss
          if (s.boss) {
            const boss = s.boss;
            if (
              b.x < boss.x + BOSS_W &&
              b.x + BULLET_W > boss.x &&
              b.y < boss.y + BOSS_H &&
              b.y + BULLET_H > boss.y
            ) {
              boss.hp--;
              spawnParticles(b.x, b.y, "#ffd700", 3, 2);
              if (boss.hp <= 0) {
                s.score += 100 + s.level * 20;
                spawnParticles(
                  boss.x + BOSS_W / 2,
                  boss.y + BOSS_H / 2,
                  "#ffaa00",
                  30,
                  4,
                );
                s.flash = 15;
                s.flashColor = "#ffaa00";
                s.bossDefeatedTimer = 90;
                // Drop backup powerup from boss
                s.powerUps.push({
                  x: boss.x + BOSS_W / 2,
                  y: boss.y + BOSS_H / 2,
                  type: "backup",
                  dy: 1.2,
                });
                s.boss = null;
              }
              return false;
            }
          }
          return true;
        });
      }

      // Alien bullets vs backup ships
      s.alienBullets = s.alienBullets.filter((b) => {
        for (const ship of s.backupShips) {
          if (
            b.x > ship.x - 12 &&
            b.x < ship.x + 12 &&
            b.y > ship.y - 8 &&
            b.y < ship.y + 8
          ) {
            ship.hp--;
            spawnParticles(ship.x, ship.y, ship.color, 5, 2);
            if (ship.hp <= 0) {
              spawnParticles(ship.x, ship.y, ship.color, 12, 3);
            }
            return false;
          }
        }
        return true;
      });

      // === BOSS LOGIC ===
      if (s.boss) {
        const boss = s.boss;
        const bossSpeed = 1.5 + s.level * 0.15;
        boss.x += boss.dir * bossSpeed;
        if (boss.x <= 10 || boss.x + BOSS_W >= GAME_W - 10) boss.dir *= -1;

        boss.shootTimer++;
        const shootInterval = Math.max(20, 50 - s.level * 2);

        if (boss.shootTimer >= shootInterval) {
          boss.shootTimer = 0;
          boss.phase = (boss.phase + 1) % 3;
          const abSpeed = BASE_ALIEN_BULLET_SPEED + s.level * 0.15;

          if (boss.phase === 0) {
            s.alienBullets.push({
              x: boss.x + BOSS_W / 2 - 1,
              y: boss.y + BOSS_H,
              dy: abSpeed,
            });
          } else if (boss.phase === 1) {
            s.alienBullets.push({
              x: boss.x + 10,
              y: boss.y + BOSS_H,
              dy: abSpeed,
            });
            s.alienBullets.push({
              x: boss.x + BOSS_W / 2,
              y: boss.y + BOSS_H,
              dy: abSpeed,
            });
            s.alienBullets.push({
              x: boss.x + BOSS_W - 10,
              y: boss.y + BOSS_H,
              dy: abSpeed,
            });
          } else {
            s.alienBullets.push({
              x: boss.x + 15,
              y: boss.y + BOSS_H,
              dy: abSpeed * 1.1,
            });
            s.alienBullets.push({
              x: boss.x + BOSS_W - 15,
              y: boss.y + BOSS_H,
              dy: abSpeed * 1.1,
            });
          }
        }

        // Player bullets vs boss
        s.playerBullets = s.playerBullets.filter((b) => {
          if (
            b.x < boss.x + BOSS_W &&
            b.x + BULLET_W > boss.x &&
            b.y < boss.y + BOSS_H &&
            b.y + BULLET_H > boss.y
          ) {
            boss.hp--;
            spawnParticles(b.x, b.y, "#ffaa00", 4, 2);
            if (boss.hp <= 0) {
              s.score += 100 + s.level * 20;
              spawnParticles(
                boss.x + BOSS_W / 2,
                boss.y + BOSS_H / 2,
                "#ffaa00",
                30,
                4,
              );
              spawnParticles(
                boss.x + BOSS_W / 2,
                boss.y + BOSS_H / 2,
                "#ff4444",
                20,
                5,
              );
              spawnParticles(
                boss.x + BOSS_W / 2,
                boss.y + BOSS_H / 2,
                "#44ddff",
                15,
                3,
              );
              s.flash = 15;
              s.flashColor = "#ffaa00";
              s.bossDefeatedTimer = 90;
              s.boss = null;
              // Boss always drops backup powerup
              s.powerUps.push({
                x: boss.x + BOSS_W / 2,
                y: boss.y + BOSS_H / 2,
                type: "backup",
                dy: 1.2,
              });
            }
            return false;
          }
          return true;
        });
      }

      // === ALIEN LOGIC ===
      if (!s.boss) {
        const aliveAliens = s.aliens.filter((a) => a.alive);
        if (aliveAliens.length === 0 && s.bossDefeatedTimer <= 0) {
          nextLevel();
        } else if (aliveAliens.length > 0) {
          let hitEdge = false;
          const speed =
            s.alienSpeed *
            (1 + (ALIEN_COLS * ALIEN_ROWS - aliveAliens.length) * 0.04);
          aliveAliens.forEach((a) => {
            a.x += s.alienDir * speed;
            if (a.x <= 0 || a.x + ALIEN_W >= GAME_W) hitEdge = true;
          });
          if (hitEdge) {
            s.alienDir *= -1;
            aliveAliens.forEach((a) => (a.y += 14));
          }

          if (
            Math.random() <
            ALIEN_SHOOT_CHANCE * Math.min(aliveAliens.length, 8)
          ) {
            const shooter =
              aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
            const abSpeed = BASE_ALIEN_BULLET_SPEED + s.level * 0.15;
            s.alienBullets.push({
              x: shooter.x + ALIEN_W / 2 - BULLET_W / 2,
              y: shooter.y + ALIEN_H,
              dy: abSpeed,
            });
          }

          if (aliveAliens.some((a) => a.y + ALIEN_H >= s.player.y)) {
            s.lives = 0;
            endGame(s);
          }
        }

        // Player bullets vs aliens
        s.playerBullets = s.playerBullets.filter((b) => {
          for (const a of s.aliens) {
            if (
              a.alive &&
              b.x < a.x + ALIEN_W &&
              b.x + BULLET_W > a.x &&
              b.y < a.y + ALIEN_H &&
              b.y + BULLET_H > a.y
            ) {
              a.alive = false;
              s.score += a.row === 0 ? 20 : 10;
              spawnParticles(
                a.x + ALIEN_W / 2,
                a.y + ALIEN_H / 2,
                ALIEN_COLORS[a.row],
                12,
              );
              dropPowerUp(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2);
              return false;
            }
          }
          return true;
        });
      }

      // PowerUp collection
      const px = s.player.x;
      const py = s.player.y;
      s.powerUps = s.powerUps.filter((pu) => {
        if (
          pu.x < px + PLAYER_W + 4 &&
          pu.x + 16 > px - 4 &&
          pu.y < py + PLAYER_H + 4 &&
          pu.y + 16 > py - 4
        ) {
          s.flash = 8;
          s.flashColor = POWERUP_COLORS[pu.type];
          spawnParticles(pu.x, pu.y, POWERUP_COLORS[pu.type], 10, 2);
          switch (pu.type) {
            case "shield":
              s.shieldActive += POWERUP_DURATION;
              break;
            case "rapid":
              s.rapidActive += POWERUP_DURATION;
              break;
            case "triple":
              s.tripleActive += POWERUP_DURATION;
              break;
            case "speed":
              s.speedActive += POWERUP_DURATION;
              break;
            case "life":
              s.lives++;
              break; // no cap
            case "backup":
              s.backupCount++;
              s.flash = 12;
              s.flashColor = "#ffd700";
              break;
          }
          return false;
        }
        return true;
      });

      // Alien bullets vs player
      s.alienBullets = s.alienBullets.filter((b) => {
        if (
          b.x < px + PLAYER_W &&
          b.x + BULLET_W > px &&
          b.y < py + PLAYER_H &&
          b.y + BULLET_H > py
        ) {
          if (s.shieldActive > 0) {
            s.shieldActive = Math.max(s.shieldActive - 60, 0);
            spawnParticles(px + PLAYER_W / 2, py, "#44aaff", 8, 2);
          } else {
            s.lives--;
            spawnParticles(
              px + PLAYER_W / 2,
              py + PLAYER_H / 2,
              NEON_GREEN,
              15,
            );
            s.flash = 10;
            s.flashColor = "#ff4444";
            // Check backup activation: at 0 lives with backup available
            if (s.lives <= 0 && s.backupCount > 0) {
              activateBackup(s);
            } else if (s.lives <= 0) {
              endGame(s);
            }
          }
          return false;
        }
        return true;
      });

      // Score callback
      if (s.score !== prevScore) {
        prevScore = s.score;
        onScoreChange?.(s.score);
      }

      // === RENDER ===
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      if (s.flash > 0) {
        ctx.fillStyle =
          s.flashColor +
          Math.floor((s.flash / 20) * 40)
            .toString(16)
            .padStart(2, "0");
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      s.starField.forEach((star) => {
        ctx.fillStyle = `rgba(255,255,255,${star.brightness * 0.6})`;
        ctx.fillRect(star.x, star.y, 1.5, 1.5);
      });

      // Aliens
      s.aliens.forEach((a) => {
        if (!a.alive) return;
        const color = ALIEN_COLORS[a.row];
        ctx.fillStyle = color;
        ctx.fillRect(a.x + 4, a.y, ALIEN_W - 8, ALIEN_H - 4);
        ctx.fillRect(a.x, a.y + 4, 4, ALIEN_H - 8);
        ctx.fillRect(a.x + ALIEN_W - 4, a.y + 4, 4, ALIEN_H - 8);
        ctx.fillStyle = "#fff";
        ctx.fillRect(a.x + 8, a.y + 4, 5, 5);
        ctx.fillRect(a.x + ALIEN_W - 13, a.y + 4, 5, 5);
        ctx.fillStyle = "#000";
        ctx.fillRect(a.x + 10, a.y + 6, 2, 2);
        ctx.fillRect(a.x + ALIEN_W - 11, a.y + 6, 2, 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;
        ctx.fillRect(a.x + 4, a.y + ALIEN_H - 4, ALIEN_W - 8, 2);
        ctx.shadowBlur = 0;
      });

      // Boss
      if (s.boss) {
        const boss = s.boss;
        const hpRatio = boss.hp / boss.maxHp;
        const bossColor =
          hpRatio > 0.5 ? "#ff8800" : hpRatio > 0.25 ? "#ff4400" : "#ff0044";
        ctx.fillStyle = bossColor;
        ctx.shadowColor = bossColor;
        ctx.shadowBlur = 15;
        ctx.fillRect(boss.x + 10, boss.y, BOSS_W - 20, BOSS_H);
        ctx.fillRect(boss.x, boss.y + 10, BOSS_W, BOSS_H - 20);
        ctx.fillRect(boss.x - 6, boss.y + 14, 10, BOSS_H - 24);
        ctx.fillRect(boss.x + BOSS_W - 4, boss.y + 14, 10, BOSS_H - 24);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.fillRect(boss.x + 18, boss.y + 12, 10, 10);
        ctx.fillRect(boss.x + BOSS_W - 28, boss.y + 12, 10, 10);
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(boss.x + 21, boss.y + 15, 4, 4);
        ctx.fillRect(boss.x + BOSS_W - 25, boss.y + 15, 4, 4);

        // HP bar
        ctx.fillStyle = "#333";
        ctx.fillRect(boss.x, boss.y - 12, BOSS_W, 6);
        ctx.fillStyle = bossColor;
        ctx.fillRect(boss.x, boss.y - 12, BOSS_W * hpRatio, 6);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(boss.x, boss.y - 12, BOSS_W, 6);
      }

      // Player ship
      ctx.fillStyle = NEON_GREEN;
      ctx.shadowColor = NEON_GREEN;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(px + PLAYER_W / 2, py);
      ctx.lineTo(px + PLAYER_W, py + PLAYER_H);
      ctx.lineTo(px, py + PLAYER_H);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Shield visual
      if (s.shieldActive > 0) {
        const alpha = s.shieldActive > 60 ? 0.4 : (s.shieldActive / 60) * 0.4;
        ctx.strokeStyle = `rgba(68,170,255,${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          px + PLAYER_W / 2,
          py + PLAYER_H / 2,
          PLAYER_W * 0.9,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.fillStyle = `rgba(68,170,255,${alpha * 0.3})`;
        ctx.fill();
      }

      // Backup ships
      s.backupShips.forEach((ship) => {
        ctx.fillStyle = ship.color;
        ctx.shadowColor = ship.color;
        ctx.shadowBlur = 8;
        // Small triangle ship
        ctx.beginPath();
        ctx.moveTo(ship.x, ship.y - 8);
        ctx.lineTo(ship.x + 10, ship.y + 6);
        ctx.lineTo(ship.x - 10, ship.y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Label
        ctx.font = "bold 7px monospace";
        ctx.fillStyle = ship.color;
        ctx.textAlign = "center";
        ctx.fillText(ship.powerType, ship.x, ship.y + 16);
        ctx.textAlign = "left";
      });

      // Backup bullets
      s.backupBullets.forEach((b) => {
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1, b.y, BULLET_W, BULLET_H);
        ctx.shadowBlur = 0;
      });

      // Player bullets
      const bulletColor = s.tripleActive > 0 ? "#ff44ff" : NEON_GREEN;
      ctx.fillStyle = bulletColor;
      ctx.shadowColor = bulletColor;
      ctx.shadowBlur = 8;
      s.playerBullets.forEach((b) =>
        ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H),
      );
      ctx.shadowBlur = 0;

      // Alien bullets
      ctx.fillStyle = "#ff4444";
      ctx.shadowColor = "#ff4444";
      ctx.shadowBlur = 6;
      s.alienBullets.forEach((b) => ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H));
      ctx.shadowBlur = 0;

      // PowerUps
      s.powerUps.forEach((pu) => {
        const color = POWERUP_COLORS[pu.type];
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = pu.type === "backup" ? 16 : 10;
        const sz = pu.type === "backup" ? 20 : 16;
        ctx.fillRect(pu.x - sz / 2 + 6, pu.y - 2, sz, sz);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000";
        ctx.font =
          pu.type === "backup" ? "bold 14px monospace" : "bold 11px monospace";
        ctx.fillText(POWERUP_ICONS[pu.type], pu.x - sz / 2 + 9, pu.y + sz - 6);
      });

      // Particles
      s.particles.forEach((p) => {
        ctx.globalAlpha = p.life / 35;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
      });
      ctx.globalAlpha = 1;

      // Boss defeated banner
      if (s.bossDefeatedTimer > 0) {
        const alpha = Math.min(s.bossDefeatedTimer / 30, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffaa00";
        ctx.font = "bold 26px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BOSS DEFEATED!", GAME_W / 2, GAME_H / 2 - 20);
        ctx.font = "16px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(
          `+${100 + s.level * 20} POINTS`,
          GAME_W / 2,
          GAME_H / 2 + 14,
        );
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      // HUD - top bar
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, GAME_W, 34);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px monospace";
      ctx.fillText(`SCORE: ${s.score}`, 12, 23);
      const levelText = s.boss ? `⚠ BOSS LV${s.level}` : `LEVEL ${s.level}`;
      ctx.textAlign = "center";
      ctx.fillText(levelText, GAME_W / 2, 23);
      ctx.textAlign = "right";
      ctx.fillStyle = NEON_GREEN;
      ctx.fillText("♥".repeat(Math.min(s.lives, 20)), GAME_W - 12, 23);
      if (s.lives > 20) {
        ctx.fillStyle = "#aaa";
        ctx.font = "11px monospace";
        ctx.fillText(`(${s.lives})`, GAME_W - 12, 33);
      }
      ctx.textAlign = "left";

      // Backup indicator
      if (s.backupCount > 0) {
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`★ BACKUP x${s.backupCount} [B]`, 12, GAME_H - 20);
      }
      if (s.backupShips.length > 0) {
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`★ BACKUP x${s.backupShips.length}`, 12, GAME_H - 20);
      }

      // Active powerup indicators
      let indicatorX = 12;
      const indicatorY = GAME_H - 8;
      const drawIndicator = (
        label: string,
        color: string,
        remaining: number,
      ) => {
        const barW = 50;
        const ratio = remaining / POWERUP_DURATION;
        ctx.fillStyle = color + "33";
        ctx.fillRect(indicatorX, indicatorY, barW, 6);
        ctx.fillStyle = color;
        ctx.fillRect(indicatorX, indicatorY, barW * ratio, 6);
        ctx.font = "bold 8px monospace";
        ctx.fillText(label, indicatorX + 2, indicatorY - 2);
        indicatorX += barW + 8;
      };
      if (s.shieldActive > 0)
        drawIndicator("SHIELD", POWERUP_COLORS.shield, s.shieldActive);
      if (s.rapidActive > 0)
        drawIndicator("RAPID", POWERUP_COLORS.rapid, s.rapidActive);
      if (s.tripleActive > 0)
        drawIndicator("TRIPLE", POWERUP_COLORS.triple, s.tripleActive);
      if (s.speedActive > 0)
        drawIndicator("SPEED", POWERUP_COLORS.speed, s.speedActive);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameState,
    onGameOver,
    onScoreChange,
    nextLevel,
    spawnParticles,
    getBulletSpeed,
    getShootCooldown,
    getPlayerSpeed,
    dropPowerUp,
  ]);

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.88)",
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

        {/* Help button - always visible in top-right */}
        {gameState === "playing" && (
          <button
            onClick={() => {
              const s = stateRef.current;
              if (s.gameState === "playing") {
                s.gameState = "paused";
                setGameState("paused");
              }
              setShowHelp(true);
            }}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#aaa",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
            }}
          >
            ?
          </button>
        )}

        {/* Help overlay */}
        {showHelp && (
          <div
            style={overlayStyle}
            onClick={() => {
              setShowHelp(false);
              const s = stateRef.current;
              s.gameState = "playing";
              setGameState("playing");
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                color: NEON_GREEN,
                margin: 0,
                marginBottom: 16,
              }}
            >
              CONTROLS & POWERUPS
            </h2>
            <div
              style={{
                color: "#ccc",
                lineHeight: 2,
                fontSize: "13px",
                textAlign: "left",
                maxWidth: 340,
              }}
            >
              <div
                style={{ color: "#fff", fontWeight: "bold", marginBottom: 4 }}
              >
                ⌨ Controls:
              </div>
              <div>&nbsp; ← → ↑ ↓ or WASD — Move (full direction!)</div>
              <div>&nbsp; SPACE — Shoot</div>
              <div>&nbsp; B — Deploy backup ships</div>
              <div>&nbsp; P — Pause</div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: "bold",
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                ⚡ Power-Ups:
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.shield }}>■ Shield</span> —
                Absorbs hits
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.rapid }}>■ Rapid</span> —
                Faster fire rate
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.triple }}>■ Triple</span> —
                3-way shot
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.speed }}>■ Speed</span> —
                Move faster
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.life }}>■ Life</span> — +1
                life (stackable!)
              </div>
              <div>
                <span style={{ color: POWERUP_COLORS.backup }}>★ Backup</span> —
                Stackable! Press B to deploy, auto-deploys on death
              </div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: "bold",
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                👾 Tips:
              </div>
              <div>&nbsp; Top-row aliens = +20 pts</div>
              <div>&nbsp; Boss every 2 levels</div>
              <div>&nbsp; Aliens speed up as you kill them</div>
              <div>&nbsp; Powerups stack — collect more to extend!</div>
              <div>&nbsp; Shield stays active while backups fly</div>
            </div>
            <p style={{ color: "#666", marginTop: 16, fontSize: "11px" }}>
              Click anywhere to resume
            </p>
          </div>
        )}

        {gameState === "start" && (
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
              SPACE INVADERS
            </h1>
            <div
              style={{
                marginTop: "28px",
                color: "#aaa",
                textAlign: "center",
                lineHeight: 2,
                fontSize: "14px",
              }}
            >
              <div>← → ↑ ↓ or WASD to move</div>
              <div>SPACE to shoot · B to deploy backup · P to pause</div>
              <div
                style={{ marginTop: "12px", color: "#888", fontSize: "12px" }}
              >
                🛡 Shield &nbsp; ⚡ Rapid Fire &nbsp; ✦ Triple Shot &nbsp; »
                Speed &nbsp; ♥ Life
              </div>
              <div
                style={{ marginTop: "8px", color: "#ffd700", fontSize: "13px" }}
              >
                ★ Defeat bosses to stack BACKUP ships! Press B or auto-deploys
                on death
              </div>
              <div style={{ color: "#ff8800", fontSize: "12px", marginTop: 4 }}>
                ⚠ BOSS every 2 levels · Powerups stack!
              </div>
            </div>
            <button style={btnStyle} onClick={startGame}>
              ▶ START GAME
            </button>
          </div>
        )}

        {gameState === "paused" && !showHelp && (
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
              Press P to resume
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
              Score: {finalScore}
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
