/**
 * Technician / Customer Profile Edit Screen — /edit-profile
 *
 * Matches the website's technician profile page (artifacts/fnashha/src/pages/technician/profile.tsx):
 *
 *  1. Profile image section — photo + camera-overlay upload button
 *  2. Edit Data form — fullName, email, password-change section (current / new / confirm)
 *  3. Services Provided (read-only, technician only)
 *  4. Years of Experience (read-only, technician only)
 *  5. Covered Areas (editable, technician only) — grouped by governorate, collapsible,
 *     checkbox grid, select-all per gov, dedicated save button
 *
 * Business logic, API endpoints, validation rules and RTL behaviour mirror the website.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, apiUpload, resolveMediaUrl } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import type { Area, Governorate, AppUser } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: 1,  label: 'سنة واحدة' },
  { value: 2,  label: 'سنتان' },
  { value: 3,  label: '3 سنوات' },
  { value: 5,  label: '5 سنوات' },
  { value: 7,  label: '7 سنوات' },
  { value: 10, label: '10 سنوات' },
  { value: 15, label: '15 سنة' },
  { value: 20, label: '20 سنة أو أكثر' },
];

interface TechProfile {
  services?: { id: number; nameAr?: string; name?: string }[];
  areas?: { id: number }[];
  yearsOfExperience?: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { locale } = useLocale();
  const t = translations[locale];
  const colors       = useColors();
  const insets       = useSafeAreaInsets();
  const { user, accessToken, updateUser } = useAuth();
  const queryClient  = useQueryClient();
  const isTechnician = user?.role === 'technician';
  const bottomContentPadding = (isTechnician ? TECH_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT) + insets.bottom + 40;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fullName,         setFullName]         = useState(user?.fullName ?? '');
  const [email,            setEmail]            = useState(user?.email ?? '');
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showCurrentPass,  setShowCurrentPass]  = useState(false);
  const [showNewPass,      setShowNewPass]      = useState(false);
  const [showConfirmPass,  setShowConfirmPass]  = useState(false);
  const [formError,        setFormError]        = useState('');

  // ── Profile image ──────────────────────────────────────────────────────────
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Areas ──────────────────────────────────────────────────────────────────
  const [selectedAreaIds,  setSelectedAreaIds]  = useState<number[]>([]);
  const [expandedGovIds,   setExpandedGovIds]   = useState<Set<number>>(new Set());
  const [savingAreas,      setSavingAreas]      = useState(false);

  // ── Remote data (technician only) ─────────────────────────────────────────
  const { data: techProfile } = useQuery<TechProfile>({
    queryKey: ['tech-profile', user?.id],
    queryFn:  () => apiFetch<TechProfile>(`/api/technicians/${user!.id}/profile`, { token: accessToken }),
    enabled:  !!user?.id && isTechnician,
  });

  const { data: allAreas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn:  () => apiFetch<Area[]>('/api/areas'),
    enabled:  isTechnician,
  });

  const { data: governorates = [] } = useQuery<Governorate[]>({
    queryKey: ['governorates'],
    queryFn:  () => apiFetch<Governorate[]>('/api/governorates'),
    enabled:  isTechnician,
  });

  // Seed selected areas from the technician's existing profile
  useEffect(() => {
    if (techProfile?.areas) {
      setSelectedAreaIds(techProfile.areas.map(a => a.id).filter(Boolean));
    }
  }, [techProfile]);

  // ── Area grouping ──────────────────────────────────────────────────────────
  const areasByGov: Record<number, { gov: Governorate; areas: Area[] }> = {};
  governorates.forEach(gov => {
    const govAreas = allAreas.filter(a => a.governorateId === gov.id);
    if (govAreas.length > 0) areasByGov[gov.id] = { gov, areas: govAreas };
  });

  // ── Area helpers ───────────────────────────────────────────────────────────
  const toggleArea = (id: number) =>
    setSelectedAreaIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const toggleGov = (id: number) =>
    setExpandedGovIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAllInGov = (areas: Area[]) => {
    const ids    = areas.map(a => a.id);
    const allSel = ids.every(id => selectedAreaIds.includes(id));
    setSelectedAreaIds(p =>
      allSel ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])],
    );
  };

  const experienceLabel = (v: number | null | undefined): string | null =>
    v != null
      ? (EXPERIENCE_OPTIONS.find(o => o.value === v)?.label ?? `${v} سنوات`)
      : null;

  // ── Profile save mutation ──────────────────────────────────────────────────
  const saveProfile = useMutation({
    mutationFn: ({ payload, token }: { payload: Record<string, any>; token: string | null }) =>
      apiFetch<AppUser>(`/api/users/${user?.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      updateUser({ fullName: updated.fullName, email: updated.email });
      queryClient.invalidateQueries({ queryKey: ['tech-profile', user?.id] });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t.editProfile.alertDoneTitle, t.editProfile.alertSaveSuccess, [
        { text: t.editProfile.alertOk, onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert(t.common.error, e.message || t.editProfile.alertUnknownError),
  });

  const handleSave = () => {
    setFormError('');

    if (fullName.trim().length < 3) {
      setFormError(t.editProfile.errNameTooShort);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError(t.editProfile.errInvalidEmail);
      return;
    }
    if (newPassword) {
      if (!currentPassword) {
        setFormError(t.editProfile.errCurrentPasswordRequired);
        return;
      }
      if (newPassword.length < 6) {
        setFormError(t.editProfile.errNewPasswordTooShort);
        return;
      }
      if (newPassword !== confirmPassword) {
        setFormError(t.editProfile.errPasswordMismatch);
        return;
      }
    }

    const payload: Record<string, any> = {
      fullName: fullName.trim(),
      email:    email || undefined,
    };
    if (newPassword && currentPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword     = newPassword;
    }
    saveProfile.mutate({ payload, token: accessToken });
  };

  // ── Profile image upload ───────────────────────────────────────────────────
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.editProfile.alertPermTitle, t.editProfile.alertPermMsg);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) {
      Alert.alert(t.editProfile.alertFileTooLargeTitle, t.editProfile.alertFileTooLargeMsg);
      return;
    }

    setUploadingImage(true);
    try {
      const fd = new FormData();
      const fileName = asset.fileName ?? 'photo.jpg';
      const mimeType = asset.mimeType ?? 'image/jpeg';

      if (Platform.OS === 'web') {
        // Browsers cannot append React Native's { uri, type, name } object.
        // This branch is only for browser/blob URIs; native local URIs must
        // never be passed to fetch(), which causes Android "Network request
        // failed" before the API request is made.
        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();
        fd.append('file', blob.slice(0, blob.size, mimeType), fileName);
      } else {
        // React Native's multipart adapter reads content:// and file:// picker
        // URIs directly. This also preserves the actual picker MIME type.
        fd.append('file', { uri: asset.uri, name: fileName, type: mimeType } as any);
      }

      const { url } = await apiUpload<{ url: string }>(
        '/api/upload/user?category=profiles',
        fd,
        accessToken,
      );

      await apiFetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        token:  accessToken,
        body:   JSON.stringify({ profileImage: url }),
      });

      updateUser({ profileImage: url });
      queryClient.invalidateQueries({ queryKey: ['tech-profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['tech-public-profile'] });
      Alert.alert(t.editProfile.alertDoneTitle, t.editProfile.alertPhotoSuccess);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.editProfile.alertPhotoError);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Save areas ─────────────────────────────────────────────────────────────
  const handleSaveAreas = async () => {
    setSavingAreas(true);
    try {
      await apiFetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        token:  accessToken,
        body:   JSON.stringify({ areaIds: selectedAreaIds }),
      });
      queryClient.invalidateQueries({ queryKey: ['tech-profile', user?.id] });
      Alert.alert(t.editProfile.alertDoneTitle, t.editProfile.alertAreasSaved);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.editProfile.alertAreasError);
    } finally {
      setSavingAreas(false);
    }
  };

  // ── Avatar URI ─────────────────────────────────────────────────────────────
  const avatarUri = resolveMediaUrl(user?.profileImage);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.customerAccount.editProfile} />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottomContentPadding,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══ 1. Profile image ═══════════════════════════════════════════════ */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.imageSection}>
            <View style={styles.avatarWrap}>
              {uploadingImage ? (
                <View style={[styles.avatar, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="user" size={36} color={colors.primary} />
                </View>
              )}
              <TouchableOpacity
                style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
                onPress={handlePickImage}
                disabled={uploadingImage}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.avatarName,   { color: colors.foreground }]}>{user?.fullName}</Text>
            <Text style={[styles.avatarMobile, { color: colors.mutedForeground }]}>{user?.mobile}</Text>
          </View>
        </View>

        {/* ══ 2. Edit data form ══════════════════════════════════════════════ */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.editProfile.editDataSection}</Text>

          {/* Full name */}
          <FieldGroup label={t.editProfile.fullNameLabel} colors={colors}>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t.editProfile.placeholderFullName}
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
              />
            </View>
          </FieldGroup>

          {/* Email */}
          <FieldGroup label={t.editProfile.emailLabel} colors={colors} mt={14}>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
              />
            </View>
          </FieldGroup>

          {/* ── Password section ─────────────────────────────────────────── */}
          <View style={[styles.sectionDivider, { borderColor: colors.border }]} />

          <View style={[styles.passwordHeader, { gap: 6 }]}>
            <Feather name="lock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.passwordSectionLabel, { color: colors.foreground }]}>
              {t.editProfile.changePasswordSection}
            </Text>
          </View>

          {/* Current password */}
          <FieldGroup label={t.editProfile.currentPasswordLabel} colors={colors} mt={12}>
            <PasswordField
              value={currentPassword}
              onChangeText={setCurrentPassword}
              show={showCurrentPass}
              onToggleShow={() => setShowCurrentPass(p => !p)}
              placeholder={t.editProfile.placeholderCurrentPassword}
              colors={colors}
            />
          </FieldGroup>

          {/* New password */}
          <FieldGroup label={t.editProfile.newPasswordLabel} colors={colors} mt={12}>
            <PasswordField
              value={newPassword}
              onChangeText={setNewPassword}
              show={showNewPass}
              onToggleShow={() => setShowNewPass(p => !p)}
              placeholder={t.editProfile.placeholderNewPassword}
              colors={colors}
            />
          </FieldGroup>

          {/* Confirm password */}
          <FieldGroup label={t.editProfile.confirmPasswordLabel} colors={colors} mt={12}>
            <PasswordField
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              show={showConfirmPass}
              onToggleShow={() => setShowConfirmPass(p => !p)}
              placeholder={t.editProfile.placeholderConfirmPassword}
              colors={colors}
            />
          </FieldGroup>

          {/* Inline validation error */}
          {!!formError && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{formError}</Text>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: colors.primary, marginTop: 18 },
              saveProfile.isPending && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={saveProfile.isPending}
            activeOpacity={0.85}
          >
            {saveProfile.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t.editProfile.saveBtn}</Text>}
          </TouchableOpacity>
        </View>

        {/* ══ 3. Services (read-only, technician only) ══════════════════════ */}
        {isTechnician && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="briefcase" size={15} color={colors.foreground} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                {t.editProfile.servicesSection}
              </Text>
            </View>

            <View style={[styles.badgesRow, { marginTop: 10 }]}>
              {(techProfile?.services ?? []).length > 0
                ? techProfile!.services!.map(s => (
                    <View key={s.id} style={[styles.badge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: colors.foreground }]}>
                        {s.nameAr ?? s.name}
                      </Text>
                    </View>
                  ))
                : (
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                    {t.editProfile.servicesEmpty}
                  </Text>
                )
              }
            </View>

            <InfoNote colors={colors}>{t.editProfile.servicesNote}</InfoNote>
          </View>
        )}

        {/* ══ 4. Experience (read-only, technician only) ════════════════════ */}
        {isTechnician && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="briefcase" size={15} color={colors.foreground} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                {t.editProfile.experienceSection}
              </Text>
            </View>

            <Text style={[styles.expValue, { color: colors.foreground, marginTop: 10 }]}>
              {experienceLabel(techProfile?.yearsOfExperience) ?? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Cairo_400Regular' }}>
                  {t.editProfile.experienceEmpty}
                </Text>
              )}
            </Text>

            <InfoNote colors={colors}>{t.editProfile.experienceNote}</InfoNote>
          </View>
        )}

        {/* ══ 5. Covered Areas (editable, technician only) ══════════════════ */}
        {isTechnician && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="map-pin" size={15} color={colors.foreground} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                {t.editProfile.areasSection}
              </Text>
            </View>

            {Object.keys(areasByGov).length === 0 ? (
              <Text style={[styles.emptyHint, { color: colors.mutedForeground, marginTop: 10 }]}>
                {t.editProfile.areasEmpty}
              </Text>
            ) : (
              <View style={[styles.areasList, { borderColor: colors.border, marginTop: 12 }]}>
                {Object.entries(areasByGov).map(([govIdStr, { gov, areas }], idx, arr) => {
                  const govId      = Number(govIdStr);
                  const isExpanded = expandedGovIds.has(govId);
                  const selCount   = areas.filter(a => selectedAreaIds.includes(a.id)).length;
                  const allSel     = selCount === areas.length && areas.length > 0;
                  const isLast     = idx === arr.length - 1;

                  return (
                    <View
                      key={govId}
                      style={!isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      }}
                    >
                      {/* Governorate header row */}
                      <TouchableOpacity
                        style={styles.govRow}
                        onPress={() => toggleGov(govId)}
                        activeOpacity={0.7}
                      >
                        {/* Left (visual): chevron + select-all link */}
                        <View style={styles.govRowLeft}>
                          {isExpanded && (
                            <TouchableOpacity
                              onPress={() => toggleAllInGov(areas)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={[styles.selectAll, { color: colors.primary }]}>
                                {allSel ? t.editProfile.deselectAll : t.editProfile.selectAll}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <Feather
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.mutedForeground}
                          />
                        </View>

                        {/* Right (visual): governorate name + count badge */}
                        <View style={styles.govRowRight}>
                          {selCount > 0 && (
                            <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
                              <Text style={styles.countPillText}>{selCount}</Text>
                            </View>
                          )}
                          <Text style={[styles.govName, { color: colors.foreground }]}>
                            {gov.nameAr}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Area grid */}
                      {isExpanded && (
                        <View style={styles.areaGrid}>
                          {areas.map(area => {
                            const sel = selectedAreaIds.includes(area.id);
                            return (
                              <TouchableOpacity
                                key={area.id}
                                style={[
                                  styles.areaBtn,
                                  {
                                    borderColor:     sel ? colors.primary : colors.border,
                                    backgroundColor: sel ? colors.primary + '15' : colors.background,
                                  },
                                ]}
                                onPress={() => toggleArea(area.id)}
                                activeOpacity={0.75}
                              >
                                <View style={[
                                  styles.checkbox,
                                  { borderColor: sel ? colors.primary : colors.mutedForeground + '66' },
                                  sel && { backgroundColor: colors.primary },
                                ]}>
                                  {sel && <Feather name="check" size={10} color="#fff" />}
                                </View>
                                <Text
                                  style={[
                                    styles.areaBtnText,
                                    { color: sel ? colors.primary : colors.foreground },
                                    sel && { fontFamily: 'Cairo_600SemiBold' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {area.nameAr ?? area.name}
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

            {/* Save areas button */}
            <TouchableOpacity
              style={[
                styles.outlineBtn,
                { borderColor: colors.primary, marginTop: 14 },
                savingAreas && styles.btnDisabled,
              ]}
              onPress={handleSaveAreas}
              disabled={savingAreas}
              activeOpacity={0.85}
            >
              {savingAreas
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={[styles.outlineBtnText, { color: colors.primary }]}>{t.editProfile.saveAreasBtn}</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldGroup({
  label, children, colors, mt,
}: {
  label: string; children: React.ReactNode; colors: any; mt?: number;
}) {
  return (
    <View style={{ gap: 6, marginTop: mt ?? 0 }}>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

function PasswordField({
  value, onChangeText, show, onToggleShow, placeholder, colors,
}: {
  value: string; onChangeText: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  placeholder: string; colors: any;
}) {
  return (
    <View style={[s.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={onToggleShow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[s.eyeBtn, { backgroundColor: colors.muted }]}
      >
        <Feather name={show ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TextInput
        style={[s.inputFlex, { color: colors.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={!show}
        textAlign="right"
        autoCapitalize="none"
      />
    </View>
  );
}

function InfoNote({ children, colors }: { children: string; colors: any }) {
  return (
    <View style={[s.infoNote, { backgroundColor: colors.muted + '80', borderColor: colors.border, marginTop: 10 }]}>
      <Text style={[s.infoNoteText, { color: colors.mutedForeground }]}>{children}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  // ── Profile image ──
  imageSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  avatarMobile: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    marginTop: 2,
  },
  // ── Section headers ──
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 14,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordSectionLabel: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
  },
  // ── Form ──
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 1,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    paddingVertical: 13,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    marginTop: 8,
  },
  // ── Buttons ──
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
  },
  outlineBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
  },
  // ── Services badges ──
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
  // ── Experience ──
  expValue: {
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
  },
  // ── Areas ──
  areasList: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  govRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  govRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  govRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  govName: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
  },
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countPillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Cairo_700Bold',
  },
  selectAll: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
  },
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  areaBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  areaBtnText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
});

// Shared styles used by sub-components
const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
  },
  inputRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    paddingVertical: 13,
  },
  eyeBtn: {
    borderRadius: 8,
    padding: 6,
  },
  infoNote: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  infoNoteText: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
});
