import { Router } from "express";
import { createRequire } from "module";
import path from "path";
import { authenticate } from "../middlewares/auth";
import { uploadToCloudinary } from "../lib/cloudinary";
import { saveFile } from "../lib/local-storage";

const _require = createRequire(import.meta.url);
const _multerMod = _require("multer");
const multer = (_multerMod.default ?? _multerMod) as typeof import("multer");

// ─── ALLOWED FILE TYPES ───────────────────────────────────────────────────────
// Strict allowlists (mime type AND extension must both match) — anything not
// explicitly listed here is rejected before the file ever touches disk or
// Cloudinary. Each endpoint only allows the types the app actually uses today
// so existing features keep working without opening the door to arbitrary
// file uploads (executables, scripts, etc).

// POST /api/upload (Cloudinary) — used exclusively by the admin CMS pages
// (banners, hero, offers, branding, services) for images and short promo
// videos.
const CLOUDINARY_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "video/mp4",
  "video/webm",
]);
const CLOUDINARY_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
]);

// POST /api/upload/user (local disk) — used by customer/technician-facing
// features: chat images, request photos, profile photos, technician ID
// documents, price-adjustment photos, and voice notes (recorded or uploaded)
// on new service requests.
const LOCAL_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  // HEIC/HEIF: iOS Photos library returns these MIME types when picking images.
  // The Expo client normalises them to image/jpeg in edit-profile, but belt-and-suspenders.
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
]);
const LOCAL_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".mp3",
  ".wav",
  ".webm",
  ".m4a",
]);

function makeFileFilter(allowedMimeTypes: Set<string>, allowedExtensions: Set<string>) {
  return (
    _req: import("express").Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mimeOk = allowedMimeTypes.has((file.mimetype || "").toLowerCase());
    // A blob upload (e.g. a live voice recording) may have no extension in
    // its originalname — in that case rely on the mime type alone. If a
    // filename with an extension is present, the extension must also match.
    const extOk = ext === "" || allowedExtensions.has(ext);
    if (mimeOk && extOk) {
      cb(null, true);
      return;
    }
    cb(new Error("نوع الملف غير مدعوم"), false);
  };
}

const router = Router();

const cloudinaryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: makeFileFilter(CLOUDINARY_ALLOWED_MIME_TYPES, CLOUDINARY_ALLOWED_EXTENSIONS),
});

const localUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: makeFileFilter(LOCAL_ALLOWED_MIME_TYPES, LOCAL_ALLOWED_EXTENSIONS),
});

// Wraps a multer middleware so file-type/size rejections come back as a
// clean 400 instead of an unhandled error bubbling to the default handler.
function handleUpload(mw: import("express").RequestHandler) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    mw(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "فشل رفع الملف" });
        return;
      }
      next();
    });
  };
}

router.post("/upload", authenticate, handleUpload(cloudinaryUpload.single("file")), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق ملف" });

    const { mimetype, buffer } = req.file;

    let resourceType: "image" | "video" | "raw" | "auto" = "auto";
    if (mimetype.startsWith("image/")) resourceType = "image";
    else if (mimetype.startsWith("video/")) resourceType = "video";
    else if (mimetype.startsWith("audio/")) resourceType = "video";

    const result = await uploadToCloudinary(buffer, {
      folder: "fnashha",
      resourceType,
    });

    return res.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "فشل رفع الملف" });
  }
});

router.post("/upload/user", authenticate, handleUpload(localUpload.single("file")), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق ملف" });

    const category = (req.query.category as string) || "requests";
    const urlPath = saveFile(req.file.buffer, req.file.originalname || "file.bin", category);

    return res.json({ url: urlPath, publicId: urlPath, resourceType: "image" });
  } catch (err) {
    console.error("Local upload error:", err);
    return res.status(500).json({ error: "فشل رفع الملف" });
  }
});

export default router;
