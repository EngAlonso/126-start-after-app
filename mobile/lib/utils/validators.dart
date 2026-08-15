/// Centralized form-field validators shared by every auth screen (login,
/// customer registration, technician registration) so validation rules
/// live in exactly one place instead of being re-typed per form.
class Validators {
  Validators._();

  static String? required(String? value, {String message = 'هذا الحقل مطلوب'}) {
    if (value == null || value.trim().isEmpty) return message;
    return null;
  }

  static String? fullName(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'الاسم الكامل مطلوب';
    if (trimmed.length < 3) return 'الاسم يجب أن يكون 3 أحرف على الأقل';
    return null;
  }

  /// Matches the backend's own tolerance (`mobile.length < 8` on the web
  /// client) — the server is the source of truth for real validity, this
  /// only catches obviously-wrong input before a network round trip.
  static String? mobile(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'رقم الهاتف مطلوب';
    if (trimmed.length < 8) return 'رقم الهاتف غير صحيح';
    if (!RegExp(r'^[0-9+]+$').hasMatch(trimmed)) return 'رقم الهاتف غير صحيح';
    return null;
  }

  static String? password(String? value, {int minLength = 6}) {
    final v = value ?? '';
    if (v.isEmpty) return 'كلمة المرور مطلوبة';
    if (v.length < minLength) return 'كلمة المرور يجب أن تكون $minLength أحرف على الأقل';
    return null;
  }

  static String? loginPassword(String? value) {
    final v = value ?? '';
    if (v.isEmpty) return 'كلمة المرور مطلوبة';
    return null;
  }

  static String? Function(String?) confirmPassword(String Function() original) {
    return (value) {
      if (value != original()) return 'كلمتا المرور غير متطابقتان';
      return null;
    };
  }

  /// Egyptian national ID is a fixed 14-digit number, matching the backend
  /// column and the web client's own `.length(14)` rule.
  static String? nationalId(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'الرقم القومي مطلوب';
    if (trimmed.length != 14 || !RegExp(r'^[0-9]{14}$').hasMatch(trimmed)) {
      return 'رقم البطاقة يجب أن يكون 14 رقماً';
    }
    return null;
  }
}
