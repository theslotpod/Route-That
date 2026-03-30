"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ESPNPlayer } from "@/lib/espn";

const FEATURED_NAMES = [
  "Saquon Barkley",
  "Derrick Henry",
  "De'Von Achane",
  "Jahmyr Gibbs",
  "Josh Jacobs",
  "CeeDee Lamb",
  "Justin Jefferson",
  "Travis Kelce",
  "Amon-Ra St. Brown",
];

const POS_COLOR: Record<string, string> = {
  RB: "#00ff88",
  WR: "#33aaff",
  TE: "#ffaa22",
  QB: "#ff6622",
  K:  "#cc44ff",
};

interface Props {
  onSelect: (player: ESPNPlayer) => void;
  onClose: () => void;
}

export default function PlayerSearch({ onSelect, onClose }: Props) {
  const [query, setQuery]                   = useState("");
  const [results, setResults]               = useState<ESPNPlayer[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [noResults, setNoResults]           = useState(false);
  const [featured, setFeatured]             = useState<ESPNPlayer[]>([]);
  const [featuredReady, setFeaturedReady]   = useState(false);
  const [prospects, setProspects]           = useState<ESPNPlayer[]>([]);
  const [prospectsReady, setProspectsReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);

    // Load featured NFL players
    Promise.all(
      FEATURED_NAMES.map(name =>
        fetch(`/api/player/search?q=${encodeURIComponent(name)}`)
          .then(r => r.json())
          .then((d: ESPNPlayer[]) => d.find(p => !p.isDraftProspect) ?? null)
          .catch(() => null)
      )
    ).then(players => {
      setFeatured(players.filter(Boolean) as ESPNPlayer[]);
      setFeaturedReady(true);
    });

    // Load 2026 draft prospects
    fetch("/api/college/prospects")
      .then(r => r.json())
      .then((d: ESPNPlayer[]) => {
        setProspects(d);
        setProspectsReady(true);
      })
      .catch(() => setProspectsReady(true));
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setNoResults(false); setIsSearching(false); return; }
    setIsSearching(true);
    setNoResults(false);
    try {
      const res  = await fetch(`/api/player/search?q=${encodeURIComponent(q)}`);
      const data: ESPNPlayer[] = await res.json();
      setResults(data);
      setNoResults(data.length === 0);
    } catch {
      setResults([]); setNoResults(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 280);
  };

  const posColor   = (pos: string) => POS_COLOR[pos] ?? "#88aacc";
  const showSearch = query.length >= 2;

  function PlayerCard({ p, compact }: { p: ESPNPlayer; compact?: boolean }) {
    const col    = posColor(p.positionAbbr);
    const accent = p.teamColor ?? col;
    const parts  = p.displayName.split(" ");
    const last   = parts.pop() ?? "";
    const first  = parts.join(" ");
    const sz     = compact ? 46 : 54;

    return (
      <button
        onClick={() => onSelect(p)}
        style={{
          borderRadius: 12,
          background: `linear-gradient(155deg, ${accent}0f 0%, rgba(0,8,3,0.94) 62%)`,
          border: `1px solid ${accent}22`,
          padding: compact ? "11px 5px 9px" : "14px 6px 11px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 5 : 7,
          cursor: "pointer",
          transition: "transform 0.1s",
        }}
        onTouchStart={e => (e.currentTarget.style.transform = "scale(0.93)")}
        onTouchEnd={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        <div style={{
          width: sz, height: sz, borderRadius: "50%",
          overflow: "hidden", flexShrink: 0,
          background: `${accent}12`,
          border: `1.5px solid ${accent}48`,
          boxShadow: `0 0 14px ${accent}1a`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {p.headshot ? (
            <img
              src={p.headshot} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span style={{
              fontFamily: "Impact, 'Arial Black', sans-serif",
              fontSize: compact ? 16 : 19, color: accent, opacity: 0.7,
            }}>
              {last.charAt(0)}
            </span>
          )}
        </div>

        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
          {first && (
            <div style={{
              fontFamily: "monospace", fontSize: compact ? 6.5 : 7.5,
              color: "rgba(150,205,175,0.42)", letterSpacing: "0.02em",
            }}>
              {first}
            </div>
          )}
          <div style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: compact ? 11.5 : 13.5, color: "#fff",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {last}
          </div>
        </div>

        <div style={{
          background: `${col}18`, border: `1px solid ${col}30`,
          color: col, fontFamily: "monospace", fontSize: compact ? 6.5 : 7.5,
          padding: "1.5px 5px", borderRadius: 3, letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}>
          {p.positionAbbr} · {p.teamAbbr}
        </div>

        {p.isDraftProspect && (
          <div style={{
            background: "rgba(255,170,0,0.12)", border: "1px solid rgba(255,170,0,0.3)",
            color: "rgba(255,200,80,0.85)", fontFamily: "monospace", fontSize: 6,
            padding: "1px 5px", borderRadius: 3, letterSpacing: "0.1em",
          }}>
            DRAFT '26
          </div>
        )}
      </button>
    );
  }

  function SkeletonCard({ compact }: { compact?: boolean }) {
    const sz = compact ? 46 : 52;
    return (
      <div style={{
        borderRadius: 12,
        background: "rgba(0,14,5,0.75)",
        border: "1px solid rgba(0,55,18,0.20)",
        padding: compact ? "11px 5px 9px" : "16px 8px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
      }}>
        <div style={{ width: sz, height: sz, borderRadius: "50%", background: "rgba(0,35,12,0.55)" }} />
        <div style={{ width: 52, height: 7, borderRadius: 4, background: "rgba(0,35,12,0.42)" }} />
        <div style={{ width: 36, height: 6, borderRadius: 3, background: "rgba(0,28,9,0.32)" }} />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden"
      style={{ background: "#010704" }}
    >
      {/* Top ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% -5%, rgba(0,110,45,0.20) 0%, transparent 52%)",
      }} />

      {/* Ghost field stripes */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.038 }}>
        {[12, 27, 42, 57, 72, 87].map(y => (
          <div key={y} style={{
            position: "absolute", top: `${y}%`, left: 0, right: 0, height: 1,
            background: "linear-gradient(to right, transparent 4%, #00cc66 25%, #00cc66 75%, transparent 96%)",
          }} />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 14, right: 14, zIndex: 10,
          width: 30, height: 30, borderRadius: "50%",
          background: "rgba(0,25,10,0.85)",
          border: "1px solid rgba(0,200,80,0.18)",
          color: "rgba(0,200,80,0.45)",
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        ×
      </button>

      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>

        {/* ── HERO ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 52, paddingBottom: 26,
        }}>
          <div style={{
            fontFamily: "Impact, 'Arial Black', sans-serif",
            fontSize: 56, letterSpacing: "0.06em", lineHeight: 1,
            userSelect: "none",
          }}>
            <span style={{ color: "#fff" }}>PLAY</span>
            <span style={{
              color: "#00ff88",
              textShadow: "0 0 22px rgba(0,255,136,0.50), 0 0 52px rgba(0,255,136,0.16)",
            }}>MAP</span>
          </div>

          <div style={{
            width: 60, height: 2, margin: "11px 0 10px",
            background: "linear-gradient(to right, transparent, rgba(0,255,136,0.55), transparent)",
            boxShadow: "0 0 10px rgba(0,255,136,0.28)",
          }} />

          <div style={{
            fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.24em",
            color: "rgba(0,200,100,0.42)", textTransform: "uppercase",
          }}>
            NFL Play Visualization · 2025
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            height: 52, padding: "0 14px", gap: 10,
            background: "rgba(0,12,5,0.93)",
            border: "1px solid rgba(0,255,80,0.26)",
            borderRadius: 14,
            boxShadow: "0 0 20px rgba(0,255,80,0.04)",
          }}>
            {isSearching ? (
              <div style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                border: "1.5px solid rgba(0,255,80,0.15)",
                borderTop: "1.5px solid #00ff88",
                animation: "spin 0.8s linear infinite",
              }} />
            ) : (
              <span style={{ color: "rgba(0,255,80,0.36)", fontSize: 17, flexShrink: 0 }}>⌕</span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInput}
              placeholder="Search any NFL player or draft prospect..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#fff", caretColor: "#00ff88",
                fontSize: 14, fontFamily: "monospace",
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); setNoResults(false); inputRef.current?.focus(); }}
                style={{ color: "rgba(100,180,120,0.55)", fontSize: 19, lineHeight: 1, flexShrink: 0, cursor: "pointer" }}
              >×</button>
            )}
          </div>
        </div>

        {/* ── SEARCH RESULTS ── */}
        {showSearch && (
          <div style={{ padding: "0 16px 28px" }}>
            {isSearching && (
              <div style={{
                textAlign: "center", padding: "32px 0",
                fontFamily: "monospace", color: "rgba(0,255,80,0.6)", fontSize: 11,
              }}>
                Searching...
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <>
                <div style={{
                  fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.16em",
                  color: "rgba(0,200,80,0.32)", textTransform: "uppercase", marginBottom: 10,
                }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {results.map(p => {
                    const col    = posColor(p.positionAbbr);
                    const accent = p.teamColor ?? col;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", borderRadius: 12, textAlign: "left",
                          background: `linear-gradient(to right, ${accent}0d, rgba(0,14,5,0.95))`,
                          border: `1px solid ${accent}22`,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                          overflow: "hidden", background: `${accent}14`,
                          border: `1.5px solid ${accent}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {p.headshot ? (
                            <img
                              src={p.headshot} alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <span style={{
                              fontFamily: "Impact, 'Arial Black', sans-serif",
                              fontSize: 17, color: accent, opacity: 0.7,
                            }}>
                              {p.displayName.split(" ").pop()?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "monospace", fontWeight: "bold", color: "#fff",
                            fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {p.displayName}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                            <span style={{
                              background: `${col}1e`, border: `1px solid ${col}3c`,
                              color: col, fontFamily: "monospace", fontSize: 8.5,
                              padding: "1px 5px", borderRadius: 3, letterSpacing: "0.05em",
                            }}>
                              {p.positionAbbr}
                            </span>
                            <span style={{ fontFamily: "monospace", color: "rgba(160,210,180,0.65)", fontSize: 10 }}>
                              {p.teamAbbr && p.teamAbbr !== "FA" ? p.teamAbbr : "Free Agent"}
                              {p.number && p.number !== "?" ? ` · #${p.number}` : ""}
                            </span>
                            {p.isDraftProspect && (
                              <span style={{
                                background: "rgba(255,170,0,0.12)", border: "1px solid rgba(255,170,0,0.3)",
                                color: "rgba(255,200,80,0.85)", fontFamily: "monospace", fontSize: 7,
                                padding: "1px 5px", borderRadius: 3, letterSpacing: "0.08em",
                              }}>
                                DRAFT '26
                              </span>
                            )}
                          </div>
                        </div>
                        <span style={{ color: `${accent}66`, fontSize: 16, flexShrink: 0 }}>›</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!isSearching && noResults && (
              <div style={{
                textAlign: "center", padding: "32px 0",
                fontFamily: "monospace", color: "rgba(100,160,120,0.45)", fontSize: 11,
              }}>
                No players found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* ── FEATURED & PROSPECTS GRIDS ── */}
        {!showSearch && (
          <div style={{ padding: "0 14px 48px", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Featured NFL Players */}
            <div>
              <div style={{
                fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.2em",
                color: "rgba(0,200,80,0.28)", textTransform: "uppercase", marginBottom: 12,
              }}>
                Featured Players
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {!featuredReady
                  ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
                  : featured.map(p => <PlayerCard key={p.id} p={p} />)
                }
              </div>
            </div>

            {/* 2026 Draft Class */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.2em",
                  color: "rgba(255,170,0,0.45)", textTransform: "uppercase",
                }}>
                  2026 Draft Class
                </div>
                <div style={{
                  height: 1, flex: 1,
                  background: "linear-gradient(to right, rgba(255,170,0,0.2), transparent)",
                }} />
                <div style={{
                  background: "rgba(255,170,0,0.1)", border: "1px solid rgba(255,170,0,0.25)",
                  color: "rgba(255,200,80,0.7)", fontFamily: "monospace", fontSize: 7,
                  padding: "2px 6px", borderRadius: 3, letterSpacing: "0.1em",
                }}>
                  CFB 2025
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {!prospectsReady
                  ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} compact />)
                  : prospects.map(p => <PlayerCard key={p.id} p={p} compact />)
                }
              </div>
            </div>

          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
