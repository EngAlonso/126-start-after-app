/**
 * AppTextInput — the design-system TextInput for Fnashha Expo.
 *
 * Differences from a raw <TextInput>:
 *  - Includes its own rounded border wrapper that changes color on focus
 *    (brand primary instead of the default border, no black browser outline).
 *  - Sets outlineStyle="none" on web (React Native Web) as a belt-and-suspenders
 *    guard in addition to the global CSS reset in _layout.tsx.
 *  - Pre-applies the app's font, text color, and placeholder color from the
 *    active color scheme so callers don't have to repeat these on every input.
 *  - Forwards all standard TextInput props unchanged.
 *
 * Usage (replaces the common "View wrapper + TextInput" pattern):
 *
 *   <AppTextInput
 *     label="الاسم الكامل *"
 *     value={name}
 *     onChangeText={setName}
 *     placeholder="اسمك"
 *   />
 *
 * For a bare input without the wrapper (e.g. inside a chat bar), use
 * `bareInputStyle` exported below instead of this component.
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface AppTextInputProps extends TextInputProps {
  /** Optional field label rendered above the input */
  label?: string;
  /** Extra style applied to the outer wrapper View */
  containerStyle?: ViewStyle;
  /** When true, renders a taller textarea-style box */
  multiline?: boolean;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    { label, containerStyle, onFocus, onBlur, style, ...props },
    ref,
  ) {
    const colors = useColors();
    const [focused, setFocused] = useState(false);

    return (
      <View style={containerStyle}>
        {label ? (
          <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        ) : null}
        <View
          style={[
            styles.wrap,
            {
              backgroundColor: colors.card,
              borderColor: focused ? colors.primary : colors.border,
            },
            props.multiline && styles.wrapMultiline,
          ]}
        >
          <TextInput
            ref={ref}
            {...props}
            style={[
              styles.input,
              { color: colors.foreground },
              props.multiline && styles.inputMultiline,
              // outlineStyle is a React Native Web-only prop; cast avoids TS error
              { outlineStyle: 'none' } as any,
              style,
            ]}
            placeholderTextColor={props.placeholderTextColor ?? colors.mutedForeground}
            textAlign={props.textAlign ?? 'right'}
            textAlignVertical={props.multiline ? 'top' : props.textAlignVertical}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
          />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'auto',
    marginBottom: 6,
  },
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // Smooth border-color transition on web
    // @ts-ignore — transitionProperty is web-only
    transitionProperty: 'border-color',
    transitionDuration: '150ms',
  },
  wrapMultiline: {
    paddingVertical: 10,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    // Remove React Native's default underline on Android
    textDecorationLine: 'none',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
