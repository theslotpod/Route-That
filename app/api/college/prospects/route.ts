import { NextResponse } from "next/server";

const API = process.env.NFLDATA_API_URL ?? "http://localhost:8001";

export async function GET() {
  try {
    const res = await fetch(`${API}/api/college/prospects`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    return NextResponse.json(await res.json());
  } catch (e) {
    console.error("[college/prospects]", e);
    return NextResponse.json([], { status: 502 });
  }
}
