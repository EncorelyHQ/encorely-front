import { useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { router, Stack } from 'expo-router'
import { formatEventDate } from '@/features/events/format'
import { isApiError, userMessage } from '@/lib/api/errors'
import {
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  haptics,
  ListRow,
  ListSection,
  LoadingState,
  Screen,
  space,
  Text,
  TextField,
  TicketIcon,
  TrashIcon,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { LineupEditor } from '../components/LineupEditor'
import { useAdminEvents, useDeleteEvent, useSaveEvent } from '../hooks/queries'
import { bogotaToIso, maskDateInput, maskTimeInput } from '../model/datetime'
import {
  CITY_PRESETS,
  EVENT_LIMITS,
  emptyEventForm,
  eventToForm,
  hasErrors,
  serverEventErrors,
  toEventRequest,
  validateEventForm,
  type CityChoice,
  type EventFormErrors,
  type EventFormValues,
} from '../model/eventForm'
import type { AdminEvent } from '../types'

export function AdminEventFormScreen({ eventId }: { eventId?: string }) {
  const title = eventId ? 'Editar concierto' : 'Nuevo concierto'
  return (
    <AdminGate title={title}>
      {eventId ? <EditEvent eventId={eventId} /> : <EventForm event={null} />}
    </AdminGate>
  )
}

// No hay GET por id en admin: el concierto sale de la lista (en caché si se viene de ella).
function EditEvent({ eventId }: { eventId: string }) {
  const events = useAdminEvents()
  const event = events.data?.find((e) => e.id === eventId)
  const header = <Stack.Screen options={{ title: 'Editar concierto' }} />

  if (events.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Cargando concierto" />
      </Screen>
    )
  }
  if (events.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <AdminQueryError
          title="No pudimos cargar el concierto"
          error={events.error}
          onRetry={() => void events.refetch()}
          retrying={events.isRefetching}
        />
      </Screen>
    )
  }
  if (!event) {
    return (
      <Screen edges={[]}>
        {header}
        <EmptyState
          icon={TicketIcon}
          title="Este concierto ya no existe"
          body="Puede que alguien lo haya borrado. Vuelve a la lista para ver los que quedan."
          action={{ label: 'Volver a conciertos', onPress: () => router.back() }}
        />
      </Screen>
    )
  }
  return <EventForm key={event.id} event={event} />
}

const CITY_OPTIONS: readonly { value: CityChoice; label: string }[] = [
  ...CITY_PRESETS.map((city) => ({ value: city, label: city })),
  { value: 'other', label: 'Otra' },
]

function EventForm({ event }: { event: AdminEvent | null }) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const save = useSaveEvent(event?.id ?? null)
  const remove = useDeleteEvent()
  const [values, setValues] = useState<EventFormValues>(() => (event ? eventToForm(event) : emptyEventForm()))
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<EventFormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timeRef = useRef<TextInput>(null)

  // Los errores aparecen después del primer intento y se recalculan al corregir.
  const localErrors = submitted ? validateEventForm(values, { now: new Date(), requireFuture: !event }) : {}
  const errors: EventFormErrors = { ...serverErrors, ...localErrors }

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (Object.keys(serverErrors).length) setServerErrors({})
  }

  const iso = bogotaToIso(values.date, values.time)
  const preview = iso ? formatEventDate(iso) : null

  const submit = () => {
    setSubmitted(true)
    setServerErrors({})
    const found = validateEventForm(values, { now: new Date(), requireFuture: !event })
    if (hasErrors(found)) {
      haptics.warning()
      return
    }
    save.mutate(toEventRequest(values), {
      onSuccess: () => {
        toast.show(event ? 'Cambios guardados.' : 'Concierto creado.', 'success')
        router.back()
      },
      onError: (error) => {
        if (isApiError(error)) setServerErrors(serverEventErrors(error))
      },
    })
  }

  const generalError =
    save.error && !hasErrors(isApiError(save.error) ? serverEventErrors(save.error) : {}) ? userMessage(save.error) : null
  const showSummary = submitted && hasErrors(errors) && !generalError

  return (
    <Screen
      edges={[]}
      mode="form"
      contentStyle={styles.content}
      footer={
        <>
          {generalError ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              {generalError}
            </Text>
          ) : showSummary ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              Revisa los campos marcados.
            </Text>
          ) : null}
          <Button
            label={event ? 'Guardar cambios' : 'Crear concierto'}
            size="lg"
            loading={save.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Stack.Screen options={{ title: event ? 'Editar concierto' : 'Nuevo concierto' }} />

      <TextField
        label="Nombre del concierto"
        value={values.name}
        onChangeText={(text) => set('name', text)}
        error={errors.name}
        maxLength={EVENT_LIMITS.nameMax}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <LineupEditor value={values.lineup} onChange={(lineup) => set('lineup', lineup)} error={errors.lineup} />

      <TextField
        label="Lugar"
        placeholder="Movistar Arena"
        value={values.venue}
        onChangeText={(text) => set('venue', text)}
        error={errors.venue}
        maxLength={EVENT_LIMITS.venueMax}
        autoCapitalize="words"
      />

      <View style={styles.group}>
        <Text variant="callout" color="textMuted" accessibilityRole="header">
          Ciudad
        </Text>
        <View style={styles.chips}>
          {CITY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={values.cityChoice === option.value}
              onPress={() => set('cityChoice', option.value)}
            />
          ))}
        </View>
        {values.cityChoice === 'other' ? (
          <TextField
            label="Nombre de la ciudad"
            value={values.otherCity}
            onChangeText={(text) => set('otherCity', text)}
            error={errors.city}
            maxLength={EVENT_LIMITS.cityMax}
            autoCapitalize="words"
            autoFocus={!event}
          />
        ) : errors.city ? (
          <Text variant="footnote" color="danger">
            {errors.city}
          </Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <TextField
              label="Fecha"
              placeholder="DD/MM/AAAA"
              value={values.date}
              onChangeText={(text) => {
                const masked = maskDateInput(text)
                set('date', masked)
                if (masked.length === 10 && values.date.length < 10) timeRef.current?.focus()
              }}
              error={errors.date}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
            />
          </View>
          <View style={styles.timeField}>
            <TextField
              ref={timeRef}
              label="Hora"
              placeholder="HH:MM"
              value={values.time}
              onChangeText={(text) => set('time', maskTimeInput(text))}
              error={errors.time}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={5}
            />
          </View>
        </View>
        <Text variant="footnote" color="textSubtle" accessibilityLiveRegion="polite">
          {preview
            ? `Queda el ${preview.long} a las ${preview.time}, hora de Bogotá.`
            : 'Hora de Bogotá, en formato de 24 horas (20:00 son las 8 p. m.).'}
        </Text>
      </View>

      <TextField
        label="Imagen (opcional)"
        placeholder="https://"
        helper="Dirección de una imagen horizontal del cartel."
        value={values.imageUrl}
        onChangeText={(text) => set('imageUrl', text)}
        error={errors.imageUrl}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={EVENT_LIMITS.imageUrlMax}
      />

      <TextField
        label="Descripción (opcional)"
        value={values.description}
        onChangeText={(text) => set('description', text)}
        error={errors.description}
        helper={`${values.description.length}/${EVENT_LIMITS.descriptionMax}`}
        multiline
        textAlignVertical="top"
        maxLength={EVENT_LIMITS.descriptionMax}
        style={styles.multiline}
      />

      <ListSection footer="Si lo ocultas, nadie lo ve en la pestaña Conciertos. Aquí sigue apareciendo.">
        <ListRow
          title="Visible en la app"
          switchValue={values.isPublished}
          onSwitchChange={(value) => set('isPublished', value)}
        />
      </ListSection>

      {event ? (
        <View style={styles.danger}>
          <Button
            label="Borrar concierto"
            variant="destructive"
            icon={TrashIcon}
            onPress={() => {
              remove.reset()
              setConfirmDelete(true)
            }}
          />
          <ConfirmSheet
            visible={confirmDelete}
            title={`¿Borrar ${event.name}?`}
            message={
              event.attendeeCount > 0
                ? `Se borran también las ${event.attendeeCount === 1 ? 'asistencia registrada' : `${event.attendeeCount} asistencias registradas`} y deja de aparecer en el radar. No se puede deshacer.`
                : 'Deja de aparecer en la app. No se puede deshacer.'
            }
            confirmLabel="Borrar concierto"
            destructive
            loading={remove.isPending}
            onConfirm={() =>
              remove.mutate(event.id, {
                onSuccess: () => {
                  setConfirmDelete(false)
                  toast.show('Concierto borrado.', 'success')
                  router.back()
                },
              })
            }
            onCancel={() => {
              if (!remove.isPending) setConfirmDelete(false)
            }}
          >
            {remove.error ? (
              <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                {userMessage(remove.error)}
              </Text>
            ) : null}
          </ConfirmSheet>
        </View>
      ) : null}
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xl, paddingBottom: space.xxl },
    group: { gap: space.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    dateField: { flexGrow: 3, flexBasis: 160 },
    timeField: { flexGrow: 2, flexBasis: 110 },
    multiline: { minHeight: 120 },
    danger: { marginTop: space.lg },
  })
