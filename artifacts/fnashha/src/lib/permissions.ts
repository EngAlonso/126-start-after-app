export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "users",
    label: "العملاء",
    permissions: [
      { key: "users.view", label: "عرض" },
      { key: "users.edit", label: "تعديل" },
      { key: "users.ban", label: "حظر / إيقاف" },
      { key: "delete_users", label: "حذف الحسابات" },
    ],
  },
  {
    group: "technicians",
    label: "الفنيون",
    permissions: [
      { key: "technicians.view", label: "عرض" },
      { key: "technicians.approve", label: "موافقة" },
      { key: "technicians.reject", label: "رفض" },
      { key: "technicians.suspend", label: "إيقاف" },
      { key: "technicians.edit_services", label: "تعديل خدمات الفني" },
      { key: "technicians.edit_areas", label: "تعديل مناطق الفني" },
      { key: "technicians.edit_experience", label: "تعديل خبرة الفني" },
      { key: "technicians.delete", label: "حذف الفني نهائياً" },
    ],
  },
  {
    group: "requests",
    label: "الطلبات",
    permissions: [
      { key: "requests.view", label: "عرض" },
      { key: "requests.edit", label: "تعديل" },
      { key: "requests.change_status", label: "تغيير الحالة" },
    ],
  },
  {
    group: "chats",
    label: "المحادثات",
    permissions: [
      { key: "chats.view", label: "مشاهدة المحادثات" },
    ],
  },
  {
    group: "commissions",
    label: "نطاقات العمولة",
    permissions: [
      { key: "commissions.view", label: "عرض نطاقات العمولة" },
    ],
  },
  {
    group: "points",
    label: "النقاط",
    permissions: [
      { key: "points.view", label: "عرض" },
      { key: "points.add", label: "إضافة" },
      { key: "points.deduct", label: "خصم" },
    ],
  },
  {
    group: "services",
    label: "الخدمات",
    permissions: [
      { key: "services.add", label: "إضافة" },
      { key: "services.edit", label: "تعديل" },
      { key: "services.delete", label: "حذف" },
    ],
  },
  {
    group: "locations",
    label: "المناطق",
    permissions: [
      { key: "locations.add", label: "إضافة" },
      { key: "locations.edit", label: "تعديل" },
      { key: "locations.delete", label: "حذف" },
    ],
  },
  {
    group: "cms",
    label: "إدارة المحتوى",
    permissions: [
      { key: "cms.settings", label: "العلامة التجارية والإعدادات" },
      { key: "cms.homepage", label: "الصفحة الرئيسية" },
      { key: "cms.banners", label: "البانرات" },
      { key: "cms.footer", label: "الفوتر" },
      { key: "offers.manage", label: "إدارة العروض" },
    ],
  },
  {
    group: "seo_pages",
    label: "صفحات محركات البحث",
    permissions: [
      { key: "seo_pages.view", label: "عرض الصفحات المؤهلة" },
    ],
  },
  {
    group: "support",
    label: "الدعم الفني",
    permissions: [
      { key: "support.view", label: "عرض التذاكر" },
      { key: "support.reply", label: "الرد" },
      { key: "support.close", label: "إغلاق التذاكر" },
    ],
  },
  {
    group: "analytics",
    label: "التحليلات",
    permissions: [
      { key: "analytics.view", label: "عرض التقارير" },
      { key: "analytics.export", label: "تصدير التقارير" },
      { key: "activity_logs.view", label: "سجل الأنشطة" },
    ],
  },
  {
    group: "backup",
    label: "النسخ الاحتياطية",
    permissions: [
      { key: "backup.create", label: "إنشاء نسخة احتياطية" },
      { key: "backup.download", label: "تنزيل النسخ الاحتياطية" },
      { key: "backup.restore", label: "استعادة نسخة احتياطية" },
      { key: "backup.delete", label: "حذف النسخ الاحتياطية" },
    ],
  },
  {
    group: "loyalty",
    label: "نظام الولاء",
    permissions: [
      { key: "loyalty.view",   label: "عرض لوحة الولاء والمحافظ والإحالات" },
      { key: "loyalty.manage", label: "تعديل المحافظ وإدارة الحملات" },
    ],
  },
  {
    group: "invoices",
    label: "الفواتير",
    permissions: [
      { key: "invoices.view_customer",      label: "عرض فاتورة العميل" },
      { key: "invoices.print_customer",     label: "طباعة فاتورة العميل" },
      { key: "invoices.download_customer",  label: "تنزيل فاتورة العميل (PDF)" },
      { key: "invoices.whatsapp_customer",  label: "إرسال فاتورة العميل عبر واتساب" },
      { key: "invoices.view_technician",    label: "عرض إشعار تسوية الفني" },
      { key: "invoices.print_technician",   label: "طباعة إشعار تسوية الفني" },
      { key: "invoices.download_technician",label: "تنزيل إشعار تسوية الفني (PDF)" },
      { key: "invoices.whatsapp_technician",label: "إرسال إشعار تسوية الفني عبر واتساب" },
    ],
  },
  {
    group: "admin",
    label: "إدارة الموظفين",
    permissions: [
      { key: "admin.create", label: "إنشاء مديرين" },
      { key: "admin.edit", label: "تعديل المديرين" },
      { key: "admin.delete", label: "حذف المديرين" },
      { key: "admin.permissions", label: "إدارة الصلاحيات" },
      { key: "offers.submit_on_behalf", label: "تقديم عروض بالنيابة" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

export function getPermissionLabel(key: string): string {
  for (const group of PERMISSION_GROUPS) {
    const found = group.permissions.find((p) => p.key === key);
    if (found) return `${group.label} — ${found.label}`;
  }
  return key;
}
