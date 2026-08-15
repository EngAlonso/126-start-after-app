import { Router } from "express";
import { db } from "@workspace/db";
import {
  ratingsTable, usersTable, serviceRequestsTable,
  servicesTable,
  technicianProfilesTable, notificationsTable, auditTrailTable,
} from "@workspace/db";
import { eq, avg, count, desc } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

router.get("/ratings", async (req, res) => {
  try {
    const { technicianId, customerId } = req.query as any;
    let rows = await db
      .select({ rating: ratingsTable, customer: usersTable })
      .from(ratingsTable)
      .leftJoin(usersTable, eq(ratingsTable.customerId, usersTable.id))
      .orderBy(desc(ratingsTable.createdAt));

    if (technicianId) rows = rows.filter((r) => r.rating.technicianId === parseInt(technicianId));
    if (customerId) rows = rows.filter((r) => r.rating.customerId === parseInt(customerId));

    return res.json(rows.map(({ rating, customer }) => ({
      ...rating,
      customer: customer ? { id: customer.id, fullName: customer.fullName, profileImage: customer.profileImage } : null,
    })));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/ratings/technician/:technicianId - get ratings for a specific technician
router.get("/ratings/technician/:technicianId", async (req, res) => {
  try {
    const technicianId = parseInt(req.params["technicianId"] as string);
    const rows = await db
      .select({
        rating: ratingsTable,
        customer: usersTable,
        serviceName: servicesTable.name,
        serviceNameAr: servicesTable.nameAr,
      })
      .from(ratingsTable)
      .leftJoin(usersTable, eq(ratingsTable.customerId, usersTable.id))
      .leftJoin(serviceRequestsTable, eq(ratingsTable.requestId, serviceRequestsTable.id))
      .leftJoin(servicesTable, eq(serviceRequestsTable.serviceId, servicesTable.id))
      .where(eq(ratingsTable.technicianId, technicianId))
      .orderBy(desc(ratingsTable.createdAt));

    const stats = await db
      .select({ avg: avg(ratingsTable.stars), count: count() })
      .from(ratingsTable)
      .where(eq(ratingsTable.technicianId, technicianId));

    return res.json({
      ratings: rows.map(({ rating, customer, serviceName, serviceNameAr }) => ({
        ...rating,
        customer: customer ? { id: customer.id, fullName: customer.fullName, profileImage: customer.profileImage } : null,
        service: serviceName || serviceNameAr ? { name: serviceName, nameAr: serviceNameAr } : null,
      })),
      averageRating: parseFloat(stats[0]?.avg ?? "0"),
      reviewCount: stats[0]?.count ?? 0,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/ratings", authenticate, async (req, res) => {
  try {
    if (req.user!.role !== "customer") {
      return res.status(403).json({ error: "العملاء فقط يمكنهم التقييم" });
    }

    const { requestId, technicianId, stars, review } = req.body;
    if (!requestId || !technicianId || !stars) {
      return res.status(400).json({ error: "البيانات مطلوبة: requestId, technicianId, stars" });
    }
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ error: "التقييم يجب أن يكون بين 1 و5 نجوم" });
    }

    // Verify the request exists and belongs to this customer
    const [request] = await db
      .select()
      .from(serviceRequestsTable)
      .where(eq(serviceRequestsTable.id, parseInt(requestId)))
      .limit(1);

    if (!request) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    if (request.customerId !== req.user!.id) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    // Check for duplicate rating (unique constraint on requestId)
    const [existing] = await db
      .select({ id: ratingsTable.id })
      .from(ratingsTable)
      .where(eq(ratingsTable.requestId, parseInt(requestId)))
      .limit(1);

    if (existing) {
      // Already rated — update instead of error
      const [updated] = await db
        .update(ratingsTable)
        .set({ stars: parseInt(stars), review: review || null })
        .where(eq(ratingsTable.id, existing.id))
        .returning();
      return res.json({ ...updated, message: "تم تحديث تقييمك بنجاح" });
    }

    const [rating] = await db
      .insert(ratingsTable)
      .values({
        requestId: parseInt(requestId),
        customerId: req.user!.id,
        technicianId: parseInt(technicianId),
        stars: parseInt(stars),
        review: review || null,
      })
      .returning();

    // Send response first — secondary ops must not block or error the rating creation
    res.status(201).json({ ...rating, message: "تم إرسال التقييم بنجاح" });

    try {
      await db.insert(notificationsTable).values({
        userId: parseInt(technicianId),
        title: "تقييم جديد",
        body: `حصلت على تقييم ${stars} نجوم${review ? `: "${review.slice(0, 60)}"` : ""}`,
        type: "status_change" as const,
        relatedId: parseInt(requestId),
      });

      // Push notification for technician — non-blocking, fail silently
      try {
        await NotificationService.notifyNewRating(
          parseInt(technicianId),
          parseInt(requestId),
          parseInt(String(stars)),
        );
      } catch {}

      await db.insert(auditTrailTable).values({
        requestId: parseInt(requestId),
        changedBy: req.user!.id,
        fieldName: "rating_submitted",
        oldValue: "0",
        newValue: String(stars),
      });
    } catch (secErr) {
      req.log.error({ err: secErr }, "rating notification/audit failed — rating was saved successfully");
    }
    return;
  } catch (err: any) {
    // Handle unique constraint violation gracefully
    if (err?.code === "23505" || err?.message?.includes("unique")) {
      return res.status(409).json({ error: "لقد قمت بتقييم هذا الطلب مسبقاً" });
    }
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/ratings/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(ratingsTable).where(eq(ratingsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
