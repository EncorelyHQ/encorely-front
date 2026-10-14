import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { meApi } from '@/lib/api/endpoints'
import { isApiError, userMessage } from '@/lib/api/errors'
import type { Me, UpdateMeRequest } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import {
  Button,
  Chip,
  ErrorState,
  haptics,
  LoadingState,
  Screen,
  Skeleton,
  space,
  Text,
  TextField,
  touch,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { RadioGroup } from '@/features/safety/components/RadioGroup'
import { BirthDateFields } from '../components/BirthDateFields'
import {
  buildProfilePatch,
  CITY_OPTIONS,
  draftFromMe,
  isDraftDirty,
  validateDraft,
  type CityChoice,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileField,
} from '../profileForm'
import { useGenresQuery, useMeQuery } from '../queries'
import { BIO_MAX, charCount, GENRES_MAX } from '../validation'

const CITY_RADIO = [...CITY_OPTIONS.map((c) => ({ value: c as CityChoice, label: c })), { value: 'other' as CityChoice, label: 'Otra' }]
const FIELDS: ProfileField[] = ['displayName', 'birthDate', 'city', 'genres', 'bio']

export function EditProfileScreen() {
  const me = useMeQuery()
  return (
    <>
      <Stack.Screen options={{ title: 'Editar perfil' }} />
      {me.data ? (
        <EditProfileForm key={me.data.id} me={me.data} />
      ) : me.isError ? (
        <Screen edges={[]}>
          <ErrorState
            title="No pudimos cargar tu perfil"
            message={userMessage(me.error)}
            onRetry={() => void me.refetch()}
            retrying={me.isRefetching}
          />
        </Screen>
      ) : (
        <Screen edges={[]}>
          <LoadingState label="Cargando tu perfil" />
        </Screen>
      )}
    </>
  )
}

function EditProfileForm({ me }: { me: Me }) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const queryClient = useQueryClient()
  const { applyMe } = useSession()
  const genres = useGenresQuery()

  const initial = useMemo(() => draftFromMe(me), [me])
  const [draft, setDraft] = useState<ProfileDraft>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const dirty = isDraftDirty(initial, draft)
  const { values, errors: clientErrors } = validateDraft(draft)
  // Los errores locales aparecen tras el primer intento de guardar; los del servidor, siempre hasta que se edite el campo.
  const errorFor = (field: ProfileField) => (submitted ? clientErrors[field] : undefined) ?? serverErrors[field] ?? null

  const save = useMutation({
    mutationFn: (patch: UpdateMeRequest) => meApi.update(patch),
    onSuccess: (updated) => {
      applyMe(updated)
      // queryKeys.me es prefijo de queryKeys.dna: así se refrescan los dos (los géneros cambian el perfil musical).
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      toast.show('Perfil actualizado', 'success')
      router.back()
    },
    onError: (error) => {
      haptics.warning()
      if (isApiError(error) && error.status === 400) {
        const byField: ProfileErrors = {}
        for (const field of FIELDS) {
          const message = error.field(field)
          if (message) byField[field] = message
        }
        if (Object.keys(byField).length > 0) {
          setServerErrors(byField)
          return
        }
      }
      setFormError(userMessage(error))
    },
  })

  function edit<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K], field: ProfileField) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setFormError(null)
    if (serverErrors[field]) setServerErrors(({ [field]: _removed, ...rest }) => rest)
  }

  function submit() {
    setSubmitted(true)
    setFormError(null)
    if (!values) {
      haptics.warning()
      return
    }
    const patch = buildProfilePatch(me, values)
    if (Object.keys(patch).length === 0) {
      router.back()
      return
    }
    save.mutate(patch)
  }

  function toggleGenre(slug: string) {
    const selected = draft.genres.includes(slug)
    edit('genres', selected ? draft.genres.filter((g) => g !== slug) : [...draft.genres, slug], 'genres')
  }

  const bioCount = charCount(draft.bio.trim())
  const genresError = errorFor('genres')
  const hasErrors = submitted && !values

  return (
    <Screen
      mode="form"
      edges={[]}
      footer={
        <>
          {formError || hasErrors ? (
            <Text variant="footnote" color="danger" align="center" accessibilityLiveRegion="polite">
              {formError ?? 'Revisa los campos marcados.'}
            </Text>
          ) : null}
          <Button
            label="Guardar"
            size="lg"
            disabled={!dirty}
            loading={save.isPending}
            onPress={submit}
            accessibilityHint={dirty ? undefined : 'No hay cambios por guardar'}
          />
        </>
      }
    >
      <View style={styles.form}>
        <TextField
          label="Nombre"
          value={draft.displayName}
          onChangeText={(v) => edit('displayName', v, 'displayName')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={60}
          editable={!save.isPending}
          error={errorFor('displayName')}
          helper="Así te ven en el radar y en el chat."
        />

        <BirthDateFields
          value={draft.birth}
          onChange={(v) => edit('birth', v, 'birthDate')}
          error={errorFor('birthDate')}
          editable={!save.isPending}
        />

        <View style={styles.group}>
          <Text variant="callout" color="textMuted" accessibilityRole="header">
            Ciudad
          </Text>
          <RadioGroup
            label="Ciudad"
            direction="row"
            options={CITY_RADIO}
            value={draft.cityChoice}
            onChange={(v) => edit('cityChoice', v, 'city')}
            disabled={save.isPending}
          />
          {draft.cityChoice === 'other' ? (
            <TextField
              label="¿En qué ciudad vives?"
              value={draft.otherCity}
              onChangeText={(v) => edit('otherCity', v, 'city')}
              autoCapitalize="words"
              maxLength={90}
              editable={!save.isPending}
              error={errorFor('city')}
            />
          ) : errorFor('city') ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              {errorFor('city')}
            </Text>
          ) : null}
        </View>

        <View style={styles.group}>
          <Text variant="callout" color="textMuted" accessibilityRole="header">
            Géneros que escuchas
          </Text>
          {genres.data && genres.data.length === 0 ? (
            <Text variant="footnote" color="textMuted">
              No hay géneros para elegir en este momento. Intenta más tarde.
            </Text>
          ) : genres.data ? (
            <View style={styles.chips}>
              {genres.data.map((genre) => {
                const selected = draft.genres.includes(genre.slug)
                return (
                  <Chip
                    key={genre.slug}
                    label={genre.name}
                    selected={selected}
                    disabled={save.isPending || (!selected && draft.genres.length >= GENRES_MAX)}
                    onPress={() => toggleGenre(genre.slug)}
                  />
                )
              })}
            </View>
          ) : genres.isError ? (
            <View style={styles.inlineError}>
              <Text variant="footnote" color="textMuted">
                {userMessage(genres.error)}
              </Text>
              <Button
                label="Reintentar"
                variant="secondary"
                fullWidth={false}
                loading={genres.isRefetching}
                onPress={() => void genres.refetch()}
              />
            </View>
          ) : (
            <View style={styles.chips} accessible accessibilityLabel="Cargando géneros">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} width={touch.large * (i % 2 ? 1.6 : 2)} height={touch.min} />
              ))}
            </View>
          )}
          {genresError ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              {genresError}
            </Text>
          ) : (
            <Text variant="footnote" color="textSubtle">
              Elige entre 1 y {GENRES_MAX}. Llevas{' '}
              <Text variant="data" color="textSubtle">
                {draft.genres.length}
              </Text>
              .
            </Text>
          )}
        </View>

        <TextField
          label="Sobre ti (opcional)"
          value={draft.bio}
          onChangeText={(v) => edit('bio', v, 'bio')}
          multiline
          maxLength={BIO_MAX + 20}
          textAlignVertical="top"
          style={styles.bio}
          editable={!save.isPending}
          placeholder="Qué conciertos te mueven, con quién te gustaría ir…"
          error={errorFor('bio')}
          helper={`${bioCount}/${BIO_MAX}`}
        />
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    form: { gap: space.xl, paddingBottom: space.xl },
    group: { gap: space.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    inlineError: { gap: space.sm, alignItems: 'flex-start' },
    bio: { minHeight: touch.large * 2 },
  })
