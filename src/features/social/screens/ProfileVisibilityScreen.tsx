import { StyleSheet, Switch, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { meApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { Button, ErrorState, LoadingState, Screen, Text, radius, space, useStyles, useTheme, useToast, type Theme } from '@/ui'
import { useProfileVisibility } from '../queries'
import { VISIBILITY_COPY, visibilityOf } from '../visibility'

export function ProfileVisibilityScreen() {
  const styles = useStyles(makeStyles)
  const theme = useTheme()
  const toast = useToast()
  const me = useQuery({ queryKey: queryKeys.me, queryFn: meApi.get })
  const toggle = useProfileVisibility({ onError: (error) => toast.show(userMessage(error), 'danger') })
  const header = <Stack.Screen options={{ title: 'Privacidad del perfil' }} />

  if (me.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Cargando tu perfil" />
      </Screen>
    )
  }
  if (me.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <ErrorState title="No pudimos cargar tu perfil" message={userMessage(me.error)} onRetry={() => void me.refetch()} retrying={me.isRefetching} />
      </Screen>
    )
  }

  const visibility = visibilityOf(me.data)
  const on = me.data.showProfileToOthers

  return (
    <Screen mode="scroll" edges={[]}>
      {header}
      <View style={styles.page}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text variant="headline">
              Mostrar mi perfil a otras personas
            </Text>
            <Text variant="footnote" color="textMuted">
              Tu nombre, edad, ciudad, bio, géneros, artistas y estadísticas, y tu nombre junto a las reacciones que dejes.
            </Text>
          </View>
          <Switch
            value={on}
            disabled={toggle.isPending}
            onValueChange={(value) => toggle.mutate(value)}
            accessibilityLabel="Mostrar mi perfil a otras personas"
            trackColor={{ false: theme.borderInput, true: theme.accent }}
            thumbColor={theme.surface}
            ios_backgroundColor={theme.borderInput}
          />
        </View>

        <View
          style={[styles.status, visibility === 'visible' ? styles.statusOn : styles.statusOff]}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${visibility === 'visible' ? 'Visible' : 'Oculto'}. ${VISIBILITY_COPY[visibility]}`}
        >
          <Text variant="headline">{visibility === 'visible' ? 'Ahora otras personas te ven' : 'Ahora nadie más te ve'}</Text>
          <Text variant="callout" color="textMuted">
            {VISIBILITY_COPY[visibility]}
          </Text>
          {visibility === 'needsConsent' ? (
            <Button label="Revisar y aceptar" variant="secondary" fullWidth={false} onPress={() => router.push('/consent')} />
          ) : null}
        </View>

        <Text variant="footnote" color="textMuted">
          Apagarlo no cambia quién va a tus conciertos ni tus matches: el radar y los chats siguen igual. Si alguien te
          molesta, bloquéalo desde su perfil o desde la reacción que te dejó.
        </Text>
      </View>
    </Screen>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xl },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    rowText: { flex: 1, gap: space.xs },
    status: { gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
    statusOn: { backgroundColor: t.surface, borderColor: t.verified },
    statusOff: { backgroundColor: t.surface, borderColor: t.border },
  })
