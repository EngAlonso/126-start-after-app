import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "technician",
  "admin",
  "super_admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",
  "suspended",
  "banned",
  "rejected",
  "deleted",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "offers_received",
  "technician_selected",
  "in_progress",
  "price_change_requested",
  "waiting_approval",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_technician",
  "cancelled_by_admin",
  "disputed",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "pending",
  "selected",
  "rejected",
  "withdrawn",
]);

export const messageTypeEnum = pgEnum("message_type", ["text", "image"]);

export const pointTransactionTypeEnum = pgEnum("point_transaction_type", [
  "credit",
  "debit",
  "commission",
  "release",
]);


export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "new_request",
  "new_offer",
  "technician_selected",
  "new_message",
  "price_adjustment",
  "status_change",
  "support_reply",
  "announcement",
  "platform_credit_added",
  "platform_credit_paid",
]);

// ─── LOYALTY ENUMS ───────────────────────────────────────────────────────────

export const coinTxTypeEnum = pgEnum("coin_tx_type", [
  "earn_pending",      // coins earned, locked until pending period elapses
  "earn_available",    // pending period elapsed; coins moved to available
  "system_cancel",     // pending coins cancelled (request reversed/invalidated)
  "redeem",            // customer spent coins on a request
  "redeem_reversal",   // coins returned when request cancelled post-redemption
  "referral_bonus",    // referral reward for referrer or referee
  "campaign",          // coins granted via admin campaign
  "manual_credit",     // admin manual coin credit
  "manual_debit",      // admin manual coin debit
  "expiry",            // coins expired (future-proofing)
]);

export const redemptionStatusEnum = pgEnum("redemption_status", [
  "active",
  "settled",
  "reversed",
]);

export const creditStatusEnum = pgEnum("credit_status", [
  "pending_settlement",
  "paid",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "completed",
  "fraud_flagged",
]);

export const campaignTargetEnum = pgEnum("campaign_target", [
  "all_customers",
  "manual",
  "registration_range",
  "inactive_customers",
  "service_based",
  "location_based",
  "spending_based",
  "completed_services",
]);

// ─── USERS ───────────────────────────────────────────────────────────────────

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    mobile: varchar("mobile", { length: 20 }).notNull().unique(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("active"),
    profileImage: text("profile_image"),
    jobTitle: text("job_title"),
    suspensionReason: text("suspension_reason"),
    bannedUntil: timestamp("banned_until"),
    bannedByAdminId: integer("banned_by_admin_id"),
    isFounder: boolean("is_founder").notNull().default(false),
    referralCode: varchar("referral_code", { length: 20 }).unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("users_mobile_idx").on(t.mobile), index("users_role_idx").on(t.role)]
);

// ─── REFRESH TOKENS ─────────────────────────────────────────────────────────
// One row per issued refresh token (opaque JWT string, never stored in plain
// text — only its SHA-256 hash lives here). Multiple active rows per user are
// expected (one per logged-in device). Rotation marks the used row's
// revoked_at and inserts a fresh row rather than mutating the token in place,
// so reuse of an already-rotated token is detectable (its row is already
// revoked when looked up again).
export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    deviceId: text("device_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [
    index("refresh_tokens_user_idx").on(t.userId),
    index("refresh_tokens_hash_idx").on(t.tokenHash),
  ]
);

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  technicianProfile: one(technicianProfilesTable, {
    fields: [usersTable.id],
    references: [technicianProfilesTable.userId],
  }),
  customerWallet: one(customerWalletsTable, {
    fields: [usersTable.id],
    references: [customerWalletsTable.userId],
  }),
  requests: many(serviceRequestsTable),
  offers: many(offersTable),
  messages: many(messagesTable),
  notifications: many(notificationsTable),
  tickets: many(supportTicketsTable),
  referralsMade: many(referralsTable, { relationName: "referrerReferrals" }),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── TECHNICIAN PROFILES ─────────────────────────────────────────────────────

export const technicianProfilesTable = pgTable("technician_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  nationalId: varchar("national_id", { length: 20 }).notNull(),
  personalPhoto: text("personal_photo"),
  nationalIdFront: text("national_id_front"),
  nationalIdBack: text("national_id_back"),
  approvalStatus: approvalStatusEnum("approval_status")
    .notNull()
    .default("pending"),
  rejectionReason: text("rejection_reason"),
  rejectedByAdminId: integer("rejected_by_admin_id"),
  rejectedAt: timestamp("rejected_at"),
  pointsBalance: integer("points_balance").notNull().default(0),
  reservedPoints: integer("reserved_points").notNull().default(0),
  primaryAreaId: integer("primary_area_id"),
  yearsOfExperience: integer("years_of_experience"),
  adminSeen: boolean("admin_seen").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  // approval_status is filtered on every dashboard count query and all pending/
  // approved/rejected list endpoints — without this index those are full-table scans.
  index("technician_profiles_approval_idx").on(t.approvalStatus),
  // primary_area_id is used in availability queries (find technicians covering an area)
  index("technician_profiles_primary_area_idx").on(t.primaryAreaId),
]);

export const technicianProfilesRelations = relations(
  technicianProfilesTable,
  ({ one, many }) => ({
    user: one(usersTable, {
      fields: [technicianProfilesTable.userId],
      references: [usersTable.id],
    }),
    primaryArea: one(areasTable, {
      fields: [technicianProfilesTable.primaryAreaId],
      references: [areasTable.id],
    }),
    technicianServices: many(technicianServicesTable),
    technicianAreas: many(technicianAreasTable),
    pointTransactions: many(pointTransactionsTable),
  })
);

export type TechnicianProfile = typeof technicianProfilesTable.$inferSelect;

// ─── SERVICES ────────────────────────────────────────────────────────────────

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  icon: text("icon"),
  image: text("image"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  iconSize: integer("icon_size").notNull().default(100),
  iconShape: text("icon_shape").notNull().default("square"),
  titleSize: integer("title_size").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const servicesRelations = relations(servicesTable, ({ many }) => ({
  technicianServices: many(technicianServicesTable),
  serviceRequests: many(serviceRequestsTable),
}));

export type Service = typeof servicesTable.$inferSelect;

// ─── GOVERNORATES ────────────────────────────────────────────────────────────

export const governoratesTable = pgTable("governorates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const governoratesRelations = relations(
  governoratesTable,
  ({ many }) => ({
    areas: many(areasTable),
  })
);

export type Governorate = typeof governoratesTable.$inferSelect;

// ─── AREAS ───────────────────────────────────────────────────────────────────

export const areasTable = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  governorateId: integer("governorate_id")
    .notNull()
    .references(() => governoratesTable.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  extraPoints: integer("extra_points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const areasRelations = relations(areasTable, ({ one, many }) => ({
  governorate: one(governoratesTable, {
    fields: [areasTable.governorateId],
    references: [governoratesTable.id],
  }),
  technicianAreas: many(technicianAreasTable),
  serviceRequests: many(serviceRequestsTable),
}));

export type Area = typeof areasTable.$inferSelect;

// ─── JUNCTION: TECHNICIAN ↔ SERVICES ─────────────────────────────────────────

export const technicianServicesTable = pgTable("technician_services", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id")
    .notNull()
    .references(() => technicianProfilesTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id")
    .notNull()
    .references(() => servicesTable.id, { onDelete: "cascade" }),
});

export const technicianServicesRelations = relations(
  technicianServicesTable,
  ({ one }) => ({
    technician: one(technicianProfilesTable, {
      fields: [technicianServicesTable.technicianId],
      references: [technicianProfilesTable.id],
    }),
    service: one(servicesTable, {
      fields: [technicianServicesTable.serviceId],
      references: [servicesTable.id],
    }),
  })
);

// ─── JUNCTION: TECHNICIAN ↔ AREAS ────────────────────────────────────────────

export const technicianAreasTable = pgTable("technician_areas", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id")
    .notNull()
    .references(() => technicianProfilesTable.id, { onDelete: "cascade" }),
  areaId: integer("area_id")
    .notNull()
    .references(() => areasTable.id, { onDelete: "cascade" }),
});

export const technicianAreasRelations = relations(
  technicianAreasTable,
  ({ one }) => ({
    technician: one(technicianProfilesTable, {
      fields: [technicianAreasTable.technicianId],
      references: [technicianProfilesTable.id],
    }),
    area: one(areasTable, {
      fields: [technicianAreasTable.areaId],
      references: [areasTable.id],
    }),
  })
);

// ─── SERVICE REQUESTS ────────────────────────────────────────────────────────

export const serviceRequestsTable = pgTable(
  "service_requests",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => usersTable.id),
    serviceId: integer("service_id")
      .notNull()
      .references(() => servicesTable.id),
    selectedTechnicianId: integer("selected_technician_id").references(
      () => usersTable.id
    ),
    status: requestStatusEnum("status").notNull().default("pending"),
    fullName: text("full_name").notNull(),
    mobile: varchar("mobile", { length: 20 }).notNull(),
    governorateId: integer("governorate_id")
      .notNull()
      .references(() => governoratesTable.id),
    areaId: integer("area_id")
      .notNull()
      .references(() => areasTable.id),
    address: text("address").notNull(),
    description: text("description").notNull(),
    images: text("images").array().notNull().default([]),
    audioUrl: text("audio_url"),
    agreedPrice: numeric("agreed_price", { precision: 10, scale: 2 }),
    customerPayableAmount: numeric("customer_payable_amount", { precision: 10, scale: 2 }),
    hasDiscount: boolean("has_discount").notNull().default(false),
    adminNote: text("admin_note"),
    cancelReason: text("cancel_reason"),
    adminSeen: boolean("admin_seen").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("requests_customer_idx").on(t.customerId),
    index("requests_status_idx").on(t.status),
    index("requests_service_idx").on(t.serviceId),
    index("requests_area_idx").on(t.areaId),
    // admin_seen is filtered on the dashboard unread-requests count (analytics route)
    index("requests_admin_seen_idx").on(t.adminSeen),
    // created_at is used in the "stale requests" analytics query (status + created_at)
    index("requests_created_at_idx").on(t.createdAt),
    // selected_technician_id is used in the technician's active-request queries
    index("requests_selected_tech_idx").on(t.selectedTechnicianId),
    // governorate_id is used in technician-matching area queries
    index("requests_governorate_idx").on(t.governorateId),
  ]
);

export const serviceRequestsRelations = relations(
  serviceRequestsTable,
  ({ one, many }) => ({
    customer: one(usersTable, {
      fields: [serviceRequestsTable.customerId],
      references: [usersTable.id],
      relationName: "customerRequests",
    }),
    service: one(servicesTable, {
      fields: [serviceRequestsTable.serviceId],
      references: [servicesTable.id],
    }),
    selectedTechnician: one(usersTable, {
      fields: [serviceRequestsTable.selectedTechnicianId],
      references: [usersTable.id],
      relationName: "selectedRequests",
    }),
    governorate: one(governoratesTable, {
      fields: [serviceRequestsTable.governorateId],
      references: [governoratesTable.id],
    }),
    area: one(areasTable, {
      fields: [serviceRequestsTable.areaId],
      references: [areasTable.id],
    }),
    offers: many(offersTable),
    messages: many(messagesTable),
    ratings: many(ratingsTable),
    priceAdjustments: many(priceAdjustmentsTable),
    auditTrail: many(auditTrailTable),
    coinRedemption: one(coinRedemptionsTable, {
      fields: [serviceRequestsTable.id],
      references: [coinRedemptionsTable.requestId],
    }),
    platformCredit: one(platformCreditsTable, {
      fields: [serviceRequestsTable.id],
      references: [platformCreditsTable.requestId],
    }),
  })
);

export type ServiceRequest = typeof serviceRequestsTable.$inferSelect;

// ─── OFFERS ───────────────────────────────────────────────────────────────────

export const offersTable = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => serviceRequestsTable.id, { onDelete: "cascade" }),
    technicianId: integer("technician_id")
      .references(() => usersTable.id),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    spareParts: numeric("spare_parts", { precision: 10, scale: 2 }),
    notes: text("notes"),
    status: offerStatusEnum("status").notNull().default("pending"),
    reservedPoints: integer("reserved_points").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("offers_request_idx").on(t.requestId),
    index("offers_technician_idx").on(t.technicianId),
  ]
);

export const offersRelations = relations(offersTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [offersTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  technician: one(usersTable, {
    fields: [offersTable.technicianId],
    references: [usersTable.id],
  }),
}));

export type Offer = typeof offersTable.$inferSelect;

// ─── MESSAGES ────────────────────────────────────────────────────────────────

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => serviceRequestsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => usersTable.id),
    content: text("content").notNull(),
    type: messageTypeEnum("type").notNull().default("text"),
    imageUrl: text("image_url"),
    isRead: boolean("is_read").notNull().default(false),
    isDelivered: boolean("is_delivered").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_request_idx").on(t.requestId)]
);

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [messagesTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  sender: one(usersTable, {
    fields: [messagesTable.senderId],
    references: [usersTable.id],
  }),
}));

export type Message = typeof messagesTable.$inferSelect;

// ─── RATINGS ─────────────────────────────────────────────────────────────────

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => serviceRequestsTable.id, { onDelete: "cascade" })
      .unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => usersTable.id),
    technicianId: integer("technician_id")
      .notNull()
      .references(() => usersTable.id),
    stars: integer("stars").notNull(),
    review: text("review"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // technician_id is queried in AVG(stars)/COUNT(*) aggregations for profile pages
    index("ratings_technician_idx").on(t.technicianId),
  ]
);

export const ratingsRelations = relations(ratingsTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [ratingsTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  customer: one(usersTable, {
    fields: [ratingsTable.customerId],
    references: [usersTable.id],
    relationName: "customerRatings",
  }),
  technician: one(usersTable, {
    fields: [ratingsTable.technicianId],
    references: [usersTable.id],
    relationName: "technicianRatings",
  }),
}));

export type Rating = typeof ratingsTable.$inferSelect;

// ─── POINT TRANSACTIONS ───────────────────────────────────────────────────────

export const pointTransactionsTable = pgTable(
  "point_transactions",
  {
    id: serial("id").primaryKey(),
    technicianId: integer("technician_id")
      .notNull()
      .references(() => technicianProfilesTable.id),
    amount: integer("amount").notNull(),
    type: pointTransactionTypeEnum("type").notNull(),
    description: text("description").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    requestId: integer("request_id").references(
      () => serviceRequestsTable.id
    ),
    adminId: integer("admin_id").references(() => usersTable.id),
    performedBy: text("performed_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("point_txn_technician_idx").on(t.technicianId),
    // request_id is queried when looking up point transactions for a specific request
    index("point_txn_request_idx").on(t.requestId),
    // admin_id is queried in admin-facing transaction history filters
    index("point_txn_admin_idx").on(t.adminId),
  ]
);

export const pointTransactionsRelations = relations(
  pointTransactionsTable,
  ({ one }) => ({
    technician: one(technicianProfilesTable, {
      fields: [pointTransactionsTable.technicianId],
      references: [technicianProfilesTable.id],
    }),
    request: one(serviceRequestsTable, {
      fields: [pointTransactionsTable.requestId],
      references: [serviceRequestsTable.id],
    }),
    admin: one(usersTable, {
      fields: [pointTransactionsTable.adminId],
      references: [usersTable.id],
    }),
  })
);

export type PointTransaction = typeof pointTransactionsTable.$inferSelect;

// ─── COMMISSION RANGES ────────────────────────────────────────────────────────
// Range-based commission rules: price bracket → required points.
// service_id = NULL means "all services" (global rule).
// Priority: service-specific range overrides global range.
// Total required points = range.requiredPoints + area.extraPoints.

export const commissionRangesTable = pgTable("commission_ranges", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  minPrice: numeric("min_price", { precision: 10, scale: 2 }).notNull(),
  maxPrice: numeric("max_price", { precision: 10, scale: 2 }).notNull(),
  requiredPoints: integer("required_points").notNull().default(0),
  commissionType: text("commission_type").notNull().default("fixed"),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commissionRangesRelations = relations(commissionRangesTable, ({ one }) => ({
  service: one(servicesTable, {
    fields: [commissionRangesTable.serviceId],
    references: [servicesTable.id],
  }),
}));

export type CommissionRange = typeof commissionRangesTable.$inferSelect;

// ─── PRICE ADJUSTMENTS ───────────────────────────────────────────────────────

export const priceAdjustmentsTable = pgTable(
  "price_adjustments",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => serviceRequestsTable.id, { onDelete: "cascade" }),
    technicianId: integer("technician_id"),
    oldPrice: numeric("old_price", { precision: 10, scale: 2 }),
    oldSpareParts: numeric("old_spare_parts", { precision: 10, scale: 2 }),
    newPrice: numeric("new_price", { precision: 10, scale: 2 }).notNull(),
    newSpareParts: numeric("new_spare_parts", { precision: 10, scale: 2 }),
    newDescription: text("new_description"),
    supportingImage: text("supporting_image"),
    images: text("images").array().notNull().default([]),
    status: text("status").notNull().default("pending"),
    decisionDate: timestamp("decision_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // request_id is the primary lookup key — fetching adjustments for a request
    index("price_adj_request_idx").on(t.requestId),
    // technician_id is filtered in technician-facing price-adjustment history
    index("price_adj_technician_idx").on(t.technicianId),
  ]
);

export const priceAdjustmentsRelations = relations(
  priceAdjustmentsTable,
  ({ one }) => ({
    request: one(serviceRequestsTable, {
      fields: [priceAdjustmentsTable.requestId],
      references: [serviceRequestsTable.id],
    }),
  })
);

// ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  images: text("images").array().notNull().default([]),
  status: ticketStatusEnum("status").notNull().default("open"),
  priority: ticketPriorityEnum("priority").notNull().default("normal"),
  adminUnread: boolean("admin_unread").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("support_tickets_user_idx").on(t.userId),
  // status and admin_unread are both used in WHERE clauses in analytics + list routes
  index("support_tickets_status_idx").on(t.status),
  index("support_tickets_admin_unread_idx").on(t.adminUnread),
]);

export const supportTicketsRelations = relations(
  supportTicketsTable,
  ({ one, many }) => ({
    user: one(usersTable, {
      fields: [supportTicketsTable.userId],
      references: [usersTable.id],
    }),
    replies: many(ticketRepliesTable),
  })
);

export type SupportTicket = typeof supportTicketsTable.$inferSelect;

// ─── TICKET REPLIES ───────────────────────────────────────────────────────────

export const ticketRepliesTable = pgTable(
  "ticket_replies",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTicketsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .references(() => usersTable.id),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // ticketId is always filtered (load all replies for a ticket)
    index("ticket_replies_ticket_idx").on(t.ticketId),
    // sender_id is used in reply-count aggregations per user
    index("ticket_replies_sender_idx").on(t.senderId),
  ]
);

export const ticketRepliesRelations = relations(
  ticketRepliesTable,
  ({ one }) => ({
    ticket: one(supportTicketsTable, {
      fields: [ticketRepliesTable.ticketId],
      references: [supportTicketsTable.id],
    }),
    sender: one(usersTable, {
      fields: [ticketRepliesTable.senderId],
      references: [usersTable.id],
    }),
  })
);

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: notificationTypeEnum("type").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    relatedId: integer("related_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_read_idx").on(t.isRead),
  ]
);

export const notificationsRelations = relations(
  notificationsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [notificationsTable.userId],
      references: [usersTable.id],
    }),
  })
);

export type Notification = typeof notificationsTable.$inferSelect;

// ─── PUSH TOKENS ─────────────────────────────────────────────────────────────

export const pushTokenPlatformEnum = pgEnum("push_token_platform", [
  "android",
  "ios",
  "web",
]);

export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: pushTokenPlatformEnum("platform").notNull(),
    deviceId: text("device_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("push_tokens_user_idx").on(t.userId),
    index("push_tokens_active_idx").on(t.isActive),
  ]
);

export const pushTokensRelations = relations(pushTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [pushTokensTable.userId],
    references: [usersTable.id],
  }),
}));

export type PushToken = typeof pushTokensTable.$inferSelect;

// ─── CMS SETTINGS ────────────────────────────────────────────────────────────

export const cmsSettingsTable = pgTable("cms_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── BANNERS ─────────────────────────────────────────────────────────────────

export const bannerLocationEnum = pgEnum("banner_location", [
  "hero",
  "below_services",
  "before_footer",
  "customer_dashboard",
  "offers_page",
]);

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  description: text("description"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  location: bannerLocationEnum("location").notNull().default("hero"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  mobileImageUrl: text("mobile_image_url"),
  showIn: text("show_in").notNull().default("both"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  overlayEnabled: boolean("overlay_enabled").notNull().default(true),
  overlayColor: text("overlay_color").default("#000000"),
  overlayOpacity: integer("overlay_opacity").notNull().default(45),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Banner = typeof bannersTable.$inferSelect;
export type InsertBanner = typeof bannersTable.$inferInsert;

// ─── ADMIN PERMISSIONS ───────────────────────────────────────────────────────

export const adminPermissionsTable = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  permissions: text("permissions").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────

export const activityLogsTable = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id")
      .notNull()
      .references(() => usersTable.id),
    action: text("action").notNull(),
    details: text("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_logs_admin_idx").on(t.adminId),
    // created_at is filtered in the analytics "recent activity" count query
    index("activity_logs_created_at_idx").on(t.createdAt),
  ]
);

export const activityLogsRelations = relations(activityLogsTable, ({ one }) => ({
  admin: one(usersTable, {
    fields: [activityLogsTable.adminId],
    references: [usersTable.id],
  }),
}));

// ─── PAGE BACKGROUNDS ────────────────────────────────────────────────────────

export const pageBackgroundsTable = pgTable("page_backgrounds", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull().default(""),
  imageUrl: text("image_url"),
  enabled: boolean("enabled").notNull().default(true),
  overlayOpacity: integer("overlay_opacity").notNull().default(48),
  position: text("position").notNull().default("center"),
  size: text("size").notNull().default("cover"),
  repeat: text("repeat").notNull().default("no-repeat"),
  attachment: text("attachment").notNull().default("scroll"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PageBackground = typeof pageBackgroundsTable.$inferSelect;

// ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────

export const auditTrailTable = pgTable(
  "audit_trail",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => serviceRequestsTable.id, { onDelete: "cascade" }),
    changedBy: integer("changed_by").references(() => usersTable.id),
    fieldName: text("field_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // request_id is always filtered (load audit history for a request)
    index("audit_trail_request_idx").on(t.requestId),
    // changed_by is filtered in admin-facing staff-action history
    index("audit_trail_changed_by_idx").on(t.changedBy),
  ]
);

export const auditTrailRelations = relations(auditTrailTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [auditTrailTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  changedByUser: one(usersTable, {
    fields: [auditTrailTable.changedBy],
    references: [usersTable.id],
  }),
}));

// ─── SYSTEM MAINTENANCE ──────────────────────────────────────────────────────

// Singleton row (id = 1) tracking the current deployed frontend/service-worker
// version and the last time a deployment was triggered from the admin panel.
export const maintenanceStateTable = pgTable("maintenance_state", {
  id: integer("id").primaryKey().default(1),
  swVersion: integer("sw_version").notNull().default(1),
  lastDeploymentAt: timestamp("last_deployment_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const maintenanceLogTable = pgTable("maintenance_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  adminId: integer("admin_id").references(() => usersTable.id),
  adminName: text("admin_name").notNull(),
  result: text("result").notNull().default("success"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const maintenanceLogRelations = relations(maintenanceLogTable, ({ one }) => ({
  admin: one(usersTable, {
    fields: [maintenanceLogTable.adminId],
    references: [usersTable.id],
  }),
}));

export type MaintenanceLog = typeof maintenanceLogTable.$inferSelect;

// ─── CUSTOMER WALLETS ────────────────────────────────────────────────────────

export const customerWalletsTable = pgTable("customer_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  coinsBalance: integer("coins_balance").notNull().default(0),     // AVAILABLE: spendable now
  pendingCoins: integer("pending_coins").notNull().default(0),     // PENDING: locked until period elapses
  reservedCoins: integer("reserved_coins").notNull().default(0),   // RESERVED: locked for active redemption
  lifetimeEarned: integer("lifetime_earned").notNull().default(0), // cumulative total ever credited
  lifetimeUsed: integer("lifetime_used").notNull().default(0),     // cumulative total ever redeemed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerWalletsRelations = relations(customerWalletsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [customerWalletsTable.userId],
    references: [usersTable.id],
  }),
  transactions: many(coinTransactionsTable),
}));

export type CustomerWallet = typeof customerWalletsTable.$inferSelect;
export type InsertCustomerWallet = typeof customerWalletsTable.$inferInsert;

// ─── COIN TRANSACTIONS ───────────────────────────────────────────────────────

export const coinTransactionsTable = pgTable(
  "coin_transactions",
  {
    id: serial("id").primaryKey(),
    walletId: integer("wallet_id")
      .notNull()
      .references(() => customerWalletsTable.id),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    amount: integer("amount").notNull(),                           // always positive
    type: coinTxTypeEnum("type").notNull(),
    description: text("description").notNull(),
    balanceAfter: integer("balance_after").notNull(),              // available balance after this tx
    sourceType: varchar("source_type", { length: 50 }),           // 'request'|'referral'|'campaign'|'manual'|'system'
    sourceId: integer("source_id"),                               // PK of originating record (FK-less for polymorphism)
    requestId: integer("request_id").references(() => serviceRequestsTable.id), // FK convenience for request sources
    adminId: integer("admin_id").references(() => usersTable.id),
    performedBy: text("performed_by"),
    expiresAt: timestamp("expires_at"),                           // for earn_pending: when it matures; for earn_available: when it expires
    maturedAt: timestamp("matured_at"),                           // Phase 10: set when earn_pending is converted to earn_available
    expiredAt: timestamp("expired_at"),                           // Phase 10: set when earn_available is expired by the scheduler
    cancelled: boolean("cancelled").notNull().default(false),     // true when a system_cancel invalidated this tx
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("coin_txn_wallet_idx").on(t.walletId),
    index("coin_txn_user_idx").on(t.userId),
    index("coin_txn_type_idx").on(t.type),
  ]
);

export const coinTransactionsRelations = relations(coinTransactionsTable, ({ one }) => ({
  wallet: one(customerWalletsTable, {
    fields: [coinTransactionsTable.walletId],
    references: [customerWalletsTable.id],
  }),
  user: one(usersTable, {
    fields: [coinTransactionsTable.userId],
    references: [usersTable.id],
  }),
  request: one(serviceRequestsTable, {
    fields: [coinTransactionsTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  admin: one(usersTable, {
    fields: [coinTransactionsTable.adminId],
    references: [usersTable.id],
    relationName: "adminCoinTxns",
  }),
}));

export type CoinTransaction = typeof coinTransactionsTable.$inferSelect;
export type InsertCoinTransaction = typeof coinTransactionsTable.$inferInsert;

// ─── COIN REDEMPTIONS ────────────────────────────────────────────────────────

export const coinRedemptionsTable = pgTable("coin_redemptions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .unique()
    .references(() => serviceRequestsTable.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  coinsRedeemed: integer("coins_redeemed").notNull(),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  status: redemptionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

export const coinRedemptionsRelations = relations(coinRedemptionsTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [coinRedemptionsTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  user: one(usersTable, {
    fields: [coinRedemptionsTable.userId],
    references: [usersTable.id],
  }),
}));

export type CoinRedemption = typeof coinRedemptionsTable.$inferSelect;
export type InsertCoinRedemption = typeof coinRedemptionsTable.$inferInsert;

// ─── CREDIT SETTLEMENT BATCHES ───────────────────────────────────────────────

export const creditSettlementBatchesTable = pgTable("credit_settlement_batches", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  creditCount: integer("credit_count").notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
});

export const creditSettlementBatchesRelations = relations(creditSettlementBatchesTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [creditSettlementBatchesTable.createdBy],
    references: [usersTable.id],
  }),
  credits: many(platformCreditsTable),
}));

export type CreditSettlementBatch = typeof creditSettlementBatchesTable.$inferSelect;
export type InsertCreditSettlementBatch = typeof creditSettlementBatchesTable.$inferInsert;

// ─── PLATFORM CREDITS ────────────────────────────────────────────────────────

export const platformCreditsTable = pgTable("platform_credits", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .unique()
    .references(() => serviceRequestsTable.id),
  technicianId: integer("technician_id")
    .notNull()
    .references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: creditStatusEnum("status").notNull().default("pending_settlement"),
  batchId: integer("batch_id").references(() => creditSettlementBatchesTable.id),
  paymentMethod: text("payment_method"),
  paymentDate: timestamp("payment_date"),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const platformCreditsRelations = relations(platformCreditsTable, ({ one }) => ({
  request: one(serviceRequestsTable, {
    fields: [platformCreditsTable.requestId],
    references: [serviceRequestsTable.id],
  }),
  technician: one(usersTable, {
    fields: [platformCreditsTable.technicianId],
    references: [usersTable.id],
  }),
  batch: one(creditSettlementBatchesTable, {
    fields: [platformCreditsTable.batchId],
    references: [creditSettlementBatchesTable.id],
  }),
}));

export type PlatformCredit = typeof platformCreditsTable.$inferSelect;
export type InsertPlatformCredit = typeof platformCreditsTable.$inferInsert;

// ─── REFERRALS ───────────────────────────────────────────────────────────────

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id")
    .notNull()
    .references(() => usersTable.id),
  refereeId: integer("referee_id")
    .notNull()
    .unique()                                                      // one referrer per new user
    .references(() => usersTable.id),
  referralCode: varchar("referral_code", { length: 20 }).notNull(), // code used at registration
  status: referralStatusEnum("status").notNull().default("pending"),
  referrerRewarded: boolean("referrer_rewarded").notNull().default(false),
  refereeRewarded: boolean("referee_rewarded").notNull().default(false),
  firstRequestId: integer("first_request_id").references(() => serviceRequestsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  rewardedAt: timestamp("rewarded_at"),
});

export const referralsRelations = relations(referralsTable, ({ one }) => ({
  referrer: one(usersTable, {
    fields: [referralsTable.referrerId],
    references: [usersTable.id],
    relationName: "referrerReferrals",
  }),
  referee: one(usersTable, {
    fields: [referralsTable.refereeId],
    references: [usersTable.id],
    relationName: "refereeReferral",
  }),
  firstRequest: one(serviceRequestsTable, {
    fields: [referralsTable.firstRequestId],
    references: [serviceRequestsTable.id],
  }),
}));

export type Referral = typeof referralsTable.$inferSelect;
export type InsertReferral = typeof referralsTable.$inferInsert;

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  notificationTitle: text("notification_title"),
  notificationBody: text("notification_body"),
  coinsAmount: integer("coins_amount").notNull(),
  target: campaignTargetEnum("target").notNull(),
  segmentFilter: jsonb("segment_filter"),                          // JSONB: structured filter criteria (governorate, category, activity, spend range, etc.)
  isActive: boolean("is_active").notNull().default(false),
  createdBy: integer("created_by").references(() => usersTable.id),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaignsRelations = relations(campaignsTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [campaignsTable.createdBy],
    references: [usersTable.id],
  }),
  distributions: many(campaignDistributionsTable),
  executionLogs: many(campaignExecutionLogsTable),
}));

export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertCampaign = typeof campaignsTable.$inferInsert;

// ─── CAMPAIGN DISTRIBUTIONS ───────────────────────────────────────────────────
// Tracks which wallet received coins from which campaign — prevents duplicate rewards.

export const campaignDistributionsTable = pgTable(
  "campaign_distributions",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
    walletId:   integer("wallet_id").notNull().references(() => customerWalletsTable.id),
    userId:     integer("user_id").notNull().references(() => usersTable.id),
    coinsAwarded:   integer("coins_awarded").notNull(),
    executionLogId: integer("execution_log_id"),   // FK set after log is created
    executedAt: timestamp("executed_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_dist_uniq").on(t.campaignId, t.walletId),
    index("campaign_dist_campaign_idx").on(t.campaignId),
  ]
);

export const campaignDistributionsRelations = relations(campaignDistributionsTable, ({ one }) => ({
  campaign: one(campaignsTable, { fields: [campaignDistributionsTable.campaignId], references: [campaignsTable.id] }),
  wallet:   one(customerWalletsTable, { fields: [campaignDistributionsTable.walletId], references: [customerWalletsTable.id] }),
  user:     one(usersTable, { fields: [campaignDistributionsTable.userId], references: [usersTable.id] }),
}));

export type CampaignDistribution = typeof campaignDistributionsTable.$inferSelect;

// ─── CAMPAIGN EXECUTION LOGS ──────────────────────────────────────────────────
// One row per admin-triggered execution run.

export const campaignExecutionLogsTable = pgTable("campaign_execution_logs", {
  id: serial("id").primaryKey(),
  campaignId:           integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  executedBy:           integer("executed_by").references(() => usersTable.id),
  status:               text("status").notNull().default("success"),   // success | failed | partial
  customersTargeted:    integer("customers_targeted").notNull().default(0),
  customersSkipped:     integer("customers_skipped").notNull().default(0),
  customersRewarded:    integer("customers_rewarded").notNull().default(0),
  totalCoinsDistributed: integer("total_coins_distributed").notNull().default(0),
  durationMs:           integer("duration_ms"),
  errorMessage:         text("error_message"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
});

export const campaignExecutionLogsRelations = relations(campaignExecutionLogsTable, ({ one }) => ({
  campaign:   one(campaignsTable, { fields: [campaignExecutionLogsTable.campaignId], references: [campaignsTable.id] }),
  executedBy: one(usersTable,     { fields: [campaignExecutionLogsTable.executedBy],  references: [usersTable.id] }),
}));

export type CampaignExecutionLog = typeof campaignExecutionLogsTable.$inferSelect;

// ─── INTRO SCREENS ─────────────────────────────────────────────────────────────
// Configurable startup slideshow images managed by admin.

export const introScreensTable = pgTable("intro_screens", {
  id:           serial("id").primaryKey(),
  imageUrl:     text("image_url").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  enabled:      boolean("enabled").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export type IntroScreen = typeof introScreensTable.$inferSelect;
export type InsertIntroScreen = typeof introScreensTable.$inferInsert;

// ─── INVOICES ────────────────────────────────────────────────────────────────
// Permanent invoice records generated once per completed request.
// Invoice numbers are immutable; snapshot_data captures all data at creation.

export const invoicesTable = pgTable(
  "invoices",
  {
    id:           serial("id").primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 30 }).notNull().unique(),
    requestId:    integer("request_id").notNull().references(() => serviceRequestsTable.id),
    invoiceType:  varchar("invoice_type", { length: 20 }).notNull(),   // 'customer' | 'technician'
    status:       varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'cancelled'
    snapshotData: jsonb("snapshot_data").notNull().default({}),
    pdfPath:      text("pdf_path"),
    createdBy:    integer("created_by").references(() => usersTable.id),
    lastWhatsappAt: timestamp("last_whatsapp_at"),
    lastPrintedAt:  timestamp("last_printed_at"),
    lastDownloadAt: timestamp("last_download_at"),
    createdAt:    timestamp("created_at").notNull().defaultNow(),
    updatedAt:    timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoices_request_id_idx").on(t.requestId),
    index("invoices_number_idx").on(t.invoiceNumber),
  ]
);

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;

// ─── INVOICE ACTIVITY LOGS ───────────────────────────────────────────────────

export const invoiceActivityLogsTable = pgTable(
  "invoice_activity_logs",
  {
    id:              serial("id").primaryKey(),
    invoiceId:       integer("invoice_id").notNull().references(() => invoicesTable.id),
    action:          varchar("action", { length: 30 }).notNull(), // created|viewed|printed|downloaded|whatsapp_opened
    performedBy:     integer("performed_by").references(() => usersTable.id),
    performedByName: text("performed_by_name"),
    createdAt:       timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("inv_activity_invoice_idx").on(t.invoiceId),
  ]
);

export type InvoiceActivityLog = typeof invoiceActivityLogsTable.$inferSelect;
