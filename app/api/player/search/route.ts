import { NextRequest, NextResponse } from "next/server";
import { searchPlayers, TEAM_COLORS } from "@/lib/espn";

const API = process.env.NFLDATA_API_URL;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);

  // If backend is configured, try it first (it includes draft prospects in results)
  if (API) {
    try {
      const res = await fetch(`${API}/api/players/search?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const players: Array<Record<string, string>> = await res.json();
        const enriched = players.map((p) => ({
          ...p,
          teamColor: TEAM_COLORS[p.teamAbbr] ?? "#00cc55",
        }));
        return NextResponse.json(enriched);
      }
    } catch {
      // fall through to ESPN
    }
  }

  // Fall back to ESPN public API (works without a backend)
  try {
    const players = await searchPlayers(q);
    return NextResponse.json(players);
  } catch (e) {
    console.error("[player/search] ESPN fallback failed", e);
    return NextResponse.json([]);
  }
}
