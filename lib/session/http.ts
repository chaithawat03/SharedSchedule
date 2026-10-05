import { NextResponse, type NextRequest } from "next/server";
import type { SessionRepository } from "../../services/session.service";
import {
  logoutSession,
  resolveSession,
  signInWithPhone,
} from "../../services/session.service";
import { InvalidPhoneError } from "../phone";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./cookie";
import { SessionInputError } from "./validation";

const noStore = { "Cache-Control": "no-store" };

export async function handleLoginRequest(
  request: NextRequest,
  repository: SessionRepository,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a phone number" },
      { status: 400, headers: noStore },
    );
  }

  try {
    const result = await signInWithPhone(body, repository);
    if (result.requiresRegistration) {
      return NextResponse.json(result, { headers: noStore });
    }

    const response = NextResponse.json(
      { user: result.user },
      { headers: noStore },
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.token,
      sessionCookieOptions(
        result.expiresAt,
        process.env.NODE_ENV === "production",
      ),
    );
    return response;
  } catch (error) {
    if (
      error instanceof InvalidPhoneError ||
      error instanceof SessionInputError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: noStore },
      );
    }
    return NextResponse.json(
      { error: "Unable to continue right now" },
      { status: 500, headers: noStore },
    );
  }
}

export async function handleMeRequest(
  request: NextRequest,
  repository: SessionRepository,
) {
  try {
    const user = await resolveSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      repository,
    );
    if (!user)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStore },
      );
    return NextResponse.json({ user }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { error: "Unable to check session" },
      { status: 500, headers: noStore },
    );
  }
}

export async function handleLogoutRequest(
  request: NextRequest,
  repository: SessionRepository,
) {
  try {
    await logoutSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      repository,
    );
    const response = NextResponse.json({ success: true }, { headers: noStore });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to log out right now" },
      { status: 500, headers: noStore },
    );
  }
}
