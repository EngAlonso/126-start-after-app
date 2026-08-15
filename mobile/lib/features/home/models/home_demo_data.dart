import 'package:flutter/material.dart';

/// Static placeholder data for the Phase 3A home screen prototype.
///
/// NOT sourced from any service/provider — Phase 3A is a visual prototype
/// only. Every list here exists purely to give the layout something to
/// render and must be replaced by real API-backed state in a later phase.

// ─── Services ─────────────────────────────────────────────────────────────

class DemoService {
  const DemoService({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;
}

const demoServices = <DemoService>[
  DemoService(
    label: 'كهرباء',
    icon: Icons.bolt_rounded,
    color: Color(0xFFE9B73A),
  ),
  DemoService(
    label: 'سباكة',
    icon: Icons.plumbing_rounded,
    color: Color(0xFF3CA7DD),
  ),
  DemoService(
    label: 'تكييف',
    icon: Icons.ac_unit_rounded,
    color: Color(0xFF22C35D),
  ),
  DemoService(
    label: 'نظافة',
    icon: Icons.cleaning_services_rounded,
    color: Color(0xFFAF57DB),
  ),
  DemoService(
    label: 'دهانات',
    icon: Icons.format_paint_rounded,
    color: Color(0xFFE9B73A),
  ),
  DemoService(
    label: 'نجارة',
    icon: Icons.carpenter_rounded,
    color: Color(0xFF3CA7DD),
  ),
  DemoService(
    label: 'نقل عفش',
    icon: Icons.local_shipping_rounded,
    color: Color(0xFF22C35D),
  ),
  DemoService(
    label: 'الكل',
    icon: Icons.grid_view_rounded,
    color: Color(0xFF949FB8),
  ),
  // Extra items shown on wide screens (tablet 6-column grid)
  DemoService(
    label: 'حدادة',
    icon: Icons.hardware_rounded,
    color: Color(0xFFAF57DB),
  ),
  DemoService(
    label: 'ألواح شمسية',
    icon: Icons.solar_power_rounded,
    color: Color(0xFFE9B73A),
  ),
  DemoService(
    label: 'أجهزة منزلية',
    icon: Icons.kitchen_rounded,
    color: Color(0xFF3CA7DD),
  ),
  DemoService(
    label: 'زجاج',
    icon: Icons.window_rounded,
    color: Color(0xFF22C35D),
  ),
];

// ─── Banners ──────────────────────────────────────────────────────────────

class DemoBanner {
  const DemoBanner({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.gradient,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final List<Color> gradient;
}

const demoBanners = <DemoBanner>[
  DemoBanner(
    title: 'خصم 20% على أول طلب',
    subtitle: 'اطلب فنيك المفضل الآن واستمتع بالعرض',
    icon: Icons.local_offer_rounded,
    gradient: [Color(0xFF2A2210), Color(0xFF3A2E12)],
  ),
  DemoBanner(
    title: 'فنيون موثوقون بالقرب منك',
    subtitle: 'أكثر من 500 فني معتمد في جميع المحافظات',
    icon: Icons.verified_rounded,
    gradient: [Color(0xFF14171F), Color(0xFF20242E)],
  ),
  DemoBanner(
    title: 'اكسب نقاط مع كل طلب',
    subtitle: 'حوّل نقاطك إلى خصومات فورية على خدماتك',
    icon: Icons.stars_rounded,
    gradient: [Color(0xFF241C0A), Color(0xFF352810)],
  ),
  DemoBanner(
    title: 'صيانة سريعة خلال ساعتين',
    subtitle: 'فنيو الطوارئ متاحون 24/7 في القاهرة الكبرى',
    icon: Icons.flash_on_rounded,
    gradient: [Color(0xFF101318), Color(0xFF181C25)],
  ),
];

// ─── Offers ───────────────────────────────────────────────────────────────

class DemoOffer {
  const DemoOffer({
    required this.title,
    required this.discount,
    required this.icon,
    this.badgeLabel,
  });

  final String title;
  final String discount;
  final IconData icon;

  /// Optional top badge text (e.g. 'جديد', 'محدود'). null = no badge.
  final String? badgeLabel;
}

const demoOffers = <DemoOffer>[
  DemoOffer(
    title: 'صيانة تكييف شاملة',
    discount: 'خصم 15%',
    icon: Icons.ac_unit_rounded,
    badgeLabel: 'الأكثر طلباً',
  ),
  DemoOffer(
    title: 'باقة تنظيف المنزل',
    discount: 'خصم 25%',
    icon: Icons.cleaning_services_rounded,
    badgeLabel: 'محدود',
  ),
  DemoOffer(
    title: 'فحص كهرباء مجاني',
    discount: 'عرض مجاني',
    icon: Icons.electrical_services_rounded,
    badgeLabel: 'جديد',
  ),
  DemoOffer(
    title: 'دهان غرفة كاملة',
    discount: 'خصم 10%',
    icon: Icons.format_paint_rounded,
  ),
  DemoOffer(
    title: 'سباكة طارئة 24/7',
    discount: 'خصم 20%',
    icon: Icons.plumbing_rounded,
    badgeLabel: 'طوارئ',
  ),
];

// ─── Requests ─────────────────────────────────────────────────────────────

class DemoRequestStatus {
  const DemoRequestStatus({required this.label, required this.color});
  final String label;
  final Color color;
}

class DemoRequest {
  const DemoRequest({
    required this.serviceName,
    required this.icon,
    required this.date,
    required this.status,
    required this.technicianName,
    this.price,
  });

  final String serviceName;
  final IconData icon;
  final String date;
  final DemoRequestStatus status;
  final String technicianName;

  /// Display price string, e.g. '٢٥٠ جنيه'. Null when not yet priced.
  final String? price;
}

const _statusPending = DemoRequestStatus(
  label: 'قيد الانتظار',
  color: Color(0xFFE9B73A),
);
const _statusInProgress = DemoRequestStatus(
  label: 'قيد التنفيذ',
  color: Color(0xFF3CA7DD),
);
const _statusDone = DemoRequestStatus(
  label: 'مكتمل',
  color: Color(0xFF22C35D),
);
const _statusCancelled = DemoRequestStatus(
  label: 'ملغي',
  color: Color(0xFFDC2828),
);

const demoRequests = <DemoRequest>[
  DemoRequest(
    serviceName: 'تصليح تسريب مياه',
    icon: Icons.plumbing_rounded,
    date: 'اليوم، 4:30 م',
    status: _statusInProgress,
    technicianName: 'محمود عبد الله',
    price: '٣٥٠ جنيه',
  ),
  DemoRequest(
    serviceName: 'صيانة تكييف',
    icon: Icons.ac_unit_rounded,
    date: 'أمس، 11:00 ص',
    status: _statusPending,
    technicianName: 'في انتظار التعيين',
  ),
  DemoRequest(
    serviceName: 'تركيب لمبات إضاءة',
    icon: Icons.bolt_rounded,
    date: '٣ يوليو',
    status: _statusDone,
    technicianName: 'كريم سامي',
    price: '١٨٠ جنيه',
  ),
  DemoRequest(
    serviceName: 'دهان شقة كاملة',
    icon: Icons.format_paint_rounded,
    date: '٢٨ يونيو',
    status: _statusCancelled,
    technicianName: 'عمر فاروق',
  ),
];
