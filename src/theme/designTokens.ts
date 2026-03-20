import { ComponentProps } from 'react';
import { View } from 'react-native';

export const theme = {
  colors: {
    primary: '#F366FF',      // Magenta Neon
    background: '#181818',   // Pure Black
    text: '#FFFFFF',         // White text
    violet: '#A855F7',       // Violet for gradients
    
    // Glassmorphism translucency
    glassLight: 'rgba(255, 255, 255, 0.1)',
    glassNeon: 'rgba(243, 102, 255, 0.15)',
    glassDark: 'rgba(0, 0, 0, 0.4)',
    
    // Auxiliar UI states
    surface: '#242424',
    border: 'rgba(255, 255, 255, 0.1)',
    textDim: 'rgba(255, 255, 255, 0.6)',
  },
  typography: {
    fontFamily: {
      heading: 'GolosText_600SemiBold', // Para h1, h2
      headingBold: 'GolosText_700Bold', 
      headingBlack: 'GolosText_900Black', 
      body: 'Inter_400Regular',         // Body general
      bodyMedium: 'Inter_500Medium',    
      bodyBold: 'Inter_700Bold',        
    },
    sizes: {
      h1: 32,
      h2: 24,
      h3: 20,
      body: 16,
      caption: 12,
    }
  },
  components: {
    button: {
      radiusRect: 12,
      radiusCircle: 9999, // 50%
    },
    shadows: {
      neonMagenta: {
        shadowColor: '#F366FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 10,
      }
    },
    blur: {
      intensityBase: 20,
      intensityHigh: 40,
    }
  }
};

export type ThemeType = typeof theme;
