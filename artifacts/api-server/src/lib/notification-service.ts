/**
 * Notification Service
 * ====================
 * Centralised service for in-app DB notifications + push notification dispatch.
 *
 * Push delivery:
 *  • Android / Web tokens → FCM HTTP v1 API  (requires FIREBASE_SERVICE_ACCOUNT)
 *  • iOS tokens           → APNs HTTP/2 API  (requires APNS_TEAM_ID / APNS_KEY_ID /
 *                                             APNS_P8_KEY / APNS_BUNDLE_ID)
 *
 * If the required credentials are absent the call is a no-op (logged as a
 * warning) — the in-app DB notification is always written regardless.
 *
 * Usage:
 *   import { NotificationService } from "../lib/notification-service";
 *   await NotificationService.notifyNewOffer(customerId, requestId, techName, price);
 */

import { db, pool } from "@workspace/db";
import { notificationsTable, pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type PushNotificationType =
  | "new_request"
  | "new_offer"
  | "new_message"
  | "offer_accepted"
  | "request_completed"
  | "request_cancelled"
  | "coins_earned"
  | "referral_reward"
  | "campaign_reward"
  | "announcement"
  | "platform_credit_added"
  | "platform_credit_paid"
  | "price_change_requested"
  | "price_approved"
  | "price_rejected"
  | "waiting_approval"
  | "new_rating"
  | "support_reply";

export type NotificationDbType =
  | "new_request"
  | "new_offer"
  | "technician_selected"
  | "new_message"
  | "price_adjustment"
  | "status_change"
  | "support_reply"
  | "announcement"
  | "offer_accepted"
  | "request_completed"
  | "platform_credit_added"
  | "platform_credit_paid";

export interface PushPayload {
  title: string;
  body: string;
  type: PushNotificationType;
  data?: Record<string, string>;
}

// ─── FCM HTTP v1 ─────────────────────────────────────────────────────────────

let _fcmAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  const b64 = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!b64) return null;

  if (_fcmAccessToken && _fcmAccessToken.expiresAt > Date.now() + 60_000) {
    return _fcmAccessToken.token;
  }

  try {
    const trimmed = b64.trim();
    const decoded = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf8");
    const serviceAccount = JSON.parse(decoded);
    const privateKey: string | undefined = serviceAccount["private_key"];
    const clientEmail: string | undefined = serviceAccount["client_email"];

    if (!privateKey || !clientEmail) {
      logger.error(
        { hasPrivateKey: !!privateKey, hasClientEmail: !!clientEmail },
        "[FCM] Service account missing private_key or client_email"
      );
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss:   clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud:   "https://oauth2.googleapis.com/token",
        iat:   now,
        exp:   now + 3600,
      })
    ).toString("base64url");

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKey, "base64url");
    const jwt = `${header}.${payload}.${signature}`;

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }),
    });

    const data = (await resp.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    _fcmAccessToken = {
      token:     data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return _fcmAccessToken.token;
  } catch (err) {
    logger.error({ err }, "[FCM] Failed to obtain access token");
    return null;
  }
}

async function sendFcmMessage(token: string, payload: PushPayload): Promise<boolean> {
  const projectId   = process.env["FIREBASE_PROJECT_ID"];
  const accessToken = await getFcmAccessToken();

  if (!accessToken || !projectId) {
    logger.warn(
      { payloadType: payload.type, hasProjectId: !!projectId, hasAccessToken: !!accessToken },
      "[FCM] No credentials — push not sent"
    );
    return false;
  }

  const fcmPayload = {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data: Object.fromEntries(
        Object.entries({ type: payload.type, ...(payload.data ?? {}) })
          .map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: {
          sound:      "default",
          channel_id: "fnashha_default",
          // No click_action — Flutter-specific; not used in Expo/React Native apps.
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      webpush: {
        headers:      { Urgency: "high" },
        notification: {
          icon:  "/assets/icon-192.png?v=3",
          badge: "/assets/icon-96.png?v=3",
        },
        fcm_options: { link: "/" },
      },
    },
  };

  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    const responseText = await resp.text();

    if (!resp.ok) {
      logger.warn(
        { status: resp.status, response: responseText, tokenPrefix: token.slice(0, 30) },
        "[FCM] Send failed"
      );
      if (resp.status === 404 || resp.status === 410) {
        await deactivateToken(token);
      }
      return false;
    }

    logger.info(
      { status: resp.status, tokenPrefix: token.slice(0, 30) },
      "[FCM] Sent successfully"
    );
    return true;
  } catch (err) {
    logger.error({ err }, "[FCM] Network error");
    return false;
  }
}

// ─── APNs HTTP/2 ─────────────────────────────────────────────────────────────

// APNs JWT is valid for up to 60 minutes. Apple recommends NOT generating a
// new one per request — cache and reuse until 50 minutes old.
let _apnsJwt: { token: string; issuedAt: number } | null = null;

async function getApnsJwt(): Promise<string | null> {
  const teamId = process.env["APNS_TEAM_ID"];
  const keyId  = process.env["APNS_KEY_ID"];
  const p8Key  = process.env["APNS_P8_KEY"];

  if (!teamId || !keyId || !p8Key) return null;

  const now = Math.floor(Date.now() / 1000);
  // Reuse if < 50 minutes old
  if (_apnsJwt && now - _apnsJwt.issuedAt < 50 * 60) {
    return _apnsJwt.token;
  }

  try {
    const header  = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString("base64url");

    const { createSign } = await import("crypto");
    const sign = createSign("SHA256");
    sign.update(`${header}.${payload}`);
    // APNs JWTs require the raw IEEE P1363 r||s format, not DER.
    const signature = sign.sign(
      { key: p8Key, dsaEncoding: "ieee-p1363" },
      "base64url"
    );
    const jwt = `${header}.${payload}.${signature}`;

    _apnsJwt = { token: jwt, issuedAt: now };
    return jwt;
  } catch (err) {
    logger.error({ err }, "[APNs] Failed to build JWT");
    return null;
  }
}

async function sendApnsMessage(deviceToken: string, payload: PushPayload): Promise<boolean> {
  const bundleId = process.env["APNS_BUNDLE_ID"];
  const jwt      = await getApnsJwt();

  if (!jwt || !bundleId) {
    logger.warn(
      { payloadType: payload.type, hasBundleId: !!bundleId, hasJwt: !!jwt },
      "[APNs] Credentials not configured — iOS push skipped"
    );
    return false;
  }

  // APNs device token is a hex string from getDevicePushTokenAsync() on iOS.
  // The APNs API path expects the raw hex token (no spaces/dashes).
  const cleanToken = deviceToken.replace(/[^0-9a-fA-F]/g, "");
  const isProduction = process.env["NODE_ENV"] === "production";
  const host = isProduction ? "api.push.apple.com" : "api.sandbox.push.apple.com";

  const apnsBody = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      badge: 1,
      "content-available": 1,
    },
    // Custom data fields (all must be strings per FCM/APNs convention)
    ...Object.fromEntries(
      Object.entries({ type: payload.type, ...(payload.data ?? {}) })
        .map(([k, v]) => [k, String(v)])
    ),
  });

  return new Promise<boolean>((resolve) => {
    import("node:http2").then(({ connect }) => {
      let resolved = false;
      const safeResolve = (v: boolean) => {
        if (!resolved) { resolved = true; resolve(v); }
      };

      const client = connect(`https://${host}`);
      client.on("error", (err) => {
        logger.error({ err, tokenPrefix: cleanToken.slice(0, 20) }, "[APNs] Connection error");
        safeResolve(false);
      });

      const req = client.request({
        ":method":     "POST",
        ":path":       `/3/device/${cleanToken}`,
        ":scheme":     "https",
        ":authority":  host,
        authorization: `bearer ${jwt}`,
        "content-type":   "application/json",
        "content-length": Buffer.byteLength(apnsBody).toString(),
        "apns-topic":     bundleId,
        "apns-push-type": "alert",
        "apns-priority":  "10",
      });

      req.write(apnsBody);
      req.end();

      let statusCode = 0;
      let responseBody = "";

      req.on("response", (headers) => {
        statusCode = headers[":status"] as number;
      });
      req.on("data", (chunk: Buffer) => {
        responseBody += chunk.toString();
      });
      req.on("end", () => {
        client.close();
        if (statusCode === 200) {
          logger.info({ tokenPrefix: cleanToken.slice(0, 20) }, "[APNs] Sent successfully");
          safeResolve(true);
        } else {
          logger.warn(
            { status: statusCode, response: responseBody, tokenPrefix: cleanToken.slice(0, 20) },
            "[APNs] Send failed"
          );
          // 410 = token unregistered (app uninstalled)
          if (statusCode === 410) {
            deactivateToken(deviceToken).catch(() => null);
          }
          safeResolve(false);
        }
      });
      req.on("error", (err) => {
        logger.error({ err }, "[APNs] Request error");
        client.close();
        safeResolve(false);
      });

      // Safety timeout — never block the notification pipeline indefinitely.
      setTimeout(() => {
        client.close();
        safeResolve(false);
      }, 10_000);
    }).catch((err) => {
      logger.error({ err }, "[APNs] Failed to import http2");
      resolve(false);
    });
  });
}

// ─── Token helpers ────────────────────────────────────────────────────────────

async function deactivateToken(token: string): Promise<void> {
  try {
    await db
      .update(pushTokensTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pushTokensTable.token, token));
  } catch { /* ignore */ }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Look up all active tokens for the given user IDs, then route each token to
 * the correct push sender based on its platform:
 *   android / web → FCM HTTP v1
 *   ios           → APNs HTTP/2
 */
async function dispatchPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const result = await pool.query<{ token: string; user_id: number; platform: string }>(
      `SELECT token, user_id, platform FROM push_tokens WHERE user_id = ANY($1) AND is_active = TRUE`,
      [userIds]
    );

    logger.info(
      {
        targetUserIds: userIds,
        tokensFound:   result.rows.length,
        payloadType:   payload.type,
      },
      "[Push] dispatchPushToUsers — token lookup"
    );

    if (result.rows.length === 0) return;

    await Promise.allSettled(
      result.rows.map((r) => {
        if (r.platform === "ios") {
          return sendApnsMessage(r.token, payload);
        }
        // android + web use FCM HTTP v1
        return sendFcmMessage(r.token, payload);
      })
    );
  } catch (err) {
    logger.error({ err }, "[Push] dispatchPushToUsers failed");
  }
}

// ─── In-app notification helper ───────────────────────────────────────────────

async function createInAppNotifications(
  userIds: number[],
  title: string,
  body: string,
  type: NotificationDbType,
  relatedId?: number
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await db.insert(notificationsTable).values(
      userIds.map((uid) => ({
        userId:    uid,
        title,
        body,
        type:      type as any,
        relatedId: relatedId ?? null,
      }))
    );
  } catch (err) {
    logger.error({ err }, "[Notify] Failed to insert in-app notifications");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const NotificationService = {
  /**
   * Dispatch a push notification to a set of users without inserting any
   * in-app (DB) notification. Use when the in-app row is already written
   * by the route and you only want to add FCM/APNs on top.
   */
  dispatchPush(userIds: number[], payload: PushPayload): Promise<void> {
    return dispatchPushToUsers(userIds, payload);
  },

  // ── New request ─────────────────────────────────────────────────────────────
  async notifyNewRequest(
    technicianIds: number[],
    requestId: number,
    serviceTitle: string,
    areaName: string
  ): Promise<void> {
    const title = "طلب خدمة جديد 🔔";
    const body  = `طلب ${serviceTitle} في ${areaName} — قدّم عرضك الآن`;
    await Promise.all([
      createInAppNotifications(technicianIds, title, body, "new_request", requestId),
      dispatchPushToUsers(technicianIds, { title, body, type: "new_request",
        data: { requestId: String(requestId), serviceTitle } }),
    ]);
  },

  // ── New offer ───────────────────────────────────────────────────────────────
  async notifyNewOffer(
    customerId: number,
    requestId: number,
    technicianName: string,
    price: number
  ): Promise<void> {
    const title = "عرض جديد على طلبك 💼";
    const body  = `${technicianName} قدّم عرضاً بسعر ${price} جنيه`;
    await Promise.all([
      createInAppNotifications([customerId], title, body, "new_offer", requestId),
      dispatchPushToUsers([customerId], { title, body, type: "new_offer",
        data: { requestId: String(requestId), technicianName, price: String(price) } }),
    ]);
  },

  // ── Offer accepted ──────────────────────────────────────────────────────────
  async notifyOfferAccepted(
    technicianId: number,
    requestId: number,
    customerName: string
  ): Promise<void> {
    const title = "تم قبول عرضك ✅";
    const body  = `${customerName} قبل عرضك — انطلق إلى الطلب الآن`;
    await Promise.all([
      createInAppNotifications([technicianId], title, body, "technician_selected", requestId),
      dispatchPushToUsers([technicianId], { title, body, type: "offer_accepted",
        data: { requestId: String(requestId), customerName } }),
    ]);
  },

  // ── New message ─────────────────────────────────────────────────────────────
  async notifyNewMessage(
    recipientId: number,
    requestId: number,
    senderName: string,
    preview: string
  ): Promise<void> {
    const title = `رسالة من ${senderName} 💬`;
    const body  = preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
    await Promise.all([
      createInAppNotifications([recipientId], title, body, "new_message", requestId),
      dispatchPushToUsers([recipientId], { title, body, type: "new_message",
        data: { requestId: String(requestId), senderName } }),
    ]);
  },

  // ── Request completed ───────────────────────────────────────────────────────
  async notifyRequestCompleted(
    technicianId: number,
    customerId: number,
    requestId: number
  ): Promise<void> {
    const techTitle = "تم إنهاء الطلب ✅";
    const techBody  = "تم تسجيل انتهاء العمل وصرف المستحقات";
    const custTitle = "تم إنهاء الطلب ✅";
    const custBody  = "تم إنهاء الخدمة — يمكنك تقييم الفني الآن";
    await Promise.all([
      createInAppNotifications([technicianId], techTitle, techBody, "status_change", requestId),
      createInAppNotifications([customerId],   custTitle, custBody, "status_change", requestId),
      dispatchPushToUsers([technicianId], { title: techTitle, body: techBody, type: "request_completed",
        data: { requestId: String(requestId) } }),
      dispatchPushToUsers([customerId],   { title: custTitle, body: custBody, type: "request_completed",
        data: { requestId: String(requestId) } }),
    ]);
  },

  // ── Request cancelled ───────────────────────────────────────────────────────
  // Cancellation previously dispatched push/SSE only. Keep the existing copy
  // and push payload, while also writing one in-app row per affected user.
  async notifyRequestCancelled(
    userIds: number[],
    requestId: number
  ): Promise<void> {
    const title = "تم إلغاء الطلب";
    const body  = `تم إلغاء الطلب رقم #${requestId}`;
    await Promise.all([
      createInAppNotifications(userIds, title, body, "status_change", requestId),
      dispatchPushToUsers(userIds, {
        title, body, type: "request_cancelled",
        data: { requestId: String(requestId) },
      }),
    ]);
  },

  // ── Loyalty rewards ─────────────────────────────────────────────────────────
  async notifyCoinsEarned(
    userId: number,
    requestId: number,
    coins: number
  ): Promise<void> {
    const title = `تم إضافة ${coins} فنشها كوينز 🪙`;
    const body  = "رصيد محفظتك تم تحديثه — استمر في الاستفادة من الخدمات";
    await Promise.all([
      createInAppNotifications([userId], title, body, "status_change", requestId),
      dispatchPushToUsers([userId], {
        title, body, type: "coins_earned",
        data: { coins: String(coins), requestId: String(requestId) },
      }),
    ]);
  },

  async notifyReferralReward(
    userIds: number[],
    requestId: number
  ): Promise<void> {
    const title = "🎁 مكافأة الإحالة!";
    const body  = "تم إضافة فنشها كوينز كمكافأة إحالة إلى محفظتك";
    await Promise.all([
      createInAppNotifications(userIds, title, body, "status_change", requestId),
      dispatchPushToUsers(userIds, {
        title, body, type: "referral_reward",
        data: { requestId: String(requestId) },
      }),
    ]);
  },

  async notifyCampaignReward(
    userIds: number[],
    coins: number,
    notificationTitle?: string | null,
    notificationBody?: string | null,
  ): Promise<void> {
    const hasCustomNotification =
      typeof notificationTitle === "string" &&
      notificationTitle.trim().length > 0 &&
      typeof notificationBody === "string" &&
      notificationBody.trim().length > 0;
    const title = hasCustomNotification
      ? notificationTitle!.trim()
      : "🎉 مكافأة حملة!";
    const bodyTemplate = hasCustomNotification
      ? notificationBody!.trim()
      : "تم إضافة {coins} فنشها كوينز إلى محفظتك";
    const body = bodyTemplate.replace(/\{coins\}/g, String(coins));
    await Promise.all([
      createInAppNotifications(userIds, title, body, "status_change"),
      // Preserve the existing campaign push cap; all recipients still get the
      // in-app record.
      dispatchPushToUsers(userIds.slice(0, 500), {
        title, body, type: "campaign_reward",
        data: { coins: String(coins) },
      }),
    ]);
  },

  // ── Admin-added technician points ───────────────────────────────────────────
  // This operation had no push event. It only needs the existing in-app
  // notification infrastructure plus an SSE refresh for the bell/list.
  async notifyAdminPointsAdded(
    technicianId: number,
    points: number
  ): Promise<void> {
    const title = "تم إضافة نقاط من الإدارة";
    const body  = `تم إضافة ${points} نقطة إلى رصيدك بواسطة الإدارة`;
    await createInAppNotifications([technicianId], title, body, "status_change");
  },

  // ── Price change requested (technician → customer) ──────────────────────────
  async notifyPriceChangeRequested(
    customerId: number,
    requestId: number,
    newPrice: number
  ): Promise<void> {
    const title = "طلب تعديل السعر 💰";
    const body  = `الفني طلب تعديل السعر إلى ${newPrice} جنيه — يرجى الموافقة أو الرفض`;
    await dispatchPushToUsers([customerId], {
      title, body, type: "price_change_requested",
      data: { requestId: String(requestId), newPrice: String(newPrice) },
    });
  },

  // ── Price approved (customer → technician) ──────────────────────────────────
  async notifyPriceApproved(
    technicianId: number,
    requestId: number,
    newTotal: number
  ): Promise<void> {
    const title = "تم قبول تعديل السعر ✅";
    const body  = `وافق العميل على السعر الجديد: ${newTotal} جنيه`;
    await dispatchPushToUsers([technicianId], {
      title, body, type: "price_approved",
      data: { requestId: String(requestId), newTotal: String(newTotal) },
    });
  },

  // ── Price rejected (customer → technician) ──────────────────────────────────
  async notifyPriceRejected(
    technicianId: number,
    requestId: number
  ): Promise<void> {
    const title = "تم رفض تعديل السعر ❌";
    const body  = "رفض العميل السعر الجديد — يستمر العمل بالسعر الأصلي";
    await dispatchPushToUsers([technicianId], {
      title, body, type: "price_rejected",
      data: { requestId: String(requestId) },
    });
  },

  // ── Waiting approval (technician marked complete → customer) ────────────────
  async notifyWaitingApproval(
    customerId: number,
    requestId: number
  ): Promise<void> {
    const title = "هل تم تنفيذ الخدمة؟ 🔔";
    const body  = "أعلن الفني إتمام الطلب — يرجى التأكيد أو الرفض";
    await dispatchPushToUsers([customerId], {
      title, body, type: "waiting_approval",
      data: { requestId: String(requestId) },
    });
  },

  // ── New rating (customer → technician) ──────────────────────────────────────
  async notifyNewRating(
    technicianId: number,
    requestId: number,
    stars: number
  ): Promise<void> {
    const title = "تقييم جديد ⭐";
    const body  = `حصلت على تقييم ${stars} ${stars === 1 ? "نجمة" : "نجوم"}`;
    await dispatchPushToUsers([technicianId], {
      title, body, type: "new_rating",
      data: { requestId: String(requestId), stars: String(stars) },
    });
  },

  // ── Support reply (admin → user) ─────────────────────────────────────────────
  async notifySupportReply(
    userId: number,
    ticketId: number,
    preview: string
  ): Promise<void> {
    const title = "رد على تذكرتك 📩";
    const body  = preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
    await dispatchPushToUsers([userId], {
      title, body, type: "support_reply",
      data: { ticketId: String(ticketId) },
    });
  },

  // ── Platform credit added ────────────────────────────────────────────────────
  async notifyPlatformCreditAdded(
    technicianId: number,
    requestId: number,
    amount: number
  ): Promise<void> {
    const title = "مستحق جديد 💰";
    const body  = `تم إضافة مستحق جديد لك من فنشها بقيمة ${amount.toFixed(2)} جنيه`;
    await Promise.all([
      createInAppNotifications([technicianId], title, body, "platform_credit_added", requestId),
      dispatchPushToUsers([technicianId], { title, body, type: "platform_credit_added",
        data: { requestId: String(requestId), amount: String(amount) } }),
    ]);
  },

  // ── Platform credit paid ─────────────────────────────────────────────────────
  async notifyPlatformCreditPaid(
    technicianId: number,
    requestId: number,
    amount: number
  ): Promise<void> {
    const title = "تم تحويل مستحقك ✅";
    const body  = `تم تحويل مستحق بقيمة ${amount.toFixed(2)} جنيه إلى حسابك`;
    await Promise.all([
      createInAppNotifications([technicianId], title, body, "platform_credit_paid", requestId),
      dispatchPushToUsers([technicianId], { title, body, type: "platform_credit_paid",
        data: { requestId: String(requestId), amount: String(amount) } }),
    ]);
  },

  // ── Announcement ─────────────────────────────────────────────────────────────
  async notifyAnnouncement(
    userIds: number[],
    title: string,
    body: string
  ): Promise<void> {
    await Promise.all([
      createInAppNotifications(userIds, title, body, "announcement"),
      dispatchPushToUsers(userIds, { title, body, type: "announcement" }),
    ]);
  },
};
