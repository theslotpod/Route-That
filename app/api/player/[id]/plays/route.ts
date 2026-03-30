import { NextRequest, NextResponse } from "next/server";

const API = process.env.NFLDATA_API_URL ?? "http://localhost:8001";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const season = req.nextUrl.searchParams.get("season") || "2025";
  const gsisId = params.id;

  try {
    const res = await fetch(
      `${API}/api/players/${encodeURIComponent(gsisId)}/plays?season=${season}`,
      { signal: AbortSignal.timeout(60000) }
    );
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    console.error("[player/plays]", e);
    return NextResponse.json(
      { rushing: [], receiving: [], gamesFound: 0, error: "Failed to load plays" },
      { status: 502 }
    );
  }
}
