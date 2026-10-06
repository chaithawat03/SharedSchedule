import { NextResponse, type NextRequest } from "next/server";
import { handleCreateRoom, handleListRooms } from "../../../lib/rooms/http";
import { getRoomRepository } from "../../../lib/rooms/repository";
import { getSessionRepository } from "../../../lib/session/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return await handleListRooms(
      request,
      getSessionRepository(),
      getRoomRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Room service unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleCreateRoom(
      request,
      getSessionRepository(),
      getRoomRepository(),
    );
  } catch {
    return NextResponse.json(
      { error: "Room service unavailable" },
      { status: 503 },
    );
  }
}
