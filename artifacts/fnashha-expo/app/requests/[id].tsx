import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Image, Modal,
  KeyboardAvoidingView, Platform, Pressable, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import type { PriceAdjustment } from '@/types';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useAuthedFetch, apiFetch, apiUrl, resolveMediaUrl } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonList } from '@/components/SkeletonCard';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StarRating } from '@/components/StarRating';
import type { ServiceRequest, Offer, LoyaltyWallet } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

const STATUS_LABELS: Record<string, string> = {
  pending:                 'Published',
  offers_received:         'Awaiting Offers',
  technician_selected:     'Offer Accepted',
  in_progress:             'In Progress',
  waiting_approval:        'Awaiting Customer Approval',
  price_change_requested:  'Price Adjustment',
  completed:               'Completed',
  cancelled:               'Cancelled',
  cancelled_by_customer:   'Cancelled by Customer',
  cancelled_by_technician: 'Cancelled by Technician',
  cancelled_by_admin:      'Cancelled by Admin',
  rejected:                'Rejected',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  pending:                 { bg: '#EFF6FF', text: '#1D4ED8', icon: 'send' },
  offers_received:         { bg: '#F5F3FF', text: '#6D28D9', icon: 'tag' },
  technician_selected:     { bg: '#FFF4ED', text: '#C2410C', icon: 'user-check' },
  in_progress:             { bg: '#EEF2FF', text: '#4338CA', icon: 'tool' },
  waiting_approval:        { bg: '#FFFBEB', text: '#B45309', icon: 'alert-circle' },
  price_change_requested:  { bg: '#ECFEFF', text: '#0E7490', icon: 'refresh-cw' },
  completed:               { bg: '#F0FDF4', text: '#15803D', icon: 'check-circle' },
  cancelled:               { bg: '#FEF2F2', text: '#991B1B', icon: 'x-circle' },
  cancelled_by_customer:   { bg: '#FEF2F2', text: '#991B1B', icon: 'x-circle' },
  cancelled_by_technician: { bg: '#FEF2F2', text: '#991B1B', icon: 'x-circle' },
  cancelled_by_admin:      { bg: '#FEF2F2', text: '#991B1B', icon: 'x-circle' },
  rejected:                { bg: '#FEF2F2', text: '#991B1B', icon: 'slash' },
};

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();
  const { get: getCms } = useCmsSettings();
  const appName = getCms(CMS_KEYS.APP_NAME, BRAND.NAME);
  const { locale, isRTL } = useLocale();
  const t = translations[locale];

  const [offerPrice, setOfferPrice] = useState('');
  const [offerParts, setOfferParts] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);

  // Edit-offer state (for the "My Offer" inline edit form)
  const [editingOffer, setEditingOffer] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editParts, setEditParts] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingReview, setRatingReview] = useState('');

  // Price change form state (technician → customer flow)
  const [showPriceChangeForm, setShowPriceChangeForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newSpareParts, setNewSpareParts] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adjSupportingImage, setAdjSupportingImage] = useState<string | null>(null);
  const [adjImageUploading, setAdjImageUploading] = useState(false);

  // Edit request state (customer: pending / offers_received)
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [editAddress, setEditAddress] = useState('');
  const [editDescription2, setEditDescription2] = useState('');

  // Price adjustment history (resolved adjustments, not the pending one)
  const [adjHistory, setAdjHistory] = useState<any[]>([]);

  // Cross-platform confirmation (native Alert on iOS/Android, ConfirmDialog on web)
  const { confirm, showAlert, dialogState } = useConfirm();


  const { data: request, isLoading, refetch: refetchRequest } = useQuery<ServiceRequest>({
    queryKey: ['request', id],
    queryFn: () => authedFetch(`/api/requests/${id}`),
    enabled: !!id,
  });

  // Refetch request data every time the screen gains focus (e.g. returning from chat)
  useRefetchOnFocus([refetchRequest]);

  // Platform credit summary (for technician: completed + coin discount)
  const { data: platformCredit } = useQuery<any>({
    queryKey: ['platform-credit', id],
    queryFn: () => authedFetch(`/api/requests/${id}/platform-credit`),
    enabled: !!id && !!request && request.status === 'completed' && !!(request as any).hasDiscount && user?.role === 'technician',
  });

  // Mark related notifications as read when screen mounts (mirrors web)
  useEffect(() => {
    if (!id || !accessToken) return;
    apiFetch(`/api/notifications/read-related`, {
      method: 'POST', token: accessToken,
      body: JSON.stringify({ relatedId: Number(id) }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load price adjustment history (settled adjustments only)
  useEffect(() => {
    if (!id || !accessToken) return;
    apiFetch(`/api/requests/${id}/price-adjustments`, { token: accessToken })
      .then((data: any) => setAdjHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, request?.status]);

  // Customer (and selected technician after selection): fetch all offers for this request.
  // Regular technicians get 403 from this endpoint (privacy — can't see competitors' bids).
  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ['offers', id],
    queryFn: () => authedFetch(`/api/requests/${id}/offers`),
    enabled: !!id && !!request && user?.role !== 'technician',
  });

  // Fetch the latest pending price adjustment (when technician has requested one)
  const { data: pendingAdjustment } = useQuery<PriceAdjustment | null>({
    queryKey: ['price-adjustment', id],
    queryFn: async () => {
      try {
        return await authedFetch(`/api/requests/${id}/price-adjustment`);
      } catch {
        return null;
      }
    },
    enabled: !!id && !!request && request.status === 'price_change_requested',
    staleTime: 10_000,
  });

  // Technicians: fetch only their own offer via the dedicated /offers/my endpoint.
  // This avoids the 403 from the general offers list and gives us live price/notes data.
  const { data: ownOffer } = useQuery<Offer | undefined>({
    queryKey: ['my-offer', id],
    queryFn: async () => {
      const all: Offer[] = await authedFetch('/api/offers/my');
      return all.find(o => String(o.requestId) === String(id));
    },
    enabled: !!id && user?.role === 'technician',
    staleTime: 10_000,
  });

  const submitOffer = useMutation({
    mutationFn: (): Promise<Offer> =>
      apiFetch(`/api/requests/${id}/offers`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ price: Number(offerPrice), spareParts: Number(offerParts) || 0, notes: offerNotes }),
      }),
    onSuccess: (newOffer: Offer) => {
      const offerWithCurrentTechnicianImage: Offer = user?.role === 'technician'
        ? {
            ...newOffer,
            technician: {
              id: user.id,
              fullName: user.fullName,
              profileImage: user.profileImage,
            },
          }
        : newOffer;

      // Immediately write to the technician's own-offer cache —
      // myOffer becomes non-null synchronously, no round-trip needed.
      qc.setQueryData<Offer | undefined>(['my-offer', id], offerWithCurrentTechnicianImage);
      // Also patch the general offers list in case the customer is watching.
      qc.setQueryData<Offer[]>(['offers', id], (prev = []) => [...prev, offerWithCurrentTechnicianImage]);
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.refetchQueries({ queryKey: ['request', id] });
      setShowOfferForm(false);
      setOfferPrice(''); setOfferParts(''); setOfferNotes('');
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const updateOffer = useMutation({
    mutationFn: (vars: { offerId: number; price: number; spareParts: number; notes: string }): Promise<Offer> =>
      apiFetch(`/api/requests/${id}/offers/${vars.offerId}`, {
        method: 'PATCH', token: accessToken,
        body: JSON.stringify({ price: vars.price, spareParts: vars.spareParts, notes: vars.notes }),
      }),
    onSuccess: (updatedOffer: Offer) => {
      // Patch own-offer cache in-place — card re-renders instantly.
      qc.setQueryData<Offer | undefined>(['my-offer', id], (prev) =>
        prev ? { ...prev, ...updatedOffer } : updatedOffer
      );
      // Keep general offers list in sync too.
      qc.setQueryData<Offer[]>(['offers', id], (prev = []) =>
        prev.map(o => o.id === updatedOffer.id ? { ...o, ...updatedOffer } : o)
      );
      // Price change triggers point recalculation on the backend — refresh balance.
      qc.invalidateQueries({ queryKey: ['points-balance'] });
      setEditingOffer(false);
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const withdrawOffer = useMutation({
    mutationFn: (offerId: number) =>
      apiFetch(`/api/requests/${id}/offers/${offerId}/withdraw`, {
        method: 'POST', token: accessToken,
      }),
    onSuccess: () => {
      // Remove the offer from cache immediately — MyOfferCard disappears,
      // submit form reappears (canSubmitOffer && !myOffer becomes true).
      qc.setQueryData<Offer | undefined>(['my-offer', id], undefined);
      // Request status may have reverted to "pending" — force an immediate refetch.
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.refetchQueries({ queryKey: ['request', id] });
      // Reserved points were released — refresh wallet balance everywhere.
      qc.invalidateQueries({ queryKey: ['points-balance'] });
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const selectOffer = useMutation({
    mutationFn: (offerId: number) =>
      apiFetch(`/api/requests/${id}/offers/${offerId}/select`, { method: 'POST', token: accessToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['offers', id] });
      Alert.alert(t.requestDetail.offerAccepted, t.requestDetail.offerAcceptedMsg);
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message),
  });

  const cancelRequest = useMutation({
    mutationFn: () =>
      apiFetch(`/api/requests/${id}/cancel`, { method: 'POST', token: accessToken }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); router.back(); },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // Customer confirms completion (waiting_approval → completed)
  const completeRequest = useMutation({
    mutationFn: () =>
      apiFetch(`/api/requests/${id}/complete`, { method: 'POST', token: accessToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      setShowRatingModal(true);
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // Customer rejects completion (revert to cancelled)
  const rejectCompletion = useMutation({
    mutationFn: () =>
      apiFetch(`/api/requests/${id}/cancel`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ reason: 'لم يتم التنفيذ بشكل صحيح' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      showAlert(t.common.done, t.requestDetail.rejectCompleteContactSupport);
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // Confirmation handlers — native Alert on iOS/Android, ConfirmDialog on web
  const handleConfirmComplete = async () => {
    const ok = await confirm({
      title: t.requestDetail.confirmCompleteDialog,
      message: t.requestDetail.confirmCompleteMsg,
      confirmText: t.requestDetail.confirmComplete,
      cancelText: t.common.cancel,
      destructive: false,
    });
    if (!ok) return;
    completeRequest.mutate();
  };

  const handleRejectCompletion = async () => {
    const ok = await confirm({
      title: t.requestDetail.rejectCompleteDialog,
      message: t.requestDetail.rejectCompleteMsg,
      confirmText: t.requestDetail.rejectCompleteConfirm,
      cancelText: t.common.cancel,
      destructive: true,
    });
    if (!ok) return;
    rejectCompletion.mutate();
  };

  const handleCancelRequest = async () => {
    const ok = await confirm({
      title: t.requestDetail.cancelDialog,
      message: t.requestDetail.cancelMessage,
      confirmText: t.requestDetail.cancelConfirm,
      cancelText: t.common.cancel,
      destructive: true,
    });
    if (!ok) return;
    cancelRequest.mutate();
  };

  // ── Technician: mark job done → sets status to waiting_approval ──────────
  const requestCompletion = useMutation({
    mutationFn: () =>
      apiFetch(`/api/requests/${id}/request-completion`, { method: 'POST', token: accessToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // ── Technician: request a price change ────────────────────────────────────
  const submitPriceChange = useMutation({
    mutationFn: (vars: { newPrice: number; newSpareParts: number; newDescription: string }) =>
      apiFetch(`/api/requests/${id}/price-adjustment`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['price-adjustment', id] });
      setShowPriceChangeForm(false);
      setNewPrice(''); setNewSpareParts(''); setNewDescription(''); setAdjSupportingImage(null);
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // ── Customer: approve or reject the technician's price change ─────────────
  // Backend reads `approved` (boolean), NOT `decision` (string).
  const respondPriceChange = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      apiFetch(`/api/requests/${id}/price-adjustment/respond`, {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ approved: decision === 'approved' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['price-adjustment', id] });
      qc.invalidateQueries({ queryKey: ['points-balance'] });
      // Refresh history so the settled adjustment appears
      apiFetch(`/api/requests/${id}/price-adjustments`, { token: accessToken })
        .then((data: any) => setAdjHistory(Array.isArray(data) ? data : []))
        .catch(() => {});
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // ── Customer: edit request (address / description) — pending / offers_received ──
  const editRequestMutation = useMutation({
    mutationFn: (vars: { address: string; description: string }) =>
      apiFetch(`/api/requests/${id}/edit`, {
        method: 'PATCH', token: accessToken,
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', id] });
      setShowEditRequest(false);
      showAlert(t.common.done, t.requestDetail.editRequestSuccess);
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  const submitRating = useMutation({
    mutationFn: (vars: { stars: number; review: string }) =>
      apiFetch('/api/ratings', {
        method: 'POST', token: accessToken,
        body: JSON.stringify({ requestId: Number(id), technicianId: request?.selectedTechnicianId, ...vars }),
      }),
    onSuccess: () => {
      setShowRatingModal(false);
      Alert.alert(t.requestDetail.thankYou, t.requestDetail.thankYouRating);
    },
    onError: () => Alert.alert(t.common.error, t.requestDetail.ratingFailed),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t.requestDetail.loading} />
        <View style={{ padding: 16 }}><SkeletonList count={4} /></View>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t.requestDetail.loading} />
        <View style={styles.center}><Text style={{ color: colors.mutedForeground }}>{t.requestDetail.notFound}</Text></View>
      </View>
    );
  }

  const isCustomer = user?.role === 'customer';
  const isTech = user?.role === 'technician';
  const canCancel = isCustomer && ['pending', 'offers_received'].includes(request.status);
  const canAcceptOffer = isCustomer && request.status === 'offers_received';
  const canEditRequest = isCustomer && ['pending', 'offers_received'].includes(request.status);
  // Backend accepts offers on both pending and offers_received requests
  const canSubmitOffer = isTech && ['pending', 'offers_received'].includes(request.status);
  // Technicians: use dedicated own-offer query (general offers list returns 403 for them).
  // Customers: derive from the full offers list (they can see all bids).
  const myOffer = isTech ? ownOffer : offers.find(o => o.technicianId === user?.id);
  const isSelectedTech = isTech && (request as any).selectedTechnicianId === user?.id;
  // Hide customer contact details from non-selected technicians — mirrors the backend
  // which already strips mobile from the response, but we guard the cached data too.
  const showPhone = isCustomer || isSelectedTech;
  // Chat is available only to the selected technician, not all technicians (mirrors web)
  const canChat = ['technician_selected', 'in_progress', 'waiting_approval', 'price_change_requested'].includes(request.status) &&
    (isCustomer || isSelectedTech);
  // Technician-specific actions: complete job or request price change (must be selected tech)
  const canTechComplete = isSelectedTech && ['technician_selected', 'in_progress'].includes(request.status);
  const canTechPriceChange = isSelectedTech && ['technician_selected', 'in_progress'].includes(request.status);
  const isPriceChangePending = request.status === 'price_change_requested';
  // Customer: approve/reject pending price change
  const canRespondPriceChange = isCustomer && isPriceChangePending;
  const canComplete = isCustomer && request.status === 'waiting_approval';

  const statusLabel = (t.requestStatus as any)[request.status] ?? STATUS_LABELS[request.status] ?? request.status;
  const price = request.agreedPrice ?? request.customerPayableAmount;

  const statusColor = STATUS_COLORS[request.status] ?? { bg: '#F3F4F6', text: '#374151', icon: 'info' };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t.requestDetail.title(request.id)}
        rightElement={
          <View style={styles.headerRight}>
            <Text style={[styles.headerDate, { color: colors.mutedForeground }]}>
              {fmtDate(request.createdAt, { dateStyle: 'medium' })}
            </Text>
            {canChat && (
              <TouchableOpacity onPress={() => router.push(`/messages/${request.id}` as any)}>
                <Feather name="message-circle" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: (isTech ? TECH_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT) + insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge + price row */}
        <View style={[styles.statusRow, { paddingHorizontal: 16, marginTop: 12, marginBottom: 12 }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Feather name={statusColor.icon as any} size={13} color={statusColor.text} />
            <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>{statusLabel}</Text>
          </View>
          {price && (
            <View style={[styles.priceBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '35' }]}>
              <Text style={[styles.priceBadgeText, { color: colors.primary }]}>{fmtNumber(Number(price))} {t.common.currency}</Text>
            </View>
          )}
        </View>

        {/* in_progress — status notice (for customer) */}
        {request.status === 'in_progress' && isCustomer && (
          <View style={[styles.noticeCard, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginHorizontal: 16, marginBottom: 14 }]}>
            <Feather name="alert-circle" size={18} color="#2563EB" style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: '#1D4ED8' }]}>
              {t.requestDetail.inProgressNotice}
            </Text>
          </View>
        )}

        {/* waiting_approval — status notice (for customer) */}
        {request.status === 'waiting_approval' && isCustomer && (
          <View style={[styles.noticeCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginHorizontal: 16, marginBottom: 14 }]}>
            <Feather name="check-circle" size={18} color="#16A34A" style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: '#15803D' }]}>
              {t.requestDetail.waitingApprovalCustomer}
            </Text>
          </View>
        )}

        {/* waiting_approval — notice for technician */}
        {request.status === 'waiting_approval' && isTech && (
          <View style={[styles.noticeCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginHorizontal: 16, marginBottom: 14 }]}>
            <Feather name="clock" size={18} color="#16A34A" style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: '#15803D' }]}>
              {t.requestDetail.waitingApprovalTech}
            </Text>
          </View>
        )}

        {/* price_change_requested — notice for technician */}
        {isPriceChangePending && isTech && (
          <View style={[styles.noticeCard, { backgroundColor: '#ECFEFF', borderColor: '#A5F3FC', marginHorizontal: 16, marginBottom: 14 }]}>
            <Feather name="refresh-cw" size={18} color="#0E7490" style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: '#0E7490' }]}>
              {t.requestDetail.priceChangePendingTech}
              {pendingAdjustment ? t.requestDetail.priceChangePendingPrice(Number(pendingAdjustment.newPrice).toFixed(2)) : ''}
            </Text>
          </View>
        )}

        {/* Details card */}
        <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <SectionHeader title={t.requestDetail.detailsSection} colors={colors} />
          <RequestInfoCard request={request} colors={colors} showPhone={showPhone} />
        </View>

        {/* Customer: all received offers */}
        {isCustomer && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title={t.requestDetail.offersSection} count={offers.length} colors={colors} />
            {offers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                canAccept={canAcceptOffer}
                onAccept={() => selectOffer.mutate(offer.id)}
                isAccepting={selectOffer.isPending}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* Technician: "My Offer" card — shown as soon as the offer exists */}
        {isTech && myOffer && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title={t.requestDetail.myOfferSection} colors={colors} />
            <MyOfferCard
              offer={myOffer}
              editing={editingOffer}
              editPrice={editPrice}
              editParts={editParts}
              editNotes={editNotes}
              onEditStart={() => {
                setEditPrice(String(Number(myOffer.price)));
                setEditParts(myOffer.spareParts ? String(Number(myOffer.spareParts)) : '');
                setEditNotes(myOffer.notes ?? '');
                setEditingOffer(true);
              }}
              onEditCancel={() => setEditingOffer(false)}
              onEditPrice={setEditPrice}
              onEditParts={setEditParts}
              onEditNotes={setEditNotes}
              onEditSubmit={() => updateOffer.mutate({
                offerId: myOffer.id,
                price: Number(editPrice),
                spareParts: Number(editParts) || 0,
                notes: editNotes,
              })}
              isSaving={updateOffer.isPending}
              onWithdraw={async () => {
                const ok = await confirm({
                  title: t.requestDetail.withdrawDialog,
                  message: t.requestDetail.withdrawMessage,
                  confirmText: t.requestDetail.withdrawConfirm,
                  cancelText: t.common.cancel,
                  destructive: true,
                });
                if (!ok) return;
                withdrawOffer.mutate(myOffer.id);
              }}
              isWithdrawing={withdrawOffer.isPending}
              colors={colors}
            />
          </View>
        )}

        {/* Technician: submit offer form (only when no offer yet) */}
        {canSubmitOffer && !myOffer && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            {!showOfferForm ? (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowOfferForm(true)}
              >
                <Text style={styles.bigBtnText}>{t.requestDetail.submitOfferBtn}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.offerFormCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>{t.requestDetail.offerFormTitle}</Text>
                <FormField label={t.requestDetail.totalPriceLabel} value={offerPrice} onChangeText={setOfferPrice} keyboardType="numeric" colors={colors} />
                <FormField label={t.requestDetail.partsLabel} value={offerParts} onChangeText={setOfferParts} keyboardType="numeric" colors={colors} />
                <FormField label={t.requestDetail.notesLabel} value={offerNotes} onChangeText={setOfferNotes} colors={colors} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={() => setShowOfferForm(false)}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }}>{t.common.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fillBtn, { backgroundColor: colors.primary }]}
                    onPress={() => submitOffer.mutate()}
                    disabled={submitOffer.isPending}
                  >
                    {submitOffer.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold' }}>{t.requestDetail.sendLabel}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Technician action buttons: complete job + price change ── */}
        {canTechComplete && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 10 }}>
            {/* Complete job */}
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#10B981' }]}
              onPress={async () => {
                const ok = await confirm({
                  title: t.requestDetail.confirmCompleteDialog,
                  message: t.requestDetail.confirmCompleteMsg,
                  confirmText: t.requestDetail.confirmComplete,
                  cancelText: t.common.cancel,
                  destructive: false,
                });
                if (!ok) return;
                requestCompletion.mutate();
              }}
              disabled={requestCompletion.isPending || submitPriceChange.isPending}
            >
              {requestCompletion.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.bigBtnText}>{t.requestDetail.techDoneBtn}</Text></>}
            </TouchableOpacity>

            {/* Price change toggle */}
            {!showPriceChangeForm ? (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: '#0891B2' }]}
                onPress={() => {
                  const currentPrice = request.agreedPrice ?? '';
                  setNewPrice(currentPrice ? String(Number(currentPrice)) : '');
                  setNewSpareParts('');
                  setNewDescription('');
                  setShowPriceChangeForm(true);
                }}
                disabled={requestCompletion.isPending}
              >
                <Feather name="refresh-cw" size={18} color="#fff" />
                <Text style={styles.bigBtnText}>{t.requestDetail.priceChangeBtn}</Text>
              </TouchableOpacity>
            ) : (
              /* Price change form */
              <View style={[styles.offerFormCard, { backgroundColor: colors.card, borderColor: '#A5F3FC', borderWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Feather name="refresh-cw" size={16} color="#0891B2" />
                  <Text style={[styles.formTitle, { color: colors.foreground, fontSize: 15 }]}>{t.requestDetail.priceChangeFormTitle}</Text>
                </View>
                <FormField
                  label={t.requestDetail.newPriceLabel}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="numeric"
                  colors={colors}
                />
                <FormField
                  label={t.requestDetail.newPartsLabel}
                  value={newSpareParts}
                  onChangeText={setNewSpareParts}
                  keyboardType="numeric"
                  colors={colors}
                />
                <FormField
                  label={t.requestDetail.priceReasonLabel}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  colors={colors}
                />
                {/* Supporting image upload (mirrors web) */}
                <View style={{ gap: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>{t.requestDetail.supportingImageLabel}</Text>
                  {adjSupportingImage ? (
                    <View style={{ position: 'relative', width: '100%' }}>
                      <Image
                        source={{ uri: adjSupportingImage.startsWith('http') ? adjSupportingImage : apiUrl(adjSupportingImage) }}
                        style={{ width: '100%', height: 140, borderRadius: 10, borderWidth: 1, borderColor: '#A5F3FC' }}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setAdjSupportingImage(null)}
                      >
                        <Feather name="x" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.outlineBtn, { borderColor: '#A5F3FC', borderStyle: 'dashed', borderWidth: 2, flexDirection: 'row', gap: 8, paddingVertical: 14 }]}
                      onPress={async () => {
                        try {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== 'granted') { showAlert(t.common.error, t.requestDetail.uploadPermission); return; }
                          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
                          if (result.canceled || !result.assets?.[0]) return;
                          setAdjImageUploading(true);
                          const asset = result.assets[0];
                          const formData = new FormData();
                          formData.append('file', { uri: asset.uri, name: 'pricing.jpg', type: 'image/jpeg' } as any);
                          const uploadRes = await fetch(apiUrl('/api/upload/user?category=pricing'), {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${accessToken}` },
                            body: formData,
                          });
                          const uploadData = await uploadRes.json();
                          if (!uploadRes.ok) throw new Error(uploadData.error || t.requestDetail.uploadFailed);
                          setAdjSupportingImage(uploadData.url || uploadData.path || uploadData.secure_url);
                        } catch (e: any) {
                          showAlert(t.common.error, e.message || t.requestDetail.uploadFailed);
                        } finally {
                          setAdjImageUploading(false);
                        }
                      }}
                      disabled={adjImageUploading}
                    >
                      {adjImageUploading
                        ? <ActivityIndicator color="#0891B2" size="small" />
                        : <><Feather name="image" size={16} color="#0891B2" /><Text style={{ color: '#0891B2', fontFamily: 'Cairo_500Medium' }}>{t.requestDetail.addImageBtn}</Text></>}
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.formBtns}>
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: colors.border }]}
                    onPress={() => { setShowPriceChangeForm(false); setAdjSupportingImage(null); }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }}>{t.common.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fillBtn, { backgroundColor: '#0891B2' }]}
                    onPress={() => {
                      if (!newPrice || Number(newPrice) <= 0) {
                        showAlert(t.common.error, t.requestDetail.enterNewPrice);
                        return;
                      }
                      submitPriceChange.mutate({
                        newPrice: Number(newPrice),
                        newSpareParts: Number(newSpareParts) || 0,
                        newDescription,
                        ...(adjSupportingImage ? { supportingImage: adjSupportingImage } : {}),
                      } as any);
                    }}
                    disabled={submitPriceChange.isPending || adjImageUploading}
                  >
                    {submitPriceChange.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold' }}>{t.requestDetail.sendToCustomer}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Customer: approve or reject the technician's price change ── */}
        {canRespondPriceChange && (
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            {/* Price comparison card (mirrors web's old vs new table) */}
            <View style={[{ backgroundColor: '#ECFEFF', borderColor: '#A5F3FC', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14, gap: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Feather name="refresh-cw" size={16} color="#0E7490" />
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: '#0E7490' }}>{t.requestDetail.priceComparisonTitle}</Text>
              </View>
              {pendingAdjustment && (
                <>
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#A5F3FC', paddingBottom: 6, marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: '#6B7280', flex: 1 }}>{t.requestDetail.priceCompareItem}</Text>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: '#6B7280', width: 80, textAlign: 'center' }}>{t.requestDetail.priceCompareOriginal}</Text>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: '#C2410C', width: 80, textAlign: 'center' }}>{t.requestDetail.priceCompareNew}</Text>
                  </View>
                  {/* Service price row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: '#374151', flex: 1 }}>{t.requestDetail.priceServiceRow}</Text>
                    <Text style={{ fontFamily: 'Cairo_500Medium', fontSize: 13, color: '#374151', width: 80, textAlign: 'center' }}>{Number((pendingAdjustment as any).oldPrice || 0) > 0 ? `${Number((pendingAdjustment as any).oldPrice).toFixed(0)} ${t.common.currency}` : '—'}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#C2410C', width: 80, textAlign: 'center' }}>{Number(pendingAdjustment.newPrice || 0) > 0 ? `${Number(pendingAdjustment.newPrice).toFixed(0)} ${t.common.currency}` : '—'}</Text>
                  </View>
                  {/* Spare parts row — only when either value is non-zero */}
                  {(Number((pendingAdjustment as any).oldSpareParts || 0) > 0 || Number((pendingAdjustment as any).newSpareParts || 0) > 0) && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: '#374151', flex: 1 }}>{t.requestDetail.pricePartsRow}</Text>
                      <Text style={{ fontFamily: 'Cairo_500Medium', fontSize: 13, color: '#374151', width: 80, textAlign: 'center' }}>{Number((pendingAdjustment as any).oldSpareParts || 0) > 0 ? `${Number((pendingAdjustment as any).oldSpareParts).toFixed(0)} ${t.common.currency}` : '—'}</Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#C2410C', width: 80, textAlign: 'center' }}>{Number((pendingAdjustment as any).newSpareParts || 0) > 0 ? `${Number((pendingAdjustment as any).newSpareParts).toFixed(0)} ${t.common.currency}` : '—'}</Text>
                    </View>
                  )}
                  {/* Total row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#A5F3FC', paddingTop: 8, marginTop: 4 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#0E7490', flex: 1 }}>{t.requestDetail.priceTotal}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#374151', width: 80, textAlign: 'center' }}>{(Number((pendingAdjustment as any).oldPrice || 0) + Number((pendingAdjustment as any).oldSpareParts || 0)).toFixed(0)} {t.common.currency}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#C2410C', width: 80, textAlign: 'center' }}>{(Number(pendingAdjustment.newPrice || 0) + Number((pendingAdjustment as any).newSpareParts || 0)).toFixed(0)} {t.common.currency}</Text>
                  </View>
                  {/* Reason */}
                  {(pendingAdjustment as any).newDescription && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#A5F3FC', marginTop: 4 }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: '#6B7280', marginBottom: 2 }}>{t.requestDetail.adjReason}:</Text>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: '#374151' }}>{(pendingAdjustment as any).newDescription}</Text>
                    </View>
                  )}
                  {/* Supporting image */}
                  {(pendingAdjustment as any).supportingImage && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'auto' }}>{t.requestDetail.supportingImageLabel}:</Text>
                      <Image
                        source={{ uri: (pendingAdjustment as any).supportingImage.startsWith('http') ? (pendingAdjustment as any).supportingImage : apiUrl((pendingAdjustment as any).supportingImage) }}
                        style={{ width: '100%', height: 160, borderRadius: 10, borderWidth: 1, borderColor: '#A5F3FC' }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Approve / Reject */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: '#10B981' }]}
                onPress={async () => {
                  const ok = await confirm({
                    title: t.requestDetail.approvePriceDialog,
                    message: t.requestDetail.approvePriceMsg,
                    confirmText: t.requestDetail.approvePriceConfirm,
                    cancelText: t.common.cancel,
                    destructive: false,
                  });
                  if (!ok) return;
                  respondPriceChange.mutate('approved');
                }}
                disabled={respondPriceChange.isPending}
              >
                {respondPriceChange.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.bigBtnText}>{t.requestDetail.approvePrice}</Text></>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={async () => {
                  const ok = await confirm({
                    title: t.requestDetail.rejectPriceDialog,
                    message: t.requestDetail.rejectPriceMsg,
                    confirmText: t.requestDetail.rejectPriceConfirm,
                    cancelText: t.common.cancel,
                    destructive: true,
                  });
                  if (!ok) return;
                  respondPriceChange.mutate('rejected');
                }}
                disabled={respondPriceChange.isPending}
              >
                {respondPriceChange.isPending
                  ? <ActivityIndicator color="#EF4444" size="small" />
                  : <><Feather name="x-circle" size={18} color="#EF4444" /><Text style={[styles.bigBtnText, { color: '#EF4444' }]}>{t.requestDetail.rejectPrice}</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Coin redemption — self-contained; shows only if loyalty is enabled in config */}
        {canComplete && isCustomer && (
          <CoinRedemptionSection reqId={Number(id)} req={request} colors={colors} accessToken={accessToken} />
        )}

        {/* Platform Credit Summary — technician view, completed with coin discount (mirrors web tech detail) */}
        {request.status === 'completed' && isSelectedTech && platformCredit?.hasCoinDiscount && (
          <View style={[styles.paymentCard, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginHorizontal: 16, marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="credit-card" size={16} color="#2563EB" />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: '#1D4ED8' }}>{t.requestDetail.priceSummaryTitle}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentValue, { color: '#374151' }]}>{platformCredit.agreedPrice?.toFixed(2)} {t.common.currency}</Text>
              <Text style={[styles.paymentLabel, { color: '#6B7280' }]}>{t.requestDetail.priceSummaryOriginal}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentValue, { color: '#C2410C' }]}>−{platformCredit.platformCreditAmount?.toFixed(2)} {t.common.currency}</Text>
              <Text style={[styles.paymentLabel, { color: '#C2410C' }]}>{t.requestDetail.priceSummaryCoinDiscount(appName)}</Text>
            </View>
            <View style={[styles.paymentRow, styles.paymentTotal, { borderTopColor: '#93C5FD' }]}>
              <Text style={[styles.paymentValue, { color: '#1D4ED8', fontFamily: 'Cairo_700Bold', fontSize: 16 }]}>{platformCredit.customerPayableAmount?.toFixed(2)} {t.common.currency}</Text>
              <Text style={[styles.paymentLabel, { color: '#1E3A8A', fontFamily: 'Cairo_700Bold' }]}>{t.requestDetail.priceSummaryCollect}</Text>
            </View>
            <View style={[styles.paymentRow]}>
              <Text style={[styles.paymentValue, { color: '#16A34A', fontFamily: 'Cairo_700Bold' }]}>+{platformCredit.platformCreditAmount?.toFixed(2)} {t.common.currency}</Text>
              <Text style={[styles.paymentLabel, { color: '#16A34A' }]}>{t.requestDetail.priceSummaryPlatformPay(appName)}</Text>
            </View>
            <View style={[styles.paymentRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#93C5FD', paddingTop: 8 }]}>
              <View style={{ backgroundColor: platformCredit.status === 'paid' ? '#D1FAE5' : '#FEF9C3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: platformCredit.status === 'paid' ? '#16A34A' : '#92400E' }}>
                  {platformCredit.status === 'paid' ? t.requestDetail.priceSummaryStatusPaid(appName) : t.requestDetail.priceSummaryStatusPending}
                </Text>
              </View>
              <Text style={[styles.paymentLabel, { color: '#6B7280', fontSize: 11 }]}>{t.requestDetail.priceSummaryStatusLabel(appName)}</Text>
            </View>
          </View>
        )}

        {/* Permanent payment summary — post-completion when coin discount was applied (customer view) */}
        {request.status !== 'waiting_approval' &&
          (request as any).hasCoinRedemption &&
          request.customerPayableAmount != null &&
          request.agreedPrice != null &&
          parseFloat(String(request.customerPayableAmount)) < parseFloat(String(request.agreedPrice)) && (
          <View style={[styles.paymentCard, { backgroundColor: '#FEFCE8', borderColor: '#FDE68A', marginHorizontal: 16, marginBottom: 14 }]}>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: '#92400E' }]}>{t.requestDetail.permanentOriginal}</Text>
              <Text style={[styles.paymentValue, { color: '#92400E' }]}>{parseFloat(String(request.agreedPrice)).toFixed(2)} {t.common.currency}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: '#16A34A' }]}>{t.requestDetail.permanentCoinDiscount(appName)}</Text>
              <Text style={[styles.paymentValue, { color: '#16A34A' }]}>
                −{(parseFloat(String(request.agreedPrice)) - parseFloat(String(request.customerPayableAmount))).toFixed(2)} {t.common.currency}
              </Text>
            </View>
            <View style={[styles.paymentRow, styles.paymentTotal]}>
              <Text style={[styles.paymentLabel, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>{t.requestDetail.permanentCustomerPays}</Text>
              <Text style={[styles.paymentValue, { color: colors.primary, fontFamily: 'Cairo_700Bold', fontSize: 17 }]}>
                {parseFloat(String(request.customerPayableAmount)).toFixed(2)} {t.common.currency}
              </Text>
            </View>
          </View>
        )}

        {/* Customer action buttons — confirm or reject completion */}
        {canComplete && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 10 }}>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#10B981' }]}
              onPress={handleConfirmComplete}
              disabled={completeRequest.isPending || rejectCompletion.isPending}
            >
              {completeRequest.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.bigBtnText}>{t.requestDetail.confirmComplete}</Text></>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={handleRejectCompletion}
              disabled={rejectCompletion.isPending || completeRequest.isPending}
            >
              {rejectCompletion.isPending
                ? <ActivityIndicator color="#EF4444" size="small" />
                : <><Feather name="x-circle" size={18} color="#EF4444" /><Text style={[styles.bigBtnText, { color: '#EF4444' }]}>{t.requestDetail.rejectComplete}</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* Edit request button — customer only, pending/offers_received */}
        {canEditRequest && (
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}
            onPress={() => {
              setEditAddress((request as any).address || '');
              setEditDescription2((request as any).description || '');
              setShowEditRequest(true);
            }}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
            <Text style={[styles.bigBtnText, { color: colors.primary }]}>{t.requestDetail.editRequestBtn}</Text>
          </TouchableOpacity>
        )}

        {/* Edit request inline form */}
        {canEditRequest && showEditRequest && (
          <View style={[styles.offerFormCard, { backgroundColor: colors.card, borderColor: colors.primary + '40', borderWidth: 1, marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>{t.requestDetail.editRequestTitle}</Text>
            <View style={{ gap: 4 }}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>{t.requestDetail.editAddressLabel}</Text>
              <View style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  style={{ fontFamily: 'Cairo_400Regular', color: colors.foreground, textAlign: 'auto', flex: 1 }}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder={t.requestDetail.editAddressPlaceholder}
                  value={editAddress}
                  onChangeText={setEditAddress}
                />
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>{t.requestDetail.editDescLabel}</Text>
              <View style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, minHeight: 80 }]}>
                <TextInput
                  style={{ fontFamily: 'Cairo_400Regular', color: colors.foreground, textAlign: 'auto', flex: 1 }}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder={t.requestDetail.editDescPlaceholder}
                  value={editDescription2}
                  onChangeText={setEditDescription2}
                  multiline
                />
              </View>
            </View>
            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={() => setShowEditRequest(false)}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fillBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (!editAddress.trim() || !editDescription2.trim()) {
                    showAlert(t.common.error, t.requestDetail.fillAddressDesc);
                    return;
                  }
                  editRequestMutation.mutate({ address: editAddress, description: editDescription2 });
                }}
                disabled={editRequestMutation.isPending}
              >
                {editRequestMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold' }}>{t.requestDetail.saveEdits}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canCancel && (
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: '#EF444420', marginHorizontal: 16, marginBottom: 16 }]}
            onPress={handleCancelRequest}
          >
            <Text style={[styles.bigBtnText, { color: '#EF4444' }]}>{t.requestDetail.cancelRequest}</Text>
          </TouchableOpacity>
        )}

        {/* Price adjustment history (settled adjustments only — mirrors web) */}
        {adjHistory.filter(a => a.status !== 'pending').length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title={t.requestDetail.priceHistorySection} colors={colors} />
            {adjHistory.filter(a => a.status !== 'pending').map((adj: any) => {
              const oldTotal = Number(adj.oldPrice || 0) + Number(adj.oldSpareParts || 0);
              const newTotal = Number(adj.newPrice || 0) + Number(adj.newSpareParts || 0);
              const isApproved = adj.status === 'approved';
              return (
                <View
                  key={adj.id}
                  style={{
                    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
                    backgroundColor: isApproved ? '#F0FDF4' : '#FEF2F2',
                    borderColor: isApproved ? '#86EFAC' : '#FECACA',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ backgroundColor: isApproved ? '#16A34A' : '#DC2626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Cairo_600SemiBold' }}>{isApproved ? t.requestDetail.adjApproved : t.requestDetail.adjRejected}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.foreground }}>{adj.technicianName || t.requestDetail.adjTechFallback}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: '#6B7280' }}>{t.requestDetail.adjOriginal}: <Text style={{ fontFamily: 'Cairo_700Bold' }}>{oldTotal || '—'}</Text></Text>
                    <Text style={{ color: '#6B7280' }}>←</Text>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: isApproved ? '#16A34A' : '#6B7280', textDecorationLine: isApproved ? 'none' : 'line-through' }}>
                      {t.requestDetail.adjNew}: <Text style={{ fontFamily: 'Cairo_700Bold' }}>{newTotal}</Text> {t.common.currency}
                    </Text>
                  </View>
                  {adj.newDescription ? (
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'auto' }}>{t.requestDetail.adjReason}: {adj.newDescription}</Text>
                  ) : null}
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'auto' }}>
                    {t.requestDetail.adjRequested}: {adj.createdAt ? new Date(adj.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : ''}
                    {adj.decisionDate ? `  •  ${t.requestDetail.adjDecided}: ${new Date(adj.decisionDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Chat button */}
        {canChat && (
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, marginHorizontal: 16, marginBottom: 16 }]}
            onPress={() => router.push(`/messages/${request.id}` as any)}
          >
            <Feather name="message-circle" size={18} color={colors.primary} />
            <Text style={[styles.bigBtnText, { color: colors.primary }]}>{t.requestDetail.openChat}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Rating Modal — shown after customer confirms completion */}
      <Modal visible={showRatingModal} transparent animationType="fade" onRequestClose={() => {}}>
        <Pressable style={styles.modalOverlay} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.requestDetail.rateTitle}</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>{t.requestDetail.rateSubtitle}</Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                <StarRating
                  value={ratingStars}
                  size={38}
                  gap={8}
                  interactive
                  onChange={setRatingStars}
                />
              </View>

              {/* Review input */}
              <View style={[styles.reviewInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={{ fontFamily: 'Cairo_400Regular', color: colors.foreground, textAlign: 'auto', minHeight: 72 }}
                  placeholder={t.requestDetail.reviewPlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={ratingReview}
                  onChangeText={setRatingReview}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: colors.primary }]}
                onPress={() => submitRating.mutate({ stars: ratingStars, review: ratingReview })}
                disabled={submitRating.isPending}
              >
                {submitRating.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.bigBtnText}>{t.requestDetail.submitRating}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Web-only in-app confirmation dialog (replaces Alert.alert on web) */}
      <ConfirmDialog state={dialogState} />
    </View>
  );
}

// ─── Coin Redemption Section ──────────────────────────────────────────────────
// Self-contained: fetches its own config + wallet, manages its own state.
// Mirrors the web's CoinRedemptionSection pattern exactly.
function CoinRedemptionSection({
  reqId, req, colors, accessToken,
}: {
  reqId: number; req: any; colors: any; accessToken: string | null;
}) {
  const qc = useQueryClient();
  const [coinsInput, setCoinsInput] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);
  const { confirm, showAlert, dialogState } = useConfirm();
  const { locale } = useLocale();
  const t = translations[locale];

  // Config — public endpoint, fetched unconditionally (no CMS gate)
  const { data: config } = useQuery<{
    loyaltyEnabled: boolean; coinName: string;
    coinRedeemX: number; coinRedeemY: number; maxCoinsPerRequest: number;
  }>({
    queryKey: ['loyalty-config'],
    queryFn: () => apiFetch('/api/loyalty/config'),
    staleTime: 5 * 60 * 1000,
  });

  // Wallet — authenticated, always enabled when token exists
  const { data: wallet } = useQuery<LoyaltyWallet>({
    queryKey: ['wallet'],
    queryFn: () => apiFetch('/api/loyalty/wallet', { token: accessToken }),
    enabled: !!accessToken,
    staleTime: 30_000,
  });

  const calculateMut = useMutation({
    mutationFn: (vars: { coinsToUse: number; requestId: number }) =>
      apiFetch('/api/loyalty/calculate', { method: 'POST', token: accessToken, body: JSON.stringify(vars) }),
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  const redeemMut = useMutation({
    mutationFn: (vars: { requestId: number; coinsToUse: number }) =>
      apiFetch('/api/loyalty/redeem', { method: 'POST', token: accessToken, body: JSON.stringify(vars) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', String(reqId)] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setCoinsInput('');
      setCalcResult(null);
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  const releaseMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/loyalty/redeem/${reqId}`, { method: 'DELETE', token: accessToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', String(reqId)] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => showAlert(t.common.error, e.message),
  });

  // Don't render until config is known; hide if loyalty is disabled
  if (!config || !config.loyaltyEnabled) return null;

  const coinName      = config.coinName ?? t.requestDetail.coinUnit;
  const coinRedeemX   = config.coinRedeemX ?? 1;
  const coinRedeemY   = config.coinRedeemY ?? 0.5;
  const availableCoins = wallet?.availableCoins ?? 0;
  const reservedCoins  = wallet?.reservedCoins  ?? 0;

  const hasActiveCoinRedemption = req.hasDiscount && reservedCoins > 0;
  const hasOtherDiscount        = req.hasDiscount && !hasActiveCoinRedemption;

  const agreedPrice  = parseFloat(req.agreedPrice || '0');
  // Max coins allowed by the price: agreedPrice / coinRedeemY * coinRedeemX
  const maxByPrice   = coinRedeemY > 0 ? Math.floor((agreedPrice / coinRedeemY) * coinRedeemX) : 0;
  const maxUsable    = Math.max(0, Math.min(config.maxCoinsPerRequest ?? 500, availableCoins, maxByPrice));

  const handleCalculate = async () => {
    const coins = parseInt(coinsInput || '0', 10);
    if (!coins || coins <= 0) { setCalcResult(null); return; }
    try {
      const result = await calculateMut.mutateAsync({ coinsToUse: coins, requestId: reqId });
      setCalcResult(result);
    } catch {
      setCalcResult(null);
    }
  };

  const handleRedeem = async () => {
    const coins = parseInt(coinsInput || '0', 10);
    if (!coins || coins <= 0) { showAlert(t.common.error, t.requestDetail.enterCoinsFirst); return; }
    const ok = await confirm({
      title: t.common.confirm,
      message: t.requestDetail.coinRedeemConfirm(coins, coinName),
      confirmText: t.requestDetail.yesLabel,
      cancelText: t.common.cancel,
      destructive: false,
    });
    if (!ok) return;
    redeemMut.mutate({ requestId: reqId, coinsToUse: coins });
  };

  return (
    <>
    <View style={[styles.coinSection, { borderColor: '#FDE68A', marginHorizontal: 16, marginBottom: 14 }]}>
      {/* Header */}
      <View style={styles.coinHeader}>
        <Feather name="star" size={17} color="#D97706" />
        <Text style={[styles.coinTitle, { color: colors.foreground }]}>{t.requestDetail.coinTitle} {coinName}</Text>
      </View>

      {/* Other discount conflict */}
      {hasOtherDiscount && (
        <View style={[styles.coinNotice, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
          <Feather name="info" size={14} color="#C2410C" />
          <Text style={[styles.coinNoticeText, { color: '#C2410C' }]}>
            {t.requestDetail.coinConflict(coinName)}
          </Text>
        </View>
      )}

      {/* Active redemption — coins already reserved */}
      {hasActiveCoinRedemption && (
        <View style={{ gap: 12 }}>
          <View style={[styles.coinNotice, { backgroundColor: '#FEFCE8', borderColor: '#FDE68A' }]}>
            <Feather name="star" size={14} color="#D97706" />
            <Text style={[styles.coinNoticeText, { color: '#92400E' }]}>
              {t.requestDetail.coinReserved(reservedCoins, coinName, t.requestDetail.coinDiscountSuffix(coinRedeemX, coinRedeemY, reservedCoins))}
            </Text>
          </View>
          {req.customerPayableAmount != null && parseFloat(req.customerPayableAmount) < agreedPrice && (
            <View style={[styles.paymentCard, { backgroundColor: '#FEFCE8', borderColor: '#FDE68A' }]}>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#92400E' }]}>{t.requestDetail.coinOriginal}</Text>
                <Text style={[styles.paymentValue, { color: '#92400E' }]}>{agreedPrice.toFixed(2)} {t.common.currency}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#16A34A' }]}>{t.requestDetail.coinDiscount(coinName)}</Text>
                <Text style={[styles.paymentValue, { color: '#16A34A' }]}>
                  −{(agreedPrice - parseFloat(req.customerPayableAmount)).toFixed(2)} {t.common.currency}
                </Text>
              </View>
              <View style={[styles.paymentRow, styles.paymentTotal]}>
                <Text style={[styles.paymentLabel, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>{t.requestDetail.coinCustomerPays}</Text>
                <Text style={[styles.paymentValue, { color: colors.primary, fontFamily: 'Cairo_700Bold', fontSize: 16 }]}>
                  {parseFloat(req.customerPayableAmount).toFixed(2)} {t.common.currency}
                </Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' }]}
            onPress={() => releaseMut.mutate()}
            disabled={releaseMut.isPending}
          >
            {releaseMut.isPending
              ? <ActivityIndicator color="#EF4444" size="small" />
              : <Text style={[styles.bigBtnText, { color: '#EF4444', fontSize: 14 }]}>{t.requestDetail.coinCancelReservation(coinName)}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Input section — shown when no discount is active */}
      {!hasOtherDiscount && !hasActiveCoinRedemption && (
        <View style={{ gap: 14 }}>

          {/* Balance summary card */}
          <View style={[styles.coinBalanceRow, { backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[styles.coinBalanceLabel, { color: colors.mutedForeground }]}>{t.requestDetail.coinAvailableBalance}</Text>
              <Text style={[styles.coinBalanceValue, { color: colors.foreground }]}>{availableCoins.toLocaleString()}</Text>
              <Text style={[styles.coinBalanceLabel, { color: colors.mutedForeground, marginTop: 1 }]}>{coinName}</Text>
            </View>
            <View style={[styles.coinBalanceDivider, { backgroundColor: colors.border }]} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[styles.coinBalanceLabel, { color: colors.mutedForeground }]}>{t.requestDetail.coinMaxPerRequest}</Text>
              <Text style={[styles.coinBalanceValue, { color: colors.primary }]}>{(config.maxCoinsPerRequest ?? 500).toLocaleString()}</Text>
              <Text style={[styles.coinBalanceLabel, { color: colors.mutedForeground, marginTop: 1 }]}>{coinName}</Text>
            </View>
          </View>

          {/* Labeled input field */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.coinInputLabel, { color: colors.foreground }]}>{t.requestDetail.coinInputLabel(coinName)}</Text>
            <View style={[styles.coinInputField, {
              borderColor: coinsInput ? colors.primary : colors.border,
              backgroundColor: colors.background,
            }]}>
              <TextInput
                style={[styles.coinInputText, { color: colors.foreground }]}
                placeholder={t.requestDetail.coinMaxPlaceholder(maxUsable)}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={coinsInput}
                onChangeText={(v) => { setCoinsInput(v); setCalcResult(null); }}
              />
              <Text style={[styles.coinInputHint, { color: colors.mutedForeground }]}>{t.requestDetail.coinUnit}</Text>
            </View>
          </View>

          {/* Calculate button — full width, outline style */}
          <TouchableOpacity
            style={[styles.coinCalcFullBtn, {
              borderColor: colors.primary,
              backgroundColor: colors.primary + '12',
              opacity: (!coinsInput || calculateMut.isPending) ? 0.55 : 1,
            }]}
            onPress={handleCalculate}
            disabled={!coinsInput || calculateMut.isPending}
          >
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={[styles.coinCalcFullBtnText, { color: colors.primary }]}>
              {calculateMut.isPending ? t.common.calculating : t.common.calcDiscount}
            </Text>
          </TouchableOpacity>

          {/* Calculation preview */}
          {calcResult && (
            <View style={[styles.paymentCard, { backgroundColor: '#FEFCE8', borderColor: '#FDE68A' }]}>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#92400E' }]}>{t.requestDetail.coinOriginal}</Text>
                <Text style={[styles.paymentValue, { color: '#92400E' }]}>{agreedPrice.toFixed(2)} {t.common.currency}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#16A34A' }]}>{t.requestDetail.coinDiscount(coinName)}</Text>
                <Text style={[styles.paymentValue, { color: '#16A34A' }]}>−{calcResult.discountValue} {t.common.currency}</Text>
              </View>
              <View style={[styles.paymentRow, styles.paymentTotal]}>
                <Text style={[styles.paymentLabel, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>{t.requestDetail.coinCustomerPays}</Text>
                <Text style={[styles.paymentValue, { color: colors.primary, fontFamily: 'Cairo_700Bold', fontSize: 16 }]}>
                  {calcResult.customerPayableAmount} {t.common.currency}
                </Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#D97706' }]}>{t.requestDetail.coinUsedLabel(coinName)}</Text>
                <Text style={[styles.paymentValue, { color: '#D97706', fontFamily: 'Cairo_700Bold' }]}>{calcResult.allowedCoins}</Text>
              </View>
            </View>
          )}

          {/* Redeem button */}
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: '#D97706', opacity: (!coinsInput || redeemMut.isPending || availableCoins === 0) ? 0.5 : 1 }]}
            onPress={handleRedeem}
            disabled={!coinsInput || redeemMut.isPending || availableCoins === 0}
          >
            {redeemMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Feather name="star" size={16} color="#fff" /><Text style={styles.bigBtnText}>{t.requestDetail.coinUsed(coinName)}</Text></>}
          </TouchableOpacity>

          {availableCoins === 0 && (
            <Text style={[styles.coinEmptyText, { color: colors.mutedForeground }]}>
              {t.requestDetail.coinEmpty(coinName)}
            </Text>
          )}
        </View>
      )}
    </View>
    <ConfirmDialog state={dialogState} />
    </>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, count, colors }: { title: string; count?: number; colors: any }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionHeaderAccent, { backgroundColor: colors.primary }]} />
      <Text style={[styles.sectionHeaderText, { color: colors.foreground }]}>{title}</Text>
      {count !== undefined && (
        <View style={[styles.sectionHeaderBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.sectionHeaderBadgeText, { color: colors.primary }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Grid item ────────────────────────────────────────────────────────────────
function InfoGridItem({ icon, iconColor, iconBg, label, value, colors, onPress }: any) {
  const inner = (
    <View style={styles.infoGridItem}>
      <Text style={[styles.infoGridValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <View style={styles.infoGridMeta}>
        <Text style={[styles.infoGridLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[styles.infoGridIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={12} color={iconColor} />
        </View>
      </View>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  }
  return inner;
}

// ─── Compact Request Info Card ────────────────────────────────────────────────
function RequestInfoCard({ request, colors, showPhone }: { request: ServiceRequest; colors: any; showPhone: boolean }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const { locale } = useLocale();
  const t = translations[locale];

  // ── Audio playback ──────────────────────────────────────────────────────────
  // Mirrors web: request detail shows <audio controls src={req.audioUrl}> when
  // audioUrl is present. On Expo we use Audio.Sound with the same URL resolved
  // to a full URL (relative paths get the API host prepended via apiUrl).
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioSrc = request.audioUrl
    ? (request.audioUrl.startsWith('http') ? request.audioUrl : apiUrl(request.audioUrl))
    : null;

  useEffect(() => {
    // Unload the sound instance when the card is unmounted (e.g. user navigates away).
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const handleAudioToggle = async () => {
    if (!audioSrc) return;
    try {
      if (!soundRef.current) {
        // First press: configure audio session then load + play.
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioSrc },
          { shouldPlay: true },
          (status) => {
            // Auto-reset to play state when the recording finishes.
            if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
          },
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } else if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch {
      Alert.alert(t.common.error, t.requestDetail.audioError);
    }
  };

  const desc = request.description ?? '';
  const descLong = desc.length > 120;

  return (
    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top accent bar */}
      <View style={[styles.infoAccentBar, { backgroundColor: colors.primary }]} />

      {/* Service pill */}
      <View style={[styles.infoTopRow, { borderBottomColor: colors.border, justifyContent: 'center' }]}>
        <View style={[styles.infoServicePill, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
          {request.service?.image ? (
            <Image
              source={{ uri: request.service.image }}
              style={{ width: 15, height: 15, borderRadius: 3 }}
              resizeMode="contain"
            />
          ) : (
            <Feather name="tool" size={11} color={colors.primary} />
          )}
          <Text style={[styles.infoServicePillText, { color: colors.primary }]} numberOfLines={1}>
            {locale === 'en' ? (request.service?.name || request.service?.nameAr || '—') : (request.service?.nameAr || request.service?.name || '—')}
          </Text>
        </View>
      </View>

      {/* Customer-attached problem photos — available to the assigned technician */}
      {Array.isArray(request.images) && request.images.length > 0 && (
        <View style={[styles.infoImagesBlock, { borderBottomColor: colors.border }]}>
          <View style={styles.infoDescHeaderRow}>
            <View style={styles.infoDetailLeft}>
              <Text style={[styles.infoDetailLabel, { color: colors.mutedForeground }]}>
                {t.requestDetail.imagesSection}
              </Text>
              <View style={[styles.infoGridIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="image" size={12} color={colors.primary} />
              </View>
            </View>
          </View>
          <View style={styles.infoImagesGrid}>
            {request.images.filter(Boolean).map((image, index) => {
              const uri = resolveMediaUrl(image);
              return uri ? (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.infoRequestImage}
                  resizeMode="cover"
                />
              ) : null;
            })}
          </View>
        </View>
      )}

      {/* Grid row 1: Name + Phone — hidden from non-selected technicians */}
      <View style={[styles.infoGridRow, { borderBottomColor: colors.border }]}>
        <InfoGridItem
          icon="phone"
          iconColor={showPhone ? '#2563EB' : '#9CA3AF'}
          iconBg={showPhone ? '#EFF6FF' : '#F3F4F6'}
          label={t.requestDetail.infoPhone}
          value={showPhone ? request.mobile : '••••••••'}
          colors={colors}
          onPress={showPhone && request.mobile ? () => Linking.openURL(`tel:${request.mobile}`) : undefined}
        />
        <View style={[styles.infoGridSep, { backgroundColor: colors.border }]} />
        <InfoGridItem
          icon="user"
          iconColor={showPhone ? '#7C3AED' : '#9CA3AF'}
          iconBg={showPhone ? '#EDE9FE' : '#F3F4F6'}
          label={t.requestDetail.infoName}
          value={showPhone ? request.fullName : '—'}
          colors={colors}
        />
      </View>

      {/* Grid row 2: Area + Governorate */}
      <View style={[styles.infoGridRow, { borderBottomColor: colors.border }]}>
        <InfoGridItem icon="map" iconColor="#059669" iconBg="#D1FAE5" label={t.requestDetail.infoArea} value={locale === 'en' ? (request.area?.name || request.area?.nameAr || '—') : (request.area?.nameAr || '—')} colors={colors} />
        <View style={[styles.infoGridSep, { backgroundColor: colors.border }]} />
        <InfoGridItem icon="map-pin" iconColor="#0891B2" iconBg="#ECFEFF" label={t.requestDetail.infoGov} value={locale === 'en' ? (request.governorate?.name || request.governorate?.nameAr || '—') : (request.governorate?.nameAr || '—')} colors={colors} />
      </View>

      {/* Address row */}
      <View style={[styles.infoDetailRow, { borderBottomColor: colors.border, borderBottomWidth: desc ? StyleSheet.hairlineWidth : 0 }]}>
        <Text style={[styles.infoDetailValue, { color: colors.foreground }]} numberOfLines={2}>
          {request.address}
        </Text>
        <View style={styles.infoDetailLeft}>
          <Text style={[styles.infoDetailLabel, { color: colors.mutedForeground }]}>{t.requestDetail.infoAddress}</Text>
          <View style={[styles.infoGridIcon, { backgroundColor: '#FFF7ED' }]}>
            <Feather name="navigation" size={12} color="#EA580C" />
          </View>
        </View>
      </View>

      {/* Description with expand/collapse */}
      {desc ? (
        <View style={styles.infoDescBlock}>
          <View style={styles.infoDescHeaderRow}>
            {descLong ? (
              <TouchableOpacity onPress={() => setDescExpanded(v => !v)} activeOpacity={0.7}>
                <Text style={[styles.infoDescToggle, { color: colors.primary }]}>
                  {descExpanded ? t.requestDetail.showLess : t.requestDetail.showMoreDesc}
                </Text>
              </TouchableOpacity>
            ) : <View />}
            <View style={styles.infoDetailLeft}>
              <Text style={[styles.infoDetailLabel, { color: colors.mutedForeground }]}>{t.requestDetail.infoProblem}</Text>
              <View style={[styles.infoGridIcon, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="file-text" size={12} color="#6B7280" />
              </View>
            </View>
          </View>
          <Text
            style={[styles.infoDescText, { color: colors.foreground }]}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {desc}
          </Text>
        </View>
      ) : null}

      {/* Audio player — mirrors web's <audio controls src={req.audioUrl}> */}
      {audioSrc && (
        <View style={[styles.infoAudioRow, { borderTopColor: colors.border }]}>
          <View style={styles.infoDetailLeft}>
            <Text style={[styles.infoDetailLabel, { color: colors.mutedForeground }]}>{t.requestDetail.infoAudio}</Text>
            <View style={[styles.infoGridIcon, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="volume-2" size={12} color="#DC2626" />
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.infoAudioBtn,
              { backgroundColor: isPlaying ? colors.primary + '25' : colors.primary },
            ]}
            onPress={handleAudioToggle}
            activeOpacity={0.8}
          >
            <Feather
              name={isPlaying ? 'pause' : 'play'}
              size={15}
              color={isPlaying ? colors.primary : '#fff'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormField({ label, colors, ...props }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.formLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TextInput style={[{ flex: 1, fontFamily: 'Cairo_400Regular', color: colors.foreground, textAlign: 'auto' }]} placeholderTextColor={colors.mutedForeground} {...props} />
      </View>
    </View>
  );
}

// ─── OfferCard ────────────────────────────────────────────────────────────────
function OfferCard({
  offer, canAccept, onAccept, isAccepting, colors,
}: {
  offer: Offer;
  canAccept: boolean;
  onAccept: () => void;
  isAccepting: boolean;
  colors: any;
}) {
  const authedFetch = useAuthedFetch();
  const { locale: _offerLocale } = useLocale();
  const _ot = translations[_offerLocale];
  const tech = offer.technician;
  const isSelected = offer.status === 'selected';

  // Lazy-fetch public profile for rating display (React Query dedupes per technicianId)
  const { data: profile } = useQuery<any>({
    queryKey: ['tech-public-profile', offer.technicianId],
    queryFn: () => authedFetch(`/api/technicians/${offer.technicianId}/public-profile`),
    staleTime: 5 * 60 * 1000,
    enabled: !!offer.technicianId,
  });

  // API may return averageRating as a string ("4.8"), number, null, or undefined.
  // Parse through Number() and fall back to 0 for any non-finite result.
  const avgRating: number = (() => {
    const v = Number(profile?.averageRating);
    return isFinite(v) ? v : 0;
  })();
  const totalRatings: number = (() => {
    const v = Number(profile?.totalRatings);
    return isFinite(v) && v >= 0 ? Math.round(v) : 0;
  })();

  const goToProfile = () =>
    router.push(`/technician-profile/${offer.technicianId}` as any);

  return (
    <View
      style={[
        styles.offerCard,
        {
          backgroundColor: colors.card,
          shadowColor: isSelected ? colors.primary : '#000',
          borderColor: isSelected ? colors.primary : 'transparent',
          borderWidth: isSelected ? 1.5 : 0,
        },
      ]}
    >
      {/* Amber accent bar for selected offer */}
      {isSelected && (
        <View style={[styles.offerAccentBar, { backgroundColor: colors.primary }]} />
      )}

      {/* ── Header: avatar + tech info + badge ── */}
      <View style={styles.offerHeader}>
        {/* Avatar — tappable */}
        <TouchableOpacity onPress={goToProfile} activeOpacity={0.8}>
          {resolveMediaUrl(tech?.profileImage) ? (
            <Image
              source={{ uri: resolveMediaUrl(tech?.profileImage)! }}
              style={styles.offerAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.offerAvatarFallback, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="user" size={22} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        {/* Name + rating */}
        <View style={styles.offerTechInfo}>
          <TouchableOpacity onPress={goToProfile} activeOpacity={0.7}>
            <Text style={[styles.offerTechName, { color: colors.foreground }]} numberOfLines={1}>
              {tech?.fullName ?? _ot.messages.techFallback}
            </Text>
          </TouchableOpacity>
          <View style={styles.offerRatingRow}>
            <StarRating value={avgRating} size={12} />
            <Text style={[styles.offerRatingText, { color: colors.mutedForeground }]}>
              {avgRating ? avgRating.toFixed(1) : '—'}
              {totalRatings > 0 ? ` (${totalRatings})` : ''}
            </Text>
          </View>
        </View>

        {/* Selected badge */}
        {isSelected && (
          <View style={styles.offerSelectedBadge}>
            <Feather name="check-circle" size={12} color="#10B981" />
            <Text style={styles.offerSelectedText}>{_ot.requestDetail.offerSelectedBadge}</Text>
          </View>
        )}
      </View>

      {/* ── Price breakdown ── */}
      {(() => {
        const total      = Number(offer.price) || 0;
        const parts      = Number(offer.spareParts) || 0;
        const service    = Math.max(0, total - parts);
        const hasParts   = parts > 0;

        return (
          <View style={[styles.offerBreakdown, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Service cost row */}
            <View style={styles.offerBreakRow}>
              <Text style={styles.offerBreakValue}>
                <Text style={styles.offerBreakValueService}>{fmtNumber(service)}</Text>
                {'  '}{_ot.common.currency}
              </Text>
              <View style={styles.offerBreakLabel}>
                <View style={[styles.offerBreakIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="tool" size={13} color="#2563EB" />
                </View>
                <Text style={[styles.offerBreakLabelText, { color: '#2563EB' }]}>{_ot.requestDetail.offerServiceCost}</Text>
              </View>
            </View>

            {/* Spare parts row — only when parts > 0 */}
            {hasParts && (
              <>
                <View style={[styles.offerBreakDividerThin, { backgroundColor: colors.border }]} />
                <View style={styles.offerBreakRow}>
                  <Text style={styles.offerBreakValue}>
                    <Text style={styles.offerBreakValueParts}>{fmtNumber(parts)}</Text>
                    {'  '}{_ot.common.currency}
                  </Text>
                  <View style={styles.offerBreakLabel}>
                    <View style={[styles.offerBreakIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Feather name="package" size={13} color="#EA580C" />
                    </View>
                    <Text style={[styles.offerBreakLabelText, { color: '#EA580C' }]}>{_ot.requestDetail.offerPartsCost}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Divider before total */}
            <View style={[styles.offerBreakDivider, { backgroundColor: colors.border }]} />

            {/* Total row */}
            <View style={[styles.offerBreakRow, styles.offerBreakTotalRow]}>
              <Text style={styles.offerBreakTotalValue}>
                {fmtNumber(total)}
                <Text style={styles.offerBreakTotalUnit}>  {_ot.common.currency}</Text>
              </Text>
              <View style={styles.offerBreakLabel}>
                <View style={[styles.offerBreakIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Feather name="check-circle" size={13} color="#16A34A" />
                </View>
                <Text style={[styles.offerBreakLabelText, { color: '#16A34A' }]}>{_ot.requestDetail.offerTotal}</Text>
              </View>
            </View>

          </View>
        );
      })()}

      {/* ── Notes ── */}
      {offer.notes ? (
        <Text style={[styles.offerNotes, { color: colors.mutedForeground }]}>
          {offer.notes}
        </Text>
      ) : null}

      {/* ── Accept button ── */}
      {canAccept && offer.status === 'pending' && (
        <TouchableOpacity
          style={[styles.offerAcceptBtn, { backgroundColor: colors.primaryDark ?? colors.primary }]}
          onPress={onAccept}
          disabled={isAccepting}
          activeOpacity={0.82}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.offerAcceptText}>{_ot.requestDetail.acceptOffer}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── MyOfferCard ──────────────────────────────────────────────────────────────
// Shows the technician's own submitted offer with inline edit capability.
function MyOfferCard({
  offer, editing,
  editPrice, editParts, editNotes,
  onEditStart, onEditCancel, onEditPrice, onEditParts, onEditNotes,
  onEditSubmit, isSaving,
  onWithdraw, isWithdrawing,
  colors,
}: {
  offer: Offer;
  editing: boolean;
  editPrice: string; editParts: string; editNotes: string;
  onEditStart: () => void; onEditCancel: () => void;
  onEditPrice: (v: string) => void; onEditParts: (v: string) => void; onEditNotes: (v: string) => void;
  onEditSubmit: () => void;
  isSaving: boolean;
  onWithdraw: () => void;
  isWithdrawing: boolean;
  colors: any;
}) {
  const total   = Number(offer.price)      || 0;
  const parts   = Number(offer.spareParts) || 0;
  const service = Math.max(0, total - parts);
  const hasParts = parts > 0;
  // Technician can edit while the offer is still pending (not yet selected/rejected)
  const canEdit = offer.status === 'pending';

  const { locale: _myOfferLocale } = useLocale();
  const _t = translations[_myOfferLocale];
  const statusLabel =
    offer.status === 'selected'  ? _t.requestDetail.myOfferStatusSelected :
    offer.status === 'rejected'  ? _t.requestDetail.myOfferStatusRejected :
    offer.status === 'withdrawn' ? _t.requestDetail.myOfferStatusWithdrawn :
    _t.requestDetail.myOfferStatusPending;

  const statusColor =
    offer.status === 'selected' ? '#059669' :
    offer.status === 'rejected' ? '#DC2626' :
    offer.status === 'withdrawn' ? '#6B7280' :
    colors.primary;

  const statusBg =
    offer.status === 'selected' ? '#D1FAE5' :
    offer.status === 'rejected' ? '#FEE2E2' :
    offer.status === 'withdrawn' ? '#F3F4F6' :
    colors.primary + '15';

  const statusIcon: any =
    offer.status === 'selected'  ? 'check-circle' :
    offer.status === 'rejected'  ? 'x-circle'     :
    offer.status === 'withdrawn' ? 'slash'         :
    'clock';

  return (
    <View style={[moStyles.card, { backgroundColor: colors.card, borderColor: colors.primary + '50' }]}>
      {/* Accent bar */}
      <View style={[moStyles.accentBar, { backgroundColor: colors.primary }]} />

      {!editing ? (
        <>
          {/* Header: status badge + submission date */}
          <View style={moStyles.headerRow}>
            <View style={[moStyles.statusBadge, { backgroundColor: statusBg }]}>
              <Feather name={statusIcon} size={12} color={statusColor} />
              <Text style={[moStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={[moStyles.dateText, { color: colors.mutedForeground }]}>
              {fmtDate(offer.createdAt, { dateStyle: 'medium' })}
            </Text>
          </View>

          {/* Price breakdown */}
          <View style={[moStyles.breakdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Service cost */}
            <View style={moStyles.breakRow}>
              <Text style={[moStyles.breakAmount, { color: '#2563EB' }]}>{fmtNumber(service)} {_t.common.currency}</Text>
              <View style={moStyles.breakLabelRow}>
                <View style={[moStyles.breakIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="tool" size={13} color="#2563EB" />
                </View>
                <Text style={[moStyles.breakLabel, { color: '#2563EB' }]}>{_t.requestDetail.offerServiceCost}</Text>
              </View>
            </View>

            {/* Spare parts — only when non-zero */}
            {hasParts && (
              <>
                <View style={[moStyles.dividerThin, { backgroundColor: colors.border }]} />
                <View style={moStyles.breakRow}>
                  <Text style={[moStyles.breakAmount, { color: '#EA580C' }]}>{fmtNumber(parts)} {_t.common.currency}</Text>
                  <View style={moStyles.breakLabelRow}>
                    <View style={[moStyles.breakIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Feather name="package" size={13} color="#EA580C" />
                    </View>
                    <Text style={[moStyles.breakLabel, { color: '#EA580C' }]}>{_t.requestDetail.offerPartsCost}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Total */}
            <View style={[moStyles.divider, { backgroundColor: colors.border }]} />
            <View style={[moStyles.breakRow, moStyles.totalRow]}>
              <Text style={moStyles.totalAmount}>{fmtNumber(total)}<Text style={moStyles.totalUnit}> {_t.common.currency}</Text></Text>
              <View style={moStyles.breakLabelRow}>
                <View style={[moStyles.breakIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Feather name="check-circle" size={13} color="#16A34A" />
                </View>
                <Text style={[moStyles.breakLabel, { color: '#16A34A' }]}>{_t.requestDetail.offerTotal}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {!!offer.notes && (
            <View style={[moStyles.notesBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="file-text" size={13} color={colors.mutedForeground} style={{ marginTop: 2 }} />
              <Text style={[moStyles.notesText, { color: colors.foreground }]}>{offer.notes}</Text>
            </View>
          )}

          {/* Action buttons — only for pending offers */}
          {canEdit && (
            <View style={moStyles.actionRow}>
              {/* Edit */}
              <TouchableOpacity
                style={[moStyles.actionBtn, { borderColor: colors.primary, flex: 1 }]}
                onPress={onEditStart}
                activeOpacity={0.75}
                disabled={isWithdrawing}
              >
                <Feather name="edit-2" size={14} color={colors.primary} />
                <Text style={[moStyles.actionBtnText, { color: colors.primary }]}>{_t.requestDetail.editOfferBtn}</Text>
              </TouchableOpacity>

              {/* Withdraw */}
              <TouchableOpacity
                style={[moStyles.actionBtn, moStyles.withdrawBtn]}
                onPress={onWithdraw}
                activeOpacity={0.75}
                disabled={isWithdrawing || isSaving}
              >
                {isWithdrawing
                  ? <ActivityIndicator color="#DC2626" size="small" />
                  : <>
                      <Feather name="x-circle" size={14} color="#DC2626" />
                      <Text style={moStyles.withdrawBtnText}>{_t.requestDetail.withdrawOfferBtn}</Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        /* ── Inline edit form ── */
        <View style={moStyles.editForm}>
          <Text style={[moStyles.editTitle, { color: colors.foreground }]}>{_t.requestDetail.editOfferTitle}</Text>
          <FormField
            label={_t.requestDetail.totalPriceLabel}
            value={editPrice}
            onChangeText={onEditPrice}
            keyboardType="numeric"
            colors={colors}
          />
          <FormField
            label={_t.requestDetail.partsLabel}
            value={editParts}
            onChangeText={onEditParts}
            keyboardType="numeric"
            colors={colors}
          />
          <FormField
            label={_t.requestDetail.notesLabel}
            value={editNotes}
            onChangeText={onEditNotes}
            colors={colors}
          />
          <View style={styles.formBtns}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.border }]}
              onPress={onEditCancel}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }}>{_t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fillBtn, { backgroundColor: colors.primary }]}
              onPress={onEditSubmit}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold' }}>{_t.requestDetail.saveEdit}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const moStyles = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1.5,
    // NOTE: no overflow:'hidden' — elevation + overflow:'hidden' = white rectangle on Android
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  accentBar: { height: 3, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14, paddingBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  dateText: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  breakdown: {
    marginHorizontal: 14, marginBottom: 12,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  breakRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11,
  },
  breakLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  breakIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  breakLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  breakAmount: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  dividerThin: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  divider: { height: 1 },
  totalRow: { paddingVertical: 14 },
  totalAmount: { fontSize: 26, fontFamily: 'Cairo_700Bold', color: '#16A34A' },
  totalUnit: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: '#16A34A' },
  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 14, marginBottom: 12,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  notesText: {
    flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular',
    textAlign: 'auto', lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 14, marginBottom: 14,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  withdrawBtn: {
    borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  withdrawBtnText: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#DC2626' },
  editForm: { padding: 14, gap: 12 },
  editTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', textAlign: 'auto', marginBottom: 4 },
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Header ──
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDate: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  // ── Status + price row ──
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  statusBadgeText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  priceBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  priceBadgeText: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  // ── Section header ──
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionHeaderAccent: { width: 3, height: 17, borderRadius: 2 },
  sectionHeaderText: { fontSize: 15, fontFamily: 'Cairo_700Bold', flex: 1 },
  sectionHeaderBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionHeaderBadgeText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  // ── Info card ──
  // NOTE: no overflow:'hidden' — elevation + overflow:'hidden' = white rectangle on Android
  infoCard: { borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  infoAccentBar: { height: 3 },
  infoTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  infoDateChip: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  infoServicePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  infoServicePillText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  infoGridRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  infoGridItem: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'flex-end' },
  infoGridValue: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto', marginBottom: 3 },
  infoGridMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  infoGridLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  infoGridIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  infoGridSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8 },
  infoDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  infoDetailLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoDetailLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  infoDetailValue: { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto', flex: 1 },
  infoDescBlock: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
  infoDescHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  infoDescText: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'auto', lineHeight: 21 },
  infoDescToggle: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  infoImagesBlock: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  infoImagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  infoRequestImage: { width: 82, height: 82, borderRadius: 10, backgroundColor: '#E5E7EB' },
  // ── Audio player row (inside info card) ──────────────────────────────────────
  infoAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoAudioBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Offer card ──────────────────────────────────────────────────────────────
  offerCard: {
    borderRadius: 18,
    marginBottom: 14,
    // NOTE: no overflow:'hidden' — elevation + overflow:'hidden' = white rectangle on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  offerAccentBar: { height: 3, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingBottom: 12,
  },
  offerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  offerAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerTechInfo: { flex: 1, gap: 4 },
  offerTechName: { fontSize: 15, fontFamily: 'Cairo_700Bold', textAlign: 'auto' },
  offerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  offerRatingText: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  offerSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  offerSelectedText: { color: '#059669', fontFamily: 'Cairo_600SemiBold', fontSize: 11 },
  // ── Price breakdown block ──
  offerBreakdown: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  offerBreakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  offerBreakTotalRow: {
    paddingVertical: 14,
  },
  offerBreakLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  offerBreakIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerBreakLabelText: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  offerBreakValue: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    color: '#6B7280',
  },
  offerBreakValueService: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    color: '#2563EB',
  },
  offerBreakValueParts: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    color: '#EA580C',
  },
  offerBreakDividerThin: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  offerBreakDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  offerBreakTotalValue: {
    fontSize: 26,
    fontFamily: 'Cairo_700Bold',
    color: '#16A34A',
  },
  offerBreakTotalUnit: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    color: '#16A34A',
  },
  offerNotes: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    lineHeight: 20,
    marginHorizontal: 14,
    marginBottom: 12,
  },
  offerAcceptBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#C89820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  offerAcceptText: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 15 },
  bigBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Cairo_700Bold' },
  offerFormCard: { borderRadius: 14, padding: 16, gap: 12 },
  formTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold', textAlign: 'auto' },
  fieldGroup: { gap: 4 },
  formLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto' },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  formBtns: { flexDirection: 'row', gap: 10 },
  outlineBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  fillBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },

  // ── Status notice ──
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  noticeText: { flex: 1, fontFamily: 'Cairo_500Medium', fontSize: 13, lineHeight: 20, textAlign: 'auto' },

  // ── Payment summary ──
  paymentCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentLabel: { fontFamily: 'Cairo_500Medium', fontSize: 13 },
  paymentValue: { fontFamily: 'Cairo_600SemiBold', fontSize: 13 },
  paymentTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#FDE68A', paddingTop: 8, marginTop: 4 },

  // ── Coin redemption ──
  coinSection: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  coinHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinTitle: { fontFamily: 'Cairo_700Bold', fontSize: 15 },
  coinNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  coinNoticeText: { flex: 1, fontFamily: 'Cairo_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'auto' },
  coinBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinBalanceLabel: { fontFamily: 'Cairo_400Regular', fontSize: 11, textAlign: 'center', marginBottom: 2 },
  coinBalanceValue: { fontFamily: 'Cairo_700Bold', fontSize: 14, textAlign: 'center' },
  coinBalanceDivider: { width: 1, height: 32, opacity: 0.4 },
  coinInputLabel: { fontFamily: 'Cairo_600SemiBold', fontSize: 13, textAlign: 'auto' },
  coinInputField: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinInputText: { flex: 1, fontFamily: 'Cairo_400Regular', fontSize: 15, textAlign: 'auto' },
  coinInputHint: { fontFamily: 'Cairo_400Regular', fontSize: 12 },
  coinCalcFullBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  coinCalcFullBtnText: { fontFamily: 'Cairo_600SemiBold', fontSize: 13 },
  coinEmptyText: { fontFamily: 'Cairo_400Regular', fontSize: 12, textAlign: 'center' },

  // ── Rating modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { width: '100%', borderRadius: 20, padding: 24, gap: 16, maxWidth: 400 },
  modalTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center', marginTop: -8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  reviewInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 88 },
});
