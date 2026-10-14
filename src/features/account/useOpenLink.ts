import { useCallback } from 'react'
import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useTheme, useToast } from '@/ui'

// Documentos legales en el navegador in-app (el usuario vuelve a la app sin perder contexto); mailto al cliente de correo.
export function useOpenLink() {
  const theme = useTheme()
  const toast = useToast()
  return useCallback(
    async (url: string) => {
      try {
        if (url.startsWith('mailto:')) await Linking.openURL(url)
        else await WebBrowser.openBrowserAsync(url, { controlsColor: theme.accent, toolbarColor: theme.bg })
      } catch (error) {
        console.warn('No se pudo abrir el enlace', error instanceof Error ? error.message : error)
        toast.show('No pudimos abrir el enlace. Intenta otra vez.', 'danger')
      }
    },
    [theme.accent, theme.bg, toast],
  )
}
