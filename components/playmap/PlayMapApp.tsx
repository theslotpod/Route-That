"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { PlayMode, FilterState, Stats, RushingPlay, ReceivingRoute } from "@/types";
import type { ESPNPlayer } from "@/lib/espn";
import { rushingPlays as mockRushing, receivingRoutes as mockReceiving, PLAYER } from "@/lib/mockData";
import TopBar from "./TopBar";
import BottomPanel from "./BottomPanel";
import RushingCanvas from "./RushingCanvas";
import ReceivingCanvas from "./ReceivingCanvas";
import FilterModal from "./FilterModal";
import PlayTooltip from "./PlayTooltip";
import PlayerSearch from "./PlayerSearch";

const DEFAULT_FILTER: FilterState = {
  downs: [1, 2, 3, 4],
  results: ["gain", "loss", "td", "fumble", "catch", "incomplete", "int"],
  quarters: [1, 2, 3, 4],
  minYards: -20,
  maxYards: 100,
};

type LoadState = "idle" | "loading" | "done" | "error";

export default function PlayMapApp() {
  const [mode, setMode] = useState<PlayMode>("rushing");
  const [animationKey, setAnimationKey] = useState(1);
  const [isScreenRecord, setIsScreenRecord] = useState(false);
  const [isViral, setIsViral] = useState(false);
  const [isAutoLoop, setIsAutoLoop] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showPlayerSearch, setShowPlayerSearch] = useState(true);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [tooltip, setTooltip] = useState<{ play: RushingPlay | ReceivingRoute; x: number; y: number } | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  // Live player data
  const [currentPlayer, setCurrentPlayer] = useState<ESPNPlayer | null>(null);
  const [liveRushing, setLiveRushing] = useState<RushingPlay[] | null>(null);
  const [liveReceiving, setLiveReceiving] = useState<ReceivingRoute[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadMsg, setLoadMsg] = useState("");
  const [gamesFound, setGamesFound] = useState(0);
  const [captureMode, setCaptureMode] = useState(false);
  const [captureName, setCaptureName] = useState("");
  const [captureDataReady, setCaptureDataReady] = useState(false);
  const [captureIntroVisible, setCaptureIntroVisible] = useState(false);
  const [captureIntroFading, setCaptureIntroFading] = useState(false);
  const [captureIntroDone, setCaptureIntroDone] = useState(false);

  const [waitingToPlay, setWaitingToPlay] = useState(false);

  const autoLoopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureModeRef = useRef(false);
  const waitingToPlayRef = useRef(false);
  waitingToPlayRef.current = waitingToPlay;

  // Active data: prefer live, fall back to mock
  const allRushing = liveRushing ?? mockRushing;
  const allReceiving = liveReceiving ?? mockReceiving;

  // ─── Filtered data ────────────────────────────────────────────────────────

  const filteredRushing = useMemo(
    () =>
      allRushing.filter(
        (p) =>
          filter.downs.includes(p.down) &&
          filter.results.includes(p.result) &&
          p.yards >= filter.minYards &&
          p.yards <= filter.maxYards &&
          filter.quarters.includes(p.quarter)
      ),
    [allRushing, filter]
  );

  const filteredReceiving = useMemo(
    () =>
      allReceiving.filter(
        (r) => filter.results.includes(r.result) && filter.quarters.includes(r.quarter)
      ),
    [allReceiving, filter]
  );

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo((): Stats => {
    if (mode === "rushing") {
      const totalYards = filteredRushing.filter((p) => p.yards > 0).reduce((s, p) => s + p.yards, 0);
      const tds = filteredRushing.filter((p) => p.result === "td").length;
      return {
        plays: filteredRushing.length,
        yards: totalYards,
        perPlay: filteredRushing.length ? (totalYards / filteredRushing.length).toFixed(1) : "0.0",
        tds,
      };
    } else {
      const catches = filteredReceiving.filter((r) => r.result === "catch" || r.result === "td");
      const totalYards = catches.reduce((s, r) => s + r.yards, 0);
      const tds = filteredReceiving.filter((r) => r.result === "td").length;
      return {
        plays: filteredReceiving.length,
        yards: totalYards,
        perPlay: filteredReceiving.length ? (totalYards / filteredReceiving.length).toFixed(1) : "0.0",
        tds,
      };
    }
  }, [mode, filteredRushing, filteredReceiving]);

  // ─── Live data fetch ──────────────────────────────────────────────────────

  const fetchPlayerPlays = useCallback(async (player: ESPNPlayer) => {
    setLoadState("loading");
    setLoadMsg(`Loading ${player.displayName}'s 2025 season...`);
    setLiveRushing(null);
    setLiveReceiving(null);
    setGamesFound(0);
    setTooltip(null);
    if (containerRef.current) {
      delete containerRef.current.dataset.animComplete;
      delete containerRef.current.dataset.animError;
    }

    try {
      const res = await fetch(
        `/api/player/${player.id}/plays?name=${encodeURIComponent(player.displayName)}&season=2025`
      );
      if (!res.ok) throw new Error("API error");
      const data: { rushing: RushingPlay[]; receiving: ReceivingRoute[]; gamesFound: number; isQB?: boolean; error?: string } =
        await res.json();

      if (data.error && !data.rushing.length && !data.receiving.length) {
        throw new Error(data.error);
      }

      const total = data.rushing.length + data.receiving.length;
      if (total === 0) {
        setLoadMsg(`No plays found — showing sample data`);
        setLoadState("error");
        setLiveRushing(null);
        setLiveReceiving(null);
        setTimeout(() => setLoadState("idle"), 3000);
        return;
      }

      setLiveRushing(data.rushing.length ? data.rushing : null);
      setLiveReceiving(data.receiving.length ? data.receiving : null);
      setGamesFound(data.gamesFound);
      setLoadState("done");
      setLoadMsg(`${total} plays from ${data.gamesFound} games`);
      setTimeout(() => setLoadState("idle"), 3000);

      // Default to the sensible mode for this position + available data
      if (!captureModeRef.current) {
        const pos = player.positionAbbr;
        const prefersReceiving = data.isQB || pos === "WR" || pos === "TE" || pos === "WR/RS";
        if (prefersReceiving && data.receiving.length > 0) {
          setMode("receiving");
        } else if (!prefersReceiving && data.rushing.length > 0) {
          setMode("rushing");
        }
      }

      // Restart animation (captureMode: intro controls when it starts)
      if (captureModeRef.current) {
        setCaptureDataReady(true);
      } else {
        setWaitingToPlay(true);
      }
    } catch (e) {
      console.error(e);
      setLoadState("error");
      setLoadMsg("Failed to load — using sample data");
      setLiveRushing(null);
      setLiveReceiving(null);
      setTimeout(() => setLoadState("idle"), 3500);
    }
  }, []);

  const handlePlayerSelect = useCallback(
    (player: ESPNPlayer) => {
      setShowPlayerSearch(false);
      setCurrentPlayer(player);
      fetchPlayerPlays(player);
    },
    [fetchPlayerPlays]
  );

  // ─── Animation control ────────────────────────────────────────────────────

  const handleReplay = useCallback(() => {
    if (autoLoopTimer.current) clearTimeout(autoLoopTimer.current);
    setAnimationKey((k) => k + 1);
    setTooltip(null);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    if (isAutoLoop) {
      const delay = isViral ? 5000 : 8000;
      autoLoopTimer.current = setTimeout(() => setAnimationKey((k) => k + 1), delay);
    }
    // Only signal capture when real player data has finished loading (not mock animation)
    if (currentPlayer && loadState !== "loading") {
      setTimeout(() => {
        if (containerRef.current) containerRef.current.dataset.animComplete = "true";
      }, 1500);
    }
  }, [isAutoLoop, isViral, currentPlayer, loadState]);

  useEffect(() => {
    if (autoLoopTimer.current) clearTimeout(autoLoopTimer.current);
    if (!captureModeRef.current && !waitingToPlayRef.current) setAnimationKey((k) => k + 1);
    setTooltip(null);
  }, [mode, filter, isViral]);

  useEffect(() => () => {
    if (autoLoopTimer.current) clearTimeout(autoLoopTimer.current);
  }, []);

  // captureDataReady: fade out photo → reveal field → delay → start plays
  useEffect(() => {
    if (!captureDataReady) return;
    const t1 = setTimeout(() => setCaptureIntroFading(true), 800);   // start fade-out
    const t2 = setTimeout(() => setCaptureIntroDone(true), 1600);    // remove overlay (800ms fade)
    const t3 = setTimeout(() => setAnimationKey((k) => k + 1), 3200); // plays start 1.6s after field reveals
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [captureDataReady]);

  // Headless capture: auto-load player from ?autoload=Name&mode=rushing|receiving
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoload = params.get("autoload");
    const urlMode = params.get("mode") as PlayMode | null;
    if (!autoload) return;
    setCaptureName(autoload);
    captureModeRef.current = true;
    setTimeout(() => setCaptureIntroVisible(true), 50); // trigger photo fade-in after first paint
    if (urlMode === "receiving" || urlMode === "rushing") setMode(urlMode);
    setShowPlayerSearch(false);
    setIsScreenRecord(true);
    setCaptureMode(true);
    fetch(`/api/player/search?q=${encodeURIComponent(autoload)}`)
      .then((r) => r.json())
      .then((data: ESPNPlayer[]) => {
        if (data.length > 0) handlePlayerSelect(data[0]);
        else if (containerRef.current) containerRef.current.dataset.animError = "true";
      })
      .catch(() => {
        if (containerRef.current) containerRef.current.dataset.animError = "true";
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Play selection ────────────────────────────────────────────────────────

  const handlePlaySelect = useCallback(
    (play: RushingPlay | ReceivingRoute | null, x: number, y: number) =>
      setTooltip(play ? { play, x, y } : null),
    []
  );

  // ─── Copy caption ─────────────────────────────────────────────────────────

  const handleCopyCaption = useCallback(() => {
    const pName = currentPlayer?.displayName ?? PLAYER.name;
    const last = pName.split(" ").pop() ?? pName;
    const modeStr = mode === "rushing" ? "rush map 🏃" : (isQB ? "pass map 🏈" : "route tree 📡");
    const text = `Every ${pName} ${modeStr} from the 2025 NFL season 📊🔥\n\n${stats.plays} plays · ${stats.yards} yards · ${stats.perPlay} avg${stats.tds > 0 ? ` · ${stats.tds} TDs` : ""}\n\n#NFL #${last} #Analytics #PlayMap #FootballStats`;
    navigator.clipboard.writeText(text).catch(() => {});
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2500);
  }, [mode, stats, currentPlayer]);

  // ─── Capture scale factor ────────────────────────────────────────────────────
  const s    = captureMode ? 1080 / 390 : 1;
  const isQB = currentPlayer?.positionAbbr === "QB";
  const modeLabel = mode === "rushing" ? "RUSH MAP" : (isQB ? "PASS MAP" : "ROUTE TREE");

  // ─── Display name ─────────────────────────────────────────────────────────

  const displayFirstName = (currentPlayer?.displayName ?? PLAYER.name).split(" ").slice(0, -1).join(" ");

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden select-none">
      {/* 9:16 container */}
      <div
        className="relative overflow-hidden flex flex-col"
        style={captureMode ? {
          width: "100vw",
          height: "100dvh",
          background: "#04090a",
        } : {
          width: "390px",
          aspectRatio: "9 / 16",
          maxHeight: "100svh",
          maxWidth: "100vw",
          background: "#04090a",
        }}
        onClick={() => setTooltip(null)}
      >
        {/* Deep field bg gradient */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(0,40,15,0.4) 0%, transparent 70%)" }}
        />

        {/* Viral overlay */}
        {isViral && <div className="absolute inset-0 pointer-events-none z-10 viral-overlay" />}

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        {!isScreenRecord && (
          <div className="relative z-20 shrink-0">
            <TopBar
              mode={mode}
              onModeChange={(m) => { setMode(m); setTooltip(null); }}
              isViral={isViral}
              isQB={isQB}
              currentPlayer={currentPlayer}
              onPlayerSearch={() => setShowPlayerSearch(true)}
            />
          </div>
        )}

        {/* Screen-record header — full styled with headshot, scales for HD capture */}
        {isScreenRecord && (() => {
          const p = currentPlayer;
          const accent = p?.teamColor ?? "#00cc55";
          const lastName = (p?.displayName ?? PLAYER.name).split(" ").pop() ?? "";
          const firstName = (p?.displayName ?? PLAYER.name).split(" ").slice(0, -1).join(" ");
          return (
            <div
              className="relative z-20 shrink-0 flex items-center justify-between"
              style={{
                padding: `${s * 8}px ${s * 12}px`,
                borderBottom: `${s * 1}px solid rgba(0,255,80,0.1)`,
                background: `linear-gradient(to right, ${accent}10, transparent 60%)`,
              }}
            >
              <div className="flex items-center" style={{ gap: s * 10 }}>
                {/* Headshot */}
                <div
                  className="shrink-0 rounded-full overflow-hidden"
                  style={{
                    width: s * 36, height: s * 36,
                    border: `${s * 2}px solid ${accent}`,
                    boxShadow: isViral ? `0 0 ${s * 12}px ${accent}80` : `0 0 ${s * 6}px ${accent}40`,
                    background: `${accent}18`,
                    minWidth: s * 36,
                  }}
                >
                  {p?.headshot ? (
                    <img src={p.headshot} alt={p.displayName} className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono font-bold"
                      style={{ color: accent, fontSize: s * 13 }}>
                      {lastName.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Name + meta */}
                <div className="flex flex-col" style={{ gap: s * 2 }}>
                  <div style={{ fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: s * 15, letterSpacing: "0.03em", color: "#fff", lineHeight: 1.1, textShadow: isViral ? `0 0 ${s * 14}px rgba(0,255,136,0.7)` : "none" }}>
                    {firstName}{" "}
                    <span style={{ color: isViral ? "#00ff88" : accent, textShadow: isViral ? `0 0 ${s * 18}px #00ff88` : `0 0 ${s * 8}px ${accent}80` }}>
                      {lastName}
                    </span>
                  </div>
                  <div className="flex items-center" style={{ gap: s * 6 }}>
                    {p && (
                      <span className="font-mono rounded"
                        style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44`, fontSize: s * 8, padding: `${s * 2}px ${s * 4}px` }}>
                        {p.teamAbbr}
                      </span>
                    )}
                    <span className="font-mono" style={{ color: "rgba(150,200,160,0.6)", fontSize: s * 8 }}>
                      {p?.positionAbbr ?? PLAYER.position}{p?.number && p.number !== "?" ? ` · #${p.number}` : ""} · 2025
                    </span>
                  </div>
                </div>
              </div>
              {/* Mode label */}
              <span className="font-mono uppercase"
                style={{ fontSize: s * 9, color: isViral ? "#00ff88" : accent, letterSpacing: "0.12em", textShadow: isViral ? `0 0 ${s * 8}px #00ff88` : "none" }}>
                {modeLabel}
              </span>
            </div>
          );
        })()}

        {/* ── Main Visualization ──────────────────────────────────────────── */}
        <div
          className="relative flex-1 min-h-0 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {mode === "rushing" ? (
            <RushingCanvas
              plays={filteredRushing}
              animationKey={animationKey}
              isViral={isViral}
              onPlaySelect={handlePlaySelect}
              onComplete={handleAnimationComplete}
            />
          ) : (
            <ReceivingCanvas
              routes={filteredReceiving}
              animationKey={animationKey}
              isViral={isViral}
              onRouteSelect={handlePlaySelect}
              onComplete={handleAnimationComplete}
            />
          )}

          {/* Tooltip */}
          {tooltip && (
            <PlayTooltip play={tooltip.play} pos={{ x: tooltip.x, y: tooltip.y }} mode={mode} />
          )}

          {/* Loading overlay */}
          {loadState === "loading" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-30"
              style={{ background: "rgba(2,8,3,0.88)", backdropFilter: "blur(4px)" }}
            >
              <div
                className="w-10 h-10 rounded-full mb-4"
                style={{
                  border: "2px solid rgba(0,255,80,0.2)",
                  borderTop: "2px solid #00ff88",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div
                className="font-mono text-center px-6"
                style={{ color: "#00ff88", fontSize: "11px", letterSpacing: "0.06em" }}
              >
                {loadMsg}
              </div>
              <div
                className="font-mono mt-2"
                style={{ color: "rgba(0,200,80,0.4)", fontSize: "9px" }}
              >
                Fetching from nflverse...
              </div>
            </div>
          )}

          {/* Play button — shown after data loads, waits for user tap */}
          {waitingToPlay && !captureMode && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-30"
              style={{ background: "rgba(2,8,3,0.80)", backdropFilter: "blur(3px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setWaitingToPlay(false); setAnimationKey((k) => k + 1); }}
                className="flex flex-col items-center"
                style={{ background: "none", border: "none", cursor: "pointer", gap: 14 }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: "2px solid rgba(0,255,80,0.55)",
                  boxShadow: "0 0 28px rgba(0,255,80,0.18), inset 0 0 20px rgba(0,255,80,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,255,80,0.07)",
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderTop: "13px solid transparent",
                    borderBottom: "13px solid transparent",
                    borderLeft: "21px solid rgba(0,255,80,0.9)",
                    marginLeft: 5,
                  }} />
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 10,
                  color: "rgba(0,255,80,0.75)", letterSpacing: "0.22em",
                  textTransform: "uppercase", marginTop: 2,
                }}>
                  TAP TO PLAY
                </div>
              </button>
              <div style={{
                fontFamily: "monospace", fontSize: 9, marginTop: 10,
                color: "rgba(80,170,100,0.38)", letterSpacing: "0.1em",
              }}>
                {mode === "rushing" ? filteredRushing.length : filteredReceiving.length} plays ready
              </div>
            </div>
          )}

          {/* Success / error flash */}
          {(loadState === "done" || loadState === "error") && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full font-mono text-xs z-30 animate-fade-in"
              style={{
                background: loadState === "done" ? "rgba(0,160,50,0.25)" : "rgba(200,50,0,0.25)",
                border: `1px solid ${loadState === "done" ? "rgba(0,255,80,0.35)" : "rgba(255,80,0,0.35)"}`,
                color: loadState === "done" ? "#00ff88" : "#ff8844",
                whiteSpace: "nowrap",
                fontSize: "9px",
              }}
            >
              {loadState === "done" ? "✓ " : "⚠ "}{loadMsg}
            </div>
          )}

          {/* Watermark in screen record */}
          {isScreenRecord && (
            <div
              className="absolute bottom-3 right-3 font-mono uppercase z-20 pointer-events-none"
              style={{ fontSize: "8px", color: "rgba(0,255,80,0.18)", letterSpacing: "0.2em" }}
            >
              PLAYMAP
            </div>
          )}
        </div>

        {/* ── Bottom Panel ─────────────────────────────────────────────────── */}
        <div className="relative z-20 shrink-0">
          <BottomPanel
            stats={stats}
            mode={mode}
            isQB={isQB}
            isScreenRecord={isScreenRecord}
            isViral={isViral}
            isAutoLoop={isAutoLoop}
            currentPlayer={currentPlayer}
            onReplay={handleReplay}
            onFilter={() => setShowFilter(true)}
            onScreenRecord={() => { setIsScreenRecord((v) => !v); setTooltip(null); }}
            onViral={() => setIsViral((v) => !v)}
            onAutoLoop={() => setIsAutoLoop((a) => !a)}
            onCopyCaption={handleCopyCaption}
          />
        </div>

        {/* ── Filter Modal ─────────────────────────────────────────────────── */}
        {showFilter && (
          <FilterModal
            filter={filter}
            mode={mode}
            onApply={(f) => { setFilter(f); setShowFilter(false); }}
            onClose={() => setShowFilter(false)}
          />
        )}

        {/* ── Player Search ────────────────────────────────────────────────── */}
        {showPlayerSearch && (
          <PlayerSearch
            onSelect={handlePlayerSelect}
            onClose={() => setShowPlayerSearch(false)}
          />
        )}

        {/* ── Copy toast ───────────────────────────────────────────────────── */}
        {showCopied && (
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-mono text-xs z-50 animate-fade-in pointer-events-none"
            style={{
              background: "rgba(0,180,60,0.25)",
              border: "1px solid rgba(0,255,80,0.4)",
              color: "#00ff88",
              textShadow: "0 0 8px #00ff88",
              boxShadow: "0 0 20px rgba(0,255,80,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            ✓ Caption copied to clipboard
          </div>
        )}

        {/* ── Capture intro card (pre-roll replacement) ────────────────────── */}
        {captureMode && !captureIntroDone && (() => {
          const p      = currentPlayer;
          const accent = p?.teamColor ?? "#00cc55";
          const name   = p?.displayName ?? captureName ?? "";
          const iFirst = name.split(" ").slice(0, -1).join(" ") || name;
          const iLast  = name.split(" ").pop() ?? "";
          return (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{
                zIndex: 60,
                background: `radial-gradient(ellipse at 50% 28%, ${accent}18 0%, #020a04 52%, #000 100%)`,
                opacity: captureIntroFading ? 0 : (captureIntroVisible ? 1 : 0),
                transition: captureIntroFading ? "opacity 0.8s ease-out" : "opacity 0.8s ease-in",
              }}
            >
              {/* Headshot */}
              <div
                className="rounded-full overflow-hidden shrink-0"
                style={{
                  width: s * 82, height: s * 82,
                  border: `${s * 3}px solid ${accent}`,
                  boxShadow: `0 0 ${s * 28}px ${accent}55, 0 0 ${s * 55}px ${accent}18`,
                  background: `${accent}18`,
                  marginBottom: s * 18,
                }}
              >
                {p?.headshot ? (
                  <img src={p.headshot} alt="" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ color: accent, fontSize: s * 34, fontFamily: "Impact, 'Arial Black', sans-serif", fontWeight: "bold" }}>
                    {(iLast || iFirst).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Player name */}
              <div style={{ textAlign: "center", lineHeight: 0.92, marginBottom: s * 14 }}>
                <div style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  fontSize: s * 48,
                  color: "#ffffff",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  textShadow: `0 ${s * 2}px ${s * 18}px rgba(0,0,0,0.9)`,
                }}>
                  {iFirst}
                </div>
                <div style={{
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                  fontSize: s * 48,
                  color: accent,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  textShadow: `0 0 ${s * 28}px ${accent}70, 0 ${s * 2}px ${s * 18}px rgba(0,0,0,0.9)`,
                }}>
                  {iLast}
                </div>
              </div>

              {/* Team / position */}
              {p ? (
                <div className="flex items-center" style={{ gap: s * 8, marginBottom: s * 22 }}>
                  <span style={{
                    background: `${accent}20`, border: `1px solid ${accent}40`,
                    color: accent, fontFamily: "monospace",
                    fontSize: s * 11, padding: `${s * 3}px ${s * 8}px`,
                    borderRadius: s * 4, letterSpacing: "0.06em",
                  }}>
                    {p.teamAbbr}
                  </span>
                  <span style={{ color: "rgba(140,200,155,0.60)", fontFamily: "monospace", fontSize: s * 11 }}>
                    {p.positionAbbr}{p.number && p.number !== "?" ? ` · #${p.number}` : ""} · 2025
                  </span>
                </div>
              ) : (
                <div style={{ marginBottom: s * 22, height: s * 24 }} />
              )}

              {/* Divider */}
              <div style={{
                width: s * 100, height: s * 1,
                background: `linear-gradient(to right, transparent, ${accent}55, transparent)`,
                marginBottom: s * 18,
              }} />

              {/* Mode label */}
              <div style={{
                fontFamily: "monospace",
                fontSize: s * 12,
                color: accent,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.85,
                marginBottom: s * 6,
              }}>
                {modeLabel}
              </div>
              <div style={{
                fontFamily: "monospace",
                fontSize: s * 9,
                color: "rgba(100,190,120,0.38)",
                letterSpacing: "0.14em",
              }}>
                2025 NFL SEASON
              </div>

              {/* Loading spinner (while data fetches) */}
              {!captureDataReady && (
                <div style={{
                  marginTop: s * 24,
                  width: s * 18, height: s * 18,
                  border: `${s * 2}px solid rgba(0,255,80,0.15)`,
                  borderTop: `${s * 2}px solid ${accent}`,
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
              )}
            </div>
          );
        })()}
      </div>

      {/* Desktop watermark */}
      <div
        className="absolute left-4 bottom-8 font-mono uppercase pointer-events-none"
        style={{
          fontSize: "9px",
          color: "rgba(0,255,80,0.1)",
          letterSpacing: "0.3em",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}
      >
        PLAYMAP · NFL ANALYTICS
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
