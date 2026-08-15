export const REQUEST_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار العروض", color: "bg-yellow-100 text-yellow-800" },
  offers_received: { label: "تم استلام عروض", color: "bg-blue-100 text-blue-800" },
  technician_selected: { label: "تم اختيار الفني", color: "bg-purple-100 text-purple-800" },
  in_progress: { label: "جاري التنفيذ", color: "bg-indigo-100 text-indigo-800" },
  price_change_requested: { label: "طلب تعديل سعر", color: "bg-orange-100 text-orange-800" },
  waiting_approval: { label: "في انتظار الموافقة", color: "bg-orange-100 text-orange-800" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800" },
  cancelled_by_customer: { label: "ملغي من العميل", color: "bg-red-100 text-red-800" },
  cancelled_by_technician: { label: "ملغي من الفني", color: "bg-red-100 text-red-800" },
  cancelled_by_admin: { label: "ملغي بواسطة الإدارة", color: "bg-red-100 text-red-800" },
  disputed: { label: "متنازع عليه", color: "bg-red-200 text-red-900" },
};

export const OFFER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800" },
  selected: { label: "تم الاختيار", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
  withdrawn: { label: "مسحوب", color: "bg-gray-100 text-gray-600" },
};

export const TICKET_STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: "مفتوح", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "قيد المعالجة", color: "bg-yellow-100 text-yellow-800" },
  resolved: { label: "محلول", color: "bg-green-100 text-green-800" },
  closed: { label: "مغلق", color: "bg-gray-100 text-gray-600" },
};

export const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "معتمد", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
};
