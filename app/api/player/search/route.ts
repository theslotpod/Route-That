import { NextRequest, NextResponse } from "next/server";
import { TEAM_COLORS } from "@/lib/espn";

const API = process.env.NFLDATA_API_URL ?? "http://localhost:8001";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);

  try {
    const res = await fetch(`${API}/api/players/search?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const players: Array<Record<string, string>> = await res.json();
    const enriched = players.map((p) => ({
      ...p,
      teamColor: TEAM_COLORS[p.teamAbbr] ?? "#00cc55",
    }));
    return NextResponse.json(enriched);
  } catch (e) {
    console.error("[player/search]", e);
    return NextResponse.json([], { status: 502 });
  }
}
