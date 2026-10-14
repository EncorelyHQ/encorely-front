import { useEffect, useState } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { isApiError, userMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/session/SessionContext'
import {
  Button,
  ErrorState,
  Icon,
  ListRow,
  ListSection,
  Screen,
  Skeleton,
  space,
  Text,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { ArrowSquareOutIcon } from 'phosphor-react-native/src/icons/ArrowSquareOut'
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText'
import { Checkbox } from '@/ui'
import { CONSENT_REQUIRED_CODE, currentConsentVersionOf } from '../consent'
import { clearConsentFlag } from '../consentSignal'
import { effectiveDateLabel, legalDocumentsOf } from '../legal'
import { useAcceptConsent, useLegalQuery } from '../queries'
import { useOpenLink } from '../useOpenLink'

const CONSENT_LABEL = 'Leí y acepto los términos y la política de tratamiento de datos (Ley 1581 de 2012).'

// Pantalla bloqueante: sin aceptar la versión vigente no se sigue. La salida honesta es cerrar sesión.
export function ConsentScreen() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { signOut } = useSession()
  const legal = useLegalQuery()
  const accept = useAcceptConsent()
  const open = useOpenLink()
  const [checked, setChecked] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const version = currentConsentVersionOf(legal.data)
  const effective = effectiveDateLabel(legal.data?.effectiveDate)
  const documents = legalDocumentsOf(legal.data)
  const busy = accept.isPending || signingOut

  // El botón atrás de Android no debe saltarse el consentimiento.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [])

  function submit() {
    if (!version) return
    if (!checked) {
      setCheckError('Marca la casilla para aceptar.')
      return
    }
    accept.mutate(version, {
      onSuccess: () => {
        clearConsentFlag()
        toast.show('Listo. Gracias por aceptar.', 'success')
        router.replace('/')
      },
      onError: (error) => {
        if (isApiError(error, CONSENT_REQUIRED_CODE)) {
          // Salió otra versión mientras leías: se recarga y se pide aceptar la nueva.
          setChecked(false)
          void legal.refetch()
          toast.show('Los términos cambiaron mientras los leías. Revisa la versión nueva.', 'danger')
          return
        }
        toast.show(userMessage(error), 'danger')
      },
    })
  }

  async function leave() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      setSigningOut(false)
      toast.show(userMessage(error), 'danger')
    }
  }

  return (
    <Screen
      mode="scroll"
      edges={['top']}
      footer={
        <>
          <Button label="Aceptar y seguir" size="lg" disabled={!version || busy} loading={accept.isPending} onPress={submit} />
          <Button label="Cerrar sesión" variant="ghost" disabled={busy} loading={signingOut} onPress={() => void leave()} />
        </>
      }
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={styles.page}>
        <View style={styles.head}>
          <Text variant="title1" accessibilityRole="header">
            Actualizamos los términos
          </Text>
          <Text variant="body" color="textMuted">
            Para seguir usando Encorely necesitas leer y aceptar la versión nueva de los términos y de la política de
            datos. Si no estás de acuerdo, puedes cerrar sesión o borrar tu cuenta desde la web.
          </Text>
        </View>

        {legal.isPending ? (
          <View style={styles.skeletons} accessible accessibilityLabel="Cargando términos" accessibilityRole="progressbar">
            <Skeleton width="40%" height={space.lg} />
            <Skeleton height={space.xxxl} />
            <Skeleton height={space.xxxl} />
          </View>
        ) : legal.isError || !version ? (
          <ErrorState
            title="No pudimos cargar los términos"
            message={legal.isError ? userMessage(legal.error) : 'El servidor no envió la versión vigente.'}
            onRetry={() => void legal.refetch()}
            retrying={legal.isRefetching}
          />
        ) : (
          <>
            <View
              style={styles.version}
              accessible
              accessibilityLabel={`Versión ${version}${effective ? `, vigente desde el ${effective}` : ''}`}
            >
              <Text variant="caption" color="textMuted">
                VERSIÓN
              </Text>
              <Text variant="data">{version}</Text>
              {effective ? (
                <Text variant="footnote" color="textMuted">
                  Vigente desde <Text variant="data" color="text">{effective}</Text>
                </Text>
              ) : null}
            </View>

            <ListSection>
              {documents.map((doc) => (
                <ListRow
                  key={doc.key}
                  title={doc.title}
                  icon={FileTextIcon}
                  chevron={false}
                  trailing={<Icon icon={ArrowSquareOutIcon} size={20} color="textSubtle" />}
                  accessibilityHint="Se abre en el navegador"
                  onPress={() => void open(doc.url)}
                />
              ))}
            </ListSection>

            <Checkbox
              checked={checked}
              onChange={(value) => {
                setChecked(value)
                if (value) setCheckError(null)
              }}
              label={CONSENT_LABEL}
              error={checkError}
              disabled={busy}
            />
          </>
        )}
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xl, paddingTop: space.xl, paddingBottom: space.xl },
    head: { gap: space.sm },
    skeletons: { gap: space.md },
    version: { gap: space.xs },
  })
