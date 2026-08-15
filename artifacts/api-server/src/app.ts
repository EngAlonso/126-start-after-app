import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOADS_DIR, ensureUploadDirs } from "./lib/local-storage";

ensureUploadDirs();

const app: Express = express();

// Trust the first hop of the reverse proxy (Replit/Nginx/Cloudflare/VPS all
// terminate TLS in front of this process and forward the real client IP via
// X-Forwarded-For). Without this, express-rate-limit and req.ip would key
// off the proxy's IP instead of the real client, either rate-limiting every
// user together or not rate-limiting anyone individually.
// `1` = trust exactly one hop, which matches every deployment topology this
// app runs behind (single reverse proxy in front of the app process).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── Security headers (Helmet) ────────────────────────────────────────────────
// This server serves JSON API responses and static upload files — never HTML.
// contentSecurityPolicy is therefore disabled here; the frontend (Vite/Nginx)
// manages its own CSP independently. All other Helmet defaults are applied:
// X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff,
// Strict-Transport-Security, Referrer-Policy, etc.
app.use(
  helmet({
    contentSecurityPolicy: false,
    // crossOriginResourcePolicy must be relaxed to allow the Vite dev proxy
    // and cross-origin image fetches from the /uploads static path.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
// In production CORS_ORIGIN must be explicitly configured.
// In development, localhost on any port and 127.0.0.1 are allowed so the
// Vite dev server (port 3000) can call the API (port 8080) without a proxy.
// Requests with no Origin header (native mobile, curl, Capacitor) are always
// allowed regardless of environment — CORS only restricts browser requests.
const isDev = process.env["NODE_ENV"] !== "production";
const rawCorsOrigin = process.env["CORS_ORIGIN"];

if (!isDev && !rawCorsOrigin) {
  throw new Error(
    "CORS_ORIGIN must be set in production deployments. " +
    "Set it to your frontend domain(s), e.g. 'https://fnashha.com'. " +
    "Multiple origins can be comma-separated."
  );
}

const corsOriginList = rawCorsOrigin
  ? rawCorsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

// Matches http(s)://localhost[:<port>] and http(s)://127.0.0.1[:<port>]
const devLocalPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// Matches any *.replit.dev subdomain (covers both the main dev domain and the
// Expo-specific subdomain, e.g. *.expo.spock.replit.dev). Replit routes the
// Expo web preview from a different subdomain than the API server, so without
// this the browser CORS preflight is rejected with no Access-Control-Allow-Origin
// and every fetch() call fails with "Failed to fetch".
const devReplitPattern = /^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.replit\.dev$/;

app.use(
  cors({
    origin: corsOriginList
      ? (corsOriginList.length === 1 ? corsOriginList[0] : corsOriginList)
      : isDev
      ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          // Allow requests with no Origin (native mobile apps, server-to-server,
          // curl) and any localhost/127.0.0.1 or *.replit.dev origin in development.
          if (!origin || devLocalPattern.test(origin) || devReplitPattern.test(origin)) {
            cb(null, true);
          } else {
            cb(null, false);
          }
        }
      : false, // should never reach here — startup guard above ensures CORS_ORIGIN is set
    credentials: true,
  })
);

// ─── Global API rate limiter ──────────────────────────────────────────────────
// Backstop limiter applied to every /api route. Individual auth endpoints
// (login / register / refresh) carry tighter per-route limits defined in
// middlewares/rate-limit.ts — this global limiter is an additional guard
// against runaway automation against any other endpoint.
// 300 requests / 15 minutes per IP ≈ 20 req/min — comfortable for normal
// multi-tab UI usage while blocking scripted bulk access.
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" },
});

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/uploads", express.static(UPLOADS_DIR));

app.use("/api", globalApiLimiter, router);

export default app;
