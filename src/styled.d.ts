import type { ThemeType } from '@/shared/theme';

declare module 'styled-components/native' {
  export interface DefaultTheme extends ThemeType {}
}
