// Encorely Design Tokens
export const theme = {
  colors: {
    bg: '#0A0A0F',
    surface: '#13131A',
    surfaceHigh: '#1E1E2E',
    border: '#2A2A3E',
    primary: '#EF4444',       // Encorely red
    primaryDark: '#B91C1C',
    accent: '#7C3AED',        // Vibe purple
    accentLight: '#A78BFA',
    deezer: '#EF0B3A',
    success: '#22C55E',
    text: '#F0F0F5',
    textMuted: '#8888A0',
    textDim: '#4B4B6A',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 999,
  },
  font: {
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 28,
    hero: 40,
  },
} as const;

export type Theme = typeof theme;
