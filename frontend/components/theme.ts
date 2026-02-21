// Prophit Design System - Theme Configuration
// STRICT: No dark mode, follow color palette exactly

export const theme = {
  colors: {
    // Primary/CTA
    hotCoral: '#FF4F40',
    primary: '#FF4F40',

    // Headers/Text
    deepNavy: '#112231',
    text: '#112231',

    // Background
    softWhite: '#F2F8F3',
    background: '#F2F8F3',

    // Accents
    deepTeal: '#004E60',
    neonYellow: '#C3FF34',
    midOrange: '#FE8B18',

    // Additional utility colors
    white: '#FFFFFF',
    cardBackground: '#FFFFFF',
    textSecondary: '#5A6B7A',
    probabilityBarBackground: '#E8EEE9',
    lightGray: '#E5E5E5',
    gray: '#8E8E93',
  },

  // Chart-specific colors
  chart: {
    primary: '#FF4F40',    // Hot Coral
    secondary: '#004E60',  // Deep Teal
    tertiary: '#FE8B18',   // Mid Orange
    quaternary: '#C3FF34', // Neon Yellow
    background: '#F2F8F3', // Soft White
  },

  // Category colors for spending
  categoryColors: {
    food: '#FF4F40',       // Hot Coral
    transport: '#004E60',  // Deep Teal
    entertainment: '#FE8B18', // Mid Orange
    shopping: '#C3FF34',   // Neon Yellow
    bills: '#112231',      // Deep Navy
  },

  // Prediction icons mapping
  predictionIcons: {
    food: 'restaurant-outline',
    coffee: 'cafe-outline',
    drinks: 'beer-outline',
    transport: 'car-outline',
  } as const,

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radius - 24pt+ for cards as per design spec
  borderRadius: {
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
  },

  // Typography
  typography: {
    header: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 34,
    },
    subheader: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 26,
    },
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 22,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400' as const,
    },
    small: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
  },

  // Shadow for cards - soft diffused drop shadows
  cardShadow: {
    shadowColor: '#112231',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Larger shadow for emphasis
  cardShadowLarge: {
    shadowColor: '#112231',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};

export type Theme = typeof theme;
export default theme;
