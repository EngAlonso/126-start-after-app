/**
 * Push Token Routes
 * =================
 * Allows authenticated clients to register, refresh, or remove their
 * FCM / APNs push tokens.
 *
 * POST   /push-tokens         — register or refresh a token
 * DELETE /push-tokens/mine    — deactivate all tokens for this device
 * GET    /push-tokens/mine    — list active tokens for the current user
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post("/push-tokens", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { token, platform, deviceId } = req.body as {
      token?: string;
      platform?: string;
      deviceId?: string;
    };

    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ error: "token مطلوب" });
    }

    const validPlatforms = ["android", "ios", "web"];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "platform يجب أن يكون android أو ios أو web" });
    }

    await db
      .insert(pushTokensTable)
      .values({
        userId,
        token: token.trim(),
        platform: platform as "android" | "ios" | "web",
        deviceId: deviceId ?? null,
        isActive: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: {
          userId,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/push-tokens/mine", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body as { token?: string };

    if (token) {
      await db
        .update(pushTokensTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(pushTokensTable.token, token),
            eq(pushTokensTable.userId, userId)
          )
        );
    } else {
      await db
        .update(pushTokensTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pushTokensTable.userId, userId));
    }

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/push-tokens/mine", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const tokens = await db
      .select({
        id: pushTokensTable.id,
        platform: pushTokensTable.platform,
        deviceId: pushTokensTable.deviceId,
        isActive: pushTokensTable.isActive,
        createdAt: pushTokensTable.createdAt,
        updatedAt: pushTokensTable.updatedAt,
      })
      .from(pushTokensTable)
      .where(
        and(
          eq(pushTokensTable.userId, userId),
          eq(pushTokensTable.isActive, true)
        )
      );

    return res.json(tokens);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
