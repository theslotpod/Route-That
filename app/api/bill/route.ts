import { NextRequest, NextResponse } from "next/server";

const BILL_API_URL = process.env.BILL_API_URL;

export async function POST(req: NextRequest) {
  if (!BILL_API_URL) {
    return NextResponse.json({ messages: ["BILL is offline right now. Check back soon!"] });
  }

  const body = await req.json();
  const { message, session_id } = body as { message: string; session_id: string };

  if (!message?.trim() || !session_id) {
    return NextResponse.json({ error: "Missing message or session_id" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BILL_API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), session_id }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok) {
      throw new Error(`Upstream ${upstream.status}`);
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[BILL API]", e);
    return NextResponse.json({ messages: ["BILL is busy right now. Try again in a sec!"] });
  }
}
