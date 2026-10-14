import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { devicesApi } from '@/lib/api/endpoints'
import { pushAvailability } from '../config'
import { foregroundBehavior, resetSetupForTests } from '../setup'
import { routeForPush } from '../payload'
import { PushBootstrap } from '../PushBootstrap'
import { PushPrimer } from '../PushPrimer'
import { resetRegistrationForTests } from '../registration'
import { resetPushNavigationForTests, usePushNavigation } from '../usePushNavigation'
import { PRIMER_SNOOZE_MS, usePushPrompt } from '../usePushPrompt'

type Listener = (value: unknown) => void
type MockListener = Listener
type MockSignInTask = (userId: string) => Promise<void> | void
type MockSignOutTask = (userId: string, reason: 'signOut' | 'delete') => Promise<void> | void

jest.mock('expo-notifications', () => {
  const responseListeners = new Set<MockListener>()
  const tokenListeners = new Set<MockListener>()
  const subscribe = (set: Set<MockListener>) =>
    jest.fn((fn: MockListener) => {
      set.add(fn)
      return { remove: () => set.delete(fn) }
    })
  return {
    __listeners: { response: responseListeners, token: tokenListeners },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    AndroidImportance: { HIGH: 6 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationHandler: jest.fn(),
    dismissAllNotificationsAsync: jest.fn(async () => undefined),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    addNotificationResponseReceivedListener: subscribe(responseListeners),
    addPushTokenListener: subscribe(tokenListeners),
  }
})

// The real mock pulls react-native-worklets, which needs a jest resolver this repo does not configure.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native')
  class MockAnimation {
    duration() {
      return this
    }
    easing() {
      return this
    }
    delay() {
      return this
    }
    reduceMotion() {
      return this
    }
  }
  const animation = new MockAnimation()
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => (t: number) => t },
    FadeIn: animation,
    FadeOut: animation,
    FadeInDown: animation,
    FadeOutDown: animation,
    Keyframe: MockAnimation,
    ReduceMotion: { Never: 'never', System: 'system' },
    useReducedMotion: () => false,
  }
})

// tsconfig maps the deep Phosphor imports to .d.ts files, which jest cannot load.
jest.mock('../icons', () => ({ BellSimpleIcon: () => null }))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} }, easConfig: null },
}))

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }))

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key)
    }),
  }
})

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('@/lib/api/endpoints', () => ({
  devicesApi: {
    registerPush: jest.fn(async () => undefined),
    unregisterPush: jest.fn(async () => undefined),
  },
}))

jest.mock('@/lib/session/tokenStore', () => ({
  getSession: () => ({ accessExpiresAt: Date.now() + 60_000 }),
}))

type MockSession = { status: 'loading' | 'signedIn' | 'signedOut'; user: { id: string } | null }
const mockSession: MockSession = { status: 'signedIn', user: { id: 'user-1' } }
jest.mock('@/lib/session/SessionContext', () => {
  const signIn: MockSignInTask[] = []
  const signOut: MockSignOutTask[] = []
  return {
    __tasks: { signIn, signOut },
    useSession: () => mockSession,
    registerSignInTask: (task: MockSignInTask) => {
      signIn.push(task)
      return () => undefined
    },
    registerSignOutTask: (task: MockSignOutTask) => {
      signOut.push(task)
      return () => undefined
    },
  }
})

// Module-level sign-in/out tasks are registered while the imports run, so they live inside the mock.
const sessionTasks = (
  jest.requireMock('@/lib/session/SessionContext') as { __tasks: { signIn: MockSignInTask[]; signOut: MockSignOutTask[] } }
).__tasks
const mockSignInTasks = sessionTasks.signIn
const mockSignOutTasks = sessionTasks.signOut

const N = Notifications as unknown as {
  __listeners: { response: Set<Listener>; token: Set<Listener> }
  getPermissionsAsync: jest.Mock
  requestPermissionsAsync: jest.Mock
  getExpoPushTokenAsync: jest.Mock
  setNotificationHandler: jest.Mock
  getLastNotificationResponseAsync: jest.Mock
  addPushTokenListener: jest.Mock
  dismissAllNotificationsAsync: jest.Mock
}
const secureStore = (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store
const device = jest.requireMock('expo-device') as { isDevice: boolean }
const expoExtra = (Constants as unknown as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra
const registerPush = devicesApi.registerPush as jest.Mock
const unregisterPush = devicesApi.unregisterPush as jest.Mock
const push = router.push as jest.Mock

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
const ROTATED = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'

const permission = (status: 'granted' | 'undetermined' | 'denied', canAskAgain = true) => ({
  status,
  granted: status === 'granted',
  canAskAgain,
  expires: 'never',
})

function response(identifier: string, data: Record<string, unknown>, actionIdentifier = 'expo.modules.notifications.actions.DEFAULT') {
  return { actionIdentifier, notification: { request: { identifier, content: { data } } } }
}

function emit(kind: 'response' | 'token', value: unknown) {
  N.__listeners[kind].forEach((listener) => listener(value))
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(async () => {
  jest.clearAllMocks()
  resetRegistrationForTests()
  resetPushNavigationForTests()
  resetSetupForTests()
  secureStore.clear()
  await AsyncStorage.clear()
  expoExtra.eas = { projectId: 'project-123' }
  device.isDevice = true
  mockSession.status = 'signedIn'
  mockSession.user = { id: 'user-1' }
  N.getPermissionsAsync.mockResolvedValue(permission('undetermined'))
  N.requestPermissionsAsync.mockResolvedValue(permission('granted'))
  N.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN })
  N.getLastNotificationResponseAsync.mockResolvedValue(null)
})

describe('pushAvailability', () => {
  test('is disabled without an EAS projectId', () => {
    delete expoExtra.eas
    expect(pushAvailability()).toBe('missingProjectId')
  })

  test('falls back to EXPO_PUBLIC_EAS_PROJECT_ID', () => {
    delete expoExtra.eas
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'from-env'
    try {
      expect(pushAvailability()).toBe('ready')
    } finally {
      delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    }
  })

  test('reports simulators and ready devices', () => {
    device.isDevice = false
    expect(pushAvailability()).toBe('simulator')
    device.isDevice = true
    expect(pushAvailability()).toBe('ready')
  })

  test('without projectId the bootstrap touches nothing', async () => {
    delete expoExtra.eas
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    await render(<PushBootstrap />)
    await flush()
    expect(N.setNotificationHandler).not.toHaveBeenCalled()
    expect(N.getPermissionsAsync).not.toHaveBeenCalled()
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled()
    expect(registerPush).not.toHaveBeenCalled()
  })
})

describe('registration', () => {
  test('mounting never asks for permission', async () => {
    await render(<PushBootstrap />)
    await flush()
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(registerPush).not.toHaveBeenCalled()
    expect(N.setNotificationHandler).toHaveBeenCalledTimes(1)
  })

  test('registers the Expo token once there is permission and a session', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    await render(<PushBootstrap />)
    await waitFor(() => expect(registerPush).toHaveBeenCalledWith(TOKEN, 'ios'))
    expect(N.getExpoPushTokenAsync).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-123' }))
    expect(registerPush).toHaveBeenCalledTimes(1)
  })

  test('the sign-in task registers too, without prompting', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    expect(mockSignInTasks).toHaveLength(1)
    await act(async () => {
      await mockSignInTasks[0]('user-2')
    })
    expect(registerPush).toHaveBeenCalledWith(TOKEN, 'ios')
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  test('re-registers when the token rotates and drops the old one', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    await render(<PushBootstrap />)
    await waitFor(() => expect(registerPush).toHaveBeenCalledWith(TOKEN, 'ios'))

    N.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: ROTATED })
    const devicePushToken = { type: 'ios', data: 'apns-device-token' }
    await act(async () => emit('token', devicePushToken))
    await waitFor(() => expect(registerPush).toHaveBeenCalledWith(ROTATED, 'ios'))
    expect(N.getExpoPushTokenAsync).toHaveBeenLastCalledWith(expect.objectContaining({ devicePushToken }))
    await waitFor(() => expect(unregisterPush).toHaveBeenCalledWith(TOKEN))
  })

  test('sign-out deletes the registered token and forgets it', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    await render(<PushBootstrap />)
    await waitFor(() => expect(registerPush).toHaveBeenCalled())

    await act(async () => {
      await mockSignOutTasks[0]('user-1', 'signOut')
    })
    expect(unregisterPush).toHaveBeenCalledWith(TOKEN)
    expect(N.dismissAllNotificationsAsync).toHaveBeenCalled()
    expect(secureStore.size).toBe(0)
  })

  test('account deletion skips the DELETE (the backend drops the devices) but clears locally', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    await render(<PushBootstrap />)
    await waitFor(() => expect(registerPush).toHaveBeenCalled())

    await act(async () => {
      await mockSignOutTasks[0]('user-1', 'delete')
    })
    expect(unregisterPush).not.toHaveBeenCalled()
    expect(secureStore.size).toBe(0)
  })
})

describe('foreground handler', () => {
  test('hides chat banners but lists a new match quietly', () => {
    const notification = (data: Record<string, unknown>) =>
      ({ request: { identifier: 'n', content: { data } } }) as unknown as Notifications.Notification
    expect(foregroundBehavior(notification({ t: 'chat', matchId: 'm1' }))).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
    })
    expect(foregroundBehavior(notification({ t: 'match' }))).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
    })
  })
})

describe('navigation', () => {
  test('maps payloads to routes and rejects unsafe ids', () => {
    expect(routeForPush({ t: 'chat', matchId: 'abc-123' })).toBe('/chat/abc-123')
    expect(routeForPush({ t: 'chat' })).toBe('/chats')
    expect(routeForPush({ t: 'chat', matchId: '../../admin' })).toBe('/chats')
    expect(routeForPush({ t: 'match', matchId: 'abc-123' })).toBe('/chats')
    expect(routeForPush({ t: 'other' })).toBeNull()
    expect(routeForPush(null)).toBeNull()
  })

  test('navigates by type and ignores repeated taps on the same notification', async () => {
    await renderHook(() => usePushNavigation())
    await flush()

    await act(() => emit('response', response('n1', { t: 'chat', matchId: 'm1' })))
    await act(() => emit('response', response('n1', { t: 'chat', matchId: 'm1' })))
    await act(() => emit('response', response('n2', { t: 'chat' })))
    await act(() => emit('response', response('n3', { t: 'match' })))
    await act(() => emit('response', response('n4', { t: 'chat', matchId: 'm4' }, 'some.custom.action')))

    expect(push.mock.calls).toEqual([['/chat/m1'], ['/chats'], ['/chats']])
  })

  test('opens the launch notification once, even after a remount', async () => {
    N.getLastNotificationResponseAsync.mockResolvedValue(response('cold', { t: 'chat', matchId: 'm9' }))
    const first = await renderHook(() => usePushNavigation())
    await flush()
    await first.unmount()
    await renderHook(() => usePushNavigation())
    await flush()
    await act(() => emit('response', response('cold', { t: 'chat', matchId: 'm9' })))

    expect(N.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1)
    expect(push.mock.calls).toEqual([['/chat/m9']])
  })

  test('ignores taps while not signed in', async () => {
    mockSession.status = 'signedOut'
    N.getLastNotificationResponseAsync.mockResolvedValue(response('cold', { t: 'match' }))
    await renderHook(() => usePushNavigation())
    await flush()
    await act(() => emit('response', response('n1', { t: 'match' })))
    expect(push).not.toHaveBeenCalled()
    expect(N.getLastNotificationResponseAsync).not.toHaveBeenCalled()
  })
})

describe('primer', () => {
  // The first render of the card loads the design-system modules, which can take seconds on a cold cache.
  jest.setTimeout(20_000)

  test('shows while the OS prompt is available and "Ahora no" hides it for 7 days', async () => {
    const now = Date.now()
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now)

    const first = await renderHook(() => usePushPrompt())
    await waitFor(() => expect(first.result.current.visible).toBe(true))
    await act(async () => {
      await first.result.current.dismiss()
    })
    expect(first.result.current.visible).toBe(false)
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled()

    clock.mockReturnValue(now + PRIMER_SNOOZE_MS - 1)
    const during = await renderHook(() => usePushPrompt())
    await flush()
    expect(during.result.current.visible).toBe(false)

    clock.mockReturnValue(now + PRIMER_SNOOZE_MS + 1)
    const after = await renderHook(() => usePushPrompt())
    await waitFor(() => expect(after.result.current.visible).toBe(true))
    clock.mockRestore()
  })

  test('is never offered when already granted or blocked', async () => {
    N.getPermissionsAsync.mockResolvedValue(permission('granted'))
    const granted = await renderHook(() => usePushPrompt())
    await flush()
    expect(granted.result.current.visible).toBe(false)

    N.getPermissionsAsync.mockResolvedValue(permission('denied', false))
    const blocked = await renderHook(() => usePushPrompt())
    await flush()
    expect(blocked.result.current.visible).toBe(false)
  })

  test('"Activar avisos" asks the OS and registers the token', async () => {
    await render(
      <>
        <PushBootstrap />
        <PushPrimer />
      </>,
    )
    const activate = await screen.findByRole('button', { name: 'Activar avisos' })
    N.getPermissionsAsync.mockResolvedValueOnce(permission('undetermined')).mockResolvedValue(permission('granted'))
    await fireEvent.press(activate)
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(registerPush).toHaveBeenCalledWith(TOKEN, 'ios'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Activar avisos' })).toBeNull())
  })

  test('"Ahora no" in the card hides it without prompting', async () => {
    await render(<PushPrimer />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Ahora no' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ahora no' })).toBeNull())
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(await AsyncStorage.getItem('encorely_push_primer_snoozed_until_v1')).not.toBeNull()
  })
})
