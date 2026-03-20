import 'styled-components/native';
import { type ThemeType } from './src/theme/designTokens';

declare module 'styled-components/native' {
  export interface DefaultTheme extends ThemeType {}
}
