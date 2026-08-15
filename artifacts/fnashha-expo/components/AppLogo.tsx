/**
 * Global reusable logo component — matches the Web app's container exactly.
 *
 * Web reference (site-header.tsx / dashboard-header.tsx):
 *   container: borderRadius 10-11, overflow hidden
 *   border: 1.5px solid rgba(245,197,24,0.5)    ← golden border
 *   boxShadow: 0 2px 8px rgba(245,197,24,0.18)  ← golden glow
 *   No white background; image fills the container.
 *
 * - Reads logoUrl from CMS; falls back to the local asset.
 * - resizeMode="contain" keeps the image uncropped.
 * - `opacity` dims the whole unit for unfocused tab states.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';

interface AppLogoProps {
  /** Width & height of the logo container in dp. Default: 36. */
  size?: number;
  /** Opacity for unfocused tab states. Default: 1. */
  opacity?: number;
}

export function AppLogo({ size = 36, opacity = 1 }: AppLogoProps) {
  const { get } = useCmsSettings();
  const cmsLogoUrl = get(CMS_KEYS.LOGO_URL);

  // Image is rendered at 112% of the container so the logo artwork appears
  // slightly larger. overflow:'hidden' on the container clips only the
  // transparent padding around the artwork — the visible logo is never cropped.
  const imgSize = size * 1.12;

  return (
    <View style={[styles.container, { width: size, height: size, opacity }]}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={cmsLogoUrl ? { uri: cmsLogoUrl } : require('@/assets/images/logo.png')}
        style={{ width: imgSize, height: imgSize }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Matches web: borderRadius 11, overflow hidden, golden border + glow
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.5)',
    // Golden shadow — mirrors web's boxShadow: 0 2px 8px rgba(245,197,24,0.18)
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
});
