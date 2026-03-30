import type { RushingPlay, ReceivingRoute, RouteType } from "@/types";

// Seeded LCG pseudo-random for deterministic data
function makeSeed(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

const rand = makeSeed(2025_1024);

function randBetween(min: number, max: number) {
  return min + rand() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(randBetween(min, max + 1));
}
function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ─── Rushing plays ────────────────────────────────────────────────────────────

export function generateRushingPlays(count = 162): RushingPlay[] {
  const plays: RushingPlay[] = [];

  for (let i = 0; i < count; i++) {
    const week = randInt(1, 18);
    const quarter = randInt(1, 4) as 1 | 2 | 3 | 4;
    const down = randInt(1, 4) as 1 | 2 | 3 | 4;
    const distance = randInt(1, 15);

    // Angle distribution: more plays up the middle
    const r = rand();
    let angle: number;
    if (r < 0.30) {
      // Up the middle: ±12°
      angle = randBetween(-12, 12);
    } else if (r < 0.58) {
      // Off-tackle: ±13–38°
      angle = (rand() < 0.5 ? -1 : 1) * randBetween(13, 38);
    } else if (r < 0.82) {
      // Outside: ±39–58°
      angle = (rand() < 0.5 ? -1 : 1) * randBetween(39, 58);
    } else {
      // Wide sweep: ±59–68°
      angle = (rand() < 0.5 ? -1 : 1) * randBetween(59, 68);
    }

    // Yards gained
    const yr = rand();
    let yards: number;
    let result: RushingPlay["result"];

    if (yr < 0.14) {
      yards = -randInt(1, 4);
      result = "loss";
    } else if (yr < 0.165) {
      yards = randInt(0, 3);
      result = "fumble";
    } else if (yr < 0.30) {
      yards = randInt(0, 2);
      result = "gain";
    } else if (yr < 0.58) {
      yards = randInt(3, 8);
      result = "gain";
    } else if (yr < 0.76) {
      yards = randInt(9, 14);
      result = "gain";
    } else if (yr < 0.90) {
      yards = randInt(15, 24);
      result = "gain";
    } else {
      yards = randInt(25, 65);
      result = "gain";
    }

    // ~5% of positive plays are TDs
    if (yards > 0 && result === "gain" && rand() < 0.05) {
      result = "td";
    }

    plays.push({
      id: `rush-${i}`,
      angle: Math.round(angle),
      yards,
      down,
      distance,
      result,
      quarter,
      week,
      isLong: yards >= 15,
    });
  }

  return plays;
}

// ─── Receiving routes ─────────────────────────────────────────────────────────

const ROUTE_TYPES: RouteType[] = [
  "slant", "slant", "slant",
  "out", "out",
  "curl", "curl",
  "post",
  "corner",
  "go", "go",
  "cross", "cross",
  "flat", "flat",
  "in",
  "wheel",
];

export function generateReceivingRoutes(count = 48): ReceivingRoute[] {
  const routes: ReceivingRoute[] = [];
  const sides: ReceivingRoute["side"][] = ["left", "slot-left", "slot-right", "right"];

  for (let i = 0; i < count; i++) {
    const week = randInt(1, 18);
    const quarter = randInt(1, 4) as 1 | 2 | 3 | 4;
    const type = randChoice(ROUTE_TYPES);
    const side = randChoice(sides);

    let depth: number;
    switch (type) {
      case "flat":    depth = randInt(1, 3); break;
      case "slant":   depth = randInt(6, 12); break;
      case "out":     depth = randInt(8, 14); break;
      case "in":      depth = randInt(10, 16); break;
      case "curl":    depth = randInt(10, 16); break;
      case "cross":   depth = randInt(5, 10); break;
      case "post":    depth = randInt(12, 22); break;
      case "corner":  depth = randInt(12, 20); break;
      case "go":      depth = randInt(16, 30); break;
      case "wheel":   depth = randInt(10, 20); break;
      default:        depth = randInt(8, 16);
    }

    // ~60% catch rate
    const catchRate = type === "go" ? 0.42 : 0.60;
    const r = rand();
    let result: ReceivingRoute["result"];
    if (r < catchRate) {
      result = rand() < 0.08 ? "td" : "catch";
    } else if (r < catchRate + 0.03) {
      result = "int";
    } else {
      result = "incomplete";
    }

    const yards =
      result === "catch"
        ? depth + randInt(0, 8)
        : result === "td"
        ? depth + randInt(2, 15)
        : 0;

    routes.push({
      id: `route-${i}`,
      type,
      depth,
      result,
      side,
      yards,
      quarter,
      week,
      isLong: yards >= 15,
    });
  }

  return routes;
}

export const rushingPlays = generateRushingPlays();
export const receivingRoutes = generateReceivingRoutes();

// Player info
export const PLAYER = {
  name: "TreVeyon Henderson",
  firstName: "TreVeyon",
  lastName: "Henderson",
  team: "CIN",
  teamFull: "Bengals",
  position: "RB",
  number: 32,
  season: "2025",
};
