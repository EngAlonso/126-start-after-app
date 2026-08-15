import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Run at server startup:
 * 1. Verify DB connectivity
 * 2. Create any missing tables / enums (idempotent DDL)
 * 3. Ensure the super admin account exists
 *
 * If the DB is completely unavailable, we log a warning and continue —
 * the auth route's built-in fallback handles that case.
 */
export interface SchemaSyncResult {
  success: boolean;
  errors: string[];
}

/**
 * Applies the existing idempotent application-schema DDL.
 *
 * This is kept separate from the founder bootstrap so callers such as database
 * restore can bring an older local database forward without changing account
 * data or running unrelated startup actions.
 */
export async function synchronizeSchema(): Promise<SchemaSyncResult> {
  const errors: string[] = [];

  try {
    await pool.query("SELECT 1");
    logger.info("Database connection verified");
  } catch (err) {
    logger.warn({ err }, "Database unavailable at startup — running in degraded mode (super-admin fallback active)");
    return { success: false, errors: ["Database connection unavailable"] };
  }

  // ── Create enums idempotently ──────────────────────────────────────────────
  const enumDDL = `
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('customer','technician','admin','super_admin');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE push_token_platform AS ENUM ('android','ios','web');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE user_status AS ENUM ('active','pending','suspended','banned','rejected','deleted');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE approval_status AS ENUM ('pending','approved','rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE request_status AS ENUM ('pending','offers_received','technician_selected','in_progress','price_change_requested','waiting_approval','completed','cancelled_by_customer','cancelled_by_technician','cancelled_by_admin','disputed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE offer_status AS ENUM ('pending','selected','rejected','withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE message_type AS ENUM ('text','image');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE point_transaction_type AS ENUM ('credit','debit','commission','release');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE ticket_status AS ENUM ('open','in_progress','resolved','closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE ticket_priority AS ENUM ('low','normal','high','urgent');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM ('new_request','new_offer','technician_selected','new_message','price_adjustment','status_change','support_reply','announcement','platform_credit_added','platform_credit_paid');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE banner_location AS ENUM ('hero','below_services','before_footer');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE coin_tx_type AS ENUM ('earn_pending','earn_available','system_cancel','redeem','redeem_reversal','referral_bonus','campaign','manual_credit','manual_debit','expiry');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE redemption_status AS ENUM ('active','settled','reversed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE credit_status AS ENUM ('pending_settlement','paid');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE referral_status AS ENUM ('pending','completed','fraud_flagged');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE campaign_target AS ENUM ('all_customers','manual','registration_range','inactive_customers','service_based','location_based','spending_based','completed_services');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;

  // ── Create tables idempotently ─────────────────────────────────────────────
  const tableDDL = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'customer',
      status user_status NOT NULL DEFAULT 'active',
      profile_image TEXT,
      job_title TEXT,
      suspension_reason TEXT,
      banned_until TIMESTAMP,
      banned_by_admin_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_mobile_idx ON users (mobile);
    CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

    CREATE TABLE IF NOT EXISTS governorates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS areas (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      governorate_id INTEGER NOT NULL REFERENCES governorates(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      icon TEXT,
      image TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS technician_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      national_id VARCHAR(20) NOT NULL,
      personal_photo TEXT,
      national_id_front TEXT,
      national_id_back TEXT,
      approval_status approval_status NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      rejected_by_admin_id INTEGER,
      rejected_at TIMESTAMP,
      points_balance INTEGER NOT NULL DEFAULT 0,
      reserved_points INTEGER NOT NULL DEFAULT 0,
      primary_area_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS technician_services (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technician_areas (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
      area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES users(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      selected_technician_id INTEGER REFERENCES users(id),
      status request_status NOT NULL DEFAULT 'pending',
      full_name TEXT NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      governorate_id INTEGER NOT NULL REFERENCES governorates(id),
      area_id INTEGER NOT NULL REFERENCES areas(id),
      address TEXT NOT NULL,
      description TEXT NOT NULL,
      images TEXT[] NOT NULL DEFAULT '{}',
      audio_url TEXT,
      agreed_price NUMERIC(10,2),
      admin_note TEXT,
      cancel_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS requests_customer_idx ON service_requests (customer_id);
    CREATE INDEX IF NOT EXISTS requests_status_idx ON service_requests (status);
    CREATE INDEX IF NOT EXISTS requests_service_idx ON service_requests (service_id);
    CREATE INDEX IF NOT EXISTS requests_area_idx ON service_requests (area_id);

    CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      technician_id INTEGER NOT NULL REFERENCES users(id),
      price NUMERIC(10,2) NOT NULL,
      spare_parts NUMERIC(10,2),
      notes TEXT,
      status offer_status NOT NULL DEFAULT 'pending',
      reserved_points INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS offers_request_idx ON offers (request_id);
    CREATE INDEX IF NOT EXISTS offers_technician_idx ON offers (technician_id);

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type message_type NOT NULL DEFAULT 'text',
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_request_idx ON messages (request_id);

    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES users(id),
      technician_id INTEGER NOT NULL REFERENCES users(id),
      stars INTEGER NOT NULL,
      review TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES technician_profiles(id),
      amount INTEGER NOT NULL,
      type point_transaction_type NOT NULL,
      description TEXT NOT NULL,
      balance_after INTEGER NOT NULL,
      request_id INTEGER REFERENCES service_requests(id),
      admin_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS point_txn_technician_idx ON point_transactions (technician_id);

    CREATE TABLE IF NOT EXISTS price_adjustments (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      new_price NUMERIC(10,2) NOT NULL,
      new_description TEXT NOT NULL,
      images TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      images TEXT[] NOT NULL DEFAULT '{}',
      status ticket_status NOT NULL DEFAULT 'open',
      priority ticket_priority NOT NULL DEFAULT 'normal',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type notification_type NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      related_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
    CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (is_read);

    CREATE TABLE IF NOT EXISTS cms_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS banners (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      button_text TEXT,
      button_link TEXT,
      location banner_location NOT NULL DEFAULT 'hero',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_permissions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_trail (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      changed_by INTEGER REFERENCES users(id),
      field_name TEXT NOT NULL DEFAULT '',
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_trail_request_idx ON audit_trail (request_id);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS activity_logs_admin_idx ON activity_logs (admin_id);

    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform push_token_platform NOT NULL,
      device_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);
    CREATE INDEX IF NOT EXISTS push_tokens_active_idx ON push_tokens (is_active);
  `;

  const alterDDL = `
    ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS icon_size INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS icon_shape TEXT NOT NULL DEFAULT 'square';

    ALTER TABLE IF EXISTS areas ADD COLUMN IF NOT EXISTS extra_points INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE IF EXISTS point_transactions ADD COLUMN IF NOT EXISTS performed_by TEXT;

    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS technician_id INTEGER;
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS old_price NUMERIC(10,2);
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS old_spare_parts NUMERIC(10,2);
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS new_spare_parts NUMERIC(10,2);
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS new_description TEXT;
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS supporting_image TEXT;
    ALTER TABLE IF EXISTS price_adjustments ADD COLUMN IF NOT EXISTS decision_date TIMESTAMP;

    CREATE TABLE IF NOT EXISTS commission_ranges (
      id SERIAL PRIMARY KEY,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      min_price NUMERIC(10,2) NOT NULL,
      max_price NUMERIC(10,2) NOT NULL,
      required_points INTEGER NOT NULL DEFAULT 0,
      commission_type TEXT NOT NULL DEFAULT 'fixed',
      commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE IF EXISTS commission_ranges ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'fixed';
    ALTER TABLE IF EXISTS commission_ranges ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE IF EXISTS commission_ranges ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE IF EXISTS commission_ranges ADD COLUMN IF NOT EXISTS required_points INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE IF EXISTS ticket_replies ALTER COLUMN sender_id DROP NOT NULL;

    -- Fix audit_trail schema mismatch: old DDL used (actor_id/action/details),
    -- Drizzle uses (changed_by/field_name/old_value/new_value).
    -- ADD COLUMN IF NOT EXISTS is safe on both old and new DBs.
    -- Note: ALTER COLUMN action DROP NOT NULL was removed because new tableDDL
    -- no longer creates "action", and old DBs that already have it nullable need no change.
    ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS changed_by INTEGER REFERENCES users(id);
    ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS field_name TEXT;
    ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS old_value TEXT;
    ALTER TABLE IF EXISTS audit_trail ADD COLUMN IF NOT EXISTS new_value TEXT;

    -- Make offers.technician_id nullable so admins (super_admin id=0, no DB record) can submit offers
    ALTER TABLE IF EXISTS offers ALTER COLUMN technician_id DROP NOT NULL;

    ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS title_size INTEGER NOT NULL DEFAULT 100;

    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS video_url TEXT;
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS show_in TEXT NOT NULL DEFAULT 'both';
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS overlay_enabled BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS overlay_color TEXT DEFAULT '#000000';
    ALTER TABLE IF EXISTS banners ADD COLUMN IF NOT EXISTS overlay_opacity INTEGER NOT NULL DEFAULT 45;


    ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS admin_seen BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS admin_unread BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE IF EXISTS technician_profiles ADD COLUMN IF NOT EXISTS admin_seen BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE IF EXISTS technician_profiles ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
    ALTER TABLE IF EXISTS technician_profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

    -- Founder account column — exactly one row may have is_founder = TRUE
    ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE UNIQUE INDEX IF NOT EXISTS users_founder_uniq ON users (is_founder) WHERE is_founder = TRUE;

    CREATE TABLE IF NOT EXISTS page_backgrounds (
      slug VARCHAR(64) PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      overlay_opacity INTEGER NOT NULL DEFAULT 48,
      position VARCHAR(32) NOT NULL DEFAULT 'center',
      size VARCHAR(32) NOT NULL DEFAULT 'cover',
      repeat VARCHAR(32) NOT NULL DEFAULT 'no-repeat',
      attachment VARCHAR(32) NOT NULL DEFAULT 'scroll',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Refresh token storage (hashed only — see refreshTokensTable comment).
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      device_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      last_used_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_hash_idx ON refresh_tokens (token_hash);

    INSERT INTO page_backgrounds (slug, label, image_url) VALUES
      ('login',               'تسجيل الدخول',    NULL),
      ('register',            'إنشاء حساب',      NULL),
      ('register-customer',   'تسجيل عميل',      NULL),
      ('register-technician', 'تسجيل فني',       NULL),
      ('qr',                  'صفحة QR',         NULL),
      ('contact',             'اتصل بنا',        NULL),
      ('how-it-works',        'كيف يعمل',        NULL),
      ('faq',                 'الأسئلة الشائعة', NULL),
      ('terms',               'الشروط والأحكام', NULL),
      ('privacy',             'سياسة الخصوصية', NULL),
      ('refund-policy',       'سياسة الاسترداد', NULL)
    ON CONFLICT (slug) DO NOTHING;

    -- Intro screens: configurable startup slideshow (admin-managed, mobile + PWA).
    CREATE TABLE IF NOT EXISTS intro_screens (
      id            SERIAL PRIMARY KEY,
      image_url     TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS intro_screens_order_idx ON intro_screens (display_order);

    -- System maintenance: singleton state + audit log.
    -- These tables are used by routes/maintenance.ts and must exist on any
    -- fresh install (they are not created by Drizzle push on a bare DB).
    CREATE TABLE IF NOT EXISTS maintenance_state (
      id                INTEGER PRIMARY KEY DEFAULT 1,
      sw_version        INTEGER NOT NULL DEFAULT 1,
      last_deployment_at TIMESTAMP,
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS maintenance_log (
      id         SERIAL PRIMARY KEY,
      action     TEXT NOT NULL,
      admin_id   INTEGER REFERENCES users(id),
      admin_name TEXT NOT NULL DEFAULT '',
      result     TEXT NOT NULL DEFAULT 'success',
      details    TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Technician service-modification requests.
    -- Technicians cannot directly change registered services or areas.
    -- They submit a request here that an admin reviews and approves or rejects.
    CREATE TABLE IF NOT EXISTS tech_service_modification_requests (
      id              SERIAL PRIMARY KEY,
      technician_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type    TEXT    NOT NULL CHECK (request_type IN ('add_service','remove_service','change_areas','other')),
      details         TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      admin_notes     TEXT,
      reviewed_by     INTEGER REFERENCES users(id),
      reviewed_at     TIMESTAMP,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS tech_mod_req_tech_idx ON tech_service_modification_requests (technician_id);
    CREATE INDEX IF NOT EXISTS tech_mod_req_status_idx ON tech_service_modification_requests (status);
  `;

  // ── Loyalty system DDL — separate query so it runs independently of alterDDL
  // Each loyalty table / column is idempotent (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
  const loyaltyDDL = `
    ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

    ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS customer_payable_amount NUMERIC(10,2);
    ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS has_discount BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS customer_wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      coins_balance INTEGER NOT NULL DEFAULT 0,
      pending_coins INTEGER NOT NULL DEFAULT 0,
      reserved_coins INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      lifetime_used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS customer_wallets_user_idx ON customer_wallets (user_id);

    CREATE TABLE IF NOT EXISTS coin_transactions (
      id SERIAL PRIMARY KEY,
      wallet_id INTEGER NOT NULL REFERENCES customer_wallets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      type coin_tx_type NOT NULL,
      description TEXT NOT NULL,
      balance_after INTEGER NOT NULL,
      source_type VARCHAR(50),
      source_id INTEGER,
      request_id INTEGER REFERENCES service_requests(id),
      admin_id INTEGER REFERENCES users(id),
      performed_by TEXT,
      expires_at TIMESTAMP,
      cancelled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS coin_txn_wallet_idx ON coin_transactions (wallet_id);
    CREATE INDEX IF NOT EXISTS coin_txn_user_idx ON coin_transactions (user_id);
    CREATE INDEX IF NOT EXISTS coin_txn_type_idx ON coin_transactions (type);

    CREATE TABLE IF NOT EXISTS coin_redemptions (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      coins_redeemed INTEGER NOT NULL,
      discount_value NUMERIC(10,2) NOT NULL,
      status redemption_status NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      settled_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_settlement_batches (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      total_amount NUMERIC(10,2) NOT NULL,
      credit_count INTEGER NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS platform_credits (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id),
      technician_id INTEGER NOT NULL REFERENCES users(id),
      amount NUMERIC(10,2) NOT NULL,
      status credit_status NOT NULL DEFAULT 'pending_settlement',
      batch_id INTEGER REFERENCES credit_settlement_batches(id),
      payment_method TEXT,
      payment_date TIMESTAMP,
      payment_reference TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS platform_credits_status_idx ON platform_credits (status);

    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      referee_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      referral_code VARCHAR(20) NOT NULL,
      status referral_status NOT NULL DEFAULT 'pending',
      referrer_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
      referee_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
      first_request_id INTEGER REFERENCES service_requests(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      rewarded_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      description TEXT,
      coins_amount INTEGER NOT NULL,
      target campaign_target NOT NULL,
      segment_filter JSONB,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by INTEGER REFERENCES users(id),
      starts_at TIMESTAMP,
      ends_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    -- Migrate segment_filter from TEXT to JSONB if table already existed with TEXT column
    ALTER TABLE IF EXISTS campaigns ALTER COLUMN segment_filter TYPE JSONB USING CASE WHEN segment_filter IS NULL THEN NULL ELSE segment_filter::jsonb END;
    ALTER TABLE IF EXISTS campaigns ADD COLUMN IF NOT EXISTS notification_title TEXT;
    ALTER TABLE IF EXISTS campaigns ADD COLUMN IF NOT EXISTS notification_body TEXT;

    CREATE TABLE IF NOT EXISTS campaign_distributions (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      wallet_id INTEGER NOT NULL REFERENCES customer_wallets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      coins_awarded INTEGER NOT NULL,
      execution_log_id INTEGER,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(campaign_id, wallet_id)
    );
    CREATE INDEX IF NOT EXISTS campaign_dist_campaign_idx ON campaign_distributions (campaign_id);
    -- Safeguard: ensure the idempotency constraint exists even if the table was created
    -- previously without it (e.g. by an older bootstrap revision).
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_dist_uniq ON campaign_distributions (campaign_id, wallet_id);

    CREATE TABLE IF NOT EXISTS campaign_execution_logs (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      executed_by INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'success',
      customers_targeted INTEGER NOT NULL DEFAULT 0,
      customers_skipped INTEGER NOT NULL DEFAULT 0,
      customers_rewarded INTEGER NOT NULL DEFAULT 0,
      total_coins_distributed INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS campaign_exec_campaign_idx ON campaign_execution_logs (campaign_id);
    CREATE INDEX IF NOT EXISTS campaign_exec_created_idx ON campaign_execution_logs (created_at DESC);

    -- Phase 10: maturation and expiry tracking columns on coin_transactions
    ALTER TABLE IF EXISTS coin_transactions ADD COLUMN IF NOT EXISTS matured_at TIMESTAMP;
    ALTER TABLE IF EXISTS coin_transactions ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP;

    -- Phase 10: scheduler performance indexes
    -- Partial indexes only scan rows that need processing — very fast even on large tables
    CREATE INDEX IF NOT EXISTS coin_txn_pending_mature_idx
      ON coin_transactions (expires_at)
      WHERE type = 'earn_pending' AND cancelled = false;

    CREATE INDEX IF NOT EXISTS coin_txn_available_expiry_idx
      ON coin_transactions (expires_at)
      WHERE type = 'earn_available' AND cancelled = false;

    -- Analytics / dashboard indexes added during stability audit.
    -- These were missing from the original DDL but are queried on every page
    -- load of the admin dashboard (unread counts, stale-request counts, etc.).
    CREATE INDEX IF NOT EXISTS technician_profiles_approval_idx
      ON technician_profiles (approval_status);

    CREATE INDEX IF NOT EXISTS requests_admin_seen_idx
      ON service_requests (admin_seen);

    CREATE INDEX IF NOT EXISTS requests_created_at_idx
      ON service_requests (created_at);

    CREATE INDEX IF NOT EXISTS support_tickets_user_idx
      ON support_tickets (user_id);

    CREATE INDEX IF NOT EXISTS support_tickets_status_idx
      ON support_tickets (status);

    CREATE INDEX IF NOT EXISTS support_tickets_admin_unread_idx
      ON support_tickets (admin_unread);

    CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
      ON activity_logs (created_at);

    -- Security hardening audit: additional indexes for tables that were missing them.
    -- All use IF NOT EXISTS so they are safe to re-run on existing databases.

    CREATE INDEX IF NOT EXISTS technician_profiles_primary_area_idx
      ON technician_profiles (primary_area_id);

    CREATE INDEX IF NOT EXISTS requests_selected_tech_idx
      ON service_requests (selected_technician_id);

    CREATE INDEX IF NOT EXISTS requests_governorate_idx
      ON service_requests (governorate_id);

    CREATE INDEX IF NOT EXISTS ratings_technician_idx
      ON ratings (technician_id);

    CREATE INDEX IF NOT EXISTS point_txn_request_idx
      ON point_transactions (request_id);

    CREATE INDEX IF NOT EXISTS point_txn_admin_idx
      ON point_transactions (admin_id);

    CREATE INDEX IF NOT EXISTS price_adj_request_idx
      ON price_adjustments (request_id);

    CREATE INDEX IF NOT EXISTS price_adj_technician_idx
      ON price_adjustments (technician_id);

    CREATE INDEX IF NOT EXISTS ticket_replies_ticket_idx
      ON ticket_replies (ticket_id);

    CREATE INDEX IF NOT EXISTS ticket_replies_sender_idx
      ON ticket_replies (sender_id);

    CREATE INDEX IF NOT EXISTS audit_trail_request_idx
      ON audit_trail (request_id);

    CREATE INDEX IF NOT EXISTS audit_trail_changed_by_idx
      ON audit_trail (changed_by);

    -- ── Invoice Management System ────────────────────────────────────────────
    -- Permanent sequential invoice numbering via PostgreSQL sequence.
    CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

    CREATE TABLE IF NOT EXISTS invoices (
      id             SERIAL PRIMARY KEY,
      invoice_number VARCHAR(30) UNIQUE NOT NULL,
      request_id     INTEGER NOT NULL REFERENCES service_requests(id),
      invoice_type   VARCHAR(20) NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'active',
      snapshot_data  JSONB NOT NULL DEFAULT '{}',
      pdf_path       TEXT,
      created_by     INTEGER REFERENCES users(id),
      last_whatsapp_at TIMESTAMP,
      last_printed_at  TIMESTAMP,
      last_download_at TIMESTAMP,
      created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoice_activity_logs (
      id               SERIAL PRIMARY KEY,
      invoice_id       INTEGER NOT NULL REFERENCES invoices(id),
      action           VARCHAR(30) NOT NULL,
      performed_by     INTEGER REFERENCES users(id),
      performed_by_name TEXT,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS invoices_request_id_idx
      ON invoices (request_id);

    CREATE INDEX IF NOT EXISTS inv_activity_invoice_idx
      ON invoice_activity_logs (invoice_id);
  `;

  try {
    await pool.query(enumDDL);
    await pool.query(tableDDL);
    logger.info("Base schema verified / created successfully");
  } catch (err) {
    logger.error({ err }, "Failed to apply base schema DDL");
    errors.push(`Base schema DDL failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Execute each ALTER / CREATE statement in alterDDL independently.
  // A single pool.query(alterDDL) would run everything inside one implicit
  // transaction: one failing statement aborts the whole batch, meaning
  // statements after the failure (e.g. intro_screens) never execute.
  // Running each statement separately ensures full isolation.
  {
    // Split on ";" — each element is one SQL statement (multi-line is fine).
    // Strip SQL line comments before the empty-check so comment-only chunks
    // are not submitted as queries.
    const alterStatements = alterDDL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);

    let skipped = 0;
    for (const stmt of alterStatements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        skipped++;
        errors.push(`Schema statement failed: ${err?.message ?? String(err)}`);
        logger.warn(
          { stmt: stmt.replace(/\s+/g, " ").slice(0, 120), errMsg: err?.message },
          "alter statement skipped (non-fatal)"
        );
      }
    }

    if (skipped === 0) {
      logger.info("Schema alterations applied successfully");
    } else {
      logger.info(
        { skipped, total: alterStatements.length },
        "Schema alterations done — some statements already applied or skipped (non-fatal)"
      );
    }
  }

  // ALTER TYPE ADD VALUE and CREATE TYPE must each run as a separate query in
  // autocommit mode. ALTER TYPE ADD VALUE fails inside transactions on older PG
  // versions. CREATE TYPE errors (already exists) are caught and ignored.
  for (const stmt of [
    // Existing enum value additions
    "ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted'",
    "ALTER TYPE point_transaction_type ADD VALUE IF NOT EXISTS 'release'",
    "ALTER TYPE banner_location ADD VALUE IF NOT EXISTS 'customer_dashboard'",
    "ALTER TYPE banner_location ADD VALUE IF NOT EXISTS 'offers_page'",
    "ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'platform_credit_added'",
    "ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'platform_credit_paid'",
    // Loyalty system enums — must exist before loyaltyDDL table creation
    "CREATE TYPE coin_tx_type AS ENUM ('earn_pending','earn_available','system_cancel','redeem','redeem_reversal','referral_bonus','campaign','manual_credit','manual_debit','expiry')",
    "CREATE TYPE redemption_status AS ENUM ('active','settled','reversed')",
    "CREATE TYPE credit_status AS ENUM ('pending_settlement','paid')",
    "CREATE TYPE referral_status AS ENUM ('pending','completed','fraud_flagged')",
    "CREATE TYPE campaign_target AS ENUM ('all_customers','manual','registration_range','inactive_customers','service_based','location_based','spending_based','completed_services')",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'registration_range'",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'inactive_customers'",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'service_based'",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'location_based'",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'spending_based'",
    "ALTER TYPE campaign_target ADD VALUE IF NOT EXISTS 'completed_services'",
  ]) {
    try {
      await pool.query(stmt);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "42710") {
        errors.push(`Enum statement failed (${stmt}): ${err instanceof Error ? err.message : String(err)}`);
        logger.warn({ err, stmt }, "Enum schema statement failed");
      }
    }
  }

  // Loyalty tables — runs AFTER enums are guaranteed to exist.
  // Isolated in its own query so alterDDL failures cannot block it.
  try {
    await pool.query(loyaltyDDL);
    logger.info("Loyalty schema applied successfully");
  } catch (err) {
    logger.error({ err }, "Failed to apply loyalty schema DDL");
    errors.push(`Loyalty schema DDL failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { success: errors.length === 0, errors };
}

export async function bootstrap(): Promise<void> {
  const schema = await synchronizeSchema();
  if (!schema.success) {
    logger.warn(
      { errors: schema.errors },
      "Schema synchronization completed with errors; continuing startup in degraded mode"
    );
  }

  // Bootstrap the Founder account from environment variables.
  // FOUNDER_PHONE is intentionally not logged to prevent phone-number leakage in log sinks.
  logger.info({ hasFounderPhone: !!process.env["FOUNDER_PHONE"] }, "Starting founder bootstrap");
  await bootstrapFounder();
}

/**
 * Ensures exactly one Founder account exists in the database.
 *
 * Step 1 — If is_founder = TRUE already exists: do nothing.
 * Step 2 — If FOUNDER_PHONE matches an existing user: convert that user to Founder.
 * Step 3 — Otherwise: create a brand-new Founder account with FOUNDER_PHONE / FOUNDER_PASSWORD.
 */
async function bootstrapFounder(): Promise<void> {
  const founderPhone    = process.env["FOUNDER_PHONE"];
  const founderPassword = process.env["FOUNDER_PASSWORD"];

  // Step 1: Check for an existing Founder row
  logger.info("Before checking is_founder");
  try {
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE is_founder = TRUE LIMIT 1`
    );
    logger.info({ rowCount: existing.rows.length }, "After is_founder query returns");
    if (existing.rows.length > 0) {
      logger.info({ id: existing.rows[0].id }, "Founder account already exists — no action taken");
      return;
    }
  } catch (err) {
    logger.error({ err }, "Failed to query for existing Founder — skipping founder bootstrap");
    return;
  }

  // No Founder exists — env vars are required from here on
  if (!founderPhone || !founderPassword) {
    logger.warn("FOUNDER_PHONE / FOUNDER_PASSWORD not set — founder account not bootstrapped");
    return;
  }

  // Step 2: Convert an existing user with FOUNDER_PHONE to Founder
  logger.info("Searching for existing user by FOUNDER_PHONE");
  try {
    const byPhone = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE mobile = $1 LIMIT 1`,
      [founderPhone]
    );
    if (byPhone.rows.length > 0) {
      const founderId = byPhone.rows[0].id;
      await pool.query(
        `UPDATE users
            SET is_founder = TRUE, role = 'super_admin', status = 'active', updated_at = NOW()
          WHERE id = $1`,
        [founderId]
      );
      logger.info({ id: founderId, mobile: founderPhone }, "Existing user converted to Founder");
      return;
    }
  } catch (err) {
    logger.error({ err }, "Error during Founder phone lookup");
    return;
  }

  // Step 3: Create a brand-new Founder account
  logger.info("Creating brand-new Founder account");
  try {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(founderPassword, 10);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users (full_name, mobile, password_hash, role, status, is_founder, created_at, updated_at)
       VALUES ('المؤسس', $1, $2, 'super_admin', 'active', TRUE, NOW(), NOW())
       RETURNING id`,
      [founderPhone, passwordHash]
    );
    logger.info({ id: result.rows[0].id, mobile: founderPhone }, "Brand-new Founder account created");
  } catch (err) {
    logger.error({ err }, "Failed to create Founder account");
  }
}
