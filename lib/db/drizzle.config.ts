import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL (or NEON_DATABASE_URL) must be set. Ensure the database is provisioned");
}

const isNeon = !process.env.DATABASE_URL && !!process.env.NEON_DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: isNeon ? "require" : undefined,
  },
});
