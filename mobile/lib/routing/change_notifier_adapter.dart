import 'package:flutter/foundation.dart';

/// Named export so `app_router.dart` doesn't need a raw `ChangeNotifier`
/// import mixed in with routing/provider imports — purely organizational.
class ChangeNotifierAdapter extends ChangeNotifier {}
