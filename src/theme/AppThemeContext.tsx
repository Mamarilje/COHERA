import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "light" | "dark";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  icon: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
};

type AppThemeContextValue = {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (theme: ThemeMode) => void;
};

const palettes: Record<ThemeMode, ThemeColors> = {
  light: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F9FAFB",
    surfaceStrong: "#F3F4F6",
    text: "#111827",
    textMuted: "#6B7280",
    textSoft: "#9CA3AF",
    border: "#E5E7EB",
    accent: "#3B82F6",
    accentSoft: "#EFF6FF",
    accentText: "#FFFFFF",
    icon: "#6B7280",
    danger: "#EF4444",
    dangerSoft: "#FEE2E2",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  dark: {
    background: "#0F172A",
    surface: "#111827",
    surfaceMuted: "#1F2937",
    surfaceStrong: "#0B1220",
    text: "#FFFFFF",
    textMuted: "#D1D5DB",
    textSoft: "#94A3B8",
    border: "#334155",
    accent: "#60A5FA",
    accentSoft: "#1E3A5F",
    accentText: "#E0F2FE",
    icon: "#CBD5E1",
    danger: "#F87171",
    dangerSoft: "#4C1D1D",
    overlay: "rgba(2, 6, 23, 0.78)",
  },
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    systemScheme === "dark" ? "dark" : "light"
  );

  const toggleTheme = useCallback(() => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({
      themeMode,
      isDark: themeMode === "dark",
      colors: palettes[themeMode],
      toggleTheme,
      setThemeMode,
    }),
    [themeMode, toggleTheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }

  return context;
}
