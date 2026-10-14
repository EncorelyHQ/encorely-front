import { useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { Alert, Button, haptics, RadioGroup, Screen, space, Text, TextField, useStyles, type Theme } from '@/ui'
import { BirthDateFields } from '@/features/shared/BirthDateFields'
import {
  CITY_CHOICES,
  CITY_MAX,
  cityError,
  validateBirthDate,
  validateDisplayName,
  type BirthDateParts,
} from '@/features/shared/profileRules'
import { StepStub } from '../components/StepStub'
import { updateDraft } from '../draftStore'
import type { StepOneField } from '../lib/draft'
import { useSeededDraft } from '../useOnboardingDraft'

type Errors = Partial<Record<StepOneField, string>>

export function AboutYouScreen() {
  const styles = useStyles(makeStyles)
  const draft = useSeededDraft()
  const [errors, setErrors] = useState<Errors>({})
  // Solo se enfoca "¿Cuál?" cuando la persona eligió "Otra", no cuando llega prellenado.
  const [focusOther, setFocusOther] = useState(false)
  const nameRef = useRef<TextInput>(null)
  const dayRef = useRef<TextInput>(null)

  const serverErrors = draft.stepOneErrors
  const errorFor = (field: StepOneField) => errors[field] ?? serverErrors[field] ?? null
  const hasServerErrors = Object.keys(serverErrors).length > 0

  const clear = (field: StepOneField) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (serverErrors[field]) {
      const rest = { ...serverErrors }
      delete rest[field]
      updateDraft({ stepOneErrors: rest })
    }
  }

  const onDateChange = (value: BirthDateParts) => {
    updateDraft(value)
    clear('birthDate')
  }

  const next = () => {
    const local: Errors = {}
    const nameMsg = validateDisplayName(draft.displayName)
    if (nameMsg) local.displayName = nameMsg
    const birth = validateBirthDate(draft)
    if (!birth.ok) local.birthDate = birth.message
    const cityMsg = cityError(draft.cityChoice, draft.otherCity)
    if (cityMsg) local.city = cityMsg
    setErrors(local)

    if (Object.keys(local).length) {
      haptics.warning()
      if (nameMsg) nameRef.current?.focus()
      else if (local.birthDate) dayRef.current?.focus()
      return
    }
    updateDraft({ stepOneErrors: {} })
    router.push('/genres')
  }

  return (
    <Screen mode="form" edges={['bottom']}>
      <View style={styles.header}>
        <StepStub step={1} total={2} />
        <Text variant="title1" accessibilityRole="header">
          Cuéntanos de ti
        </Text>
        <Text variant="body" color="textMuted">
          Con tu fecha confirmamos que tienes 18 años o más, y con tu ciudad te mostramos los conciertos cercanos.
        </Text>
        {hasServerErrors ? <Alert message="Hay un dato por corregir antes de terminar. Lo marcamos abajo." /> : null}
      </View>

      <View style={styles.fields}>
        <TextField
          ref={nameRef}
          label="Tu nombre"
          helper="Así te verán las demás personas."
          value={draft.displayName}
          onChangeText={(value) => {
            updateDraft({ displayName: value })
            clear('displayName')
          }}
          error={errorFor('displayName')}
          textContentType="name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={50}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => dayRef.current?.focus()}
        />

        <BirthDateFields
          dayRef={dayRef}
          value={draft}
          onChange={onDateChange}
          error={errorFor('birthDate')}
          helper="Los demás solo ven tu edad, nunca la fecha."
        />

        <View style={styles.city}>
          <RadioGroup
            label="Ciudad"
            showLabel
            direction="row"
            options={CITY_CHOICES}
            value={draft.cityChoice}
            onChange={(value) => {
              updateDraft({ cityChoice: value })
              setFocusOther(value === 'other')
              clear('city')
            }}
            error={draft.cityChoice === 'other' ? null : errorFor('city')}
          />
          {draft.cityChoice === 'other' ? (
            <TextField
              label="¿Cuál ciudad?"
              value={draft.otherCity}
              onChangeText={(value) => {
                updateDraft({ otherCity: value })
                clear('city')
              }}
              error={errorFor('city')}
              placeholder="Por ejemplo, Cali"
              autoFocus={focusOther}
              autoCapitalize="words"
              textContentType="addressCity"
              autoComplete="postal-address-locality"
              maxLength={CITY_MAX}
              returnKeyType="done"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.spacer} />

      <Button label="Seguir" size="lg" onPress={next} />
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    header: { gap: space.md, marginBottom: space.xl },
    fields: { gap: space.xl },
    city: { gap: space.lg },
    spacer: { flexGrow: 1, minHeight: space.xl },
  })
