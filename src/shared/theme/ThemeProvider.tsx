import React from 'react';
import styled, { ThemeProvider as StyledThemeProvider } from 'styled-components/native';
import { theme } from './designTokens';

// En RN v6+, a veces ThemeProvider de /native es undefined con import nombrado. 
const Provider = StyledThemeProvider || (styled as any).ThemeProvider;

export const CustomThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <Provider theme={theme}>{children}</Provider>;
};
