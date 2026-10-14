import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { pushAvailability, reportPushError } from './config'
import { getPushPermission, requestPushPermission, type PushPermission } from './permission'
import { syncPushToken } from './registration'

// A device preference (not business state): how long "Ahora no" keeps the primer away.
const SNOOZE_KEY = 'encorely_push_primer_snoozed_until_v1'
export const PRIMER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

async function snoozedUntil(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) ? value : 0
  } catch (error) {
    reportPushError('read primer snooze', error)
    return 0
  }
}

async function snoozePrimer(): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + PRIMER_SNOOZE_MS))
  } catch (error) {
    reportPushError('save primer snooze', error)
  }
}

// Only offered when the OS can still show its prompt: once it is blocked, insisting is just noise.
export async function shouldOfferPushPrimer(): Promise<boolean> {
  if (pushAvailability() !== 'ready') return false
  try {
    const permission = await getPushPermission()
    if (permission !== 'undetermined' && permission !== 'denied') return false
  } catch (error) {
    reportPushError('read permission', error)
    return false
  }
  return (await snoozedUntil()) <= Date.now()
}

export type PushPrompt = {
  visible: boolean
  requesting: boolean
  accept: () => Promise<PushPermission>
  dismiss: () => Promise<void>
}

export function usePushPrompt(): PushPrompt {
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    shouldOfferPushPrimer().then((offer) => {
      if (mounted.current) setVisible(offer)
    })
    return () => {
      mounted.current = false
    }
  }, [])

  const accept = useCallback(async (): Promise<PushPermission> => {
    setRequesting(true)
    let permission: PushPermission = 'unavailable'
    try {
      permission = await requestPushPermission()
    } catch (error) {
      reportPushError('request permission', error)
    }
    if (permission === 'granted') void syncPushToken()
    // A "no" in the OS dialog gets the same week of quiet as "Ahora no".
    else await snoozePrimer()
    if (mounted.current) {
      setRequesting(false)
      setVisible(false)
    }
    return permission
  }, [])

  const dismiss = useCallback(async () => {
    setVisible(false)
    await snoozePrimer()
  }, [])

  return { visible, requesting, accept, dismiss }
}
