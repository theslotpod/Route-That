"use client";

import type { RushingPlay, ReceivingRoute, PlayMode } from "@/types";

interface Props {
  play: RushingPlay | ReceivingRoute;
  pos: { x: number; y: number };
  mode: PlayMode;
}

function isRushingPlay(p: RushingPlay | ReceivingRoute): p is RushingPlay {
  return "angle" in p;
}

export default function PlayTooltip({ play, pos, mode }: Props) {
  const isRushing = isRushingPlay(play);

  let resultColor = "#00ff88";
  if (play.result === "td") resultColor = "#ffd700";
  else if (play.result === "loss" || play.result === "fumble" || play.result === "int") resultColor = "#ff4444";
  else if (play.result === "incomplete") resultColor = "#666688";

  // Offset tooltip so it doesn't cover the tap point
  const offsetX = pos.x > 260 ? -170 : 14;
  const offsetY = pos.y > 300 ? -100 : 10;

  return (
    <div
      className="absolute pointer-events-none animate-fade-in z-50"
      style={{
        left: pos.x + offsetX,
        top: pos.y + offsetY,
        width: 156,
      }}
    >
      <div
        className="rounded-xl px-3 py-2.5 font-mono text-xs"
        style={{
          background: "rgba(4, 16, 8, 0.95)",
          border: `1px solid ${resultColor}44`,
          boxShadow: `0 0 16px ${resultColor}20, 0 4px 20px rgba(0,0,0,0.8)`,
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Result badge */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: resultColor, textShadow: `0 0 6px ${resultColor}` }}
          >
            {play.result === "td"
              ? "TOUCHDOWN"
              : play.result === "fumble"
              ? "FUMBLE"
              : play.result === "int"
              ? "INT"
              : play.result === "incomplete"
              ? "INCOMPLETE"
              : play.result === "catch"
              ? "CATCH"
              : play.result.toUpperCase()}
          </span>
          <span style={{ color: "rgba(100,180,120,0.5)", fontSize: "9px" }}>
            Wk {play.week}
          </span>
        </div>

        {/* Yards */}
        <div className="flex items-baseline gap-1 mb-1">
          <span
            style={{
              fontSize: "22px",
              fontFamily: "Impact, sans-serif",
              color: resultColor,
              lineHeight: 1,
              textShadow: `0 0 10px ${resultColor}80`,
            }}
          >
            {play.yards > 0 ? "+" : ""}{play.yards}
          </span>
          <span style={{ color: "rgba(150,200,160,0.7)", fontSize: "10px" }}>YDS</span>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-0.5" style={{ color: "rgba(130,190,150,0.7)", fontSize: "9px" }}>
          {isRushing ? (
            <>
              <div>Down: <span className="text-white">{(play as RushingPlay).down} & {(play as RushingPlay).distance}</span></div>
              <div>Direction: <span className="text-white">{(play as RushingPlay).angle > 8 ? "Right" : (play as RushingPlay).angle < -8 ? "Left" : "Middle"}</span></div>
              <div>Q{play.quarter}</div>
            </>
          ) : (
            <>
              <div>Route: <span className="text-white uppercase">{(play as ReceivingRoute).type}</span></div>
              <div>Depth: <span className="text-white">{(play as ReceivingRoute).depth} yds</span></div>
              <div>Q{play.quarter}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
