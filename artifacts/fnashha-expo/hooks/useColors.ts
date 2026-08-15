import colors from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Returns the design tokens for the current color scheme.
 *
 * Reads from the user-controlled ThemeContext (set in Account → المظهر),
 * which persists the preference in AsyncStorage so it survives restarts.
 *
 * All components that call this hook automatically switch palettes the
 * moment the user toggles the dark-mode switch — no restart needed.
 */
export function useColors() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
