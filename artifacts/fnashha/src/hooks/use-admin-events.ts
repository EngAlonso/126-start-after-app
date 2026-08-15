import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListRequestsQueryKey,
  getGetRequestQueryKey,
  getListOffersQueryKey,
  getListPendingTechniciansQueryKey,
  getListTicketsQueryKey,
  getGetAnalyticsOverviewQueryKey,
  getListConversationsQueryKey,
  getListNotificationsQueryKey,
  getListUsersQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { applyIncomingUpdate } from "@/lib/maintenance-client";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const REQUESTS_LIST_KEY = getListRequestsQueryKey();
const CONVERSATIONS_KEY = getListConversationsQueryKey();
const NOTIFICATIONS_KEY = getListNotificationsQueryKey();

export function useAdminEvents() {
  const { token, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const qcRef = useRef(qc);
  const isFirstOpen = useRef(true);
  useEffect(() => { toastRef.current = toast; qcRef.current = qc; });

  useEffect(() => {
    if (!token || (!isAdmin && !isSuperAdmin)) return;

    const url = `${BASE_URL}/api/admin/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    // On reconnect: sync any missed state — generic full refresh of all cached
    // queries (not a hardcoded subset) so any page that may have missed events
    // while the connection was down catches up automatically.
    es.onopen = () => {
      if (isFirstOpen.current) { isFirstOpen.current = false; return; }
      qcRef.current.invalidateQueries();
    };

    const invalidateAnalytics = () =>
      qcRef.current.invalidateQueries({ queryKey: getGetAnalyticsOverviewQueryKey() });

    // ── Technician & support events ─────────────────────────────────────────

    es.addEventListener("new_request", () => {
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      invalidateAnalytics();
      toastRef.current({ title: "طلب خدمة جديد", description: "تم استلام طلب خدمة جديد من عميل", duration: 5000 });
    });

    es.addEventListener("new_technician", () => {
      qcRef.current.invalidateQueries({ queryKey: getListPendingTechniciansQueryKey() });
      toastRef.current({ title: "تسجيل فني جديد", description: "فني جديد ينتظر الموافقة على تسجيله", duration: 5000 });
    });

    es.addEventListener("new_support_ticket", () => {
      qcRef.current.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      toastRef.current({ title: "تذكرة دعم جديدة", description: "تم فتح تذكرة دعم جديدة", duration: 5000 });
    });

    es.addEventListener("new_support_reply", () => {
      qcRef.current.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      toastRef.current({ title: "رد جديد على تذكرة", description: "رد عميل على تذكرة دعم — يحتاج ردّاً", duration: 5000 });
    });

    // ── Request status events ───────────────────────────────────────────────

    es.addEventListener("status_changed", (e) => {
      const { id, status } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      invalidateAnalytics();
      if (status === "completed") {
        toastRef.current({ title: "تم إنهاء الطلب", description: `تم تأكيد إكمال الطلب رقم #${id}`, duration: 5000 });
      } else if (status === "waiting_approval") {
        toastRef.current({ title: "بانتظار تأكيد العميل", description: `الطلب #${id} — الفني أعلن الإتمام`, duration: 5000 });
      } else if (status === "in_progress") {
        qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      }
    });

    es.addEventListener("request_cancelled", (e) => {
      const { id } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      invalidateAnalytics();
      toastRef.current({ title: "تم إلغاء الطلب", description: `تم إلغاء الطلب رقم #${id}`, duration: 5000 });
    });

    es.addEventListener("request_updated", (e) => {
      const { id } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
    });

    // ── Offer events ────────────────────────────────────────────────────────

    es.addEventListener("new_offer", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "عرض سعر جديد", description: `فني قدّم عرضاً على الطلب #${requestId}`, duration: 4000 });
    });

    es.addEventListener("offer_selected", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      qcRef.current.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      toastRef.current({ title: "تم اختيار فني", description: `العميل اختار فنياً للطلب #${requestId}`, duration: 5000 });
    });

    es.addEventListener("offer_rejected", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
    });

    es.addEventListener("offer_updated", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
    });

    es.addEventListener("offer_withdrawn", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "تم سحب عرض", description: `فني سحب عرضه على الطلب #${requestId}`, duration: 4000 });
    });

    // ── Account / technician registration events ───────────────────────────

    es.addEventListener("account_status_changed", () => {
      qcRef.current.invalidateQueries({ queryKey: getListUsersQueryKey() });
    });

    es.addEventListener("technician_status_changed", () => {
      qcRef.current.invalidateQueries({ queryKey: getListPendingTechniciansQueryKey() });
      qcRef.current.invalidateQueries({ queryKey: getListUsersQueryKey() });
    });

    es.addEventListener("support_ticket_updated", () => {
      qcRef.current.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    });

    es.addEventListener("new_notification", () => {
      qcRef.current.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });

    // ── Price adjustment events ─────────────────────────────────────────────

    es.addEventListener("price_adjustment_requested", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "طلب تعديل سعر", description: `الفني طلب تعديل السعر للطلب #${requestId}`, duration: 5000 });
    });

    // ── Platform credits settled — refresh badge count ──────────────────────
    es.addEventListener("platform_credit_updated", () => {
      invalidateAnalytics();
    });

    es.addEventListener("price_adjustment_responded", (e) => {
      const { requestId, approved } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({
        title: approved ? "تم قبول تعديل السعر" : "تم رفض تعديل السعر",
        description: `العميل ${approved ? "قبل" : "رفض"} التعديل للطلب #${requestId}`,
        duration: 5000,
      });
    });

    // ── Chat events ─────────────────────────────────────────────────────────

    es.addEventListener("new_message", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      qcRef.current.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      if (requestId) {
        qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
        // Also refresh the message list if an admin has the conversation open
        qcRef.current.invalidateQueries({ queryKey: getListMessagesQueryKey(requestId) });
      }
    });

    // ── System Maintenance: new frontend version deployed ──────────────────
    es.addEventListener("sw_update_available", () => {
      toastRef.current({ title: "تحديث جديد متاح", description: "جاري تحديث التطبيق تلقائياً...", duration: 4000 });
      setTimeout(() => { applyIncomingUpdate(); }, 1500);
    });

    es.onerror = () => {
      // EventSource auto-reconnects; onopen fires again on reconnect and syncs state
    };

    return () => {
      es.close();
      isFirstOpen.current = true;
    };
  }, [token, isAdmin, isSuperAdmin]);
}
