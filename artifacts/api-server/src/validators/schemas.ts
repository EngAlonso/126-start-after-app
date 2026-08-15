import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Input-validation schemas for the highest-risk routes (login, registration,
// profile update, request creation). Each schema mirrors exactly the fields
// the corresponding route already reads from req.body — it only enforces
// type/shape/presence, it does not add new business rules (e.g. no new
// password-complexity requirements beyond "non-empty", matching the existing
// manual checks these schemas replace).
//
// Note: @workspace/api-zod has generated schemas for some of these bodies,
// but several are out of sync with the current implementation (e.g.
// CreateRequestBody is missing `audioUrl`, RegisterTechnicianBody requires a
// `governorateIds` field the route never reads). To avoid rejecting valid
// requests or silently dropping fields the routes rely on, these schemas are
// defined directly against actual route behavior instead of importing the
// generated ones.
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  mobile: z.string().trim().min(1, "رقم الهاتف مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const registerCustomerSchema = z.object({
  fullName: z.string().trim().min(1, "الاسم الكامل مطلوب"),
  mobile: z.string().trim().min(1, "رقم الهاتف مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  referredBy: z.string().trim().optional().nullable(),
  deviceId: z.string().trim().optional().nullable(),
});

export const registerTechnicianSchema = z.object({
  fullName: z.string().trim().min(1, "الاسم الكامل مطلوب"),
  mobile: z.string().trim().min(1, "رقم الهاتف مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  nationalId: z.string().trim()
    .min(1, "الرقم القومي مطلوب.")
    .regex(/^\d{14}$/, "يجب أن يتكون الرقم القومي من 14 رقمًا."),
  personalPhoto: z.string().nullish(),
  nationalIdFront: z.string().nullish(),
  nationalIdBack: z.string().nullish(),
  serviceIds: z.array(z.number()).optional(),
  areaIds: z.array(z.number()).optional(),
  primaryAreaId: z.number().nullish(),
  yearsOfExperience: z.union([z.number(), z.string()]).nullish(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().trim().optional().nullable(),
  profileImage: z.string().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  areaIds: z.array(z.number()).optional(),
  serviceIds: z.array(z.number()).optional(),
  yearsOfExperience: z.union([z.number(), z.string()]).nullish(),
});

export const createRequestSchema = z.object({
  serviceId: z.coerce.number({ invalid_type_error: "معرّف الخدمة غير صالح" }),
  fullName: z.string().trim().min(1, "الاسم الكامل مطلوب"),
  mobile: z.string().trim().min(1, "رقم الهاتف مطلوب"),
  governorateId: z.coerce.number({ invalid_type_error: "المحافظة غير صالحة" }),
  areaId: z.coerce.number({ invalid_type_error: "المنطقة غير صالحة" }),
  address: z.string().trim().min(1, "العنوان مطلوب"),
  description: z.string().trim().min(1, "وصف الطلب مطلوب"),
  images: z.array(z.string()).optional(),
  audioUrl: z.string().nullish(),
});
