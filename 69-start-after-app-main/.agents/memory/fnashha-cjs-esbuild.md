---
name: Fnashha CJS packages in ESM esbuild build
description: How to import CJS-only npm packages (archiver, adm-zip, multer) in the ESM esbuild API server build.
---

## Rule
CJS-only packages that esbuild cannot resolve a default export for must be:
1. Added to the `external` array in `artifacts/api-server/build.mjs`
2. Imported via `createRequire` in the route file (not `import X from "X"`)

## Why
The API server builds to ESM format (`format: "esm"` in build.mjs). esbuild v0.27+ with strict ESM output fails at build-time if it can't find a `default` export in a CJS package (e.g. `archiver@8`, `adm-zip`, `multer`). Even if build passes, Node.js v24 ESM runtime throws "does not provide an export named 'default'" for these packages.

## How to Apply
In the route file:
```typescript
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const archiver = _require("archiver") as (format: string, options?: object) => import("archiver").Archiver;
const AdmZip = _require("adm-zip") as typeof import("adm-zip");
const multer = _require("multer") as typeof import("multer");
```
In `build.mjs` external array, add the package names: `"archiver"`, `"adm-zip"`, `"multer"`.

Packages with proper ESM exports (e.g. `xlsx`/SheetJS) can still use `import * as XLSX from "xlsx"` normally.
