import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListRequestsQueryKey,
  getGetRequestQueryKey,
  getListOffersQueryKey,
  getListMessagesQueryKey,
  getListConversationsQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { applyIncomingUpdate } from "@/lib/maintenance-client";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Shared, cached query key for "list requests with no filters"
const REQUESTS_LIST_KEY = getListRequestsQueryKey();
const CONVERSATIONS_KEY = getListConversationsQueryKey();
const NOTIFICATIONS_KEY = getListNotificationsQueryKey();

export function useUserEvents() {
  const { token, currentUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const qcRef = useRef(qc);
  const isFirstOpen = useRef(true);

  useEffect(() => { toastRef.current = toast; qcRef.current = qc; });

  useEffect(() => {
    // Works for customers and technicians (not admins — they use useAdminEvents)
    if (!token || !currentUser) return;
    const role = (currentUser as any).role;
    if (role === "admin" || role === "super_admin") return;

    const url = `${BASE_URL}/api/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    // ── On (re)connect: sync any missed state ──────────────────────────────
    es.onopen = () => {
      if (isFirstOpen.current) {
        isFirstOpen.current = false;
        return; // First connect — no missed events to sync
      }
      // Reconnect after drop — generic full refresh of all cached queries
      // (not a hardcoded subset) so any page catches up on whatever it missed.
      qcRef.current.invalidateQueries();
    };

    // ── Event handlers ─────────────────────────────────────────────────────

    // New request arrived in a technician's area (technician side)
    es.addEventListener("request_created", () => {
      // Invalidate the base key — React Query partial matching cascades to sub-keys.
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      // Also invalidate filtered keys used by technician/requests.tsx explicitly
      // so the page refreshes immediately via SSE instead of waiting for the
      // 20-second refetchInterval fallback.
      qcRef.current.invalidateQueries({ queryKey: getListRequestsQueryKey({ status: "pending" } as any) });
      qcRef.current.invalidateQueries({ queryKey: getListRequestsQueryKey({ status: "offers_received" } as any) });
      toastRef.current({ title: "طلب خدمة جديد", description: "يوجد طلب خدمة جديد في منطقتك", duration: 5000 });
    });

    // Customer receives a new offer from a technician
    es.addEventListener("offer_received", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "عرض سعر جديد", description: "قدّم فني عرض سعر على طلبك", duration: 5000 });
    });

    // Customer receives an updated offer
    es.addEventListener("offer_updated", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
    });

    // Technician's offer was selected by customer
    es.addEventListener("offer_selected", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      // The request is now in "technician_selected" status — remove it from the
      // "pending" / "offers_received" technician list immediately.
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      qcRef.current.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      toastRef.current({ title: "🎉 تم قبول عرضك!", description: "اختار العميل عرضك — ابدأ التواصل معه الآن", duration: 6000 });
    });

    // Technician's offer was rejected (another was selected)
    es.addEventListener("offer_rejected", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
    });

    // Customer is notified that a technician withdrew their offer
    es.addEventListener("offer_withdrawn", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListOffersQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "تم سحب عرض", description: "قام أحد الفنيين بسحب عرضه", duration: 4000 });
    });

    // Request was edited by its owner (customer) — refresh details/lists for
    // any technician who can see it, or the selected technician
    es.addEventListener("request_updated", (e) => {
      const { id } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
    });

    // Account status changed by an admin (ban/suspend/activate/delete)
    es.addEventListener("account_status_changed", (e) => {
      const { status } = JSON.parse(e.data);
      if (status === "banned" || status === "suspended" || status === "deleted") {
        toastRef.current({ title: "تم تحديث حسابك", description: "يرجى التواصل مع الدعم لمزيد من المعلومات", duration: 6000 });
      }
    });

    // Technician approval status changed by an admin
    es.addEventListener("technician_status_changed", (e) => {
      const { approvalStatus } = JSON.parse(e.data);
      if (approvalStatus === "approved") {
        toastRef.current({ title: "تم قبول حسابك 🎉", description: "يمكنك الآن تقديم عروض على الطلبات", duration: 6000 });
      } else if (approvalStatus === "rejected") {
        toastRef.current({ title: "تم رفض طلب التسجيل", description: "يرجى مراجعة التفاصيل في حسابك", duration: 6000 });
      }
    });

    // A support ticket the user owns was updated by an admin
    es.addEventListener("support_ticket_updated", () => {
      qcRef.current.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });

    // Any new notification was created for this user — refresh bell/list instantly
    es.addEventListener("new_notification", () => {
      qcRef.current.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });

    // Platform credit created/paid for this technician — refresh the request's
    // platform-credit summary live (technician/request-detail.tsx) with no reload.
    es.addEventListener("platform_credit_updated", (e) => {
      const { requestId, status } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: ["platform-credit", requestId] });
      if (status === "paid") {
        toastRef.current({ title: "تم تحويل مستحقك ✅", description: "تم تحويل مستحق إلى حسابك", duration: 5000 });
      } else {
        toastRef.current({ title: "مستحق جديد 💰", description: "تم إضافة مستحق جديد لك من فنشها", duration: 5000 });
      }
    });

    // Either party receives a status change
    es.addEventListener("status_changed", (e) => {
      const { id, status } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      if (status === "completed") {
        toastRef.current({ title: "تم إنهاء الطلب", description: `تم تأكيد إكمال الطلب رقم #${id}`, duration: 5000 });
      } else if (status === "waiting_approval") {
        toastRef.current({ title: "هل تم تنفيذ الخدمة؟", description: "أعلن الفني إتمام العمل — يرجى التأكيد", duration: 6000 });
      }
    });

    // Either party hears of a cancellation
    es.addEventListener("request_cancelled", (e) => {
      const { id } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      qcRef.current.invalidateQueries({ queryKey: REQUESTS_LIST_KEY });
      toastRef.current({ title: "تم إلغاء الطلب", description: `تم إلغاء الطلب رقم #${id}`, duration: 5000 });
    });

    // Customer receives a price adjustment request from technician
    es.addEventListener("price_adjustment_requested", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      toastRef.current({ title: "طلب تعديل السعر", description: "الفني يطلب تعديل سعر — يرجى المراجعة", duration: 6000 });
    });

    // Technician receives customer's response to price adjustment
    es.addEventListener("price_adjustment_responded", (e) => {
      const { requestId, approved } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
      toastRef.current({
        title: approved ? "تم قبول تعديل السعر" : "تم رفض تعديل السعر",
        description: approved ? "وافق العميل على السعر الجديد" : "رفض العميل السعر الجديد — يستمر العمل بالسعر الأصلي",
        duration: 5000,
      });
    });

    // Wallet/coins updated — instantly refresh coin balance without page reload
    es.addEventListener("wallet_updated", (e) => {
      const { type, coins } = JSON.parse(e.data);
      // Invalidate the loyalty wallet query so CoinsBadge + wallet page refresh live
      qcRef.current.invalidateQueries({ queryKey: ["loyalty", "wallet"] });
      if (type === "coins_earned" && coins > 0) {
        toastRef.current({ title: `🪙 تم إضافة ${coins} فنشها كوينز!`, description: "رصيد محفظتك تم تحديثه", duration: 5000 });
      } else if (type === "referral_reward") {
        toastRef.current({ title: "🎁 مكافأة الإحالة!", description: "تم إضافة مكافأة إحالة إلى محفظتك", duration: 5000 });
      } else if (type === "campaign_reward") {
        toastRef.current({ title: "🎉 مكافأة حملة!", description: `تم إضافة ${coins ?? ""} فنشها كوينز إلى محفظتك`, duration: 5000 });
      }
    });

    // Either party receives a new chat message
    es.addEventListener("new_message", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListMessagesQueryKey(requestId) });
      qcRef.current.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      qcRef.current.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });

    // Sender gets notified that recipient has read their messages
    es.addEventListener("messages_read", (e) => {
      const { requestId } = JSON.parse(e.data);
      qcRef.current.invalidateQueries({ queryKey: getListMessagesQueryKey(requestId) });
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
  }, [token, currentUser]);
}
