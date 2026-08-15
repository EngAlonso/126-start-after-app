// Loads a local .env file (repo root) into process.env for local
// Windows/macOS/Linux development. On Replit (and in production), the real
// environment already provides these values via Secrets, and dotenv never
// overwrites a variable that's already set — so this is a no-op there.
//
// Resolved relative to this file (not process.cwd()) so it works no matter
// which directory the process is started from (`pnpm run dev` from the
// package dir, `pnpm --filter ... run dev` from the repo root, etc).
//
// esbuild bundles this module into dist/index.mjs, and bundling collapses
// every merged module's `import.meta.url` to the URL of that single output
// file — so at runtime this always resolves relative to
// artifacts/api-server/dist/index.mjs, three directories below the repo
// root, regardless of where this source file originally lived.
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");

config({ path: path.join(repoRoot, ".env") });
