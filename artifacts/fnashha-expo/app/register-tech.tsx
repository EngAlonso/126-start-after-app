/**
 * Technician Registration screen — /register-tech
 *
 * 4-step wizard matching the web version's structure and functionality:
 *   Step 1 — البيانات الشخصية   (Personal Info)
 *   Step 2 — المعلومات المهنية  (Professional Info)
 *   Step 3 — المستندات          (Documents — image picker + upload)
 *   Step 4 — المراجعة والإرسال  (Review + Terms + Submit)
 *
 * Design system: same premium card / inputs / amber button as Login & Register.
 * All business logic and upload flow preserved from the original screen.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Alert, Image,
  type TextInput as TextInputType,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { apiFetch, apiUrl } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Service, Governorate, Area } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: 1  },
  { value: 2  },
  { value: 3  },
  { value: 5  },
  { value: 7  },
  { value: 10 },
  { value: 15 },
  { value: 20 },
];

const STEPS = [
  { icon: 'user'         },
  { icon: 'briefcase'    },
  { icon: 'camera'       },
  { icon: 'check-circle' },
];

// ─── Registration image preparation ──────────────────────────────────────────
//
// /api/upload/user is an authenticated endpoint, while registration happens
// before a user has a token. The website's picker produces a server URL when
// its upload succeeds; for this unauthenticated Expo flow we send the same
// image as a backend-approved data URI instead of leaking a local file:// or
// content:// URI into the registration payload.
async function imageUriToDataUri(uri: string, mimeType: string): Promise<string> {
  if (uri.startsWith('data:image/')) return uri;

  const response = await fetch(uri);
  const blob = await response.blob();
  const resolvedMimeType = mimeType.startsWith('image/') ? mimeType : (blob.type || 'image/jpeg');

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const comma = reader.result.indexOf(',');
        resolve(`data:${resolvedMimeType};base64,${comma >= 0 ? reader.result.slice(comma + 1) : reader.result}`);
      } else {
        reject(new Error('تعذر قراءة الصورة'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(blob);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterTechScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { get } = useCmsSettings();
  const topPad  = Platform.OS === 'web' ? 20 : insets.top;
  const botPad  = insets.bottom || 0;
  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);
  const { locale } = useLocale();
  const t = translations[locale];
  const stepLabels = [t.registerTech.step1, t.registerTech.step2, t.registerTech.step3, t.registerTech.step4];

  // ── Wizard state
  const [step, setStep] = useState(1);

  // ── Step 1: Personal
  const [fullName,        setFullName]        = useState('');
  const [mobile,          setMobile]          = useState('');
  const [nationalId,      setNationalId]      = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // ── Step 2: Professional
  const [selectedServices,  setSelectedServices]  = useState<number[]>([]);
  const [yearsOfExperience, setYearsOfExperience] = useState<number | null>(null);
  const [selectedAreaIds,   setSelectedAreaIds]   = useState<number[]>([]);
  const [expandedGovIds,    setExpandedGovIds]    = useState<Set<number>>(new Set());
  const [showAllServices,   setShowAllServices]   = useState(false);

  // ── Step 3: Documents
  const [nationalIdFront,       setNationalIdFront]       = useState<string | null>(null);
  const [nationalIdBack,        setNationalIdBack]        = useState<string | null>(null);
  const [personalPhoto,         setPersonalPhoto]         = useState<string | null>(null);
  const [uploadingFront,        setUploadingFront]        = useState(false);
  const [uploadingBack,         setUploadingBack]         = useState(false);
  const [uploadingPhoto,        setUploadingPhoto]        = useState(false);

  // ── Step 4: Terms + submit
  const [acceptTerms, setAcceptTerms] = useState(false);

  // ── UI
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(false);

  // Refs for sequential focus in Step 1
  const mobileRef          = useRef<TextInputType>(null);
  const nationalIdRef      = useRef<TextInputType>(null);
  const passwordRef        = useRef<TextInputType>(null);
  const confirmPasswordRef = useRef<TextInputType>(null);

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: services     = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch('/api/services?active=true'),
  });
  const { data: governorates = [] } = useQuery<Governorate[]>({
    queryKey: ['governorates'],
    queryFn: () => apiFetch('/api/governorates'),
  });
  const { data: allAreas     = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const activeServices     = services.filter(s => (s as any).isActive !== false);
  const activeGovernorates = governorates.filter(g => (g as any).isActive !== false);

  const areasByGov: Record<number, { gov: Governorate; areas: Area[] }> = {};
  activeGovernorates.forEach(gov => {
    const govAreas = allAreas.filter(a => a.governorateId === gov.id);
    if (govAreas.length > 0) areasByGov[gov.id] = { gov, areas: govAreas };
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const focused = (f: string) => focusedField === f;
  const focus   = (f: string) => () => setFocusedField(f);
  const blur    = () => setFocusedField(null);

  const toggleService = (id: number) =>
    setSelectedServices(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const toggleArea = (id: number) =>
    setSelectedAreaIds(p => p.includes(id) ? p.filter(a => a !== id) : [...p, id]);

  const toggleGov = (id: number) =>
    setExpandedGovIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAllInGov = (areas: Area[]) => {
    const ids   = areas.map(a => a.id);
    const allSel = ids.every(id => selectedAreaIds.includes(id));
    setSelectedAreaIds(p => allSel ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };

  const getServiceName = (id: number) =>
    activeServices.find(s => s.id === id)?.nameAr || '';

  const getExperienceLabel = (v: number | null) => {
    if (v == null) return '—';
    const idx = EXPERIENCE_OPTIONS.findIndex(o => o.value === v);
    return idx >= 0 ? t.registerTech.experienceOptions[idx] : '—';
  };

  const derivedGovId = selectedAreaIds.length > 0
    ? allAreas.find(a => a.id === selectedAreaIds[0])?.governorateId ?? null
    : null;

  // ── Image picker + upload ─────────────────────────────────────────────────

  const pickAndUpload = async (
    category: string,
    setValue: (v: string | null) => void,
    setUploading: (v: boolean) => void,
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.registerTech.permissionRequired, t.registerTech.permissionMessage);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    // Show local preview immediately (before upload)
    setValue(asset.uri);
    setUploading(true);

    try {
      // Registration is unauthenticated, so the upload endpoint cannot accept
      // this request yet. Convert the exact picker asset to the same accepted
      // image data format used by the registration validator.
      const preparedImage = await imageUriToDataUri(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      setValue(preparedImage);
    } catch (e: any) {
      setValue(null);
      Alert.alert(t.registerTech.uploadErrorTitle, t.registerTech.uploadErrorMessage);
    } finally {
      setUploading(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep = (s: number): string => {
    if (s === 1) {
      if (!fullName.trim())             return t.registerTech.validFullName;
      if (!mobile.trim())               return t.registerTech.validMobile;
      if (!nationalId.trim())           return t.registerTech.validNationalIdRequired;
      if (!/^\d{14}$/.test(nationalId.trim())) return t.registerTech.validNationalIdFormat;
      if (!password.trim())             return t.registerTech.validPassword;
      if (password.length < 6)          return t.auth.passwordMinLength;
      if (password !== confirmPassword) return t.auth.passwordsNotMatch;
    }
    if (s === 2) {
      if (selectedServices.length === 0) return t.registerTech.validSelectService;
      if (selectedAreaIds.length === 0)  return t.registerTech.validSelectArea;
    }
    if (s === 3) {
      if (!nationalIdFront) return t.registerTech.validIdFront;
      if (!nationalIdBack)  return t.registerTech.validIdBack;
      if (!personalPhoto)   return t.registerTech.validPhoto;
    }
    if (s === 4) {
      if (!personalPhoto)   return t.registerTech.validPhoto;
      if (!acceptTerms) return t.registerTech.validTerms;
    }
    return '';
  };

  const handleNext = () => {
    setError('');
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setStep(s => Math.min(s + 1, 4));
  };

  const handlePrev = () => {
    setError('');
    setStep(s => Math.max(s - 1, 1));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    setError('');
    const err = validateStep(4);
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await apiFetch('/api/auth/register/technician', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          mobile,
          password,
          nationalId:       nationalId || undefined,
          serviceIds:       selectedServices,
          areaIds:          selectedAreaIds,
          primaryAreaId:    selectedAreaIds[0] ?? undefined,
          governorateId:    derivedGovId ?? undefined,
          yearsOfExperience: yearsOfExperience ?? undefined,
          nationalIdFront:  nationalIdFront  ?? undefined,
          nationalIdBack:   nationalIdBack   ?? undefined,
          personalPhoto:    personalPhoto    ?? undefined,
        }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────

  if (done) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successIconRing, { backgroundColor: '#D1FAE5', borderColor: 'rgba(34,197,94,0.25)' }]}>
          <Feather name="check" size={38} color="#16a34a" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>{t.registerTech.successTitle}</Text>
        <Text style={[styles.successSub,   { color: colors.mutedForeground }]}>{t.registerTech.successSub}</Text>
        <View style={[styles.successNote, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' }]}>
          <Feather name="info" size={14} color={colors.primaryDark} style={{ marginTop: 1 }} />
          <Text style={[styles.successNoteText, { color: colors.primaryDark }]}>
            {t.registerTech.successNote}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <View style={styles.btnInner}>
            <Feather name="log-in" size={17} color="#1A1A1A" />
            <Text style={styles.primaryBtnText}>{t.registerTech.backToLogin}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Wizard layout ─────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            step > 1
              ? handlePrev()
              : router.canGoBack()
              ? router.back()
              : router.replace('/')
          }
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.backBtnInner, { backgroundColor: colors.muted }]}>
            <Feather name="arrow-right" size={20} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t.registerTech.headerTitle}</Text>
          <Text style={[styles.headerSub,   { color: colors.mutedForeground }]}>
            {stepLabels[step - 1]} — {t.registerTech.stepProgress(step, STEPS.length)}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* ── Step indicator ── */}
      <View style={[styles.stepBarWrap, { backgroundColor: colors.background }]}>
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                i + 1 <  step && { backgroundColor: colors.primary },
                i + 1 === step && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.45,
                  shadowRadius: 6,
                  elevation: 3,
                },
                i + 1 > step && { backgroundColor: colors.muted },
              ]}>
                {i + 1 < step ? (
                  <Feather name="check" size={12} color="#1A1A1A" />
                ) : (
                  <Text style={[styles.stepNum, { color: i + 1 <= step ? '#1A1A1A' : colors.mutedForeground }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                { color: i + 1 === step ? colors.primary : i + 1 < step ? colors.mutedForeground : colors.border },
              ]} numberOfLines={1}>
                {stepLabels[i]}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, { backgroundColor: i + 1 < step ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* ── Progress bar ── */}
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View style={[
          styles.progressFill,
          {
            backgroundColor: colors.primary,
            width: `${((step - 1) / (STEPS.length - 1)) * 100}%` as any,
          },
        ]} />
      </View>

      {/* ── Scrollable step content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══ STEP 1: Personal Info ══════════════════════════════════════════ */}
        {step === 1 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionBadge icon="user" label={t.registerTech.step1} color={colors.primary} bgColor={colors.primaryLight} />

            <InputField
              label={t.auth.fullNameLabel} required icon="user"
              placeholder="محمد أحمد"
              value={fullName} onChangeText={setFullName}
              focused={focused('fullName')} onFocus={focus('fullName')} onBlur={blur}
              returnKeyType="next" blurOnSubmit={false}
              onSubmitEditing={() => mobileRef.current?.focus()}
              textContentType="name" autoComplete="name"
              colors={colors}
            />

            <InputField
              ref={mobileRef}
              label={t.auth.mobileLabel} required icon="phone"
              placeholder="01xxxxxxxxx"
              value={mobile} onChangeText={setMobile}
              focused={focused('mobile')} onFocus={focus('mobile')} onBlur={blur}
              keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel"
              returnKeyType="next" blurOnSubmit={false}
              onSubmitEditing={() => nationalIdRef.current?.focus()}
              colors={colors}
            />

            <InputField
              ref={nationalIdRef}
              label={t.registerTech.nationalIdLabel} required icon="credit-card"
              placeholder={t.registerTech.nationalIdPlaceholder}
              value={nationalId} onChangeText={setNationalId}
              focused={focused('nationalId')} onFocus={focus('nationalId')} onBlur={blur}
              keyboardType="number-pad"
              maxLength={14}
              returnKeyType="next" blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              colors={colors}
            />

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t.auth.passwordLabel}<Text style={{ color: '#E53E3E' }}> *</Text>
              </Text>
              <View style={[
                styles.inputRow,
                { backgroundColor: focused('password') ? colors.card : colors.background, borderColor: colors.border },
                focused('password') && { borderColor: colors.primary },
              ]}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="••••••••" placeholderTextColor={colors.mutedForeground}
                  value={password} onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  textContentType="newPassword" autoComplete="new-password"
                  textAlign="right" returnKeyType="next" blurOnSubmit={false}
                  onFocus={focus('password')} onBlur={blur}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(p => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.iconWrap, { backgroundColor: focused('password') ? colors.primary + '15' : colors.muted }]}
                >
                  <Feather name={showPass ? 'eye-off' : 'eye'} size={16}
                    color={focused('password') ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t.auth.confirmPasswordLabel}<Text style={{ color: '#E53E3E' }}> *</Text>
              </Text>
              <View style={[
                styles.inputRow,
                { backgroundColor: focused('confirmPassword') ? colors.card : colors.background, borderColor: colors.border },
                focused('confirmPassword') && { borderColor: colors.primary },
              ]}>
                <TextInput
                  ref={confirmPasswordRef}
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="••••••••" placeholderTextColor={colors.mutedForeground}
                  value={confirmPassword} onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPass}
                  textContentType="newPassword" autoComplete="new-password"
                  textAlign="right" returnKeyType="done"
                  onFocus={focus('confirmPassword')} onBlur={blur}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPass(p => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.iconWrap, { backgroundColor: focused('confirmPassword') ? colors.primary + '15' : colors.muted }]}
                >
                  <Feather name={showConfirmPass ? 'eye-off' : 'eye'} size={16}
                    color={focused('confirmPassword') ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ══ STEP 2: Professional ══════════════════════════════════════════ */}
        {step === 2 && (
          <View style={{ gap: 14 }}>

            {/* Services */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionBadgeRow}>
                <SectionBadge icon="briefcase" label={t.editProfile.servicesSection} color={colors.primary} bgColor={colors.primaryLight} />
                {selectedServices.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.countBadgeText}>{t.registerTech.selectedCount(selectedServices.length)}</Text>
                  </View>
                )}
              </View>

              {activeServices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{t.registerTech.noServicesAvailable}</Text>
              ) : (
                <>
                  <View style={styles.servicesGrid}>
                    {(showAllServices ? activeServices : activeServices.slice(0, 6)).map(svc => {
                      const sel = selectedServices.includes(svc.id);
                      return (
                        <TouchableOpacity
                          key={svc.id}
                          style={[
                            styles.serviceCard,
                            {
                              borderColor:     sel ? colors.primary : colors.border,
                              backgroundColor: sel ? colors.primaryLight : colors.background,
                            },
                          ]}
                          onPress={() => toggleService(svc.id)}
                          activeOpacity={0.75}
                        >
                          {sel && (
                            <View style={[styles.serviceCheck, { backgroundColor: colors.primary }]}>
                              <Feather name="check" size={9} color="#1A1A1A" />
                            </View>
                          )}
                          <View style={[styles.serviceIconBg, { backgroundColor: sel ? colors.primary + '20' : colors.muted }]}>
                            {svc.image ? (
                              <Image
                                source={{ uri: svc.image }}
                                style={styles.serviceIconImg}
                                resizeMode="contain"
                              />
                            ) : (
                              <Feather name="tool" size={16} color={sel ? colors.primary : colors.mutedForeground} />
                            )}
                          </View>
                          <Text style={[styles.serviceCardLabel, { color: sel ? colors.primaryDark : colors.foreground }]}
                            numberOfLines={2}>
                            {svc.nameAr || svc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {activeServices.length > 6 && (
                    <TouchableOpacity
                      style={[styles.showMoreBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setShowAllServices(v => !v)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.showMoreText, { color: colors.primary }]}>
                        {showAllServices ? t.registerTech.showLess : t.registerTech.showMoreCount(activeServices.length - 6)}
                      </Text>
                      <Feather
                        name={showAllServices ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Experience */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SectionBadge icon="star" label={t.editProfile.experienceSection} color={colors.primary} bgColor={colors.primaryLight} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.experienceRow, { flexDirection: 'row' }]}>
                {EXPERIENCE_OPTIONS.map((opt, idx) => {
                  const sel = yearsOfExperience === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.experienceChip,
                        { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : colors.background },
                      ]}
                      onPress={() => setYearsOfExperience(sel ? null : opt.value)}
                      activeOpacity={0.78}
                    >
                      <Text style={[styles.experienceChipText, { color: sel ? '#1A1A1A' : colors.mutedForeground }]}>
                        {t.registerTech.experienceOptions[idx]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Areas */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionBadgeRow}>
                <SectionBadge icon="map-pin" label={t.registerTech.areasSection} color={colors.primary} bgColor={colors.primaryLight} />
                {selectedAreaIds.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.countBadgeText}>{t.registerTech.areaCount(selectedAreaIds.length)}</Text>
                  </View>
                )}
              </View>

              {Object.keys(areasByGov).length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{t.registerTech.noAreasAvailable}</Text>
              ) : (
                <View style={[styles.accordionContainer, { borderColor: colors.border }]}>
                  {Object.values(areasByGov).map(({ gov, areas }, idx, arr) => {
                    const isExpanded = expandedGovIds.has(gov.id);
                    const selCount   = areas.filter(a => selectedAreaIds.includes(a.id)).length;
                    const allSel     = selCount === areas.length && areas.length > 0;
                    const isLast     = idx === arr.length - 1;
                    return (
                      <View key={gov.id}
                        style={!isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <TouchableOpacity style={styles.govRow} onPress={() => toggleGov(gov.id)} activeOpacity={0.7}>
                          <View style={{ width: 22 }}>
                            <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                          </View>
                          <View style={styles.govRowRight}>
                            <Text style={[styles.govName, { color: colors.foreground }]}>{gov.nameAr || gov.name}</Text>
                            {selCount > 0 && (
                              <View style={[styles.govBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.govBadgeText}>{selCount}</Text>
                              </View>
                            )}
                          </View>
                          {isExpanded && (
                            <TouchableOpacity
                              style={[styles.selectAllBtn, { borderColor: colors.primary + '50', backgroundColor: colors.primaryLight }]}
                              onPress={() => toggleAllInGov(areas)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={[styles.selectAllText, { color: colors.primaryDark }]}>
                                {allSel ? t.registerTech.deselectAll : t.registerTech.selectAll}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.areasGrid}>
                            {areas.map(area => {
                              const sel = selectedAreaIds.includes(area.id);
                              return (
                                <TouchableOpacity
                                  key={area.id}
                                  style={[
                                    styles.areaChip,
                                    { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primaryLight : colors.background },
                                  ]}
                                  onPress={() => toggleArea(area.id)}
                                  activeOpacity={0.75}
                                >
                                  <View style={[
                                    styles.areaCheckBox,
                                    { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent' },
                                  ]}>
                                    {sel && <Feather name="check" size={9} color="#1A1A1A" />}
                                  </View>
                                  <Text style={[styles.areaChipText, { color: sel ? colors.primaryDark : colors.foreground }]}
                                    numberOfLines={1}>
                                    {area.nameAr || area.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ══ STEP 3: Documents ═════════════════════════════════════════════ */}
        {step === 3 && (
          <View style={{ gap: 14 }}>

            {/* National ID card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SectionBadge icon="credit-card" label={t.registerTech.nationalIdSection} color={colors.primary} bgColor={colors.primaryLight} />

              <View style={styles.uploadRow}>
                <UploadCard
                  label={t.registerTech.uploadFrontLabel}
                  required
                  value={nationalIdFront}
                  uploading={uploadingFront}
                  onPress={() => pickAndUpload('national-ids', setNationalIdFront, setUploadingFront)}
                  onClear={() => setNationalIdFront(null)}
                  colors={colors}
                  uploadingLabel={t.registerTech.uploadingText}
                  tapLabel={t.registerTech.uploadTapToUpload}
                  replaceLabel={t.registerTech.uploadReplace}
                  deleteLabel={t.registerTech.uploadDelete}
                />
                <UploadCard
                  label={t.registerTech.uploadBackLabel}
                  required
                  value={nationalIdBack}
                  uploading={uploadingBack}
                  onPress={() => pickAndUpload('national-ids', setNationalIdBack, setUploadingBack)}
                  onClear={() => setNationalIdBack(null)}
                  colors={colors}
                  uploadingLabel={t.registerTech.uploadingText}
                  tapLabel={t.registerTech.uploadTapToUpload}
                  replaceLabel={t.registerTech.uploadReplace}
                  deleteLabel={t.registerTech.uploadDelete}
                />
              </View>

              {/* Status line */}
              {nationalIdFront && nationalIdBack ? (
                <View style={styles.uploadStatusRow}>
                  <Feather name="check-circle" size={14} color="#16a34a" />
                  <Text style={[styles.uploadStatusText, { color: '#16a34a' }]}>
                    {t.registerTech.uploadIdDone}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.uploadHint, { color: colors.mutedForeground }]}>
                  {t.registerTech.uploadIdHint}
                </Text>
              )}
            </View>

            {/* Personal photo card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionBadgeRow}>
                <SectionBadge icon="camera" label={t.registerTech.personalPhotoSection} color={colors.primary} bgColor={colors.primaryLight} />
                <View style={[styles.optionalBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.optionalBadgeText, { color: colors.mutedForeground }]}>{t.registerTech.optional}</Text>
                </View>
              </View>

              <View style={{ maxWidth: 160 }}>
                <UploadCard
                  label={t.registerTech.uploadPhotoLabel}
                  value={personalPhoto}
                  uploading={uploadingPhoto}
                  onPress={() => pickAndUpload('profiles', setPersonalPhoto, setUploadingPhoto)}
                  onClear={() => setPersonalPhoto(null)}
                  colors={colors}
                  tall
                  uploadingLabel={t.registerTech.uploadingText}
                  tapLabel={t.registerTech.uploadTapToUpload}
                  replaceLabel={t.registerTech.uploadReplace}
                  deleteLabel={t.registerTech.uploadDelete}
                />
              </View>
            </View>

            {/* Tips card */}
            <View style={[styles.tipsCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
              <View style={styles.tipsHeader}>
                <Feather name="info" size={14} color={colors.primaryDark} />
                <Text style={[styles.tipsTitle, { color: colors.primaryDark }]}>{t.registerTech.tipsTitle}</Text>
              </View>
              {[
                t.registerTech.tip1,
                t.registerTech.tip2,
                t.registerTech.tip3,
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.tipText, { color: colors.primaryDark }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ══ STEP 4: Review + Terms ════════════════════════════════════════ */}
        {step === 4 && (
          <View style={{ gap: 14 }}>

            {/* Personal summary */}
            <ReviewSection
              icon="user" title={t.registerTech.step1} onEdit={() => setStep(1)} colors={colors}
              editLabel={t.registerTech.editBtn}
              theme={{ accent: '#2563EB', tint: '#EFF6FF', border: '#BFDBFE' }}
            >
              <ReviewRow label={t.auth.fullNameLabel}          value={fullName}          colors={colors} />
              <ReviewRow label={t.auth.mobileLabel}            value={mobile}            colors={colors} dir="ltr" />
              <ReviewRow label={t.registerTech.nationalIdLabel} value={nationalId || '—'} colors={colors} />
              <ReviewRow label={t.auth.passwordLabel}          value="••••••••"          colors={colors} last />
            </ReviewSection>

            {/* Professional summary */}
            <ReviewSection
              icon="briefcase" title={t.registerTech.step2} onEdit={() => setStep(2)} colors={colors}
              editLabel={t.registerTech.editBtn}
              theme={{ accent: '#7C3AED', tint: '#F5F3FF', border: '#DDD6FE' }}
            >
              <ReviewRow label={t.registerTech.selectedServicesLabel} value={t.registerTech.serviceCount(selectedServices.length)} colors={colors} />
              {selectedServices.length > 0 && (
                <View style={styles.tagRow}>
                  {selectedServices.map(id => (
                    <View key={id} style={[styles.tag, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' }]}>
                      <Text style={[styles.tagText, { color: colors.primaryDark }]}>{getServiceName(id)}</Text>
                    </View>
                  ))}
                </View>
              )}
              <ReviewRow label={t.editProfile.experienceSection} value={getExperienceLabel(yearsOfExperience)} colors={colors} />
              <ReviewRow label={t.registerTech.areasSection}    value={t.registerTech.areaCount(selectedAreaIds.length)} colors={colors} last />
            </ReviewSection>

            {/* Documents summary */}
            <ReviewSection
              icon="camera" title={t.registerTech.step3} onEdit={() => setStep(3)} colors={colors}
              editLabel={t.registerTech.editBtn}
              theme={{ accent: '#059669', tint: '#ECFDF5', border: '#A7F3D0' }}
            >
              <View style={styles.docPreviewRow}>
                {[
                  { label: t.registerTech.docFront,          uri: nationalIdFront, required: true },
                  { label: t.registerTech.docBack,           uri: nationalIdBack,  required: true },
                  { label: t.registerTech.uploadPhotoLabel,  uri: personalPhoto,   required: true },
                ].map(({ label, uri, required }) => (
                  <View key={label} style={styles.docPreviewItem}>
                    <View style={[
                      styles.docPreviewThumb,
                      { borderColor: uri ? colors.primary + '40' : colors.border, backgroundColor: colors.background },
                      !!uri && { borderStyle: 'solid' },
                    ]}>
                      {uri ? (
                        <Image source={{ uri }} style={styles.docPreviewImg} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 18 }}>{required ? '❌' : '—'}</Text>
                      )}
                    </View>
                    <Text style={[styles.docPreviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </ReviewSection>

            {/* Terms */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.termsRow, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}
                onPress={() => setAcceptTerms(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: acceptTerms ? colors.primary : colors.border, backgroundColor: acceptTerms ? colors.primary : 'transparent' },
                ]}>
                  {acceptTerms && <Feather name="check" size={12} color="#1A1A1A" />}
                </View>
                <Text style={[styles.termsText, { color: colors.foreground }]}>
                  {t.registerTech.termsAgree(appName)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login hint */}
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.auth.hasAccountShort}</Text>
              <Link href="/" style={[styles.footerLink, { color: colors.primary }]}>{t.auth.loginLink}</Link>
            </View>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Error banner ── */}
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderTopColor: '#FECACA' }]}>
          <Feather name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Fixed navigation footer ── */}
      <View style={[styles.navFooter, { paddingBottom: botPad + 12, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.navBtns}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={handlePrev}
              activeOpacity={0.75}
            >
              <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
              <Text style={[styles.ghostBtnText, { color: colors.mutedForeground }]}>{t.registerTech.navPrev}</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.primaryBtnFlex, { backgroundColor: colors.primary }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <View style={styles.btnInner}>
                <Text style={styles.primaryBtnText}>{t.registerTech.navNext}</Text>
                <Feather name="arrow-left" size={17} color="#1A1A1A" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.primaryBtnFlex, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1A1A1A" size="small" />
              ) : (
                <View style={styles.btnInner}>
                  <Feather name="send" size={17} color="#1A1A1A" />
                  <Text style={styles.primaryBtnText}>{t.registerTech.submitBtn}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionBadge({
  icon, label, color, bgColor,
}: { icon: any; label: string; color: string; bgColor: string }) {
  return (
    <View style={[styles.sectionBadge, { backgroundColor: bgColor, borderColor: color + '40' }]}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.sectionBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// Premium upload card — matches web's ImageUploadCard in behaviour
function UploadCard({
  label, required, value, uploading, onPress, onClear, colors, tall,
  uploadingLabel, tapLabel, replaceLabel, deleteLabel,
}: {
  label: string; required?: boolean; value: string | null;
  uploading: boolean; onPress: () => void; onClear: () => void;
  colors: any; tall?: boolean;
  uploadingLabel?: string; tapLabel?: string; replaceLabel?: string; deleteLabel?: string;
}) {
  const h = tall ? 130 : 110;
  return (
    <View style={styles.uploadCardWrap}>
      <Text style={[styles.uploadCardLabel, { color: colors.mutedForeground }]}>
        {label}{required && <Text style={{ color: '#E53E3E' }}> *</Text>}
      </Text>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={[
            styles.uploadCardArea,
            { height: h },
            value
              ? { borderStyle: 'solid', borderColor: colors.primary + '50', backgroundColor: 'transparent' }
              : { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.background },
          ]}
          onPress={value ? undefined : onPress}
          activeOpacity={value ? 1 : 0.75}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadCardInner}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.uploadCardHint, { color: colors.mutedForeground }]}>{uploadingLabel ?? 'جاري الرفع...'}</Text>
            </View>
          ) : value ? (
            <Image source={{ uri: value }} style={styles.uploadCardImg} resizeMode="cover" />
          ) : (
            <View style={styles.uploadCardInner}>
              <View style={[styles.uploadCardIconCircle, { backgroundColor: colors.muted }]}>
                <Feather name="upload" size={18} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.uploadCardAction, { color: colors.foreground }]}>{tapLabel ?? 'اضغط للرفع'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Replace / Clear overlay when image is selected */}
        {value && !uploading && (
          <View style={styles.uploadOverlay}>
            <TouchableOpacity
              style={[styles.overlayBtn, { backgroundColor: 'rgba(255,255,255,0.92)' }]}
              onPress={onPress}
            >
              <Feather name="refresh-cw" size={12} color="#333" />
              <Text style={styles.overlayBtnText}>{replaceLabel ?? 'استبدال'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overlayBtn, { backgroundColor: 'rgba(229,62,62,0.9)' }]}
              onPress={onClear}
            >
              <Feather name="trash-2" size={12} color="#fff" />
              <Text style={[styles.overlayBtnText, { color: '#fff' }]}>{deleteLabel ?? 'حذف'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const InputField = React.forwardRef<TextInputType, {
  label: string; required?: boolean; icon: any;
  placeholder: string; value: string; onChangeText: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
  secureTextEntry?: boolean; keyboardType?: any; textContentType?: any;
  autoComplete?: any; returnKeyType?: any; onSubmitEditing?: () => void;
  blurOnSubmit?: boolean; maxLength?: number; colors: any;
}>(function InputField({ label, required, icon, focused, colors, ...props }, ref) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {label}{required && <Text style={{ color: '#E53E3E' }}> *</Text>}
      </Text>
      <View style={[
        styles.inputRow,
        { backgroundColor: focused ? colors.card : colors.background, borderColor: colors.border },
        focused && { borderColor: colors.primary },
      ]}>
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.foreground }]}
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          {...props}
        />
        <View style={[styles.iconWrap, { backgroundColor: focused ? colors.primary + '15' : colors.muted }]}>
          <Feather name={icon} size={16} color={focused ? colors.primary : colors.mutedForeground} />
        </View>
      </View>
    </View>
  );
});

function ReviewSection({
  icon, title, onEdit, children, colors, theme, editLabel,
}: {
  icon: any; title: string; onEdit: () => void; children: React.ReactNode; colors: any;
  theme: { accent: string; tint: string; border: string };
  editLabel?: string;
}) {
  return (
    <View style={[
      styles.reviewCard,
      { backgroundColor: theme.tint, borderColor: theme.border },
    ]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderLeft}>
          <View style={[styles.reviewIconCircle, { backgroundColor: theme.accent + '18' }]}>
            <Feather name={icon} size={16} color={theme.accent} />
          </View>
          <Text style={[styles.reviewTitle, { color: theme.accent }]}>{title}</Text>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, { borderColor: theme.accent + '45', backgroundColor: '#FFFFFFB8' }]}
          onPress={onEdit}
        >
          <Text style={[styles.editBtnText, { color: theme.accent }]}>{editLabel ?? 'تعديل'}</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function ReviewRow({
  label, value, colors, dir, last,
}: { label: string; value: string; colors: any; dir?: 'ltr' | 'rtl'; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border + '80' }]}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: colors.foreground, direction: dir }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10, gap: 8,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle:  { fontSize: 16, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  headerSub:    { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  backBtn:      { alignSelf: 'flex-start' },
  backBtnInner: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Step indicator
  stepBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  stepItem:   { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum:   { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  stepLabel: { fontSize: 8, fontFamily: 'Cairo_500Medium', textAlign: 'center', maxWidth: 52 },
  stepLine:  { flex: 1, height: 2, marginBottom: 14, marginHorizontal: 3 },

  // ── Progress
  progressTrack: { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 14, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },

  // ── Step content
  stepContent: { paddingHorizontal: 16, gap: 14, paddingTop: 2 },

  // ── Card
  card: {
    borderRadius: 22, borderWidth: 1,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },

  // ── Section badge
  sectionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-end',
  },
  sectionBadgeText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },

  // ── Count / optional badges
  countBadge:       { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  countBadgeText:   { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#1A1A1A' },
  optionalBadge:    { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  optionalBadgeText:{ fontSize: 11, fontFamily: 'Cairo_500Medium' },

  // ── Input fields
  fieldGroup: { gap: 5 },
  label: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 10, gap: 8, height: 46,
  },
  input: {
    flex: 1, height: 46,
    fontSize: 14, fontFamily: 'Cairo_400Regular',
    textAlign: 'auto', paddingHorizontal: 4,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Services grid
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceCard: {
    width: '30%', minWidth: 85,
    paddingVertical: 9, paddingHorizontal: 5,
    borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', gap: 5, position: 'relative',
  },
  serviceCheck: {
    position: 'absolute', top: 4,
    right: 4,
    width: 15, height: 15, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceIconBg: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceIconImg: { width: 26, height: 26, borderRadius: 4 },
  serviceCardLabel: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', lineHeight: 14 },
  emptyHint:        { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center', paddingVertical: 8 },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    alignSelf: 'center', marginTop: 2,
  },
  showMoreText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },

  // ── Experience chips
  experienceRow:      { gap: 8, paddingVertical: 2, paddingHorizontal: 2 },
  experienceChip:     { borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 9 },
  experienceChipText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },

  // ── Areas accordion
  accordionContainer: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  govRow: {
    flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  govRowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  govName:    { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  govBadge:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  govBadgeText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#1A1A1A' },
  selectAllBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  selectAllText:{ fontSize: 11, fontFamily: 'Cairo_700Bold' },
  areasGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  areaChip:   {
    flexDirection: 'row',
    alignItems: 'center', gap: 6,
    borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 7,
  },
  areaCheckBox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  areaChipText: { fontSize: 12, fontFamily: 'Cairo_500Medium' },

  // ── Upload cards
  uploadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadCardWrap:   { flex: 1, gap: 6 },
  uploadCardLabel:  { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' },
  uploadCardArea: {
    borderRadius: 14, borderWidth: 1.5,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  uploadCardInner: { alignItems: 'center', gap: 8, padding: 12 },
  uploadCardIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadCardAction: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  uploadCardHint:   { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  uploadCardImg:    { width: '100%', height: '100%' },
  uploadOverlay: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center', gap: 6,
  },
  overlayBtn: {
    flexDirection: 'row',
    alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  overlayBtnText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#333' },
  uploadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center', gap: 6, justifyContent: 'center',
  },
  uploadStatusText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  uploadHint:       { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'center' },

  // ── Tips
  tipsCard: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center', gap: 6,
  },
  tipsTitle:  { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', gap: 8,
  },
  tipDot:     { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  tipText:    { flex: 1, fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 20 },

  // ── Review
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center', gap: 7,
  },
  reviewCard: {
    borderRadius: 22, borderWidth: 1,
    paddingHorizontal: 18, paddingTop: 17, paddingBottom: 19,
    gap: 14,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09, shadowRadius: 14, elevation: 4,
  },
  reviewIconCircle: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewTitle:      { fontSize: 15, fontFamily: 'Cairo_700Bold' },
  editBtn:          { borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  editBtnText:      { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9,
  },
  reviewLabel:      { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  reviewValue:      { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  tagRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
  tag:              { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  tagText:          { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },

  // ── Doc preview (review step)
  docPreviewRow: {
    flexDirection: 'row',
    gap: 10, paddingTop: 4,
  },
  docPreviewItem:  { flex: 1, alignItems: 'center', gap: 6 },
  docPreviewThumb: {
    width: '100%', height: 64, borderRadius: 10, borderWidth: 1.5,
    borderStyle: 'dashed', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  docPreviewImg:   { width: '100%', height: '100%' },
  docPreviewLabel: { fontSize: 10, fontFamily: 'Cairo_400Regular', textAlign: 'center' },

  // ── Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10, borderRadius: 14, borderWidth: 1, padding: 14,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  termsText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  termsLink: { fontFamily: 'Cairo_700Bold' },

  // ── Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center', paddingVertical: 4,
  },
  footerText: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  footerLink: { fontSize: 13, fontFamily: 'Cairo_700Bold' },

  // ── Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1,
  },
  errorText: { flex: 1, color: '#DC2626', fontFamily: 'Cairo_500Medium', fontSize: 12, textAlign: 'auto' },

  // ── Fixed nav footer
  navFooter: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  navBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostBtn: {
    flex: 1, height: 50, borderRadius: 16, borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  ghostBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold' },

  // ── Primary amber button — same as Login / Register
  primaryBtn: {
    height: 50, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 5,
  },
  primaryBtnFlex: { flex: 2 },
  btnDisabled:    { opacity: 0.6, elevation: 0, shadowOpacity: 0 },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  primaryBtnText: { color: '#1A1A1A', fontSize: 16, fontFamily: 'Cairo_700Bold', letterSpacing: 0.3 },

  // ── Success screen
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successIconRing:  {
    width: 88, height: 88, borderRadius: 44, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  successTitle:     { fontSize: 22, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  successSub:       { fontSize: 14, fontFamily: 'Cairo_400Regular', textAlign: 'center', lineHeight: 26 },
  successNote:      {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14, width: '100%',
  },
  successNoteText:  { flex: 1, fontSize: 13, fontFamily: 'Cairo_500Medium', lineHeight: 22 },
});
