import { Redirect } from 'expo-router'

// El intercambio del código lo hace openAuthSessionAsync; esta ruta solo evita la pantalla de "ruta no encontrada"
// si el sistema abre encorely://spotify-callback directamente.
export default function SpotifyCallback() {
  return <Redirect href="/" />
}
