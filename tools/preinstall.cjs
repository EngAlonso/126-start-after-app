#!/usr/bin/env node
// Cross-platform preinstall guard (Windows CMD/PowerShell/Git Bash, macOS, Linux, Replit).
// Enforces pnpm usage and removes stray lockfiles from other package managers.
// Kept dependency-free (only Node core APIs) since it runs before `pnpm install`
// has linked any node_modules.
"use strict";

const fs = require("node:fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Ignore — file may not exist or may be locked; not fatal either way.
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
