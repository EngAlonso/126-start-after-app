---
name: Expo locale direction
description: Locale-driven direction and React Native text alignment constraints for the Fnashha Expo app.
---

The Expo app's `LocaleContext` is the single source of truth for `locale`, `direction`, and `isRTL`; device language and `I18nManager` must not be reintroduced into the layout flow.

**Why:** The app must switch completely between Arabic RTL and English LTR regardless of the device language, including Expo Web.

**How to apply:** Use the context direction for container direction and valid native text alignment values; `TextInput` accepts only `left`, `center`, or `right` in the installed React Native types, while static `Text` styles can use locale-aware alignment patterns already established in the Expo code.