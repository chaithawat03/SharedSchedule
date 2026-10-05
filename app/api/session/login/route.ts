import { NextRequest, NextResponse } from "next/server";
import { handleLoginRequest } from "../../../../lib/session/http";
import { getSessionRepository } from "../../../../lib/session/repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return await handleLoginRequest(request, getSessionRepository());
  } catch {
    return NextResponse.json(
      { error: "Session service unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
