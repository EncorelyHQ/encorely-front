import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Text } from 'react-native'
import { AdminGate } from '../components/AdminGate'
import { AdminEntryRow } from '../components/AdminEntryRow'
import { useIsAdmin, usePendingReportsCount } from '../hooks/queries'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}))

// Reanimated nativo no carga en Jest; el panel no anima nada en estas piezas.
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native')
  const chain: Record<string, () => unknown> = {}
  for (const k of ['duration', 'easing', 'delay', 'reduceMotion']) chain[k] = () => chain
  const mutable = (value: unknown) => ({ value, get: () => value, set: () => undefined })
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList },
    makeMutable: mutable,
    useSharedValue: mutable,
    useAnimatedScrollHandler: () => undefined,
    useAnimatedStyle: () => ({}),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedReaction: () => undefined,
    measure: () => null,
    Easing: { bezier: () => (t: number) => t },
    FadeIn: chain,
    FadeOut: chain,
    FadeInDown: chain,
    FadeOutDown: chain,
    ReduceMotion: { Never: 'never', System: 'system' },
    useReducedMotion: () => false,
  }
})

// tsconfig apunta los imports profundos de Phosphor a .d.ts, que Jest no carga.
jest.mock('../icons', () => ({ WrenchIcon: () => null }))
jest.mock('@/ui/icons', () => new Proxy({}, { get: (_t, key) => (key === '__esModule' ? false : () => null) }))

jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native')
  return { KeyboardAwareScrollView: ScrollView }
})

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../hooks/queries', () => ({
  useIsAdmin: jest.fn(),
  usePendingReportsCount: jest.fn(),
}))

const isAdmin = useIsAdmin as jest.Mock
const pending = usePendingReportsCount as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  pending.mockReturnValue({ data: 0 })
})

describe('AdminEntryRow', () => {
  it('no se renderiza (ni consulta reportes) si no eres admin', async () => {
    isAdmin.mockReturnValue(false)
    await render(<AdminEntryRow />)
    expect(screen.toJSON()).toBeNull()
    expect(pending).not.toHaveBeenCalled()
  })

  it('para admin abre el panel y anuncia los pendientes', async () => {
    isAdmin.mockReturnValue(true)
    pending.mockReturnValue({ data: 3 })
    await render(<AdminEntryRow />)
    const row = screen.getByRole('button', { name: /Administración/ })
    expect(row.props.accessibilityHint).toBe('3 reportes pendientes')
    await fireEvent.press(row)
    expect(router.push).toHaveBeenCalledWith('/admin')
  })
})

describe('AdminGate', () => {
  it('muestra "No tienes acceso" y no monta el contenido si no eres admin', async () => {
    isAdmin.mockReturnValue(false)
    await render(
      <AdminGate title="Reportes">
        <Text>secreto</Text>
      </AdminGate>,
    )
    expect(screen.getByText('No tienes acceso')).toBeTruthy()
    expect(screen.queryByText('secreto')).toBeNull()
  })

  it('deja pasar a un admin', async () => {
    isAdmin.mockReturnValue(true)
    await render(
      <AdminGate title="Reportes">
        <Text>contenido</Text>
      </AdminGate>,
    )
    expect(screen.getByText('contenido')).toBeTruthy()
  })
})
