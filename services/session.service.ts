import {
  parseLoginInput,
  validateDisplayName,
  SessionInputError,
} from "../lib/session/validation";
import {
  createSessionToken,
  hashSessionToken,
  isSessionToken,
  sessionExpiresAt,
} from "../lib/session/token";

export type SessionUser = {
  id: string;
  phoneNormalized: string;
  phoneDisplay: string | null;
  displayName: string;
  status: string;
};
export type PublicSessionUser = Pick<
  SessionUser,
  "id" | "phoneDisplay" | "displayName"
>;
export type NewUser = Pick<
  SessionUser,
  "phoneNormalized" | "phoneDisplay" | "displayName"
>;
export type NewSession = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};
export type StoredSession = {
  id: string;
  user: SessionUser;
  status: string;
  expiresAt: Date;
  lastActiveAt: Date;
};
export interface SessionRepository {
  findUserByPhone(phoneNormalized: string): Promise<SessionUser | null>;
  createUser(input: NewUser): Promise<SessionUser>;
  createSession(input: NewSession): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  touchSession(id: string, staleBefore: Date, touchedAt: Date): Promise<void>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
}

export type SignInResult =
  | { requiresRegistration: true; phoneDisplay: string }
  | {
      requiresRegistration: false;
      user: PublicSessionUser;
      token: string;
      expiresAt: Date;
    };

function toPublicUser(user: SessionUser): PublicSessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    phoneDisplay: user.phoneDisplay,
  };
}

export async function signInWithPhone(
  input: unknown,
  repository: SessionRepository,
  now = new Date(),
): Promise<SignInResult> {
  const { phone, displayName } = parseLoginInput(input);
  let user = await repository.findUserByPhone(phone.normalized);

  if (!user) {
    if (displayName === undefined) {
      return { requiresRegistration: true, phoneDisplay: phone.display };
    }
    user = await repository.createUser({
      phoneNormalized: phone.normalized,
      phoneDisplay: phone.display,
      displayName: validateDisplayName(displayName),
    });
  }

  if (user.status !== "ACTIVE")
    throw new SessionInputError("This account is unavailable");

  const token = createSessionToken();
  const expiresAt = sessionExpiresAt(now);
  await repository.createSession({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
  });
  return {
    requiresRegistration: false,
    user: toPublicUser(user),
    token,
    expiresAt,
  };
}

export async function resolveSession(
  token: unknown,
  repository: SessionRepository,
  now = new Date(),
): Promise<PublicSessionUser | null> {
  if (!isSessionToken(token)) return null;
  const session = await repository.findSessionByTokenHash(
    hashSessionToken(token),
  );
  if (
    !session ||
    session.status !== "ACTIVE" ||
    session.user.status !== "ACTIVE" ||
    session.expiresAt <= now
  ) {
    return null;
  }

  const staleBefore = new Date(now.getTime() - 60 * 60 * 1000);
  if (session.lastActiveAt < staleBefore) {
    await repository.touchSession(session.id, staleBefore, now);
  }
  return toPublicUser(session.user);
}

export async function logoutSession(
  token: unknown,
  repository: SessionRepository,
): Promise<void> {
  if (isSessionToken(token)) {
    await repository.revokeSessionByTokenHash(hashSessionToken(token));
  }
}
