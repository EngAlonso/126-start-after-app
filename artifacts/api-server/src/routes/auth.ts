import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  technicianProfilesTable,
  technicianServicesTable,
  technicianAreasTable,
  adminPermissionsTable,
  referralsTable,
} from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { authenticate, optionalAuth, logActivity, signToken } from "../middlewares/auth";
import { loginRateLimiter, registerRateLimiter, refreshRateLimiter } from "../middlewares/rate-limit";
import { validateBody } from "../middlewares/validate";
import { loginSchema, registerCustomerSchema, registerTechnicianSchema } from "../validators/schemas";
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken, revokeAllUserTokens } from "../lib/refreshTokens";
import { generateReferralCode, seedCustomerWallet } from "../lib/loyaltyEngine";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, profile?: any) {
  // Strip large base64 image fields before serialising into the JWT response /
  // localStorage to avoid exceeding the ~5 MB browser storage quota.
  const technicianProfile = profile
    ? (({ personalPhoto: _p, nationalIdFront: _f, nationalIdBack: _b, ...rest }) => rest)(profile)
    : null;
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    jobTitle: user.jobTitle,
    createdAt: user.createdAt,
    suspensionReason: user.suspensionReason,
    bannedUntil: user.bannedUntil,
    isFounder: user.isFounder ?? false,
    technicianProfile,
  };
}

async function getPermissions(userId: number, role: string, isFounder?: boolean): Promise<string[]> {
  // Founder and super_admin always have all permissions
  if (isFounder || role === "super_admin") return ["*"];
  try {
    const rows = await db
      .select()
      .from(adminPermissionsTable)
      .where(eq(adminPermissionsTable.adminId, userId))
      .limit(1);
    // Wildcard authority is reserved for Founder / super_admin. Do not expose
    // a stale or attacker-written "*" row to a regular employee's session.
    return (rows[0]?.permissions || []).filter((permission) => permission !== "*");
  } catch {
    return [];
  }
}

// POST /api/auth/register/customer
router.post("/auth/register/customer", registerRateLimiter, validateBody(registerCustomerSchema), async (req, res) => {
  try {
    const fullName   = (req.body.fullName  || "").trim();
    const mobile     = (req.body.mobile    || "").trim();
    const password   = (req.body.password  || "").trim();
    const referredBy = ((req.body.referredBy || "").trim().toUpperCase()) || null;

    if (!fullName || !mobile || !password) {
      return res.status(400).json({ error: "جميع الحقول مطلوبة" });
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(
      and(eq(usersTable.mobile, mobile), ne(usersTable.status, "deleted"))
    ).limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });

    // Validate referral code before touching any other data
    let referrerUser: { id: number } | null = null;
    if (referredBy) {
      const [found] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.referralCode, referredBy))
        .limit(1);
      if (!found) {
        return res.status(400).json({ error: "رمز الإحالة غير صحيح" });
      }
      referrerUser = found;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // User insert + wallet seed + referral record all in one transaction.
    // Retry up to 5 times on referral_code unique-constraint violation (concurrent registration race).
    let user!: typeof usersTable.$inferSelect;
    const MAX_CODE_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const referralCode = await generateReferralCode();
      try {
        user = await db.transaction(async (tx) => {
          const [newUser] = await tx
            .insert(usersTable)
            .values({ fullName, mobile, passwordHash, role: "customer", status: "active", referralCode })
            .returning();

          // Seed an empty wallet atomically with user creation
          await seedCustomerWallet(newUser.id, tx);

          // Record referral relationship if a valid referral code was supplied
          if (referrerUser) {
            await tx.insert(referralsTable).values({
              referrerId:   referrerUser.id,
              refereeId:    newUser.id,
              referralCode: referredBy!,
              status:       "pending",
            });
          }

          return newUser;
        });
        break; // transaction succeeded — exit retry loop
      } catch (txErr: any) {
        const isCodeCollision =
          typeof txErr?.message === "string" &&
          txErr.message.includes("unique") &&
          txErr.message.includes("referral_code");
        if (isCodeCollision && attempt < MAX_CODE_RETRIES - 1) continue; // retry with a new code
        throw txErr; // non-retryable error or max retries reached
      }
    }

    const deviceId = (req.body.deviceId || "").toString().trim() || null;
    const { accessToken, refreshToken } = await issueTokenPair(
      { id: user.id, role: user.role, mobile: user.mobile, isFounder: false },
      deviceId
    );
    return res.status(201).json({ token: accessToken, accessToken, refreshToken, user: formatUser(user), permissions: [] });
  } catch (err) {
    req.log.error({ err }, "register customer error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/auth/register/technician
router.post("/auth/register/technician", registerRateLimiter, validateBody(registerTechnicianSchema), async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const mobile = (req.body.mobile || "").trim();
    const password = (req.body.password || "").trim();
    const nationalId = (req.body.nationalId || "").trim();
    const {
      personalPhoto, nationalIdFront, nationalIdBack,
      serviceIds, areaIds, primaryAreaId, yearsOfExperience,
    } = req.body;
    if (!fullName || !mobile || !password || !nationalId) {
      return res.status(400).json({ error: "جميع الحقول المطلوبة يجب ملؤها" });
    }

    // Validate base64-encoded images: each must be within 2 MB and must have a
    // recognised image MIME prefix. Oversized or malformed payloads are rejected
    // before hitting the database to prevent storage abuse.
    const BASE64_MAX_CHARS = 2_800_000; // ≈ 2 MB binary after base64 decode
    const VALID_IMAGE_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,", "data:image/gif;base64,"];
    function validateBase64Image(value: unknown, fieldName: string): string | null {
      if (!value) return null; // optional field — absent is fine
      if (typeof value !== "string") return `حقل ${fieldName} غير صالح`;
      // Accept server-side upload URLs (produced by POST /api/upload/user)
      if (value.startsWith("/uploads/") || value.startsWith("http://") || value.startsWith("https://")) return null;
      if (value.length > BASE64_MAX_CHARS) return `حجم ${fieldName} كبير جداً (الحد الأقصى 2 ميجابايت)`;
      if (!VALID_IMAGE_PREFIXES.some((pfx) => value.startsWith(pfx))) {
        return `نوع ملف ${fieldName} غير مدعوم (يُسمح بـ JPEG و PNG و WebP فقط)`;
      }
      return null;
    }

    const imgErrors = [
      validateBase64Image(personalPhoto,   "الصورة الشخصية"),
      validateBase64Image(nationalIdFront, "صورة الوجه الأمامي للهوية"),
      validateBase64Image(nationalIdBack,  "صورة الوجه الخلفي للهوية"),
    ].filter(Boolean);
    if (imgErrors.length > 0) {
      return res.status(400).json({ error: imgErrors[0] });
    }
    const existing = await db.select().from(usersTable).where(
      and(eq(usersTable.mobile, mobile), ne(usersTable.status, "deleted"))
    ).limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ fullName, mobile, passwordHash, role: "technician", status: "pending" })
      .returning();

    const [profile] = await db
      .insert(technicianProfilesTable)
      .values({
        userId: user.id,
        nationalId,
        personalPhoto: personalPhoto || null,
        nationalIdFront: nationalIdFront || null,
        nationalIdBack: nationalIdBack || null,
        approvalStatus: "pending",
        primaryAreaId: primaryAreaId || null,
        yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
      })
      .returning();

    if (serviceIds && Array.isArray(serviceIds)) {
      for (const sid of serviceIds) {
        await db.insert(technicianServicesTable).values({ technicianId: profile.id, serviceId: sid });
      }
    }
    if (areaIds && Array.isArray(areaIds)) {
      for (const aid of areaIds) {
        await db.insert(technicianAreasTable).values({ technicianId: profile.id, areaId: aid });
      }
    }

    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("new_technician", { id: user.id });
    } catch {}

    return res.status(201).json({ pending: true, user: formatUser(user, { ...profile }) });
  } catch (err) {
    req.log.error({ err }, "register technician error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/auth/login
router.post("/auth/login", loginRateLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const mobile = (req.body.mobile ?? "").toString().trim();
    const password = (req.body.password ?? "").toString().trim();
    if (!mobile || !password) return res.status(400).json({ error: "رقم الهاتف وكلمة المرور مطلوبان" });

    // All logins go through the database — no hardcoded credentials
    const users = await db.select().from(usersTable).where(and(eq(usersTable.mobile, mobile), ne(usersTable.status, "deleted"))).limit(1);
    if (users.length === 0) return res.status(401).json({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      if (user.role === "admin" || user.role === "super_admin" || user.isFounder) {
        await logActivity(user.id, "فشل تسجيل الدخول", `محاولة دخول فاشلة للحساب: ${mobile}`, (req as any).ip);
      }
      return res.status(401).json({ error: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    }

    const effectiveRole = user.role;

    if (user.role === "technician" && user.status === "pending") {
      return res.status(403).json({ error: "حسابك قيد المراجعة من قبل الإدارة. سيتم إشعارك عند الموافقة على طلبك" });
    }

    if (user.role === "technician" && user.status === "rejected") {
      return res.status(403).json({ error: `تم رفض طلب تسجيلك. السبب: ${user.suspensionReason || "لم يستوف الشروط المطلوبة"}` });
    }

    if (user.status === "banned") {
      return res.status(403).json({ error: `الحساب محظور بشكل دائم. السبب: ${user.suspensionReason || "مخالفة السياسة"}` });
    }

    if (user.status === "suspended") {
      if (user.bannedUntil) {
        const now = new Date();
        if (user.bannedUntil > now) {
          return res.status(403).json({
            error: `الحساب موقوف حتى ${user.bannedUntil.toLocaleDateString("ar-EG")}. السبب: ${user.suspensionReason || "مخالفة السياسة"}`,
          });
        } else {
          await db.update(usersTable).set({ status: "active", suspensionReason: null, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
        }
      } else {
        return res.status(403).json({ error: `الحساب موقوف. السبب: ${user.suspensionReason || "تواصل مع الدعم الفني"}` });
      }
    }

    let profile = null;
    if (effectiveRole === "technician") {
      const profiles = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, user.id)).limit(1);
      if (profiles.length > 0) profile = profiles[0];
    }

    const permissions = await getPermissions(user.id, effectiveRole, user.isFounder);
    const deviceId = (req.body.deviceId || "").toString().trim() || null;
    const { accessToken, refreshToken } = await issueTokenPair(
      { id: user.id, role: effectiveRole, mobile: user.mobile, isFounder: user.isFounder ?? false },
      deviceId
    );
    if (effectiveRole === "admin" || effectiveRole === "super_admin" || user.isFounder) {
      await logActivity(user.id, "تسجيل الدخول", `دخول ناجح — ${user.fullName} (${mobile})`, (req as any).ip);
    }
    return res.json({ token: accessToken, accessToken, refreshToken, user: formatUser(user, profile), permissions });
  } catch (err) {
    req.log.error({ err }, "login error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// DELETE /api/auth/me — self-delete account (soft delete)
router.delete("/auth/me", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    // Founder account can never be deleted
    if (req.user!.isFounder) return res.status(403).json({ error: "لا يمكن حذف هذا الحساب" });
    const scrambledMobile = `del_${userId}`;
    const scrambledEmail = `del_${userId}@deleted.local`;
    await db.update(usersTable)
      .set({
        status: "deleted",
        passwordHash: "DELETED_ACCOUNT",
        mobile: scrambledMobile,
        email: scrambledEmail,
        updatedAt: new Date(),
      } as any)
      .where(eq(usersTable.id, userId));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/auth/logout — revokes only the refresh token for the current
// device (if supplied). Old callers that post no body keep working exactly
// as before (activity logging only, no revocation to perform).
router.post("/auth/logout", optionalAuth, async (req, res) => {
  const refreshToken = (req.body?.refreshToken || "").toString().trim();
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (err) {
      req.log.error({ err }, "logout: failed to revoke refresh token");
    }
  }
  if (req.user && (req.user.role === "admin" || req.user.role === "super_admin" || req.user.isFounder) && req.user.id > 0) {
    await logActivity(req.user.id, "تسجيل الخروج", `خروج من الحساب`, (req as any).ip);
  }
  res.json({ success: true });
});

// POST /api/auth/logout-all — revokes every refresh token belonging to the
// authenticated user, signing that user out on every device at once.
router.post("/auth/logout-all", authenticate, async (req, res) => {
  try {
    await revokeAllUserTokens(req.user!.id);
    if (req.user!.role === "admin" || req.user!.role === "super_admin" || req.user!.isFounder) {
      await logActivity(req.user!.id, "تسجيل الخروج من كل الأجهزة", `خروج من جميع الأجهزة`, (req as any).ip);
    }
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "logout-all error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/auth/refresh — rotates a refresh token for a new short-lived
// access token + a new refresh token. Reuse of an already-rotated token
// revokes every session for that user (theft detection) and forces re-login.
router.post("/auth/refresh", refreshRateLimiter, async (req, res) => {
  try {
    const refreshToken = (req.body?.refreshToken || "").toString().trim();
    if (!refreshToken) return res.status(400).json({ error: "رمز التحديث مطلوب" });

    const deviceId = (req.body.deviceId || "").toString().trim() || null;
    const result = await rotateRefreshToken(refreshToken, deviceId);

    if (!result.ok) {
      // Every rejection path returns the same generic 401 — the reason is
      // for server-side observability only, never leaked to the client.
      req.log.warn({ reason: result.reason }, "refresh token rejected");
      return res.status(401).json({ error: "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى" });
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, result.userId)).limit(1);
    if (users.length === 0 || users[0].status === "deleted" || users[0].status === "banned") {
      return res.status(401).json({ error: "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى" });
    }
    const user = users[0];

    const accessToken = signToken({ id: user.id, role: user.role, mobile: user.mobile, isFounder: user.isFounder ?? false });

    return res.json({ token: accessToken, accessToken, refreshToken: result.refreshToken });
  } catch (err) {
    req.log.error({ err }, "refresh error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/auth/me
router.get("/auth/me", authenticate, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    if (users.length === 0) return res.status(404).json({ error: "المستخدم غير موجود" });

    const user = users[0];
    const effectiveRole = user.role;

    let profile = null;
    if (effectiveRole === "technician") {
      try {
        const profiles = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, user.id)).limit(1);
        if (profiles.length > 0) profile = profiles[0];
      } catch {}
    }

    const permissions = await getPermissions(user.id, effectiveRole, user.isFounder);
    return res.json({ ...formatUser(user, profile), permissions });
  } catch (err) {
    req.log.error({ err }, "getMe error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
