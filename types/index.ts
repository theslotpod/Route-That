export type PlayMode = "rushing" | "receiving";

export interface RushingPlay {
  id: string;
  /** Degrees from straight ahead. Negative = left, positive = right. */
  angle: number;
  /** Yards gained (negative = loss). */
  yards: number;
  down: 1 | 2 | 3 | 4;
  distance: number;
  result: "gain" | "loss" | "td" | "fumble";
  quarter: 1 | 2 | 3 | 4;
  week: number;
  isLong: boolean; // yards >= 15
}

export type RouteType =
  | "slant"
  | "post"
  | "corner"
  | "curl"
  | "out"
  | "in"
  | "go"
  | "cross"
  | "flat"
  | "wheel";

export interface ReceivingRoute {
  id: string;
  type: RouteType;
  /** Target depth in yards. */
  depth: number;
  result: "catch" | "incomplete" | "td" | "int";
  side: "left" | "right" | "slot-left" | "slot-right" | "middle";
  /** Yards gained after catch (0 for incomplete). */
  yards: number;
  quarter: 1 | 2 | 3 | 4;
  week: number;
  isLong: boolean;
}

export interface FilterState {
  downs: number[];
  results: string[];
  quarters: number[];
  minYards: number;
  maxYards: number;
}

export interface TooltipData {
  play: RushingPlay | ReceivingRoute;
  x: number;
  y: number;
}

export interface Stats {
  plays: number;
  yards: number;
  perPlay: string;
  tds: number;
}
