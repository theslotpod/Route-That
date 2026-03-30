"use client";

import { useRef, useEffect, useCallback } from "react";
import type { ReceivingRoute, RouteType } from "@/types";

interface Props {
  routes: ReceivingRoute[];
  animationKey: number;
  isViral: boolean;
  onRouteSelect: (route: ReceivingRoute | null, x: number, y: number) => void;
  onComplete: () => void;
}

const LOS_Y_FRAC  = 0.78;
const PX_PER_YARD = 0.032;
const MAX_DEPTH   = 32;

// Lateral endpoint spread from center (fraction of canvas width)
const SIDE_LATERAL: Record<string, number> = {
  "left":       -0.33,
  "slot-left":  -0.14,
  "middle":      0,
  "slot-right":  0.14,
  "right":       0.33,
};

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2.8);
}

// ─── Color scale (blue spectrum for passing) ─────────────────────────────────
function routeColor(r: ReceivingRoute): string {
  if (r.result === "td")         return "#ffd700";
  if (r.result === "int")        return "#ee3333";
  if (r.result === "incomplete") return "#2a3d52";
  if (r.isLong)                  return "#00ddff";
  if (r.yards >= 10)             return "#44bbff";
  return "#2299ee";
}

function routeAlpha(r: ReceivingRoute): number {
  if (r.result === "incomplete") return 0.42;
  return 0.88;
}

function routeGlow(r: ReceivingRoute, viral: boolean): number {
  if (r.result === "td")   return viral ? 45 : 32;
  if (r.isLong)            return viral ? 26 : 18;
  if (r.result === "int")  return viral ? 18 : 12;
  if (r.result === "incomplete") return 0;
  return viral ? 7 : 3;
}

function routeW(r: ReceivingRoute): number {
  if (r.result === "td")         return 3.5;
  if (r.isLong)                  return 2.8;
  if (r.result === "incomplete") return 1.2;
  return 2.0;
}

// ─── Per-route timing ─────────────────────────────────────────────────────────
function routeMs(r: ReceivingRoute, base: number): number {
  if (r.result === "td")         return base * 1.8;
  if (r.isLong)                  return base * 1.4;
  if (r.result === "incomplete") return base * 0.72;
  return base;
}

// ─── Route waypoints (all start from center LOS) ─────────────────────────────
function getWaypoints(route: ReceivingRoute, w: number, h: number): [number, number][] {
  const losY  = h * LOS_Y_FRAC;
  const scale = h * PX_PER_YARD;
  const sx    = w / 2;                                            // all start from center
  const depth = Math.min(route.depth, MAX_DEPTH) * scale;

  const lx  = (SIDE_LATERAL[route.side] ?? 0) * w;               // lateral offset at endpoint
  const ex  = sx + lx;                                            // endpoint x
  const dir = lx < 0 ? -1 : lx > 0 ? 1 : 1;                     // direction (+1=right, -1=left)

  switch (route.type as RouteType) {
    case "go":
      return [[sx, losY], [ex, losY - depth]];

    case "slant": {
      const stem = Math.min(4 * scale, depth * 0.3);
      return [[sx, losY], [sx, losY - stem], [ex, losY - depth]];
    }

    case "out": {
      // Run upfield, break outward (away from center)
      const stemY = losY - depth * 0.75;
      return [[sx, losY], [sx + lx * 0.5, stemY], [ex + dir * 3 * scale, stemY]];
    }

    case "in": {
      // Run upfield, break inward (toward center)
      const stemY = losY - depth * 0.75;
      return [[sx, losY], [sx + lx * 0.5, stemY], [sx + dir * 3 * scale, stemY]];
    }

    case "post": {
      // Angle toward middle of field at depth
      const stemY = losY - depth * 0.55;
      return [[sx, losY], [sx + lx * 0.45, stemY], [sx + dir * depth * 0.35, losY - depth]];
    }

    case "corner": {
      // Angle toward corner
      const stemY = losY - depth * 0.55;
      return [[sx, losY], [sx + lx * 0.45, stemY], [ex, losY - depth]];
    }

    case "curl": {
      return [[sx, losY], [ex, losY - depth], [ex + dir * 4 * scale, losY - depth + 5 * scale]];
    }

    case "cross": {
      const stem = 5 * scale;
      return [[sx, losY], [sx, losY - stem], [sx + dir * depth * 1.15, losY - stem]];
    }

    case "flat":
      return [[sx, losY], [sx + lx * 0.5, losY - 2 * scale], [ex, losY - 2 * scale]];

    case "wheel": {
      const arc = sx + lx * 0.55;
      return [[sx, losY], [arc, losY - 3 * scale], [arc, losY - depth * 0.55], [ex, losY - depth]];
    }

    default:
      return [[sx, losY], [ex, losY - depth]];
  }
}

// ─── Field background ─────────────────────────────────────────────────────────
function drawField(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const ly = h * LOS_Y_FRAC;
  const sc = h * PX_PER_YARD;

  ctx.fillStyle = "#020a04";
  ctx.fillRect(0, 0, w, h);

  const fg = ctx.createLinearGradient(0, ly, 0, 0);
  fg.addColorStop(0,   "rgba(3,20,10,0.85)");
  fg.addColorStop(0.4, "rgba(2,12,6,0.60)");
  fg.addColorStop(1,   "rgba(1,5,2,0.25)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, w, ly);

  // Alternating bands
  for (let y = 0; y < MAX_DEPTH + 5; y += 10) {
    const top = Math.max(0, ly - (y + 5) * sc);
    const bot = Math.min(ly, ly - y * sc);
    if (top >= ly) break;
    ctx.fillStyle = "rgba(0,65,15,0.055)";
    ctx.fillRect(0, top, w, bot - top);
  }

  // Below-LOS tint
  const ng = ctx.createLinearGradient(0, ly, 0, ly + 8 * sc);
  ng.addColorStop(0, "rgba(30,5,5,0.4)");
  ng.addColorStop(1, "rgba(8,0,0,0.0)");
  ctx.fillStyle = ng;
  ctx.fillRect(0, ly, w, Math.min(8 * sc, h - ly));

  // Sidelines
  ctx.strokeStyle = "rgba(55,120,45,0.28)";
  ctx.lineWidth   = 0.8;
  ctx.beginPath(); ctx.moveTo(w * 0.03, 0);  ctx.lineTo(w * 0.03, ly);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.97, 0);  ctx.lineTo(w * 0.97, ly);  ctx.stroke();

  // Hash marks
  const hLen = w * 0.022;
  [w * 0.236, w * 0.764].forEach(hx => {
    for (let y = 1; y <= MAX_DEPTH + 4; y++) {
      const yy = ly - y * sc;
      if (yy < 2) break;
      ctx.strokeStyle = "rgba(50,110,50,0.20)";
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(hx - hLen / 2, yy); ctx.lineTo(hx + hLen / 2, yy); ctx.stroke();
    }
  });

  // Yard lines
  for (let y = 5; y <= MAX_DEPTH + 5; y += 5) {
    const yy = ly - y * sc;
    if (yy < 2) break;
    const isTen = y % 10 === 0;
    ctx.strokeStyle = isTen ? "rgba(60,140,50,0.36)" : "rgba(40,95,35,0.20)";
    ctx.lineWidth   = isTen ? 0.9 : 0.45;
    ctx.beginPath(); ctx.moveTo(w * 0.03, yy); ctx.lineTo(w * 0.97, yy); ctx.stroke();
    if (isTen && yy > 14) {
      ctx.fillStyle = "rgba(75,155,60,0.40)";
      ctx.font = `9px 'Courier New', monospace`;
      ctx.textAlign = "left";  ctx.fillText(`+${y}`, w * 0.035, yy - 3);
      ctx.textAlign = "right"; ctx.fillText(`+${y}`, w * 0.965, yy - 3);
    }
  }

  // Center origin marker (all routes start here)
  ctx.save();
  ctx.shadowBlur  = 10;
  ctx.shadowColor = "rgba(0,255,80,0.6)";
  ctx.fillStyle   = "rgba(0,255,80,0.75)";
  ctx.beginPath(); ctx.arc(w / 2, ly, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // LOS
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
  const vg = ctx.createRadialGradient(w / 2, h * 0.40, w * 0.08, w / 2, h * 0.40, w * 0.92);
  vg.addColorStop(0,    "rgba(0,0,0,0)");
  vg.addColorStop(0.62, "rgba(0,0,0,0.06)");
  vg.addColorStop(1,    "rgba(0,0,0,0.68)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// ─── Draw partial route path ──────────────────────────────────────────────────
function drawRoutePath(
  ctx: CanvasRenderingContext2D,
  waypoints: [number, number][],
  progress: number, // 0..1 eased
  color: string, glow: number, lw: number
): [number, number] {
  const totalSegs  = waypoints.length - 1;
  const curSeg     = progress * totalSegs;
  const segIdx     = Math.min(Math.floor(curSeg), totalSegs - 1);
  const segProg    = curSeg - segIdx;

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = color; }

  ctx.beginPath();
  ctx.moveTo(waypoints[0][0], waypoints[0][1]);
  for (let i = 0; i < segIdx; i++) ctx.lineTo(waypoints[i + 1][0], waypoints[i + 1][1]);
  const [x1, y1] = waypoints[segIdx];
  const [x2, y2] = waypoints[segIdx + 1];
  const hx = x1 + (x2 - x1) * segProg;
  const hy = y1 + (y2 - y1) * segProg;
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.restore();

  return [hx, hy];
}

// ─── Draw a single route ──────────────────────────────────────────────────────
function drawRoute(
  ctx: CanvasRenderingContext2D,
  route: ReceivingRoute,
  waypoints: [number, number][],
  progress: number, // raw 0..1
  viral: boolean
) {
  const color = routeColor(route);
  const glow  = routeGlow(route, viral);
  const lw    = routeW(route);
  const ep    = easeOut(Math.min(progress, 1));

  ctx.globalAlpha = routeAlpha(route);
  const [hx, hy]  = drawRoutePath(ctx, waypoints, ep, color, glow, lw);
  ctx.globalAlpha = 1;

  if (progress >= 1) {
    const [ex, ey] = waypoints[waypoints.length - 1];
    ctx.save();
    ctx.fillStyle   = color;
    ctx.shadowBlur  = glow > 0 ? glow : 3;
    ctx.shadowColor = color;
    const dotR = route.result === "td" ? 5.5 : route.result === "incomplete" ? 2 : 3.8;
    ctx.beginPath(); ctx.arc(ex, ey, dotR, 0, Math.PI * 2); ctx.fill();

    if (route.result === "td") {
      ctx.globalAlpha = 0.30;
      ctx.lineWidth   = 1.2;
      ctx.strokeStyle = color;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * (dotR + 2), ey + Math.sin(a) * (dotR + 2));
        ctx.lineTo(ex + Math.cos(a) * (dotR + 15), ey + Math.sin(a) * (dotR + 15));
        ctx.stroke();
      }
    }
    ctx.restore();
  } else {
    // Glowing head
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 22;
    ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(hx, hy, lw * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function drawLegend(ctx: CanvasRenderingContext2D, w: number) {
  const items = [
    { c: "#ffd700", l: "TD"    },
    { c: "#00ddff", l: "Long"  },
    { c: "#44bbff", l: "Catch" },
    { c: "#2a3d52", l: "Inc."  },
    { c: "#ee3333", l: "INT"   },
  ];
  const x0 = w - 68, y0 = 10;
  items.forEach(({ c, l }, i) => {
    const y = y0 + i * 14;
    ctx.save();
    ctx.shadowBlur = 3; ctx.shadowColor = c;
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y + 4); ctx.lineTo(x0 + 13, y + 4); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(175,210,200,0.65)";
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillText(l, x0 + 17, y + 8);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReceivingCanvas({ routes, animationKey, isViral, onRouteSelect, onComplete }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animState     = useRef({ rafId: 0, routeIdx: 0, progress: 0, lastTime: 0, done: false });
  const routesRef     = useRef(routes);
  const viralRef      = useRef(isViral);
  const onCompleteRef = useRef(onComplete);
  const waypointsRef  = useRef<[number, number][][]>([]);
  const lastSizeRef   = useRef({ w: 0, h: 0 });
  routesRef.current     = routes;
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

    if (lastSizeRef.current.w !== cw || lastSizeRef.current.h !== ch) {
      lastSizeRef.current = { w: cw, h: ch };
      waypointsRef.current = routesRef.current.map(r => getWaypoints(r, cw, ch));
    }

    const viral     = viralRef.current;
    const allRoutes = routesRef.current;
    const wps       = waypointsRef.current;
    const a         = animState.current;

    if (a.lastTime === 0) a.lastTime = ts;
    const dt = Math.min(ts - a.lastTime, 64);
    a.lastTime = ts;

    const base  = viral ? 17 : 28;
    const cur   = allRoutes[a.routeIdx];
    const msNow = cur ? routeMs(cur, base) : base;
    a.progress += dt / msNow;

    if (a.progress >= 1) {
      a.routeIdx = Math.min(a.routeIdx + 1, allRoutes.length);
      a.progress = 0;
    }

    drawField(ctx, cw, ch);
    for (let i = 0; i < a.routeIdx; i++) {
      if (wps[i]) drawRoute(ctx, allRoutes[i], wps[i], 1, viral);
    }
    if (a.routeIdx < allRoutes.length && wps[a.routeIdx]) {
      drawRoute(ctx, allRoutes[a.routeIdx], wps[a.routeIdx], Math.min(a.progress, 1), viral);
    }
    drawLegend(ctx, cw);

    if (a.routeIdx >= allRoutes.length) {
      if (!a.done) { a.done = true; onCompleteRef.current(); }
      return;
    }
    a.rafId = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!animationKey) return;
    waypointsRef.current = [];
    lastSizeRef.current  = { w: 0, h: 0 };
    const a = animState.current;
    cancelAnimationFrame(a.rafId);
    a.rafId = 0; a.routeIdx = 0; a.progress = 0; a.lastTime = 0; a.done = false;
    a.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(a.rafId);
  }, [animationKey, loop]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;

    const THRESH = 14;
    let closest: ReceivingRoute | null = null;
    let minDist = THRESH;

    routes.forEach((route, i) => {
      const wps = waypointsRef.current[i];
      if (!wps) return;
      for (let s = 0; s < wps.length - 1; s++) {
        const [ax, ay] = wps[s], [bx, by] = wps[s + 1];
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / len2));
        const d = Math.hypot(mx - (ax + t * dx), my - (ay + t * dy));
        if (d < minDist) { minDist = d; closest = route; }
      }
    });

    onRouteSelect(closest, mx, my);
  }, [routes, onRouteSelect]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none"
      onClick={handleClick}
    />
  );
}
