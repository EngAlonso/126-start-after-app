import { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Generic body-validation middleware. Parses req.body against the given Zod
// schema; on success, req.body is replaced with the parsed (typed, trimmed,
// coerced) value so downstream handlers see clean data. On failure, responds
// 400 with a field-level error list instead of letting malformed input reach
// business logic (and potentially crash the route with a 500).
//
// This only validates shape/type — it does not change any business rules,
// permissions, or response formats.
// ─────────────────────────────────────────────────────────────────────────────
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "بيانات غير صالحة",
        details: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
