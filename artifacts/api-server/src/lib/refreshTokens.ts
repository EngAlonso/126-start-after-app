import { db, refreshTokensTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { signToken, signRefreshToken, verifyRefreshToken, hashRefreshToken, type AuthUser } from "../middlewares/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Refresh-token lifecycle: issue, rotate (with theft detection), and revoke.
// This is the single module that touches the refresh_tokens table — routes
// never query it directly, so the rotation/reuse-detection invariants below
// can never be bypassed by a route taking a shortcut.
// ─────────────────────────────────────────────────────────────────────────────

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
}

// Issues a brand-new access + refresh token pair for a freshly authenticated
// user (login / registration). Always creates a new refresh_tokens row —
// multiple devices are expected to hold independent rows simultaneously.
export async function issueTokenPair(user: AuthUser, deviceId?: string | null): Promise<IssuedTokenPair> {
  const accessToken = signToken(user);
  const { token: refreshToken, expiresAt } = signRefreshToken(user.id);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    deviceId: deviceId || null,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

export type RotateResult =
  | { ok: true; userId: number; refreshToken: string }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

// Validates and rotates a refresh token in one atomic step:
//  1. Verify JWT signature/expiry (cheap, no DB hit for obviously bad tokens).
//  2. Look up the hash in the DB.
//     - Not found              → invalid token, reject.
//     - Already revoked        → this exact token was already used/rotated
//                                 once before (or explicitly revoked) — this
//                                 is a reuse attempt, treat as theft: revoke
//                                 every active token for the user and reject.
//     - Past its DB expiresAt  → expired, reject (defence in depth vs. clock
//                                 skew between JWT exp and DB row).
//  3. Otherwise: atomically mark the row revoked (rotation) and insert a new
//     refresh_tokens row for the same device. The caller is responsible for
//     looking up the user and minting a fresh access token — this module has
//     no knowledge of role/isFounder claims.
export async function rotateRefreshToken(rawToken: string, deviceId?: string | null): Promise<RotateResult> {
  let payload: { sub: number; jti: string };
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  void payload;

  const tokenHash = hashRefreshToken(rawToken);

  return db.transaction(async (tx): Promise<RotateResult> => {
    const [row] = await tx
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash))
      .limit(1);

    if (!row) return { ok: false, reason: "invalid" };

    if (row.revokedAt) {
      // Reuse of an already-rotated (or already-revoked) token — possible
      // theft. Nuke every active session for this user and force re-login.
      await tx
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokensTable.userId, row.userId), isNull(refreshTokensTable.revokedAt)));
      return { ok: false, reason: "reused" };
    }

    if (row.expiresAt.getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }

    const now = new Date();
    await tx
      .update(refreshTokensTable)
      .set({ revokedAt: now, lastUsedAt: now })
      .where(eq(refreshTokensTable.id, row.id));

    const { token: newRefreshToken, expiresAt } = signRefreshToken(row.userId);
    await tx.insert(refreshTokensTable).values({
      userId: row.userId,
      tokenHash: hashRefreshToken(newRefreshToken),
      deviceId: deviceId ?? row.deviceId,
      expiresAt,
    });

    return { ok: true, userId: row.userId, refreshToken: newRefreshToken };
  });
}

// Revokes a single refresh token by its raw (unhashed) value — used by
// POST /auth/logout for the current device only. No-ops silently if the
// token doesn't exist or is already revoked (logout must never fail loudly
// over a stale/missing token).
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.tokenHash, tokenHash), isNull(refreshTokensTable.revokedAt)));
}

// Revokes every active refresh token belonging to a user — used by
// POST /auth/logout-all and by theft-detection in rotateRefreshToken.
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)));
}
