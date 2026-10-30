import { useEffect } from 'react'
import { router, usePathname } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'
import { useSession } from '@/lib/session/SessionContext'
import {
  CONSENT_REQUIRED_CODE,
  CONSENT_ROUTE,
  decideConsent,
  shouldRedirectToConsent,
} from '../consent'
import { flagConsentRequired, useConsentFlag } from '../consentSignal'
import { accountKeys, useAccountMeQuery } from '../queries'

// Se monta una vez en el árbol autenticado. No pinta nada: decide si hay que pasar por /consent.
// Dos fuentes, ninguna guardada en el dispositivo: `consentUpToDate` de GET /me
// y cualquier respuesta autenticada con code=consent_required.
export function ConsentGate() {
  const { status, user } = useSession()
  const userId = status === 'signedIn' ? (user?.id ?? null) : null
  const pathname = usePathname()
  const qc = useQueryClient()
  const me = useAccountMeQuery(!!userId)
  const flagged = useConsentFlag(userId)

  useEffect(() => {
    if (!userId) return
    const onError = (error: unknown) => {
      if (isApiError(error, CONSENT_REQUIRED_CODE)) flagConsentRequired(userId)
    }
    const unsubQueries = qc.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') onError(event.action.error)
    })
    const unsubMutations = qc.getMutationCache().subscribe((event) => {
      if (event?.type !== 'updated' || event.action.type !== 'error') return
      // El POST de aceptación responde consent_required si la versión cambió mientras se leía: eso lo maneja /consent.
      const key = event.mutation.options.mutationKey
      if (key && key[0] === accountKeys.acceptConsent[0] && key[1] === accountKeys.acceptConsent[1]) return
      onError(event.action.error)
    })
    return () => {
      unsubQueries()
      unsubMutations()
    }
  }, [qc, userId])

  const decision = decideConsent({
    consentUpToDate: me.data?.consentUpToDate,
    serverRequiresConsent: flagged,
  })

  useEffect(() => {
    if (userId && shouldRedirectToConsent(decision, pathname)) router.replace(CONSENT_ROUTE)
  }, [decision, pathname, userId])

  return null
}
