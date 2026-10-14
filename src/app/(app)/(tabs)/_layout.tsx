import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { ChatsCircleIcon, TicketIcon, UserCircleIcon, VinylRecordIcon } from '@/ui/icons'
import type { PhosphorIcon } from '@/ui'
import { font, useTheme } from '@/ui'

function tabIcon(Glyph: PhosphorIcon) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Glyph size={26} color={color as string} weight={focused ? 'fill' : 'regular'} />
  }
}

// Tab bar nativa, dentro del safe area y sin flotar: no tapa el último elemento de las listas (03 §5.4).
export default function TabsLayout() {
  const theme = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentText,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 12 },
        tabBarAllowFontScaling: true,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Descubrir', tabBarIcon: tabIcon(VinylRecordIcon) }} />
      <Tabs.Screen name="events" options={{ title: 'Conciertos', tabBarIcon: tabIcon(TicketIcon) }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats', tabBarIcon: tabIcon(ChatsCircleIcon) }} />
      <Tabs.Screen name="me" options={{ title: 'Tú', tabBarIcon: tabIcon(UserCircleIcon) }} />
    </Tabs>
  )
}
