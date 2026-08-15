import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Platform,
  ActivityIndicator, Alert, Image, type TextInput as RNTextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, apiUpload, apiUrl } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonList } from '@/components/SkeletonCard';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Service, Governorate, Area, ServiceRequest } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

// Mirrors web validation schema exactly
const VALIDATION = {
  fullName:  { min: 3,  msg: 'الاسم يجب أن يكون 3 أحرف على الأقل' },
  mobile:    { min: 8,  msg: 'رقم الهاتف يجب أن يكون 8 أرقام على الأقل' },
  address:   { min: 5,  msg: 'العنوان يجب أن يكون 5 أحرف على الأقل' },
  description: { min: 10, msg: 'وصف المشكلة يجب أن يكون 10 أحرف على الأقل' },
};

export default function ServiceDetailScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();

  // ── Scroll-to-first-error refs ────────────────────────────────────────────
  const scrollRef      = useRef<ScrollView>(null);
  const scrollOffsetY  = useRef(0);
  const sectionRefs    = useRef<Record<string, View | null>>({});
  const inputRefs      = useRef<Record<string, RNTextInput | null>>({});

  // ── Form state ────────────────────────────────────────────────────────────
  const [fullName, setFullName]       = useState(user?.fullName ?? '');
  const [mobile, setMobile]           = useState(user?.mobile ?? '');
  const [address, setAddress]         = useState('');
  const [description, setDescription] = useState('');
  const [selectedGov, setSelectedGov] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);

  // ── Field-level validation errors ────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) => setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

  // ── Images ────────────────────────────────────────────────────────────────
  const [images, setImages]           = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const [audioUrl, setAudioUrl]       = useState<string | null>(null);
  const [audioName, setAudioName]     = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // cleanup timer + recording + preview sound on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      previewSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Data queries ──────────────────────────────────────────────────────────
  //
  // Use the already-cached services list as initialData so the hero card is
  // visible immediately when the user navigates from the home/services screens
  // (where the list is already loaded).  The per-service API call still runs in
  // the background for fresh data; it is just no longer the ONLY source.
  // Without this, the hero only renders after the API round-trip, which means
  // it is invisible for the duration of the fetch — or permanently if the call
  // fails on Expo Web.
  const { data: service, isLoading } = useQuery<Service>({
    queryKey: ['service', id],
    queryFn: () => apiFetch(`/api/services/${id}`),
    enabled: !!id,
    initialData: () => {
      const list = qc.getQueryData<Service[]>(['services']);
      return list?.find((s) => String(s.id) === id);
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(['services'])?.dataUpdatedAt,
  });

  const { data: governorates = [] } = useQuery<Governorate[]>({
    queryKey: ['governorates'],
    queryFn: () => apiFetch('/api/governorates'),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas', selectedGov],
    queryFn: () => apiFetch(`/api/areas?governorateId=${selectedGov}`),
    enabled: !!selectedGov,
  });

  // ── Create request mutation ───────────────────────────────────────────────
  const createRequest = useMutation({
    mutationFn: (data: object) =>
      apiFetch<ServiceRequest>('/api/requests', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (req) => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      router.replace(`/requests/${req.id}` as any);
    },
    onError: (e: any) => {
      Alert.alert(t.common.error, (e as any)?.data?.error || e.message || t.auth.genericError);
    },
  });

  // ── File upload helper ────────────────────────────────────────────────────
  const uploadFile = async (uri: string, mimeType: string, filename: string): Promise<string> => {
    const formData = new FormData();

    // On Expo web the picker returns a blob: or data: URI. The browser's native
    // FormData.append only accepts Blob/File — it ignores a plain JS object.
    // React Native native builds use a patched fetch that understands the
    // { uri, type, name } object form, so keep that path for native.
    if (uri.startsWith('blob:') || uri.startsWith('data:')) {
      const fetched = await fetch(uri);
      const blob = await fetched.blob();
      const file = new File([blob], filename, { type: mimeType });
      formData.append('file', file);
    } else {
      // React Native: use the RN-specific object syntax understood by RN's fetch
      formData.append('file', { uri, type: mimeType, name: filename } as any);
    }

    const result = await apiUpload<{ url: string }>(
      '/api/upload/user?category=requests',
      formData,
      accessToken,
    );
    return result.url;
  };

  // ── Image picker ──────────────────────────────────────────────────────────
  const handlePickImages = async () => {
    const remaining = 6 - images.length;
    if (remaining <= 0) {
      Alert.alert(t.serviceDetail.imageUploadMax, t.serviceDetail.imageUploadMaxMsg);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.registerTech.permissionRequired, t.registerTech.permissionMessage);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
    });

    if (result.canceled || !result.assets.length) return;

    setUploadingImages(true);
    try {
      const urls = await Promise.all(
        result.assets.map((asset) =>
          uploadFile(
            asset.uri,
            asset.mimeType ?? 'image/jpeg',
            asset.fileName ?? `photo_${Date.now()}.jpg`,
          ),
        ),
      );
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch {
      Alert.alert(t.common.error, t.serviceDetail.imageUploadFailed);
    } finally {
      setUploadingImages(false);
    }
  };

  // ── Audio recording ───────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(t.registerTech.permissionRequired, t.serviceDetail.micPermissionMsg);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      Alert.alert(t.common.error, t.serviceDetail.micAccessError);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingSeconds(0);
      if (uri) await uploadAudioUri(uri, 'voice_recording.m4a', 'audio/m4a');
    } catch {
      Alert.alert(t.common.error, t.serviceDetail.recordingSaveError);
      setIsRecording(false);
    }
  };

  // ── Audio file picker ─────────────────────────────────────────────────────
  const handlePickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert(t.serviceDetail.audioFileTooLargeTitle, t.serviceDetail.audioFileTooLargeMsg);
        return;
      }
      await uploadAudioUri(asset.uri, asset.name ?? 'ملف صوتي', asset.mimeType ?? 'audio/mpeg');
    } catch {
      Alert.alert(t.common.error, t.serviceDetail.audioFilePickError);
    }
  };

  const uploadAudioUri = async (uri: string, name: string, mimeType: string) => {
    try {
      const url = await uploadFile(uri, mimeType, name);
      setAudioUrl(url);
      setAudioName(name);
    } catch {
      Alert.alert(t.common.error, t.serviceDetail.audioUploadFailed);
    }
  };

  const clearAudio = () => {
    // Unload any in-progress preview before clearing the attachment.
    previewSoundRef.current?.unloadAsync().catch(() => {});
    previewSoundRef.current = null;
    setIsPreviewPlaying(false);
    setAudioUrl(null);
    setAudioName('');
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Build a full media URL — relative paths (e.g. `/uploads/...`) get the API
  // host prepended; absolute URLs (Cloudinary etc.) pass through unchanged.
  const resolveMediaUrl = (path: string) => path.startsWith('http') ? path : apiUrl(path);

  // ── Audio preview toggle ──────────────────────────────────────────────────
  // Mirrors web's <audio controls src={audioUrl}> that appears after upload.
  // Uses the same resolveMediaUrl helper so relative upload paths get the API
  // host prepended on native builds (Expo web uses same-origin relative URLs).
  const handlePreviewToggle = async () => {
    if (!audioUrl) return;
    const src = resolveMediaUrl(audioUrl);
    try {
      if (!previewSoundRef.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: src },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) setIsPreviewPlaying(false);
          },
        );
        previewSoundRef.current = sound;
        setIsPreviewPlaying(true);
      } else if (isPreviewPlaying) {
        await previewSoundRef.current.pauseAsync();
        setIsPreviewPlaying(false);
      } else {
        await previewSoundRef.current.playAsync();
        setIsPreviewPlaying(true);
      }
    } catch {
      Alert.alert(t.common.error, t.requestDetail.audioError);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!user) { router.push('/login' as any); return; }

    // Collect ALL field errors before deciding whether to proceed
    const newErrors: Record<string, string> = {};

    if (fullName.trim().length < VALIDATION.fullName.min)
      newErrors.fullName = t.serviceDetail.validFieldRequired;
    if (!/^[0-9+\s\-]{8,}$/.test(mobile.trim()))
      newErrors.mobile = t.serviceDetail.validMobileInvalid;
    if (!selectedGov)
      newErrors.governorate = t.serviceDetail.validSelectGov;
    if (!selectedArea)
      newErrors.area = t.serviceDetail.validSelectArea;
    if (address.trim().length < VALIDATION.address.min)
      newErrors.address = t.serviceDetail.validFieldRequired;
    if (description.trim().length < VALIDATION.description.min)
      newErrors.description = t.serviceDetail.validDescShort;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to the first invalid section and focus its input
      const fieldOrder = ['fullName', 'mobile', 'governorate', 'area', 'address', 'description'] as const;
      const fieldToSection: Record<string, string> = {
        fullName: 'contact', mobile: 'contact',
        governorate: 'location', area: 'location', address: 'location',
        description: 'problem',
      };
      const firstError = fieldOrder.find(k => newErrors[k]);
      if (firstError) {
        const sectionRef = sectionRefs.current[fieldToSection[firstError]];
        if (sectionRef) {
          sectionRef.measure((_fx: number, _fy: number, _w: number, _h: number, _px: number, py: number) => {
            const target = scrollOffsetY.current + py - 90;
            scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: true });
          });
        }
        // Focus the text input after scroll animation settles
        setTimeout(() => inputRefs.current[firstError]?.focus(), 380);
      }
      return;
    }

    setErrors({});
    createRequest.mutate({
      serviceId:     Number(id),
      fullName:      fullName.trim(),
      mobile:        mobile.trim(),
      governorateId: selectedGov,
      areaId:        selectedArea,
      address:       address.trim(),
      description:   description.trim(),
      images,
      audioUrl: audioUrl ?? undefined,
    });
  };

  // The row uses the app's existing RTL direction. Reverse the JSX order for
  // Arabic so the fields appear in the requested visual order without changing
  // their values or the request payload.
  const contactFieldOrder = locale === 'ar'
    ? (['fullName', 'mobile'] as const)
    : (['mobile', 'fullName'] as const);
  const locationFieldOrder = locale === 'ar'
    ? (['governorate', 'area'] as const)
    : (['area', 'governorate'] as const);

  const renderContactField = (field: (typeof contactFieldOrder)[number]) => {
    if (field === 'mobile') {
      return (
        <FocusField
          key="mobile"
          label={t.auth.mobileLabel}
          required
          value={mobile}
          onChangeText={(v: string) => { setMobile(v); clearError('mobile'); }}
          placeholder="01xxxxxxxxx"
          keyboardType="phone-pad"
          colors={colors}
          inputTextColor={colors.inputForeground}
          error={errors.mobile}
          inputRef={(r: RNTextInput | null) => { inputRefs.current.mobile = r; }}
          containerStyle={styles.fieldRowHalf}
        />
      );
    }

    return (
      <FocusField
        key="fullName"
        label={t.auth.fullNameLabel}
        required
        value={fullName}
        onChangeText={(v: string) => { setFullName(v); clearError('fullName'); }}
        placeholder={t.serviceDetail.placeholderFullName}
        colors={colors}
        inputTextColor={colors.inputForeground}
        error={errors.fullName}
        inputRef={(r: RNTextInput | null) => { inputRefs.current.fullName = r; }}
        containerStyle={styles.fieldRowHalf}
      />
    );
  };

  const renderLocationField = (field: (typeof locationFieldOrder)[number]) => {
    if (field === 'area') {
      return (
        <View key="area" style={[styles.fieldGroup, styles.fieldRowHalf]}>
          <FieldLabel label={t.serviceDetail.areaLabel} required colors={colors} />
          <SearchableSelect
            options={(areas as Area[]).map(a => ({
              value: a.id,
              label: (a as any).nameAr || a.name,
            }))}
            value={selectedArea}
            onChange={(v) => { setSelectedArea(v as number); clearError('area'); }}
            placeholder={selectedGov ? t.serviceDetail.validSelectArea : t.serviceDetail.validSelectAreaFirst}
            searchPlaceholder={t.serviceDetail.searchAreaPlaceholder}
            modalTitle={t.serviceDetail.validSelectArea}
            disabled={!selectedGov}
            hasError={!!errors.area}
          />
          {errors.area ? (
            <Text style={styles.fieldError}>{errors.area}</Text>
          ) : null}
        </View>
      );
    }

    return (
      <View key="governorate" style={[styles.fieldGroup, styles.fieldRowHalf]}>
        <FieldLabel label={t.serviceDetail.govLabel} required colors={colors} />
        <SearchableSelect
          options={(governorates as Governorate[]).map(g => ({
            value: g.id,
            label: (g as any).nameAr || g.name,
          }))}
          value={selectedGov}
          onChange={(v) => { setSelectedGov(v as number); setSelectedArea(null); clearError('governorate'); }}
          placeholder={t.serviceDetail.validSelectGov}
          searchPlaceholder={t.serviceDetail.searchGovPlaceholder}
          modalTitle={t.serviceDetail.validSelectGov}
          hasError={!!errors.governorate}
        />
        {errors.governorate ? (
          <Text style={styles.fieldError}>{errors.governorate}</Text>
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t.serviceDetail.loadingTitle} />
        <View style={{ padding: 16 }}><SkeletonList count={3} /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.serviceDetail.headerTitle} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollOffsetY.current = e.nativeEvent.contentOffset.y; }}
      >

        {/* ── Service hero card ── */}
        {service && (
          <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
            {/* Amber tint strip along the top edge */}
            <View style={[styles.heroAccentBar, { backgroundColor: colors.primary }]} />
            <View style={styles.heroBody}>
              {/* Icon badge */}
              <View style={[styles.heroIconBadge, { backgroundColor: colors.primary + '1A' }]}>
                {service.image ? (
                  <Image
                    source={{ uri: resolveMediaUrl(service.image) }}
                    style={styles.heroIconImg}
                    resizeMode="contain"
                  />
                ) : service.icon ? (
                  <Text style={styles.heroIconEmoji}>{service.icon}</Text>
                ) : (
                  <Feather name="tool" size={32} color={colors.primary} />
                )}
              </View>
              {/* Text */}
              <View style={styles.heroText}>
                <Text style={[styles.heroServiceLabel, { color: colors.mutedForeground }]}>
                  {t.serviceDetail.heroLabel}
                </Text>
                <Text style={[styles.heroServiceName, { color: colors.foreground }]}>
                  {service.nameAr || service.name}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.pageBody}>

          {/* ══ SECTION: Contact ══ */}
          <View ref={(r) => { sectionRefs.current.contact = r; }} collapsable={false}>
          <SectionCard
            icon="user"
            title={t.serviceDetail.contactSection}
            colors={colors}
            iconColor="#C89820"
            iconBg="#FEF3C7"
          >
            <View style={styles.fieldRow}>
              {contactFieldOrder.map(renderContactField)}
            </View>
          </SectionCard>
          </View>

          {/* ══ SECTION: Location ══ */}
          <View ref={(r) => { sectionRefs.current.location = r; }} collapsable={false}>
          <SectionCard
            icon="map-pin"
            title={t.serviceDetail.locationSection}
            colors={colors}
            iconColor="#059669"
            iconBg="#D1FAE5"
          >
            <View style={styles.fieldRow}>
              {locationFieldOrder.map(renderLocationField)}
            </View>

            <FocusField
              label={t.serviceDetail.addressLabel}
              required
              value={address}
              onChangeText={(v: string) => { setAddress(v); clearError('address'); }}
              placeholder={t.serviceDetail.placeholderAddress}
              colors={colors}
              error={errors.address}
              inputRef={(r: RNTextInput | null) => { inputRefs.current.address = r; }}
            />
          </SectionCard>
          </View>

          {/* ══ SECTION: Problem description ══ */}
          <View ref={(r) => { sectionRefs.current.problem = r; }} collapsable={false}>
          <SectionCard icon="file-text" title={t.serviceDetail.problemSection} colors={colors} iconColor="#2563EB" iconBg="#DBEAFE">
            <FocusField
              label={t.serviceDetail.descLabel}
              required
              value={description}
              onChangeText={(v: string) => { setDescription(v); clearError('description'); }}
              placeholder={t.serviceDetail.placeholderDesc}
              multiline
              numberOfLines={5}
              colors={colors}
              error={errors.description}
              inputRef={(r: RNTextInput | null) => { inputRefs.current.description = r; }}
            />
          </SectionCard>
          </View>

          {/* ══ SECTION: Images ══ */}
          <SectionCard
            icon="image"
            title={t.serviceDetail.imagesSection}
            subtitle={t.serviceDetail.imagesSubtitle}
            colors={colors}
            iconColor="#7C3AED"
            iconBg="#EDE9FE"
          >
            {images.length > 0 ? (
              <View style={styles.imageGrid}>
                {images.map((src, i) => (
                  <View key={i} style={styles.imageThumb}>
                    <Image
                      source={{ uri: resolveMediaUrl(src) }}
                      style={styles.thumbImg}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={[styles.removeImageBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    >
                      <Feather name="x" size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 6 && (
                  <TouchableOpacity
                    style={[styles.addMoreThumb, { borderColor: colors.primary + '70', backgroundColor: '#FDF8E8' }]}
                    onPress={handlePickImages}
                    disabled={uploadingImages}
                    activeOpacity={0.7}
                  >
                    {uploadingImages
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <>
                          <Feather name="plus" size={22} color={colors.primary} />
                          <Text style={[styles.addMoreLabel, { color: colors.primary }]}>{t.serviceDetail.addMoreLabel}</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadDropzone, { borderColor: colors.primary + '60', backgroundColor: '#FDF8E8' }]}
                onPress={handlePickImages}
                disabled={uploadingImages}
                activeOpacity={0.7}
              >
                {uploadingImages ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <>
                    <View style={[styles.uploadIconCircle, { backgroundColor: colors.primary + '28' }]}>
                      <Feather name="camera" size={26} color={colors.primary} />
                    </View>
                    <Text style={[styles.uploadDropzoneTitle, { color: colors.foreground }]}>
                      {t.serviceDetail.addPhotosTitle}
                    </Text>
                    <Text style={[styles.uploadDropzoneHint, { color: colors.mutedForeground }]}>
                      JPG · PNG · WEBP
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Helper text — always visible below the upload control */}
            <Text style={[styles.imageUploadHint, { color: colors.mutedForeground }]}>
              {t.serviceDetail.imageHint}
            </Text>
          </SectionCard>

          {/* ══ SECTION: Audio ══ */}
          <SectionCard
            icon="mic"
            title={t.serviceDetail.audioSection}
            subtitle={t.serviceDetail.audioSubtitle}
            colors={colors}
            iconColor="#DC2626"
            iconBg="#FEE2E2"
          >
            {audioUrl ? (
              /* ── Attached — mirrors web's filename + <audio controls> + delete ── */
              <View style={[styles.audioAttachedRow, { backgroundColor: '#FDF8E8', borderColor: colors.primary + '45' }]}>
                <View style={[styles.audioAttachedIcon, { backgroundColor: colors.primary + '28' }]}>
                  <Feather name="volume-2" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.audioAttachedName, { color: colors.foreground }]} numberOfLines={1}>
                  {audioName}
                </Text>
                {/* Play / Pause preview — matches web's <audio controls> behaviour */}
                <TouchableOpacity
                  style={[
                    styles.audioPlayBtn,
                    { backgroundColor: isPreviewPlaying ? colors.primary + '22' : colors.primary },
                  ]}
                  onPress={handlePreviewToggle}
                  hitSlop={8}
                >
                  <Feather
                    name={isPreviewPlaying ? 'pause' : 'play'}
                    size={14}
                    color={isPreviewPlaying ? colors.primary : '#fff'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.audioRemoveBtn, { backgroundColor: '#FEE2E2' }]}
                  onPress={clearAudio}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : isRecording ? (
              /* ── Recording in progress ── */
              <View style={[styles.recordingCard, { backgroundColor: '#FFF0EF', borderColor: '#FFCFCA' }]}>
                <View style={styles.recordingLeft}>
                  <View style={[styles.recordingPulse, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.recordingTimer}>{formatTime(recordingSeconds)}</Text>
                  <Text style={[styles.recordingHint, { color: colors.mutedForeground }]}>
                    {t.serviceDetail.recordingText}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.stopRecordingBtn}
                  onPress={handleStopRecording}
                  activeOpacity={0.8}
                >
                  <Feather name="square" size={13} color="#fff" />
                  <Text style={styles.stopRecordingText}>{t.serviceDetail.stopBtn}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Default buttons ── */
              <View style={styles.audioButtonRow}>
                <TouchableOpacity
                  style={[styles.audioBtn, styles.audioBtnRecord, { borderColor: '#FFCFCA', backgroundColor: '#FFF0EF' }]}
                  onPress={handleStartRecording}
                  activeOpacity={0.75}
                >
                  <View style={[styles.audioBtnIcon, { backgroundColor: '#FFEBE9' }]}>
                    <Feather name="mic" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.audioBtnLabel, { color: '#DC2626' }]}>{t.serviceDetail.recordBtn}</Text>
                  <Text style={[styles.audioBtnHint, { color: colors.mutedForeground }]}>
                    {t.serviceDetail.recordStart}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.audioBtn, { borderColor: '#DEDAD2', backgroundColor: '#F8F6F0' }]}
                  onPress={handlePickAudioFile}
                  activeOpacity={0.75}
                >
                  <View style={[styles.audioBtnIcon, { backgroundColor: colors.primary + '22' }]}>
                    <Feather name="upload" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.audioBtnLabel, { color: colors.foreground }]}>{t.serviceDetail.uploadFileBtn}</Text>
                  <Text style={[styles.audioBtnHint, { color: colors.mutedForeground }]}>
                    MP3 · M4A · WAV
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

        </View>{/* /pageBody */}

        {/* ══ Submit ══ */}
        <View style={styles.submitWrap}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primaryDark ?? '#C89820' },
              (createRequest.isPending || uploadingImages) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={createRequest.isPending || uploadingImages}
            activeOpacity={0.84}
          >
            {createRequest.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="send" size={19} color="#fff" />
                <Text style={styles.submitText}>{t.serviceDetail.submitBtn}</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.submitHint, { color: colors.mutedForeground }]}>
            {t.serviceDetail.submitHint}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, subtitle, children, colors, iconColor, iconBg,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: any;
  iconColor?: string;
  iconBg?: string;
}) {
  const resolvedIconColor = iconColor ?? (colors.primaryDark ?? colors.primary);
  const resolvedIconBg    = iconBg    ?? (colors.primary + '22');
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, shadowColor: '#1A1A1A' }]}>
      {/* Card header */}
      <View style={[styles.sectionHeader, { borderBottomColor: colors.primary + '28' }]}>
        <View style={[styles.sectionIconBadge, { backgroundColor: resolvedIconBg }]}>
          <Feather name={icon} size={15} color={resolvedIconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {/* Card body */}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FieldLabel({ label, required, colors }: { label: string; required?: boolean; colors: any }) {
  return (
    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
      {label}
      {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
    </Text>
  );
}

function FocusField({ label, required, colors, inputTextColor, multiline, error, inputRef, containerStyle, ...props }: any) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  return (
    <View style={[styles.fieldGroup, containerStyle]}>
      {label ? <FieldLabel label={label} required={required} colors={colors} /> : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: hasError ? colors.destructive + '12' : colors.card,
            borderColor: hasError ? colors.destructive : focused ? colors.primary : colors.border,
          },
          multiline && styles.inputWrapMultiline,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: inputTextColor ?? colors.foreground,
              caretColor: colors.primary,
              selectionColor: colors.primary,
            } as any,
            multiline && styles.inputMultiline,
          ]}
          placeholderTextColor={colors.mutedForeground}
          multiline={multiline}
          textAlign="right"
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {hasError ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Hero ──
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  heroAccentBar: { height: 4 },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  heroIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroIconImg: { width: 44, height: 44, borderRadius: 10 },
  heroIconEmoji: { fontSize: 34, lineHeight: 44 },
  heroText: { flex: 1, gap: 2 },
  heroServiceLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium', textAlign: 'auto', letterSpacing: 0.3 },
  heroServiceName: { fontSize: 20, fontFamily: 'Cairo_700Bold', textAlign: 'auto', lineHeight: 28 },

  // ── Page layout ──
  pageBody: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  // ── Section card ──
  sectionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Cairo_700Bold', textAlign: 'auto' },
  sectionSubtitle: { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'auto', marginTop: 1 },
  sectionBody: { padding: 16, gap: 14 },

  // ── Fields ──
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldRowHalf: { flex: 1 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto' },
  inputWrap: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputWrapMultiline: { paddingVertical: 12 },
  // outlineWidth removes the browser's native focus ring on Expo web, which
  // would otherwise appear as a second inner border inside the inputWrap border.
  input: { fontSize: 15, fontFamily: 'Cairo_400Regular', textAlign: 'auto', ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}) },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },

  // ── Image grid ──
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  imageThumb: { width: 94, height: 94, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  removeImageBtn: {
    position: 'absolute', top: 5, left: 5,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  addMoreThumb: {
    width: 94, height: 94, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addMoreLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },

  uploadDropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  uploadIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadDropzoneTitle: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  uploadDropzoneHint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  imageUploadHint: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
    lineHeight: 18,
    opacity: 0.85,
  },

  // ── Audio — attached ──
  audioAttachedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  audioAttachedIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  audioAttachedName: { flex: 1, fontSize: 14, fontFamily: 'Cairo_500Medium', textAlign: 'auto' },
  audioPlayBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  audioRemoveBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Audio — recording ──
  recordingCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, padding: 14, gap: 12,
  },
  recordingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingPulse: { width: 10, height: 10, borderRadius: 5 },
  recordingTimer: { fontFamily: 'Cairo_700Bold', fontSize: 18, color: '#DC2626' },
  recordingHint: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  stopRecordingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  stopRecordingText: { color: '#fff', fontSize: 13, fontFamily: 'Cairo_600SemiBold' },

  // ── Audio — default buttons ──
  audioButtonRow: { flexDirection: 'row', gap: 10 },
  audioBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', gap: 6,
  },
  audioBtnRecord: {},
  audioBtnIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  audioBtnLabel: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  audioBtnHint: { fontSize: 11, fontFamily: 'Cairo_400Regular' },

  // ── Field error ──
  fieldError: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    color: '#EF4444',
    textAlign: 'auto',
    marginTop: 2,
  },

  // ── Submit ──
  submitWrap: { paddingHorizontal: 16, paddingTop: 24, gap: 10, alignItems: 'center' },
  submitBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#C89820',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  submitText: { color: '#fff', fontSize: 18, fontFamily: 'Cairo_700Bold', letterSpacing: 0.3 },
  submitHint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
