"use client";

import type { PlayMode } from "@/types";
import type { ESPNPlayer } from "@/lib/espn";
import { PLAYER } from "@/lib/mockData";

interface Props {
  mode: PlayMode;
  onModeChange: (mode: PlayMode) => void;
  isViral: boolean;
  isQB: boolean;
  currentPlayer: ESPNPlayer | null;
  onPlayerSearch: () => void;
}

export default function TopBar({ mode, onModeChange, isViral, isQB, currentPlayer, onPlayerSearch }: Props) {
  const name = currentPlayer?.displayName ?? PLAYER.name;
  const nameParts = name.split(" ");
  const firstName = nameParts.slice(0, -1).join(" ");
  const lastName = nameParts[nameParts.length - 1];
  const teamAbbr = currentPlayer?.teamAbbr ?? PLAYER.team;
  const position = currentPlayer?.positionAbbr ?? PLAYER.position;
  const number = currentPlayer?.number !== "?" ? currentPlayer?.number : PLAYER.number;
  const accentColor = currentPlayer?.teamColor ?? "#00cc55";
  const headshot = currentPlayer?.headshot;

  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 shrink-0"
      style={{
        borderBottom: "1px solid rgba(0,255,80,0.1)",
        background: `linear-gradient(to right, ${accentColor}08, transparent 60%)`,
      }}
    >
      {/* Player identity — tap to change */}
      <button
        onClick={onPlayerSearch}
        className="flex items-center gap-2.5 text-left group transition-all active:scale-95"
      >
        {/* Headshot circle */}
        <div
          className="shrink-0 rounded-full overflow-hidden relative"
          style={{
            width: 40,
            height: 40,
            border: `2px solid ${accentColor}`,
            boxShadow: isViral
              ? `0 0 14px ${accentColor}90, 0 0 6px ${accentColor}50`
              : `0 0 8px ${accentColor}50`,
            background: `${accentColor}18`,
          }}
        >
          {headshot ? (
            <img
              src={headshot}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-mono font-bold"
              style={{ color: accentColor, fontSize: "13px" }}
            >
              {lastName.charAt(0)}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex flex-col">
          <div
            style={{
              fontSize: "16px",
              fontFamily: "Impact, 'Arial Black', sans-serif",
              letterSpacing: "0.03em",
              color: "#ffffff",
              lineHeight: 1.1,
              textShadow: isViral ? "0 0 14px rgba(0,255,136,0.7)" : "none",
            }}
          >
            {firstName}{" "}
            <span
              style={{
                color: isViral ? "#00ff88" : accentColor,
                textShadow: isViral ? "0 0 18px #00ff88" : `0 0 10px ${accentColor}80`,
              }}
            >
              {lastName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{
                background: `${accentColor}22`,
                color: accentColor,
                border: `1px solid ${accentColor}44`,
                fontSize: "9px",
                letterSpacing: "0.05em",
              }}
            >
              {currentPlayer?.isDraftProspect ? currentPlayer.team : teamAbbr}
            </span>
            <span
              className="font-mono"
              style={{ color: "rgba(150,200,160,0.65)", fontSize: "9px" }}
            >
              {position}{number ? ` · #${number}` : ""} · {currentPlayer?.isDraftProspect ? "CFB '25" : "2025"}
            </span>
            {currentPlayer?.isDraftProspect && (
              <span
                className="font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(255,170,0,0.12)",
                  border: "1px solid rgba(255,170,0,0.3)",
                  color: "rgba(255,200,80,0.85)",
                  fontSize: "8px",
                  letterSpacing: "0.08em",
                }}
              >
                DRAFT '26
              </span>
            )}
            <span
              className="font-mono px-1.5 py-0.5 rounded-full transition-all"
              style={{
                background: "rgba(0,255,80,0.1)",
                border: "1px solid rgba(0,255,80,0.3)",
                color: "#00ff88",
                fontSize: "8px",
                letterSpacing: "0.06em",
                opacity: 0.85,
              }}
            >
              CHANGE ↗
            </span>
          </div>
        </div>
      </button>

      {/* Mode toggle */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{
          border: "1px solid rgba(0,255,80,0.2)",
          background: "rgba(0,0,0,0.5)",
        }}
      >
        {(() => {
          const pos = currentPlayer?.positionAbbr;
          const receiverFirst = isQB || pos === "WR" || pos === "TE";
          const tabs: PlayMode[] = receiverFirst ? ["receiving", "rushing"] : ["rushing", "receiving"];
          return tabs.map((m, idx) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="px-3 py-1.5 transition-all duration-200"
              style={{
                background: active ? `${accentColor}30` : "transparent",
                color: active ? (isViral ? "#00ff88" : accentColor) : "rgba(150,200,160,0.45)",
                textShadow: active && isViral ? "0 0 8px #00ff88" : active ? `0 0 6px ${accentColor}` : "none",
                fontSize: "10px",
                fontFamily: "monospace",
                fontWeight: active ? "bold" : "normal",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderRight: idx === 0 ? "1px solid rgba(0,255,80,0.18)" : "none",
              }}
            >
              {m === "rushing" ? "Rush" : (isQB ? "Passes" : "Rec")}
            </button>
          );
        });
        })()}
      </div>
    </div>
  );
}
