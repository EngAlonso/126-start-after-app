import 'package:flutter/material.dart';

/// Shared text field for every form in the app. Wraps [TextFormField] (not
/// [TextField]) so screens get `Form`-integrated validation, inline error
/// text, and a consistent look (icon, optional password-visibility
/// toggle) without hand-rolling decoration per screen.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.validator,
    this.prefixIcon,
    this.textInputAction,
    this.autofillHints,
    this.enabled = true,
    this.hintText,
    this.maxLength,
    this.onChanged,
    this.suffixIcon,
    this.focusNode,
    this.onEditingComplete,
  });

  final String label;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final FormFieldValidator<String>? validator;
  final IconData? prefixIcon;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool enabled;
  final String? hintText;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final Widget? suffixIcon;
  final FocusNode? focusNode;
  final VoidCallback? onEditingComplete;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller:        controller,
      obscureText:       obscureText,
      keyboardType:      keyboardType,
      validator:         validator,
      textInputAction:   textInputAction,
      autofillHints:     autofillHints,
      enabled:           enabled,
      maxLength:         maxLength,
      onChanged:         onChanged,
      focusNode:         focusNode,
      onEditingComplete: onEditingComplete,
      textAlign: TextAlign.right,
      decoration: InputDecoration(
        labelText:   label,
        hintText:    hintText,
        counterText: '',
        prefixIcon:  prefixIcon != null ? Icon(prefixIcon, size: 20) : null,
        suffixIcon:  suffixIcon,
      ),
    );
  }
}

/// A password [AppTextField] with a built-in show/hide toggle — split out
/// as its own tiny stateful widget since the obscure flag needs local
/// state, unlike every other plain [AppTextField] usage.
class AppPasswordField extends StatefulWidget {
  const AppPasswordField({
    super.key,
    required this.label,
    required this.controller,
    this.validator,
    this.textInputAction,
    this.autofillHints,
    this.focusNode,
    this.onEditingComplete,
  });

  final String label;
  final TextEditingController controller;
  final FormFieldValidator<String>? validator;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final FocusNode? focusNode;
  final VoidCallback? onEditingComplete;

  @override
  State<AppPasswordField> createState() => _AppPasswordFieldState();
}

class _AppPasswordFieldState extends State<AppPasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label:             widget.label,
      controller:        widget.controller,
      obscureText:       _obscure,
      validator:         widget.validator,
      prefixIcon:        Icons.lock_outline,
      textInputAction:   widget.textInputAction,
      autofillHints:     widget.autofillHints,
      focusNode:         widget.focusNode,
      onEditingComplete: widget.onEditingComplete,
      suffixIcon: IconButton(
        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
    );
  }
}
