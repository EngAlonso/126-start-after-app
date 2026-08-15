import 'package:flutter_test/flutter_test.dart';

import 'package:fnashha_mobile/utils/validators.dart';

void main() {
  group('Validators.mobile', () {
    test('rejects empty', () {
      expect(Validators.mobile(''), isNotNull);
    });
    test('rejects too short', () {
      expect(Validators.mobile('123'), isNotNull);
    });
    test('accepts a plausible number', () {
      expect(Validators.mobile('01012345678'), isNull);
    });
  });

  group('Validators.nationalId', () {
    test('rejects wrong length', () {
      expect(Validators.nationalId('12345'), isNotNull);
    });
    test('accepts exactly 14 digits', () {
      expect(Validators.nationalId('29001010123456'), isNull);
    });
  });

  group('Validators.confirmPassword', () {
    test('rejects mismatch', () {
      final validator = Validators.confirmPassword(() => 'secret1');
      expect(validator('secret2'), isNotNull);
    });
    test('accepts match', () {
      final validator = Validators.confirmPassword(() => 'secret1');
      expect(validator('secret1'), isNull);
    });
  });
}
