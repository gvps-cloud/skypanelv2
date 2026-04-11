import { useThemeMode } from "@/contexts/ThemeContext";

export function useTheme() {
  const { colorMode, setColorMode, toggleColorMode, isDark } = useThemeMode();

  return {
    theme: colorMode,
    setTheme: setColorMode,
    toggleTheme: toggleColorMode,
    isDark,
  };
}
