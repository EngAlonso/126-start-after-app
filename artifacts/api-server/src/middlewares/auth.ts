import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "@workspace/db";
import { adminPermissionsTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// SESSION_SECRET is required — startup guard in index.ts ensures it is set
const JWT_SECRET = process.env.SESSION_SECRET!;

// Refresh tokens are signed with a distinct secret so that leaking the
// access-token secret alone can never be used to mint refresh tokens (and
// vice versa). A dedicated JWT_REFRESH_SECRET env var can be set for extra
// isolation; when absent we derive one deterministically from SESSION_SECRET
// so existing deployments keep working with zero extra configuration.
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  crypto.createHmac("sha256", JWT_SECRET).update("fnashha-refresh-token").digest("hex");

// Both lifetimes are configurable via env vars (production defaults below).
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

export interface AuthUser {
  id: number;
  role: string;
  mobile: string;
  isFounder?: boolean;
}

interface RefreshTokenPayload {
  sub: number;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Access token — short-lived, carries the same claims used throughout the
// app (role/isFounder/etc). This is the token sent as `Authorization: Bearer`
// on every normal API call.
export function signToken(payload: AuthUser, expiresIn: string = ACCESS_TOKEN_EXPIRES_IN): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

// Single source of truth for access-token verification. Anything that needs
// to check a token (header-based middleware, SSE query-param auth, etc.)
// must go through this instead of calling jwt.verify() directly, so
// verification logic never drifts between call sites.
export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
// Refresh tokens are opaque (to the client) signed JWTs containing only a
// user id + random jti — no role/permissions, so a leaked refresh token
// cannot be used directly against permission-gated endpoints, only to mint a
// new short-lived access token via /auth/refresh. The raw JWT is returned to
// the client and NEVER stored; only its SHA-256 hash is persisted in
// refresh_tokens, which is what makes revocation/rotation checks possible.
export function signRefreshToken(userId: number): { token: string; jti: string; expiresAt: Date } {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti } as RefreshTokenPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
  const decoded = jwt.decode(token) as (RefreshTokenPayload & { exp: number }) | null;
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return { token, jti, expiresAt };
}

// Verifies signature + expiry only — callers must additionally check the
// hashed row in the DB (exists, not revoked) before trusting the token,
// since JWT verification alone cannot reflect server-side revocation.
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET);
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "number" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid refresh token payload");
  }
  return { sub: payload.sub, jti: payload.jti };
}

// Deterministic, one-way — this is the only representation of a refresh
// token ever written to the database.
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Extracts the bearer token from either the Authorization header or a
// `?token=` query parameter (required for mobile EventSource clients —
// iOS/Android EventSource implementations cannot send custom headers).
// Header takes precedence when both are present.
//
// Only the SSE routes (routes/events.ts) use the query-param fallback —
// regular API routes go through `authenticate` below, which stays
// header-only so tokens never end up in query strings / access logs for
// normal request/response endpoints.
export function extractToken(req: Request, allowQueryParam = false): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  if (allowQueryParam) {
    const queryToken = req.query["token"];
    if (typeof queryToken === "string") return queryToken;
  }
  return undefined;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "رمز الجلسة غير صالح" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    // Founder always passes
    if (req.user.isFounder || req.user.role === "super_admin" || roles.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "ليس لديك صلاحية" });
  };
}

// ─── GRANULAR PERMISSION MIDDLEWARE ──────────────────────────────────────────
// Founder always passes. super_admin always passes.
// admin must have the specific key in admin_permissions.
export function requirePermission(key: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    // Founder and super_admin bypass all permission checks
    if (req.user.isFounder || req.user.role === "super_admin") {
      next();
      return;
    }
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "ليس لديك صلاحية" });
      return;
    }
    try {
      const perms = await getEffectivePermissions(req.user);
      if (perms.includes("*") || perms.includes(key)) {
        next();
        return;
      }
    } catch {}
    res.status(403).json({ error: "ليس لديك صلاحية" });
  };
}

// Read permissions from the database for every authorization decision. Access
// tokens intentionally do not carry permissions, so revoking a permission is
// effective immediately for existing sessions as well as newly issued tokens.
export async function getEffectivePermissions(user: AuthUser): Promise<string[]> {
  if (user.isFounder || user.role === "super_admin") return ["*"];
  if (user.role !== "admin") return [];
  try {
    const rows = await db
      .select()
      .from(adminPermissionsTable)
      .where(eq(adminPermissionsTable.adminId, user.id))
      .limit(1);
    // "*" is a reserved owner-level grant. A regular employee must never gain
    // wildcard authority from a database row that they could have populated
    // through a previously vulnerable self-service path.
    return (rows[0]?.permissions || []).filter((permission) => permission !== "*");
  } catch {
    return [];
  }
}

// Permission management is deliberately bounded by the caller's own
// permission set. In this flat permission model, a key is manageable only if
// the caller already has it. The "*" key is therefore reserved for Founder /
// super_admin (or an admin who already has "*"), never inferred from
// admin.permissions alone.
export function canManagePermission(
  callerPermissions: string[],
  key: string,
  allowWildcard = false,
): boolean {
  if (key === "*") return allowWildcard;
  return callerPermissions.includes("*") || callerPermissions.includes(key);
}

export function canManagePermissionSet(
  callerPermissions: string[],
  requested: unknown,
  allowWildcard = false,
): requested is string[] {
  return Array.isArray(requested)
    && requested.every((key) => typeof key === "string" && canManagePermission(callerPermissions, key, allowWildcard));
}
// ─────────────────────────────────────────────────────────────────────────────

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {}
  }
  next();
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
// Writes to the activity_logs table. Skips silently on error or when adminId <= 0.
export async function logActivity(
  adminId: number,
  action: string,
  details?: string,
  ipAddress?: string
): Promise<void> {
  try {
    if (adminId <= 0) return;
    await db.insert(activityLogsTable).values({
      adminId,
      action,
      details: details ?? null,
      ipAddress: ipAddress ?? null,
    });
  } catch {}
}
