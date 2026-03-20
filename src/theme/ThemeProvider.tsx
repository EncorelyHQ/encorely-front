import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native';
import { theme } from './designTokens';

// Tell styled-components about our theme structure
declare module 'styled-components/native' {
  export interface DefaultTheme extends ReturnType<typeof getTheme> {}
}

const getTheme = () => theme;

export const CustomThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <StyledThemeProvider theme={theme}>
      {children}
    </StyledThemeProvider>
  );
};
