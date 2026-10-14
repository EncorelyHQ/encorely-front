import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { themes, type Theme } from './tokens'

const ThemeContext = createContext<Theme>(themes.venue)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const theme = scheme === 'light' ? themes.papel : themes.venue
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

// Patrón de estilos por pantalla: `const styles = useStyles(makeStyles)` con `makeStyles = (t: Theme) => StyleSheet.create(...)`.
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme()
  return useMemo(() => factory(theme), [factory, theme])
}
