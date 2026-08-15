import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");

const CATEGORY_DIRS: Record<string, string> = {
  profiles:       "technicians/profiles",
  "national-ids": "technicians/national-ids",
  requests:       "requests",
  offers:         "offers",
  pricing:        "pricing",
  chat:           "chat",
  customers:      "customers",
};

export function getCategoryDir(category: string): string {
  const subdir = CATEGORY_DIRS[category] ?? category;
  const dir = path.join(UPLOADS_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveFile(
  buffer: Buffer,
  originalName: string,
  category: string
): string {
  const dir = getCategoryDir(category);
  const ext = path.extname(originalName) || ".bin";
  const filename = `${randomUUID()}${ext}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  const relative = path.relative(UPLOADS_DIR, filepath).replace(/\\/g, "/");
  return `/uploads/${relative}`;
}

export function getFilePath(urlPath: string): string | null {
  if (!urlPath.startsWith("/uploads/")) return null;
  const relative = urlPath.slice("/uploads/".length);
  return path.join(UPLOADS_DIR, relative);
}

export function ensureUploadDirs(): void {
  for (const subdir of Object.values(CATEGORY_DIRS)) {
    fs.mkdirSync(path.join(UPLOADS_DIR, subdir), { recursive: true });
  }
}
