/// CMS branding + contact values fetched from GET /api/cms/settings.
///
/// Flutter equivalent of the web's BrandingValues interface in
/// branding-context.tsx. Exposes the subset of CMS keys relevant to
/// mobile identity: logo, splash logo, app names, and contact info.
///
/// When a new CMS branding key is added to the backend's CMS_KEYS list
/// in artifacts/api-server/src/routes/cms.ts, add a corresponding field
/// here. This is the ONLY file that needs to change in Flutter for new
/// CMS branding keys.
class CmsSettings {
  /// Brand logo image URL (Cloudinary). Null when not configured in CMS.
  final String? logoUrl;

  /// Splash fallback logo image URL (used by _LogoSplash in IntroScreen).
  /// Null when not configured in CMS.
  final String? splashLogoUrl;

  /// Mobile app display name (CMS key: appName). Falls back to siteNameAr.
  final String appName;

  /// Arabic site name (CMS key: siteNameAr).
  final String siteNameAr;

  // ── Contact details ────────────────────────────────────────────────────────

  /// Hotline / contact phone number (CMS key: contactPhone).
  final String? contactPhone;

  /// Support email address (CMS key: contactEmail).
  final String? contactEmail;

  /// WhatsApp number — plain digits, used to build a wa.me URL
  /// (CMS key: whatsappNumber).
  final String? whatsappNumber;

  const CmsSettings({
    this.logoUrl,
    this.splashLogoUrl,
    this.appName    = 'فنشها',
    this.siteNameAr = 'فنشها',
    this.contactPhone,
    this.contactEmail,
    this.whatsappNumber,
  });

  /// Defaults used before CMS data arrives and as network-error fallback.
  /// Mirrors web DEFAULT_BRANDING in branding-context.tsx.
  static const CmsSettings defaults = CmsSettings();

  factory CmsSettings.fromMap(Map<String, dynamic> map) {
    String? nonEmpty(String key) {
      final v = map[key];
      if (v is String && v.isNotEmpty) return v;
      return null;
    }

    return CmsSettings(
      logoUrl:        nonEmpty('logoUrl'),
      splashLogoUrl:  nonEmpty('splashLogoUrl'),
      appName:        nonEmpty('appName') ?? nonEmpty('siteNameAr') ?? 'فنشها',
      siteNameAr:     nonEmpty('siteNameAr') ?? 'فنشها',
      contactPhone:   nonEmpty('contactPhone'),
      contactEmail:   nonEmpty('contactEmail'),
      whatsappNumber: nonEmpty('whatsappNumber'),
    );
  }
}
