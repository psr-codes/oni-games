"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreChange?: (score: number) => void;
}

// ─── Canvas defaults (used until container is measured) ─────────────────────
const DEFAULT_CW = 800;
const DEFAULT_CH = 500;

// ─── Geometry Classes ────────────────────────────────────────────────────────

function keepNDec(x: number, nDec: number): number {
  return Math.round(x * 10 ** nDec) / 10 ** nDec;
}

function positivMod(n: number, mod: number): number {
  return ((n % mod) + mod) % mod;
}

class Pt {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  copy() {
    return new Pt(this.x, this.y);
  }
  sameAbsciss(o: Pt) {
    return this.x === o.x;
  }
  sameOrdinate(o: Pt) {
    return this.y === o.y;
  }
  equal(o: Pt) {
    return this.sameAbsciss(o) && this.sameOrdinate(o);
  }
  addVector(v: Vec) {
    return new Pt(this.x + v.x, this.y + v.y);
  }
  translate(v: Vec) {
    this.x += v.x;
    this.x = keepNDec(this.x, 10);
    this.y += v.y;
    this.y = keepNDec(this.y, 10);
  }
}

class Vec {
  x: number;
  y: number;
  constructor(a: number | Pt, b: number | Pt) {
    if (a instanceof Pt && b instanceof Pt) {
      this.x = b.x - a.x;
      this.y = b.y - a.y;
    } else {
      this.x = a as number;
      this.y = b as number;
    }
  }
  is0() {
    return this.x === 0 && this.y === 0;
  }
  sum(o: Vec) {
    return new Vec(this.x + o.x, this.y + o.y);
  }
  product(l: number) {
    return new Vec(l * this.x, l * this.y);
  }
  scalarProduct(o: Vec) {
    return this.x * o.x + this.y * o.y;
  }
  norm() {
    return Math.sqrt(this.scalarProduct(this));
  }
  orthogonalVector() {
    return new Vec(-this.y, this.x);
  }
  polarCoordinate(): [number, number] {
    return [this.norm(), Math.atan2(this.y, this.x)];
  }
}

class StraightLine {
  point1: Pt;
  point2: Pt;
  constructor(p1: Pt, p2: Pt) {
    this.point1 = p1;
    this.point2 = p2;
  }
  equation(): [number, number, number] {
    if (this.point1.sameAbsciss(this.point2)) {
      return [1, 0, -this.point1.x];
    } else {
      const dir =
        (this.point1.y - this.point2.y) / (this.point1.x - this.point2.x);
      const ord = this.point1.y - dir * this.point1.x;
      return [-dir, 1, -ord];
    }
  }
  containPoint(p: Pt) {
    const eq = this.equation();
    return keepNDec(eq[0] * p.x + eq[1] * p.y + eq[2], 10) === 0;
  }
}

class Seg {
  point1: Pt;
  point2: Pt;
  constructor(p1: Pt, p2: Pt) {
    this.point1 = p1;
    this.point2 = p2;
  }
  center() {
    return new Pt(
      (this.point1.x + this.point2.x) / 2,
      (this.point1.y + this.point2.y) / 2,
    );
  }
  containPoint(p: Pt) {
    const v1 = new Vec(this.point1, this.point2);
    const v2 = new Vec(this.point1, p);
    const s1 = v1.scalarProduct(v2);
    const s2 = v1.scalarProduct(v1);
    return s1 >= 0 && s1 <= s2;
  }
  intersect(other: Seg) {
    const sv = new Vec(this.point1, this.point2);
    const s1 = sv.scalarProduct(new Vec(this.point1, other.point1));
    const s2 = sv.scalarProduct(new Vec(this.point1, other.point2));
    const s3 = sv.scalarProduct(new Vec(this.point2, other.point1));
    const s4 = sv.scalarProduct(new Vec(this.point2, other.point2));
    return !((s1 < 0 && s2 < 0) || (s3 > 0 && s4 > 0));
  }
}

class Poly {
  vertices: Pt[];
  constructor(v: Pt[]) {
    this.vertices = v;
  }
  translate(tv: Vec) {
    this.vertices.forEach((p) => p.translate(tv));
  }
  edges(): Seg[] {
    const edges: Seg[] = [];
    const n = this.vertices.length;
    if (n > 2) {
      for (let k = 0; k < n; k++)
        edges.push(new Seg(this.vertices[k], this.vertices[(k + 1) % n]));
    } else {
      edges.push(new Seg(this.vertices[0], this.vertices[1]));
    }
    return edges;
  }
  isoBarycenter(): Pt {
    let bx = 0,
      by = 0;
    this.vertices.forEach((p) => {
      bx += p.x;
      by += p.y;
    });
    return new Pt(bx / this.vertices.length, by / this.vertices.length);
  }
  static separation(other: Poly, edge: Seg, bary: Pt): boolean {
    const line = new StraightLine(edge.point1, edge.point2);
    const eq = line.equation();
    const thisSide = eq[0] * bary.x + eq[1] * bary.y + eq[2];
    const sides: number[] = [];
    const onSep: Pt[] = [];
    for (let k = 0; k < other.vertices.length; k++) {
      const s =
        eq[0] * other.vertices[k].x + eq[1] * other.vertices[k].y + eq[2];
      sides.push(s);
      if (keepNDec(s, 10) === 0) onSep.push(other.vertices[k]);
    }
    let common = false;
    if (onSep.length === 1) {
      if (edge.containPoint(onSep[0])) common = true;
    } else if (onSep.length === 2) {
      if (edge.intersect(new Seg(onSep[0], onSep[1]))) common = true;
    }
    if (common) return false;
    const min = Math.min(...sides);
    const max = Math.max(...sides);
    if (keepNDec(thisSide, 10) === 0) {
      return keepNDec(min, 10) * keepNDec(max, 10) >= 0;
    }
    return (
      keepNDec(thisSide, 10) * keepNDec(max, 10) <= 0 &&
      keepNDec(min, 10) * keepNDec(thisSide, 10) <= 0
    );
  }
  sat(other: Poly): boolean {
    const te = this.edges();
    const oe = other.edges();
    const tb = this.isoBarycenter();
    const ob = other.isoBarycenter();
    let sep = false;
    let i = 0;
    do {
      sep = Poly.separation(other, te[i], tb);
      i++;
    } while (i < te.length && !sep);
    if (!sep) {
      i = 0;
      do {
        sep = Poly.separation(this, oe[i], ob);
        i++;
      } while (i < oe.length && !sep);
    }
    return sep;
  }
}

class Sq extends Poly {
  center: Pt;
  polarDirection: [number, number];
  constructor(e1: Pt, e2: Pt | [number, number]) {
    let p1: Pt, p2: Pt, p3: Pt, p4: Pt;
    let pd: [number, number];
    let center: Pt;
    if (e2 instanceof Pt) {
      p1 = e1;
      p2 = e2;
      const dir = new Vec(p1, p2);
      pd = dir.polarCoordinate();
      p3 = p2.addVector(dir.orthogonalVector());
      p4 = p3.addVector(dir.orthogonalVector().orthogonalVector());
      center = new Seg(p1, p3).center();
    } else {
      pd = e2;
      const dir = new Vec(pd[0] * Math.cos(pd[1]), pd[0] * Math.sin(pd[1]));
      p1 = new Pt(0, 0);
      p2 = p1.addVector(dir);
      p3 = p2.addVector(dir.orthogonalVector());
      p4 = p3.addVector(dir.orthogonalVector().orthogonalVector());
      const ic = new Seg(p1, p3).center();
      center = e1;
      const tv = new Vec(ic, center);
      p1.translate(tv);
      p2.translate(tv);
      p3.translate(tv);
      p4.translate(tv);
    }
    super([p1, p2, p3, p4]);
    this.center = center;
    this.polarDirection = pd;
  }
  rotate(angle: number) {
    this.polarDirection[1] += angle;
    const dir = new Vec(
      this.polarDirection[0] * Math.cos(this.polarDirection[1]),
      this.polarDirection[0] * Math.sin(this.polarDirection[1]),
    );
    this.vertices[0] = new Pt(0, 0);
    this.vertices[1] = this.vertices[0].addVector(dir);
    this.vertices[2] = this.vertices[1].addVector(dir.orthogonalVector());
    this.vertices[3] = this.vertices[2].addVector(
      dir.orthogonalVector().orthogonalVector(),
    );
    const ic = new Seg(this.vertices[0], this.vertices[2]).center();
    const tv = new Vec(ic, this.center);
    this.vertices.forEach((v) => v.translate(tv));
  }
  translate(tv: Vec) {
    super.translate(tv);
    this.center.translate(tv);
  }
  getLowestPointIndex(): number[] {
    let lowest = new Pt(Infinity, Infinity);
    for (let k = 0; k < this.vertices.length; k++) {
      if (keepNDec(this.vertices[k].y, 6) < keepNDec(lowest.y, 6))
        lowest = this.vertices[k];
    }
    const res: number[] = [];
    for (let k = 0; k < this.vertices.length; k++) {
      if (keepNDec(lowest.y, 6) === keepNDec(this.vertices[k].y, 6))
        res.push(k);
    }
    if (res.length === 2 && this.vertices[res[0]].x > this.vertices[res[1]].x) {
      return [res[1], res[0]];
    }
    return res;
  }
}

// ─── Game element classes ────────────────────────────────────────────────────

class Platform {
  col: number;
  platform: Sq;
  roof: Poly;
  constructor(x: number, y: number) {
    this.col = Math.floor(x);
    const c = new Pt(x + 0.5, y + 0.5);
    this.platform = new Sq(c, [1, 0]);
    this.roof = new Poly([
      this.platform.vertices[2],
      this.platform.vertices[3],
    ]);
  }
}

class Peak {
  col: number;
  peak: Poly;
  center: Pt;
  constructor(x: number, y: number, orientation: string) {
    let p1: Pt, p2: Pt, p3: Pt;
    switch (orientation) {
      case "up":
        p1 = new Pt(x, y);
        p2 = new Pt(x + 1, y);
        p3 = new Pt(x + 0.5, y + 1);
        break;
      case "down":
        p1 = new Pt(x, y + 1);
        p2 = new Pt(x + 1, y + 1);
        p3 = new Pt(x + 0.5, y);
        break;
      case "left":
        p1 = new Pt(x + 1, y + 1);
        p2 = new Pt(x + 1, y);
        p3 = new Pt(x, y + 0.5);
        break;
      default:
        p1 = new Pt(x, y + 1);
        p2 = new Pt(x, y);
        p3 = new Pt(x + 1, y + 0.5);
        break;
    }
    this.col = Math.floor(x);
    this.peak = new Poly([p1, p2, p3]);
    this.center = new Pt(x + 0.5, y + 0.5);
  }
}

class Ending {
  ending: Poly;
  col: number;
  constructor(pos: number) {
    this.ending = new Poly([
      new Pt(pos, 0),
      new Pt(pos + 1, 0),
      new Pt(pos + 1, 10),
      new Pt(pos, 10),
    ]);
    this.col = Math.floor(pos);
  }
}

type GridElement = Platform | Peak | Ending;

class Grid {
  grid: (GridElement[] | undefined)[];
  constructor() {
    this.grid = [];
  }
  addPlatform(x: number, y: number): [number, number] {
    const p = new Platform(x, y);
    if (this.grid[p.col]) this.grid[p.col]!.push(p);
    else this.grid[p.col] = [p];
    return [x, y];
  }
  addPeak(x: number, y: number, dir: string): [number, number] {
    const p = new Peak(x, y, dir);
    if (this.grid[p.col]) this.grid[p.col]!.push(p);
    else this.grid[p.col] = [p];
    return [x, y];
  }
  addEnding(e: Ending) {
    if (this.grid[e.col]) this.grid[e.col]!.push(e);
    else this.grid[e.col] = [e];
  }
}

// ─── Hero class ──────────────────────────────────────────────────────────────

class Hero {
  body: Sq;
  foot: Poly[];
  vx: number;
  vy0: number;
  xJump: number;
  yJump: number;
  g: number;
  t: number;
  isJumping: boolean;
  startJumpPosition: Pt;
  hasStarted: boolean;
  isDead: boolean;
  haveFinished: boolean;
  deathParticle: {
    position: Pt;
    angle: number;
    maxProjection: number;
  }[];

  constructor(
    cx: number,
    cy: number,
    pd: [number, number],
    vx: number,
    vy0: number,
    xJump: number,
    yJump: number,
    g: number,
    t: number,
    isJumping: boolean,
  ) {
    this.body = new Sq(new Pt(cx, cy), [pd[0], pd[1]]);
    this.foot = this._buildFoot();
    this.vx = vx;
    this.vy0 = vy0;
    this.xJump = xJump;
    this.yJump = yJump;
    this.g = g;
    this.t = t;
    this.isJumping = isJumping;
    this.startJumpPosition = this.body.center.copy();
    this.hasStarted = false;
    this.isDead = false;
    this.haveFinished = false;
    this.deathParticle = [];
  }

  _buildFoot(): Poly[] {
    const fp = this.body.getLowestPointIndex();
    if (fp.length === 2) {
      return [
        new Poly([
          this.body.vertices[fp[0]].copy(),
          this.body.vertices[fp[1]].copy(),
        ]),
      ];
    }
    const p1 = this.body.vertices[fp[0]].copy();
    const p2 = this.body.vertices[positivMod(fp[0] + 1, 4)].copy();
    const p3 = this.body.vertices[positivMod(fp[0] - 1, 4)].copy();
    return [new Poly([p1, p2]), new Poly([p1.copy(), p3])];
  }

  rotate(angle: number) {
    this.body.rotate(angle);
    this.foot = this._buildFoot();
  }

  translate(tv: Vec) {
    this.body.translate(tv);
    this.foot.forEach((f) => f.translate(tv));
  }

  footContactWithRoof(prevFoot: Pt[][], plat: Platform): boolean {
    let count = 0;
    for (let k = 0; k < this.foot.length; k++) {
      let footPoly: Poly;
      try {
        const line = new StraightLine(this.foot[k].vertices[1], prevFoot[k][0]);
        if (line.containPoint(prevFoot[k][1])) {
          footPoly = new Poly([this.foot[k].vertices[1], prevFoot[k][0]]);
        } else {
          footPoly = new Poly([
            this.foot[k].vertices[0],
            this.foot[k].vertices[1],
            prevFoot[k][1],
            prevFoot[k][0],
          ]);
        }
      } catch {
        footPoly = new Poly([this.foot[k].vertices[1], prevFoot[k][0]]);
      }
      if (!footPoly.sat(plat.roof)) count++;
    }
    return count > 0;
  }

  move(grid: Grid, dt: number) {
    const prevFoot: Pt[][] = this.foot.map((f) => [
      f.vertices[0].copy(),
      f.vertices[1].copy(),
    ]);
    const tSauv = this.t;
    const yS = this.body.center.y;
    const xS = this.body.center.x;

    const tv = new Vec(
      this.vx * dt,
      Math.max(-0.5 * this.g * dt * (2 * this.t + dt) + this.vy0 * dt, -1),
    );
    this.translate(tv);
    this.t += dt;

    const deadC: number[] = [];
    const floorC: number[] = [];

    const sliceStart = Math.max(Math.floor(this.body.center.x - 1), 0);
    const sliceEnd = Math.floor(this.body.center.x + 2);
    const around = grid.grid.slice(sliceStart, sliceEnd);

    around.forEach((col) => {
      if (!col) return;
      col.forEach((el) => {
        if (el instanceof Platform) {
          if (!this.body.sat(el.platform)) {
            if (this.footContactWithRoof(prevFoot, el)) {
              floorC.push(el.platform.center.y);
            } else {
              deadC.push(el.platform.center.y);
            }
          }
        } else if (el instanceof Peak) {
          if (!this.body.sat(el.peak)) {
            deadC.push(el.center.y);
          }
        } else if (el instanceof Ending) {
          if (!this.body.sat(el.ending)) {
            this.haveFinished = true;
          }
        }
      });
    });

    const maxDead = deadC.length > 0 ? Math.max(...deadC) : -Infinity;
    const maxFloor = floorC.length > 0 ? Math.max(...floorC) : -Infinity;

    if (deadC.length > 0) {
      if (floorC.length === 0 || maxDead > maxFloor) {
        this.isDead = true;
      }
    }

    if (this.body.center.y < 0) {
      this.isDead = true;
      const nc = new Pt(this.body.center.x, 0.5);
      this.translate(new Vec(this.body.center, nc));
    }

    if (!this.isDead) {
      if (floorC.length > 0) {
        let newX: number;
        if (this.isJumping) {
          const a = -this.g / 2;
          const b = this.vy0 - this.g * tSauv;
          const c = -(maxFloor + 1 - yS);
          const delta = b ** 2 - 4 * a * c;
          const newDt = Math.max(
            (-b - Math.sqrt(Math.max(delta, 0))) / (2 * a),
            (-b + Math.sqrt(Math.max(delta, 0))) / (2 * a),
          );
          newX = xS + newDt * this.vx;
        } else {
          newX = this.body.center.x;
        }
        const nc = new Pt(newX, maxFloor + 1);
        this.translate(new Vec(this.body.center, nc));
        this.rotate(2 * Math.PI - this.body.polarDirection[1]);
        this.g = 0;
        this.vy0 = 0;
        this.t = 0;
        this.isJumping = false;
      } else {
        this.g = (2 * this.yJump) / (this.xJump / (2 * this.vx)) ** 2;
        this.rotate(-Math.PI / ((1 / dt) * (this.xJump / (2 * this.vx)) + 2));
        this.isJumping = true;
      }
    }
  }

  jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.g = (2 * this.yJump) / (this.xJump / (2 * this.vx)) ** 2;
      this.vy0 = (2 * this.yJump) / (this.xJump / (2 * this.vx));
      this.t = 0;
      this.startJumpPosition = this.body.center.copy();
    }
  }

  setDeathParticle() {
    for (let k = 0; k < 40; k++) {
      this.deathParticle.push({
        position: this.body.center.copy(),
        angle: 2 * Math.PI * Math.random(),
        maxProjection: 2 * Math.random(),
      });
    }
  }
}

// ─── Level builder ───────────────────────────────────────────────────────────

function platformDistance(h: number, vx: number, xJump: number, yJump: number) {
  const a = -(2 * yJump) / (xJump / (2 * vx)) ** 2 / 2;
  const b = (2 * yJump) / (xJump / (2 * vx));
  const delta = b ** 2 + 4 * a * h;
  return ((-b - Math.sqrt(Math.max(delta, 0))) / (2 * a)) * vx;
}

function buildLevel(grid: Grid, vx: number, xJump: number, yJump: number) {
  grid.grid = [];
  const d1 = platformDistance(1, vx, xJump, yJump);
  const d2 = platformDistance(2, vx, xJump, yJump);
  const d27 = platformDistance(2.7, vx, xJump, yJump);
  const d0 = 4;
  const dm1 = platformDistance(-1, vx, xJump, yJump);

  let pos: [number, number] = [0, 0];
  let lastPos: [number, number];

  // Long ground start
  for (let k = 0; k < 70; k++) grid.addPlatform(k, 4);

  // Spikes section
  for (let k = 70; k < 110; k++) {
    grid.addPlatform(k, 4);
    if ((k - 70) % 8 === 0) pos = grid.addPeak(k, 5, "up");
  }
  lastPos = pos;

  // Floating platforms
  for (let k = 0; k < 8; k++)
    pos = grid.addPlatform(Math.floor(30 + lastPos[0]) + d0 * k, 5);

  // More ground
  for (let k = 110; k < 188; k++) pos = grid.addPlatform(k, 4);

  lastPos = pos;
  // Staircase up
  for (let k = 0; k < 3; k++)
    pos = grid.addPlatform(lastPos[0] + d1 * (k + 1), 5 + k);

  pos = grid.addPlatform(pos[0] + d0, 7);
  pos = grid.addPlatform(pos[0] + dm1, 6);
  pos = grid.addPlatform(pos[0] + d0, 6);
  pos = grid.addPlatform(pos[0] + d1, 7);
  pos = grid.addPlatform(pos[0] + d0, 7);
  pos = grid.addPlatform(pos[0] + 2.5, 6);
  pos = grid.addPlatform(pos[0] + 2.5, 5);

  for (let k = 0; k < 5; k++) pos = grid.addPlatform(pos[0] + d1, 6 + k);
  for (let k = 0; k < 5; k++) pos = grid.addPlatform(pos[0] + dm1, 10 - k);
  for (let k = 0; k < 15; k++) pos = grid.addPlatform(pos[0] + d1, 6 + k);

  lastPos = pos;
  for (let k = Math.floor(lastPos[0]) + 4; k < Math.floor(lastPos[0]) + 24; k++)
    pos = grid.addPlatform(k, 4);

  // Ceiling spikes
  lastPos = pos;
  for (let k = Math.floor(lastPos[0]); k < Math.floor(lastPos[0]) + 10; k++) {
    grid.addPlatform(k, 4);
    grid.addPlatform(k, 7.6);
    pos = grid.addPeak(k, 6.5, "down");
  }

  pos = grid.addPeak(pos[0] + 4, 5, "left");
  pos = grid.addPlatform(pos[0] + 1, 5);
  pos = grid.addPlatform(Math.floor(pos[0]) + 1, 4);
  pos = grid.addPeak(pos[0], 5, "right");

  lastPos = pos;
  for (let k = Math.floor(lastPos[0]); k < Math.floor(lastPos[0]) + 10; k++)
    pos = grid.addPlatform(k, 4);

  // Big jumps
  lastPos = pos;
  for (let k = 1; k < 5; k++)
    pos = grid.addPlatform(lastPos[0] + k * d2, 4 + 2 * k);
  lastPos = pos;
  for (let k = 1; k < 5; k++)
    pos = grid.addPlatform(lastPos[0] + k * d27, lastPos[1] + 2.7 * k);

  pos = grid.addPlatform(pos[0] + d0, pos[1]);
  pos = grid.addPlatform(pos[0] + d0, pos[1]);
  pos = grid.addPlatform(pos[0] + 2.5, pos[1] - 1);
  pos = grid.addPlatform(pos[0] + d1, pos[1] + 1);
  pos = grid.addPlatform(pos[0] + dm1, pos[1] - 1);
  for (let k = 0; k < 4; k++) pos = grid.addPlatform(pos[0] + 1, pos[1]);
  grid.addPeak(pos[0], pos[1] + 1, "up");
  pos = grid.addPlatform(pos[0] + dm1 - 1, pos[1] - 2);
  pos = grid.addPlatform(pos[0] + 2.5, pos[1] - 1);
  pos = grid.addPlatform(pos[0] + 2.5, pos[1] - 1);
  grid.addPeak(pos[0] - 1, pos[1] + 3, "left");
  pos = grid.addPlatform(pos[0] + 1 + dm1, pos[1] - 4);
  pos = grid.addPlatform(pos[0] + dm1, pos[1] - 1);
  pos = grid.addPlatform(pos[0] + 2.5, pos[1] - 1);
  pos = grid.addPlatform(pos[0] + dm1, pos[1] - 1);

  for (let k = 0; k < 12; k++)
    pos = grid.addPlatform(pos[0] + 1, pos[1] - Math.abs(Math.sin(k)));

  lastPos = pos;
  for (let k = lastPos[0] + 1; k < Math.floor(lastPos[0]) + 4; k++)
    pos = grid.addPlatform(k, lastPos[1]);

  pos = grid.addPlatform(pos[0] + d0, pos[1]);

  // Height variations
  const hvs = [2, 2.7, -4, 1, 1.5, -1, 2.3, 1, -4, -4];
  for (const hv of hvs) {
    pos = grid.addPlatform(
      pos[0] + platformDistance(hv, vx, xJump, yJump),
      pos[1] + hv,
    );
  }
  pos = grid.addPlatform(pos[0] + d0, 4);

  // Long final section with spikes
  for (let k = 0; k < 20; k++) pos = grid.addPlatform(pos[0] + 1, 4);

  const spikePatterns = [5, 5, 6, 4, 4, 8, 1, 7, 1, 3, 1];
  for (const gap of spikePatterns) {
    grid.addPeak(pos[0], 5, "up");
    for (let k = 0; k < gap; k++) pos = grid.addPlatform(pos[0] + 1, 4);
  }

  // Elevated spikes
  for (let k = 0; k < 11; k++) pos = grid.addPlatform(pos[0] + 1, 4);
  for (let rep = 0; rep < 4; rep++) {
    pos = grid.addPlatform(pos[0] + 1, 4.5);
    grid.addPeak(pos[0], 5.5, "up");
    const cnt = rep === 2 ? 3 : rep === 3 ? 8 : 5;
    for (let k = 0; k < cnt; k++) pos = grid.addPlatform(pos[0] + 1, 4);
  }
  pos = grid.addPlatform(pos[0] + 1, 5);
  grid.addPeak(pos[0], 6, "up");

  // Final run
  for (let k = 0; k < 8; k++) pos = grid.addPlatform(pos[0] + 1, 4);
  pos = grid.addPlatform(pos[0] + d0, 4);
  pos = grid.addPlatform(pos[0] + d0, 4);
  for (let k = 0; k < 3; k++) pos = grid.addPlatform(pos[0] + 1, 4);
  pos = grid.addPlatform(pos[0] + dm1, 3);
  pos = grid.addPlatform(pos[0] + d0, 3);
  pos = grid.addPlatform(pos[0] + dm1, 2);
  for (let k = 0; k < 4; k++) pos = grid.addPlatform(pos[0] + 1, 2);

  // Final straight
  for (let k = 0; k < 80; k++) pos = grid.addPlatform(pos[0] + 1, 4);

  // Ending
  const endingInst = new Ending(Math.floor(pos[0]) + 10);
  grid.addEnding(endingInst);
}

// ─── Main component ─────────────────────────────────────────────────────────

// Checkpoint save state
interface CheckpointState {
  cx: number;
  cy: number;
  pd: [number, number];
  vx: number;
  vy0: number;
  g: number;
  t: number;
  isJumping: boolean;
  bgScroll: number;
  score: number;
}

// Dropbox asset URLs from the original repo
const CITY_IMG_URL =
  "https://www.dropbox.com/s/1t4dgtwi326xqcj/cyberpunk-city.png?raw=1";
const CITY_REV_IMG_URL =
  "https://www.dropbox.com/s/exjklzi9u3imwdk/cyberpunk-city-reverse.png?raw=1";
const BG_MUSIC_URL =
  "https://www.dropbox.com/s/2t2sf02z7pt2y6v/White%20Bat%20Audio%20-%20Inception.mp3?raw=1";
const DEATH_SFX_URL =
  "https://www.dropbox.com/s/atqwpuraxkqj8au/esm_8bit_explosion_medium_bomb_boom_blast_cannon_retro_old_school_classic_cartoon.mp3?raw=1";

export default function PolyDashGame({ onGameOver, onScoreChange }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cwRef = useRef(DEFAULT_CW);
  const chRef = useRef(DEFAULT_CH);
  const unityRef = useRef(DEFAULT_CW / 40);
  const rafRef = useRef<number>(0);

  const heroRef = useRef<Hero | null>(null);
  const gridRef = useRef<Grid>(new Grid());
  const keysRef = useRef<Record<string, boolean>>({});
  const stateRef = useRef<"menu" | "playing" | "dead" | "win">("menu");
  const lastTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(0);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const deathTimeRef = useRef(0);
  const bgScrollRef = useRef(0);
  const frameRef = useRef(0);
  const [, forceUpdate] = useState(0);

  // Checkpoint system
  const checkpointRef = useRef<CheckpointState | null>(null);
  const checkpointCountRef = useRef(0);
  const checkpointPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastCheckpointTimeRef = useRef(0);
  const deathCountRef = useRef(0);

  // Assets
  const cityImgRef = useRef<HTMLImageElement | null>(null);
  const cityRevImgRef = useRef<HTMLImageElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const deathSfxRef = useRef<HTMLAudioElement | null>(null);
  const imagesLoadedRef = useRef(false);

  // Game constants
  const VX = 10;
  const XJUMP = 4;
  const YJUMP = 3;
  // UNITY is derived from canvas width, kept in unityRef and updated each frame

  // ─── Load assets ───────────────────────────────────────────────────────
  useEffect(() => {
    const img1 = new Image();
    img1.crossOrigin = "anonymous";
    img1.src = CITY_IMG_URL;
    const img2 = new Image();
    img2.crossOrigin = "anonymous";
    img2.src = CITY_REV_IMG_URL;
    cityImgRef.current = img1;
    cityRevImgRef.current = img2;

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded >= 2) imagesLoadedRef.current = true;
    };
    img1.onload = onLoad;
    img2.onload = onLoad;

    const music = new Audio(BG_MUSIC_URL);
    music.loop = true;
    music.volume = 0.4;
    bgMusicRef.current = music;

    const sfx = new Audio(DEATH_SFX_URL);
    sfx.volume = 0.6;
    deathSfxRef.current = sfx;

    return () => {
      music.pause();
      music.src = "";
    };
  }, []);

  // ─── Resize canvas to fill container ───────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Set the canvas backing-store size to match the container
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Update refs so the game loop picks them up
    cwRef.current = canvas.width;
    chRef.current = canvas.height;
    unityRef.current = canvas.width / 40;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      ro.disconnect();
    };
  }, [resizeCanvas]);

  // ─── Create hero / grid ────────────────────────────────────────────────
  const createHero = useCallback(() => {
    return new Hero(6, 5.5, [1, 0], VX, 0, XJUMP, YJUMP, 0, 0, false);
  }, []);

  const resetGame = useCallback(() => {
    const hero = createHero();
    heroRef.current = hero;
    const g = new Grid();
    buildLevel(g, VX, XJUMP, YJUMP);
    gridRef.current = g;
    scoreRef.current = 0;
    cameraXRef.current = 0;
    cameraYRef.current = 0;
    bgScrollRef.current = 0;
    checkpointRef.current = null;
    checkpointCountRef.current = 0;
    checkpointPosRef.current = null;
    stateRef.current = "playing";
    lastTimeRef.current = performance.now();
    onScoreChange?.(0);
    // Start music
    try {
      bgMusicRef.current?.play();
    } catch {
      /* user interaction needed */
    }
    forceUpdate((n) => n + 1);
  }, [createHero, onScoreChange]);

  // ─── Save checkpoint ────────────────────────────────────────────────────
  const saveCheckpoint = useCallback(() => {
    const hero = heroRef.current;
    if (!hero || stateRef.current !== "playing" || !hero.hasStarted) return;
    const now = performance.now();
    if (now - lastCheckpointTimeRef.current < 500) return; // cooldown
    lastCheckpointTimeRef.current = now;
    checkpointRef.current = {
      cx: hero.body.center.x,
      cy: hero.body.center.y,
      pd: [hero.body.polarDirection[0], hero.body.polarDirection[1]],
      vx: hero.vx,
      vy0: hero.vy0,
      g: hero.g,
      t: hero.t,
      isJumping: hero.isJumping,
      bgScroll: bgScrollRef.current,
      score: scoreRef.current,
    };
    checkpointPosRef.current = { x: hero.body.center.x, y: hero.body.center.y };
    checkpointCountRef.current++;
  }, []);

  // ─── Respawn at checkpoint ─────────────────────────────────────────────
  const respawnAtCheckpoint = useCallback(() => {
    const cp = checkpointRef.current;
    if (!cp) return;
    const hero = new Hero(
      cp.cx,
      cp.cy,
      cp.pd,
      cp.vx,
      cp.vy0,
      XJUMP,
      YJUMP,
      cp.g,
      cp.t,
      cp.isJumping,
    );
    hero.hasStarted = true;
    heroRef.current = hero;
    bgScrollRef.current = cp.bgScroll;
    scoreRef.current = cp.score;
    cameraXRef.current = cp.cx - 10;
    cameraYRef.current = 0;
    stateRef.current = "playing";
    lastTimeRef.current = performance.now();
    // Resume music
    try {
      bgMusicRef.current?.play();
    } catch {
      /* ok */
    }
    forceUpdate((n) => n + 1);
  }, []);

  // ─── Input ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.key === "w" ||
        e.key === "W"
      ) {
        e.preventDefault();
        if (stateRef.current === "menu") {
          resetGame();
        } else if (stateRef.current === "dead" || stateRef.current === "win") {
          if (stateRef.current === "dead" && checkpointRef.current) {
            respawnAtCheckpoint();
          } else {
            bgMusicRef.current?.pause();
            if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
            stateRef.current = "menu";
            forceUpdate((n) => n + 1);
          }
        }
      }
      // S key = checkpoint
      if (e.key === "s" || e.key === "S") {
        if (stateRef.current === "playing") {
          e.preventDefault();
          saveCheckpoint();
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [resetGame, saveCheckpoint, respawnAtCheckpoint]);

  // ─── Drawing helpers (read live values from refs each call) ────────────
  const gx = useCallback(
    (x: number) => (x - cameraXRef.current) * unityRef.current,
    [],
  );
  const gy = useCallback(
    (y: number) => chRef.current - (y + cameraYRef.current) * unityRef.current,
    [],
  );

  // ─── Game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Create initial hero for menu
    if (!heroRef.current) {
      heroRef.current = createHero();
      const g = new Grid();
      buildLevel(g, VX, XJUMP, YJUMP);
      gridRef.current = g;
    }

    const loop = (now: number) => {
      frameRef.current++;
      const frame = frameRef.current;
      const hero = heroRef.current!;
      const grid = gridRef.current;
      const state = stateRef.current;

      // Read current canvas dimensions each frame
      const CW = cwRef.current;
      const CH = chRef.current;
      const UNITY = unityRef.current;

      // ─── Delta time ─────────────────────────────────────────
      let dt = (now - lastTimeRef.current) / 1000;
      if (dt > 0.1) dt = 0.016; // clamp
      lastTimeRef.current = now;

      // ─── Update ─────────────────────────────────────────────
      if (state === "playing" && hero.hasStarted) {
        // Jump
        if (
          keysRef.current["Space"] ||
          keysRef.current["ArrowUp"] ||
          keysRef.current["KeyW"]
        ) {
          hero.jump();
        }

        hero.move(grid, dt);

        // Score
        const newScore = Math.floor(hero.body.center.x);
        if (newScore > scoreRef.current) {
          scoreRef.current = newScore;
          onScoreChange?.(newScore);
        }

        // Camera
        cameraXRef.current = hero.body.center.x - 10;
        if (hero.body.center.y + cameraYRef.current < 5) {
          cameraYRef.current = Math.min(5 - hero.body.center.y, 0);
        } else if (CH / UNITY - hero.body.center.y - cameraYRef.current < 5) {
          cameraYRef.current = CH / UNITY - hero.body.center.y - 5;
        }

        bgScrollRef.current += dt * (VX / 6) * UNITY;

        if (hero.isDead) {
          stateRef.current = "dead";
          deathTimeRef.current = now;
          hero.setDeathParticle();
          if (scoreRef.current > bestScoreRef.current)
            bestScoreRef.current = scoreRef.current;
          // Play death sound
          try {
            const sfx = deathSfxRef.current;
            if (sfx) {
              sfx.currentTime = 0;
              sfx.play();
            }
          } catch {
            /* ok */
          }
          // Pause music briefly
          bgMusicRef.current?.pause();
          deathCountRef.current++;
          // Only show the mint popup every 5 deaths
          if (deathCountRef.current % 5 === 0) {
            onGameOver(scoreRef.current);
          }
        }
        if (hero.haveFinished) {
          stateRef.current = "win";
          deathTimeRef.current = now;
          if (scoreRef.current > bestScoreRef.current)
            bestScoreRef.current = scoreRef.current;
          bgMusicRef.current?.pause();
          onGameOver(scoreRef.current);
        }
      } else if (state === "playing" && !hero.hasStarted) {
        if (
          keysRef.current["Space"] ||
          keysRef.current["ArrowUp"] ||
          keysRef.current["KeyW"]
        ) {
          hero.hasStarted = true;
          lastTimeRef.current = now;
          try {
            bgMusicRef.current?.play();
          } catch {
            /* ok */
          }
        }
      }

      // ─── Render ──────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);

      // Background — use Dropbox city images if loaded, else gradient fallback
      const cityImg = cityImgRef.current;
      const cityRevImg = cityRevImgRef.current;
      if (imagesLoadedRef.current && cityImg && cityRevImg) {
        const ratio = cityImg.width / cityImg.height;
        const imgH = CH;
        const imgW = imgH * ratio;
        const scrollPos = bgScrollRef.current % (imgW * 2);
        const idx = Math.floor(scrollPos / imgW);

        for (let n = -1; n <= 3; n++) {
          const imgIdx = idx + n;
          const img = imgIdx % 2 === 0 ? cityImg : cityRevImg;
          const xPos = imgIdx * imgW - scrollPos;
          if (xPos > CW + 50 || xPos + imgW < -50) continue;
          ctx.drawImage(img, xPos, 0, imgW, imgH);
        }
      } else {
        // Gradient fallback
        const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
        bgGrad.addColorStop(0, "#0a001a");
        bgGrad.addColorStop(0.5, "#140028");
        bgGrad.addColorStop(1, "#1a0033");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, CW, CH);

        // Procedural city fallback
        const cityW = CW * 2;
        const scrollX = bgScrollRef.current % cityW;
        ctx.save();
        ctx.globalAlpha = 0.5;
        for (
          let bx = -scrollX;
          bx < CW + 200;
          bx += 60 + Math.sin(bx * 0.01) * 20
        ) {
          const bh =
            200 + Math.sin(bx * 0.03 + 1) * 120 + Math.cos(bx * 0.017) * 80;
          const bw = 35 + Math.sin(bx * 0.05) * 15;
          ctx.fillStyle = `hsl(${260 + Math.sin(bx * 0.01) * 20}, 60%, 15%)`;
          ctx.fillRect(bx, CH - bh, bw, bh);
          ctx.fillStyle = `rgba(${180 + Math.sin(bx) * 50}, 100, 255, 0.4)`;
          for (let wy = CH - bh + 8; wy < CH - 15; wy += 12) {
            for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
              if (Math.sin(wx * wy * 0.1) > 0) ctx.fillRect(wx, wy, 3, 5);
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // ─── Draw grid ─────────────────────────────────────────
      const minCol = Math.max(Math.floor(cameraXRef.current), 0);
      const maxCol = Math.floor(hero.body.center.x + 40);

      const drawNeon = (path: Path2D, r: number, g: number, b: number) => {
        ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`;
        ctx.lineWidth = 9;
        ctx.stroke(path);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
        ctx.lineWidth = 5;
        ctx.stroke(path);
        ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
        ctx.lineWidth = 3;
        ctx.stroke(path);
      };

      const platPath = new Path2D();
      const peakPath = new Path2D();
      const endPath = new Path2D();

      grid.grid.slice(minCol, maxCol).forEach((col) => {
        if (!col) return;
        col.forEach((el) => {
          if (el instanceof Platform) {
            platPath.rect(
              gx(el.platform.vertices[3].x),
              gy(el.platform.vertices[3].y),
              UNITY,
              UNITY,
            );
            platPath.closePath();
          } else if (el instanceof Peak) {
            peakPath.moveTo(
              gx(el.peak.vertices[0].x),
              gy(el.peak.vertices[0].y),
            );
            peakPath.lineTo(
              gx(el.peak.vertices[1].x),
              gy(el.peak.vertices[1].y),
            );
            peakPath.lineTo(
              gx(el.peak.vertices[2].x),
              gy(el.peak.vertices[2].y),
            );
            peakPath.closePath();
          } else if (el instanceof Ending) {
            const ec = el.col;
            endPath.moveTo(gx(ec - 0.5), gy(14));
            endPath.lineTo(gx(ec + 1.5), gy(14));
            endPath.lineTo(gx(ec + 1), gy(6));
            endPath.lineTo(gx(ec + 1.5), gy(6));
            endPath.lineTo(gx(ec + 0.5), gy(5));
            endPath.lineTo(gx(ec - 0.5), gy(6));
            endPath.lineTo(gx(ec), gy(6));
            endPath.closePath();
          }
        });
      });

      drawNeon(platPath, 255, 254, 242);
      drawNeon(peakPath, 255, 7, 58);
      drawNeon(endPath, 57, 255, 20);

      // ─── Draw checkpoint flag ──────────────────────────────
      if (checkpointPosRef.current && state === "playing") {
        const cpx = gx(checkpointPosRef.current.x);
        const cpy = gy(checkpointPosRef.current.y);
        // Pole
        ctx.strokeStyle = "rgba(224,231,34,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cpx, cpy);
        ctx.lineTo(cpx, cpy - UNITY * 2.5);
        ctx.stroke();
        // Flag
        ctx.fillStyle = "rgba(224,231,34,0.7)";
        ctx.beginPath();
        ctx.moveTo(cpx, cpy - UNITY * 2.5);
        ctx.lineTo(cpx + UNITY, cpy - UNITY * 2);
        ctx.lineTo(cpx, cpy - UNITY * 1.5);
        ctx.closePath();
        ctx.fill();
        // Glow
        ctx.shadowColor = "rgba(224,231,34,0.6)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ─── Draw hero ─────────────────────────────────────────
      if (state !== "dead" || now - deathTimeRef.current < 300) {
        if (state !== "dead") {
          const heroPath = new Path2D();
          heroPath.moveTo(
            gx(hero.body.vertices[0].x),
            gy(hero.body.vertices[0].y),
          );
          for (let i = 1; i < 4; i++) {
            heroPath.lineTo(
              gx(hero.body.vertices[i].x),
              gy(hero.body.vertices[i].y),
            );
          }
          heroPath.closePath();
          drawNeon(heroPath, 254, 1, 154);
          // Fill
          ctx.fillStyle = "rgba(254,1,154,0.3)";
          ctx.fill(heroPath);
        }
      }

      // Death particles
      if (state === "dead") {
        const elapsed = (now - deathTimeRef.current) / 1000;
        if (elapsed < 0.5) {
          const explPath = new Path2D();
          hero.deathParticle.forEach((p) => {
            const tv = new Vec(Math.cos(p.angle), Math.sin(p.angle)).product(
              p.maxProjection * elapsed * 3,
            );
            p.position.translate(tv);
            explPath.moveTo(gx(p.position.x) + 2, gy(p.position.y));
            explPath.arc(gx(p.position.x), gy(p.position.y), 2, 0, Math.PI * 2);
            explPath.closePath();
          });
          drawNeon(explPath, 254, 1, 154);
        }
      }

      // ─── HUD ───────────────────────────────────────────────
      if (state === "playing") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(10, 10, 150, 40);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`DISTANCE: ${scoreRef.current}`, 18, 36);

        // Checkpoint counter
        if (checkpointCountRef.current > 0) {
          ctx.fillStyle = "rgba(224,231,34,0.9)";
          ctx.font = "bold 16px monospace";
          ctx.fillText(`🚩 ${checkpointCountRef.current}`, 170, 36);
        }

        // Progress bar
        const totalLen = gridRef.current.grid.length;
        const progress = Math.min(hero.body.center.x / totalLen, 1);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(CW - 220, 15, 200, 10);
        const pGrad = ctx.createLinearGradient(CW - 220, 0, CW - 20, 0);
        pGrad.addColorStop(0, "#fe019a");
        pGrad.addColorStop(1, "#39ff14");
        ctx.fillStyle = pGrad;
        ctx.fillRect(CW - 220, 15, 200 * progress, 10);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(CW - 220, 15, 200, 10);

        // S key hint
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText("Press S = Checkpoint", CW - 15, CH - 10);
      }

      // ─── Menu ──────────────────────────────────────────────
      if (state === "menu") {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, CW, CH);

        ctx.shadowColor = "#fe019a";
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#fe019a";
        ctx.font = "bold 52px monospace";
        ctx.textAlign = "center";
        ctx.fillText("POLY DASH", CW / 2, CH / 2 - 60);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "14px monospace";
        ctx.fillText("A Geometry Dash Inspired Game", CW / 2, CH / 2 - 25);

        // Info
        ctx.fillStyle = "rgba(255,7,58,0.8)";
        ctx.font = "bold 12px monospace";
        ctx.fillText("─── HOW TO PLAY ───", CW / 2, CH / 2 + 10);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "11px monospace";
        ctx.fillText("SPACE / ↑ / W / TAP  =  Jump", CW / 2, CH / 2 + 30);
        ctx.fillText("S  =  Save Checkpoint 🚩", CW / 2, CH / 2 + 48);
        ctx.fillText(
          "Avoid spikes 🔺 · Land on platforms ▬",
          CW / 2,
          CH / 2 + 66,
        );
        ctx.fillText("Reach the finish line to win!", CW / 2, CH / 2 + 84);

        ctx.fillStyle = "rgba(224,231,34,0.7)";
        ctx.font = "11px monospace";
        ctx.fillText(
          "Checkpoints save your position — respawn there on death!",
          CW / 2,
          CH / 2 + 108,
        );

        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(57,255,20,${blink})`;
        ctx.font = "bold 20px monospace";
        ctx.fillText("TAP or SPACE to START", CW / 2, CH / 2 + 145);

        if (bestScoreRef.current > 0) {
          ctx.fillStyle = "#FFD700";
          ctx.font = "14px monospace";
          ctx.fillText(`BEST: ${bestScoreRef.current}`, CW / 2, CH / 2 + 175);
        }
      }

      // ─── Dead screen ───────────────────────────────────────
      if (state === "dead" && now - deathTimeRef.current > 500) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, CW, CH);

        ctx.fillStyle = "#ff0739";
        ctx.font = "bold 40px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CW / 2, CH / 2 - 40);

        ctx.fillStyle = "#fff";
        ctx.font = "22px monospace";
        ctx.fillText(`DISTANCE: ${scoreRef.current}`, CW / 2, CH / 2 + 5);

        if (checkpointRef.current) {
          ctx.fillStyle = "rgba(224,231,34,0.9)";
          ctx.font = "14px monospace";
          ctx.fillText(
            "🚩 Checkpoint saved! You will respawn there.",
            CW / 2,
            CH / 2 + 35,
          );
        }

        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font = "16px monospace";
        ctx.fillText(
          checkpointRef.current
            ? "TAP or SPACE to respawn at checkpoint"
            : "TAP or SPACE to continue",
          CW / 2,
          CH / 2 + 70,
        );
      }

      // ─── Win screen ────────────────────────────────────────
      if (state === "win") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, CW, CH);

        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#39ff14";
        ctx.font = "bold 44px monospace";
        ctx.textAlign = "center";
        ctx.fillText("YOU WON!", CW / 2, CH / 2 - 30);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#fff";
        ctx.font = "22px monospace";
        ctx.fillText(`DISTANCE: ${scoreRef.current}`, CW / 2, CH / 2 + 15);

        const blink = Math.sin(frame * 0.06) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font = "16px monospace";
        ctx.fillText("TAP or SPACE to continue", CW / 2, CH / 2 + 60);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [createHero, onGameOver, onScoreChange, gx, gy]);

  const handleTap = useCallback(() => {
    if (stateRef.current === "menu") {
      resetGame();
    } else if (stateRef.current === "playing") {
      const hero = heroRef.current;
      if (hero && !hero.hasStarted) {
        hero.hasStarted = true;
        lastTimeRef.current = performance.now();
        try {
          bgMusicRef.current?.play();
        } catch {
          /* ok */
        }
      } else if (hero) {
        hero.jump();
      }
    } else if (stateRef.current === "dead") {
      if (checkpointRef.current) {
        respawnAtCheckpoint();
      } else {
        bgMusicRef.current?.pause();
        if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
        stateRef.current = "menu";
        forceUpdate((n) => n + 1);
      }
    } else if (stateRef.current === "win") {
      bgMusicRef.current?.pause();
      if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
      stateRef.current = "menu";
      forceUpdate((n) => n + 1);
    }
  }, [resetGame, respawnAtCheckpoint]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
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
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault();
          handleTap();
          keysRef.current["Space"] = true;
          setTimeout(() => {
            keysRef.current["Space"] = false;
          }, 100);
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "pointer",
        }}
      />
    </div>
  );
}
