import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native';
import { theme } from './designTokens';

export const CustomThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>;
};
