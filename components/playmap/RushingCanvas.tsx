"use client";

import { useRef, useEffect, useCallback } from "react";
import type { RushingPlay } from "@/types";

interface Props {
  plays: RushingPlay[];
  animationKey: number;
  isViral: boolean;
  onPlaySelect: (play: RushingPlay | null, x: number, y: number) => void;
  onComplete: () => void;
}

const LOS_Y_FRAC     = 0.80;
const PX_PER_YARD    = 0.034;
const MAX_YARDS      = 50;

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2.8);
}

// ─── Color scale (heat-map: red→orange→yellow→green→cyan) ────────────────────
function playColor(play: RushingPlay): string {
  if (play.result === "td")     return "#ffd700";
  if (play.result === "fumble") return "#ff44cc";
  if (play.yards <  0)          return "#ee3333";
  if (play.yards <  2)          return "#ff7733";
  if (play.yards <  5)          return "#ffcc22";
  if (play.yards < 10)          return "#88ee44";
  if (play.yards < 20)          return "#22ee88";
  return "#00ffcc";
}

function playAlpha(play: RushingPlay): number {
  if (play.yards < 0)           return 0.70;
  if (play.result === "fumble") return 0.82;
  return 0.88;
}

function glowR(play: RushingPlay, viral: boolean): number {
  if (play.result === "td")     return viral ? 45 : 32;
  if (play.yards >= 20)         return viral ? 28 : 20;
  if (play.yards >= 10)         return viral ? 18 : 12;
  if (play.result === "fumble") return 14;
  return viral ? 7 : 3;
}

function strokeW(play: RushingPlay): number {
  if (play.result === "td") return 3.5;
  if (play.yards >= 20)     return 2.8;
  if (play.yards >= 10)     return 2.2;
  if (play.yards >=  5)     return 1.8;
  return 1.4;
}

// ─── Per-play timing (TDs + big plays linger longer) ─────────────────────────
function playMs(play: RushingPlay, base: number): number {
  if (play.result === "td") return base * 1.8;
  if (play.yards >= 20)     return base * 1.4;
  if (play.yards >= 10)     return base * 1.15;
  if (play.yards <  0)      return base * 0.75;
  return base;
}

// ─── Bezier control point (subtle lateral curve per play) ─────────────────────
function ctrlPt(
  idx: number,
  x0: number, y0: number, x1: number, y1: number
): [number, number] {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len, py = dx / len;               // perpendicular unit vec
  const frac = (((idx * 6271 + 17) % 100) / 100 - 0.5) * 0.12; // ±6% of len
  return [x0 + dx * 0.45 + px * len * frac,
          y0 + dy * 0.45 + py * len * frac];
}

// Partial quadratic bezier 0→t (De Casteljau). Returns head position.
function bezierTo(
  ctx: CanvasRenderingContext2D, t: number,
  x0: number, y0: number, cx: number, cy: number, x1: number, y1: number
): [number, number] {
  const q0x = x0 + t * (cx - x0), q0y = y0 + t * (cy - y0);
  const q1x = cx + t * (x1 - cx), q1y = cy + t * (y1 - cy);
  const bx  = q0x + t * (q1x - q0x), by = q0y + t * (q1y - q0y);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(q0x, q0y, bx, by);
  ctx.stroke();
  return [bx, by];
}

// ─── Play geometry ────────────────────────────────────────────────────────────
function getEndpoint(play: RushingPlay, w: number, h: number) {
  const lx = w / 2, ly = h * LOS_Y_FRAC;
  const scale = h * PX_PER_YARD;
  const yards = Math.min(Math.abs(play.yards), MAX_YARDS);
  const len   = yards * scale;
  const rad   = (play.angle * Math.PI) / 180;
  let ex: number, ey: number;
  if (play.yards >= 0) {
    ex = lx + Math.sin(rad) * len;
    ey = ly - Math.cos(Math.abs(rad)) * len;
  } else {
    ex = lx + Math.sin(rad * 0.4) * len * 0.6;
    ey = ly + len * 0.8;
  }
  return { lx, ly, ex, ey };
}

// ─── Field background ─────────────────────────────────────────────────────────
function drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const ly = h * LOS_Y_FRAC;
  const sc = h * PX_PER_YARD;

  // Base
  ctx.fillStyle = "#020a04";
  ctx.fillRect(0, 0, w, h);

  // Field zone gradient above LOS
  const fg = ctx.createLinearGradient(0, ly, 0, 0);
  fg.addColorStop(0,   "rgba(4,26,10,0.85)");
  fg.addColorStop(0.4, "rgba(3,16,7,0.60)");
  fg.addColorStop(1,   "rgba(2,6,2,0.25)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, w, ly);

  // Alternating 5-yd bands (very subtle turf feel)
  for (let y = 0; y < 50; y += 10) {
    const top = Math.max(0, ly - (y + 5) * sc);
    const bot = Math.min(ly, ly - y * sc);
    if (top >= ly) break;
    ctx.fillStyle = "rgba(0,70,18,0.055)";
    ctx.fillRect(0, top, w, bot - top);
  }

  // Behind-LOS red tint
  const ng = ctx.createLinearGradient(0, ly, 0, ly + 9 * sc);
  ng.addColorStop(0, "rgba(38,5,5,0.50)");
  ng.addColorStop(1, "rgba(10,0,0,0.00)");
  ctx.fillStyle = ng;
  ctx.fillRect(0, ly, w, Math.min(9 * sc, h - ly));

  // Sidelines
  ctx.strokeStyle = "rgba(60,130,50,0.28)";
  ctx.lineWidth   = 0.8;
  ctx.beginPath(); ctx.moveTo(w * 0.03, 0);  ctx.lineTo(w * 0.03, ly);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.97, 0);  ctx.lineTo(w * 0.97, ly);  ctx.stroke();

  // Hash marks (NFL proportion: ~23.6% / 76.4% of width)
  const hL = w * 0.236, hR = w * 0.764, hLen = w * 0.022;
  for (let y = 1; y <= 44; y++) {
    const yy = ly - y * sc;
    if (yy < 2) break;
    ctx.strokeStyle = "rgba(55,120,55,0.20)";
    ctx.lineWidth   = 0.5;
    ctx.beginPath(); ctx.moveTo(hL - hLen / 2, yy); ctx.lineTo(hL + hLen / 2, yy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hR - hLen / 2, yy); ctx.lineTo(hR + hLen / 2, yy); ctx.stroke();
  }

  // Yard lines every 5 yds
  for (let y = 5; y <= 45; y += 5) {
    const yy = ly - y * sc;
    if (yy < 2) break;
    const isTen = y % 10 === 0;
    ctx.strokeStyle = isTen ? "rgba(65,145,55,0.38)" : "rgba(45,100,40,0.20)";
    ctx.lineWidth   = isTen ? 0.9 : 0.45;
    ctx.beginPath(); ctx.moveTo(w * 0.03, yy); ctx.lineTo(w * 0.97, yy); ctx.stroke();
    if (isTen && yy > 14) {
      ctx.fillStyle = "rgba(80,165,65,0.42)";
      ctx.font = `bold ${Math.max(7, w * 0.021)}px 'Courier New', monospace`;
      ctx.textAlign = "left";  ctx.fillText(`+${y}`, w * 0.035, yy - 3);
      ctx.textAlign = "right"; ctx.fillText(`+${y}`, w * 0.965, yy - 3);
    }
  }

  // Behind-LOS lines
  for (let y = 2; y <= 8; y += 2) {
    const yy = ly + y * sc;
    if (yy > h - 2) break;
    ctx.strokeStyle = "rgba(100,18,18,0.22)";
    ctx.lineWidth   = 0.4;
    ctx.beginPath(); ctx.moveTo(w * 0.03, yy); ctx.lineTo(w * 0.97, yy); ctx.stroke();
  }

  // LOS — glowing green line
  ctx.save();
  ctx.shadowBlur = 12; ctx.shadowColor = "rgba(0,255,80,0.75)";
  ctx.strokeStyle = "rgba(0,220,80,0.92)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(w * 0.03, ly); ctx.lineTo(w * 0.97, ly); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(0,255,80,0.58)";
  ctx.font = `bold ${Math.max(7, w * 0.020)}px 'Courier New', monospace`;
  ctx.textAlign = "center";
  ctx.fillText("LINE OF SCRIMMAGE", w / 2, ly + 11);
  ctx.textAlign = "left";

  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.08, w / 2, h * 0.42, w * 0.92);
  vg.addColorStop(0,    "rgba(0,0,0,0)");
  vg.addColorStop(0.62, "rgba(0,0,0,0.06)");
  vg.addColorStop(1,    "rgba(0,0,0,0.68)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// ─── Draw a single play ───────────────────────────────────────────────────────
function drawPlay(
  ctx: CanvasRenderingContext2D,
  play: RushingPlay, idx: number,
  w: number, h: number,
  progress: number, viral: boolean
) {
  const { lx, ly, ex, ey } = getEndpoint(play, w, h);
  const [cpx, cpy] = ctrlPt(idx, lx, ly, ex, ey);
  const color = playColor(play);
  const glow  = glowR(play, viral);
  const sw    = strokeW(play);
  const ep    = easeOut(Math.min(progress, 1));

  ctx.save();
  ctx.globalAlpha = playAlpha(play);
  ctx.strokeStyle = color;
  ctx.lineWidth   = sw;
  ctx.lineCap     = "round";
  ctx.shadowBlur  = progress < 1 ? Math.max(glow * 0.55, 10) : glow;
  ctx.shadowColor = color;

  const [hx, hy] = bezierTo(ctx, ep, lx, ly, cpx, cpy, ex, ey);

  if (progress >= 1) {
    // Endpoint dot
    const r = play.result === "td" ? 5.5 : play.isLong ? 4.2 : 3;
    ctx.globalAlpha = 1;
    ctx.fillStyle   = color;
    ctx.shadowBlur  = glow;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();

    // TD starburst
    if (play.result === "td") {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth   = 1.3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * (r + 2), ey + Math.sin(a) * (r + 2));
        ctx.lineTo(ex + Math.cos(a) * (r + 15), ey + Math.sin(a) * (r + 15));
        ctx.stroke();
      }
    }
  } else {
    // Glowing head on the animating play
    ctx.globalAlpha = 0.95;
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 24;
    ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(hx, hy, sw * 1.7, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ─── Yards counter HUD (top-left) ─────────────────────────────────────────────
function drawYardsBox(ctx: CanvasRenderingContext2D, cw: number, play: RushingPlay) {
  const sc     = cw / 390;
  const col    = playColor(play);
  const isTD   = play.result === "td";
  const mainTxt = isTD ? "TD" : (play.yards >= 0 ? `+${play.yards}` : `${play.yards}`);
  const subTxt  = isTD ? "TOUCHDOWN" : "YDS";

  const bx = 10 * sc, by = 10 * sc;
  const bw = 76 * sc, bh = 52 * sc;
  const br = 4 * sc;

  ctx.save();

  // Background
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, br);
  ctx.fill();

  // Border + subtle glow
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col + "99";
  ctx.lineWidth = 1.5 * sc;
  ctx.shadowBlur = 8 * sc;
  ctx.shadowColor = col;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, br);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Yards number
  ctx.fillStyle = col;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(27 * sc)}px Impact, 'Arial Black', sans-serif`;
  ctx.shadowBlur = 12 * sc;
  ctx.shadowColor = col;
  ctx.fillText(mainTxt, bx + bw / 2, by + bh * 0.42);
  ctx.shadowBlur = 0;

  // Label
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#aaddbb";
  ctx.font = `${Math.round(7.5 * sc)}px 'Courier New', monospace`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(subTxt, bx + bw / 2, by + bh - 7 * sc);

  ctx.restore();
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function drawLegend(ctx: CanvasRenderingContext2D, w: number) {
  const items = [
    { c: "#ffd700", l: "TD"     },
    { c: "#00ffcc", l: "20+ yd" },
    { c: "#22ee88", l: "10+ yd" },
    { c: "#88ee44", l: "5+ yd"  },
    { c: "#ffcc22", l: "Gain"   },
    { c: "#ee3333", l: "Loss"   },
  ];
  const x0 = w - 72, y0 = 10;
  items.forEach(({ c, l }, i) => {
    const y = y0 + i * 14;
    ctx.save();
    ctx.shadowBlur = 4; ctx.shadowColor = c;
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y + 4); ctx.lineTo(x0 + 14, y + 4); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(175,210,175,0.65)";
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillText(l, x0 + 18, y + 8);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RushingCanvas({ plays, animationKey, isViral, onPlaySelect, onComplete }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animState     = useRef({ rafId: 0, playIdx: 0, progress: 0, lastTime: 0, done: false });
  const playsRef      = useRef(plays);
  const viralRef      = useRef(isViral);
  const onCompleteRef = useRef(onComplete);
  playsRef.current      = plays;
  viralRef.current      = isViral;
  onCompleteRef.current = onComplete;

  const loop = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    if (!cw || !ch) { animState.current.rafId = requestAnimationFrame(loop); return; }
    const tw = Math.round(cw * dpr), th = Math.round(ch * dpr);
    if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; }

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const viral    = viralRef.current;
    const allPlays = playsRef.current;
    const a        = animState.current;

    if (a.lastTime === 0) a.lastTime = ts;
    const dt = Math.min(ts - a.lastTime, 64);
    a.lastTime = ts;

    const base   = viral ? 14 : 22;
    const cur    = allPlays[a.playIdx];
    const msNow  = cur ? playMs(cur, base) : base;
    a.progress  += dt / msNow;

    if (a.progress >= 1) {
      a.playIdx  = Math.min(a.playIdx + 1, allPlays.length);
      a.progress = 0;
    }

    drawField(ctx, cw, ch);
    for (let i = 0; i < a.playIdx; i++) drawPlay(ctx, allPlays[i], i, cw, ch, 1, viral);
    if (a.playIdx < allPlays.length) {
      drawPlay(ctx, allPlays[a.playIdx], a.playIdx, cw, ch, Math.min(a.progress, 1), viral);
      drawYardsBox(ctx, cw, allPlays[a.playIdx]);
    }
    drawLegend(ctx, cw);

    if (a.playIdx >= allPlays.length) {
      if (!a.done) { a.done = true; onCompleteRef.current(); }
      return;
    }
    a.rafId = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!animationKey) return;
    const a = animState.current;
    cancelAnimationFrame(a.rafId);
    a.rafId = 0; a.playIdx = 0; a.progress = 0; a.lastTime = 0; a.done = false;
    a.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(a.rafId);
  }, [animationKey, loop]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;

    let closest: RushingPlay | null = null;
    let minDist = 14;

    // Check endpoint dots first
    for (const play of plays) {
      const { ex, ey } = getEndpoint(play, w, h);
      const d = Math.hypot(mx - ex, my - ey);
      if (d < minDist) { minDist = d; closest = play; }
    }
    // Fallback: straight-line proximity
    if (!closest) {
      for (const play of plays) {
        const { lx, ly, ex, ey } = getEndpoint(play, w, h);
        const dx = ex - lx, dy = ey - ly;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((mx - lx) * dx + (my - ly) * dy) / len2));
        const d = Math.hypot(mx - (lx + t * dx), my - (ly + t * dy));
        if (d < 12 && d < minDist) { minDist = d; closest = play; }
      }
    }
    onPlaySelect(closest, mx, my);
  }, [plays, onPlaySelect]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none"
      onClick={handleClick}
    />
  );
}
