"use client";

import { useState } from "react";
import type { FilterState, PlayMode } from "@/types";

interface Props {
  filter: FilterState;
  mode: PlayMode;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

function Toggle({
  label,
  active,
  color = "#00ff88",
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wide transition-all active:scale-95"
      style={{
        background: active ? `${color}20` : "rgba(0,20,8,0.6)",
        border: `1px solid ${active ? color + "55" : "rgba(0,80,30,0.3)"}`,
        color: active ? color : "rgba(80,140,100,0.6)",
        textShadow: active ? `0 0 6px ${color}` : "none",
        fontSize: "10px",
      }}
    >
      {label}
    </button>
  );
}

export default function FilterModal({ filter, mode, onApply, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>({ ...filter });

  const toggleDown = (d: number) => {
    setLocal((f) => ({
      ...f,
      downs: f.downs.includes(d) ? f.downs.filter((x) => x !== d) : [...f.downs, d],
    }));
  };

  const toggleResult = (r: string) => {
    setLocal((f) => ({
      ...f,
      results: f.results.includes(r) ? f.results.filter((x) => x !== r) : [...f.results, r],
    }));
  };

  const toggleQuarter = (q: number) => {
    setLocal((f) => ({
      ...f,
      quarters: f.quarters.includes(q) ? f.quarters.filter((x) => x !== q) : [...f.quarters, q],
    }));
  };

  const rushingResults = ["gain", "loss", "td", "fumble"];
  const receivingResults = ["catch", "incomplete", "td", "int"];
  const results = mode === "rushing" ? rushingResults : receivingResults;

  const resultColors: Record<string, string> = {
    td: "#ffd700",
    loss: "#ff4444",
    fumble: "#ff44aa",
    gain: "#00ff88",
    catch: "#00aaff",
    incomplete: "#666688",
    int: "#ff4444",
  };

  return (
    <div
      className="absolute inset-0 flex items-end z-40 modal-backdrop"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl px-5 py-5 animate-slide-up"
        style={{
          background: "linear-gradient(to top, #010d03, #020e04)",
          border: "1px solid rgba(0,255,80,0.15)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="font-mono font-bold uppercase tracking-widest"
            style={{ color: "#00ff88", fontSize: "11px", textShadow: "0 0 8px #00ff88" }}
          >
            Filter Plays
          </span>
          <button
            onClick={onClose}
            className="text-xs font-mono"
            style={{ color: "rgba(100,200,130,0.5)" }}
          >
            ✕ Close
          </button>
        </div>

        {/* Downs */}
        {mode === "rushing" && (
          <div className="mb-4">
            <div className="mb-2" style={{ color: "rgba(100,180,120,0.6)", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Down
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((d) => (
                <Toggle key={d} label={`${d}${["st","nd","rd","th"][d-1]}`} active={local.downs.includes(d)} onClick={() => toggleDown(d)} />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        <div className="mb-4">
          <div className="mb-2" style={{ color: "rgba(100,180,120,0.6)", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Result
          </div>
          <div className="flex flex-wrap gap-2">
            {results.map((r) => (
              <Toggle
                key={r}
                label={r}
                active={local.results.includes(r)}
                color={resultColors[r] || "#00ff88"}
                onClick={() => toggleResult(r)}
              />
            ))}
          </div>
        </div>

        {/* Quarter */}
        <div className="mb-5">
          <div className="mb-2" style={{ color: "rgba(100,180,120,0.6)", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Quarter
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((q) => (
              <Toggle key={q} label={`Q${q}`} active={local.quarters.includes(q)} onClick={() => toggleQuarter(q)} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() =>
              setLocal({
                downs: [1, 2, 3, 4],
                results: [...rushingResults, ...receivingResults],
                quarters: [1, 2, 3, 4],
                minYards: -10,
                maxYards: 100,
              })
            }
            className="flex-1 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wide"
            style={{
              background: "rgba(0,40,15,0.5)",
              border: "1px solid rgba(0,150,50,0.2)",
              color: "rgba(80,180,110,0.6)",
              fontSize: "10px",
            }}
          >
            Reset
          </button>
          <button
            onClick={() => onApply(local)}
            className="flex-1 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wide active:scale-95"
            style={{
              background: "rgba(0,180,60,0.25)",
              border: "1px solid rgba(0,255,80,0.4)",
              color: "#00ff88",
              textShadow: "0 0 8px #00ff88",
              fontSize: "10px",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
