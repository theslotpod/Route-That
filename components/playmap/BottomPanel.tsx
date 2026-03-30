"use client";

import { useState } from "react";
import type { PlayMode, Stats } from "@/types";
import type { ESPNPlayer } from "@/lib/espn";
import { PLAYER } from "@/lib/mockData";

interface Props {
  stats: Stats;
  mode: PlayMode;
  isQB: boolean;
  isScreenRecord: boolean;
  isViral: boolean;
  isAutoLoop: boolean;
  currentPlayer: ESPNPlayer | null;
  onReplay: () => void;
  onFilter: () => void;
  onScreenRecord: () => void;
  onViral: () => void;
  onAutoLoop: () => void;
  onCopyCaption: () => void;
}

function StatBox({ label, value, viral }: { label: string; value: string | number; viral: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="font-display leading-none"
        style={{
          fontSize: "24px",
          fontFamily: "Impact, 'Arial Black', sans-serif",
          color: "#ffffff",
          textShadow: viral ? "0 0 12px rgba(0,255,136,0.9), 0 0 24px rgba(0,255,136,0.4)" : "0 1px 4px rgba(0,0,0,0.8)",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="font-mono uppercase mt-0.5"
        style={{ fontSize: "8px", color: "rgba(100,180,120,0.6)", letterSpacing: "0.12em" }}
      >
        {label}
      </div>
    </div>
  );
}

export default function BottomPanel({
  stats,
  mode,
  isQB,
  isScreenRecord,
  isViral,
  isAutoLoop,
  currentPlayer,
  onReplay,
  onFilter,
  onScreenRecord,
  onViral,
  onAutoLoop,
  onCopyCaption,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyCaption();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statsLabel = mode === "rushing"
    ? ["CARRIES", "YARDS", "YPC"]
    : isQB
      ? ["ATT", "YARDS", "Y/A"]
      : ["TARGETS", "YARDS", "YPR"];

  return (
    <div
      className="shrink-0 flex flex-col gap-2 px-4 py-3"
      style={{
        borderTop: "1px solid rgba(0,255,80,0.12)",
        background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
      }}
    >
      {/* Stats row */}
      <div
        className="flex justify-around py-2 rounded-lg"
        style={{ background: "rgba(0,20,8,0.6)", border: "1px solid rgba(0,255,80,0.1)" }}
      >
        <StatBox label={statsLabel[0]} value={stats.plays} viral={isViral} />
        <div style={{ width: 1, background: "rgba(0,255,80,0.12)" }} />
        <StatBox label={statsLabel[1]} value={stats.yards} viral={isViral} />
        <div style={{ width: 1, background: "rgba(0,255,80,0.12)" }} />
        <StatBox label={statsLabel[2]} value={stats.perPlay} viral={isViral} />
        {stats.tds > 0 && (
          <>
            <div style={{ width: 1, background: "rgba(0,255,80,0.12)" }} />
            <StatBox label="TDs" value={stats.tds} viral={isViral} />
          </>
        )}
      </div>

      {/* Primary buttons */}
      <div className="flex gap-2">
        <button
          onClick={onReplay}
          className="flex-1 py-2.5 rounded-lg font-mono font-bold uppercase text-xs transition-all active:scale-95"
          style={{
            background: isViral
              ? "linear-gradient(135deg, rgba(0,200,70,0.4), rgba(0,140,50,0.4))"
              : "rgba(0,160,55,0.25)",
            border: `1px solid ${isViral ? "rgba(0,255,120,0.5)" : "rgba(0,220,80,0.3)"}`,
            color: isViral ? "#00ff88" : "#00dd66",
            textShadow: isViral ? "0 0 8px #00ff88" : "none",
            boxShadow: isViral ? "0 0 12px rgba(0,255,80,0.2)" : "none",
            letterSpacing: "0.08em",
            fontSize: "10px",
          }}
        >
          ▶ Replay
        </button>

        {!isScreenRecord && (
          <button
            onClick={onFilter}
            className="px-3 py-2.5 rounded-lg font-mono font-bold uppercase text-xs transition-all active:scale-95"
            style={{
              background: "rgba(0,80,30,0.3)",
              border: "1px solid rgba(0,180,60,0.2)",
              color: "rgba(100,200,130,0.8)",
              fontSize: "10px",
              letterSpacing: "0.06em",
            }}
          >
            ⚡ Filter
          </button>
        )}
      </div>

      {/* Secondary buttons row */}
      {!isScreenRecord && (
        <div className="flex gap-2">
          {/* Viral Mode */}
          <button
            onClick={onViral}
            className="flex-1 py-2 rounded-lg font-mono text-xs transition-all active:scale-95"
            style={{
              background: isViral ? "rgba(255,100,0,0.2)" : "rgba(30,10,0,0.4)",
              border: `1px solid ${isViral ? "rgba(255,120,0,0.6)" : "rgba(100,50,0,0.3)"}`,
              color: isViral ? "#ff8800" : "rgba(150,80,30,0.7)",
              textShadow: isViral ? "0 0 8px #ff8800" : "none",
              fontSize: "9px",
              letterSpacing: "0.06em",
            }}
          >
            {isViral ? "🔥 VIRAL ON" : "🔥 Viral"}
          </button>

          {/* Auto Loop */}
          <button
            onClick={onAutoLoop}
            className="flex-1 py-2 rounded-lg font-mono text-xs transition-all active:scale-95"
            style={{
              background: isAutoLoop ? "rgba(0,100,180,0.2)" : "rgba(0,10,30,0.4)",
              border: `1px solid ${isAutoLoop ? "rgba(0,150,255,0.5)" : "rgba(0,50,100,0.3)"}`,
              color: isAutoLoop ? "#00aaff" : "rgba(40,100,160,0.7)",
              fontSize: "9px",
              letterSpacing: "0.06em",
            }}
          >
            {isAutoLoop ? "⟳ LOOP ON" : "⟳ Loop"}
          </button>

          {/* Screen Record */}
          <button
            onClick={onScreenRecord}
            className="flex-1 py-2 rounded-lg font-mono text-xs transition-all active:scale-95"
            style={{
              background: "rgba(80,0,120,0.2)",
              border: "1px solid rgba(150,0,200,0.3)",
              color: "rgba(180,100,240,0.8)",
              fontSize: "9px",
              letterSpacing: "0.06em",
            }}
          >
            ⏺ Record
          </button>
        </div>
      )}

      {/* Copy Caption */}
      {!isScreenRecord && (
        <button
          onClick={handleCopy}
          className="w-full py-2 rounded-lg font-mono text-xs transition-all active:scale-95"
          style={{
            background: copied ? "rgba(0,200,80,0.15)" : "rgba(0,30,10,0.4)",
            border: `1px solid ${copied ? "rgba(0,255,80,0.4)" : "rgba(0,100,30,0.2)"}`,
            color: copied ? "#00ff88" : "rgba(80,180,100,0.6)",
            fontSize: "9px",
            letterSpacing: "0.06em",
          }}
        >
          {copied
            ? "✓ Caption Copied!"
            : `📋 Copy Caption — ${(currentPlayer?.displayName ?? PLAYER.name).split(" ").pop()} ${mode === "rushing" ? "Rush Map" : isQB ? "Pass Map" : "Route Tree"} 2025`}
        </button>
      )}

      {/* Screen record watermark */}
      {isScreenRecord && (
        <div className="flex justify-between items-center px-1">
          <span
            className="font-mono uppercase"
            style={{ fontSize: "9px", color: "rgba(0,255,80,0.35)", letterSpacing: "0.15em" }}
          >
            PLAYMAP
          </span>
          <span
            className="font-mono"
            style={{ fontSize: "9px", color: "rgba(0,200,80,0.25)", letterSpacing: "0.08em" }}
          >
            {currentPlayer?.displayName ?? PLAYER.name} · 2025
          </span>
        </div>
      )}
    </div>
  );
}
