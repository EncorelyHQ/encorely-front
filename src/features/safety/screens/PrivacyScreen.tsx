import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import {
  font,
  Icon,
  LockKeyIcon,
  Screen,
  ShieldCheckIcon,
  space,
  Text,
  type as typeScale,
  useStyles,
  WarningIcon,
  type PhosphorIcon,
  type Theme,
} from '@/ui'
import { E2EE_LIMITS, E2EE_PROTECTS, E2EE_SUMMARY, E2EE_VERIFY } from '../e2eeDisclosure'

export function PrivacyScreen() {
  const styles = useStyles(makeStyles)
  return (
    <Screen mode="scroll" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Cómo protegemos tus chats' }} />
      <View style={styles.page}>
        <Text variant="body">{E2EE_SUMMARY}</Text>

        <Section icon={LockKeyIcon} title="Qué protege el cifrado">
          {E2EE_PROTECTS.map((line) => (
            <Text key={line} variant="body" color="textMuted">
              {line}
            </Text>
          ))}
        </Section>

        <Section icon={ShieldCheckIcon} title="Cómo verificar un chat">
          {E2EE_VERIFY.map((line) => (
            <Text key={line} variant="body" color="textMuted">
              {line}
            </Text>
          ))}
        </Section>

        <Section icon={WarningIcon} title="Límites de esta versión">
          <Text variant="body" color="textMuted">
            Preferimos decirte desde ya lo que el cifrado de esta versión no cubre.
          </Text>
          <View style={styles.limits}>
            {E2EE_LIMITS.map((limit) => (
              <View key={limit.id} style={styles.limit} accessible accessibilityLabel={limit.text}>
                <View style={styles.bullet} />
                <Text variant="body" color="textMuted" style={styles.limitText}>
                  <Text variant="body" style={styles.lead}>
                    {limit.lead}:
                  </Text>{' '}
                  {limit.detail}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      </View>
    </Screen>
  )
}

function Section({ icon, title, children }: { icon: PhosphorIcon; title: string; children: ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon icon={icon} size={24} color={icon === WarningIcon ? 'danger' : 'textMuted'} />
        <Text variant="headline" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

const BULLET = space.xs + 2

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xl },
    section: { gap: space.md },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    sectionTitle: { flex: 1 },
    limits: { gap: space.md },
    limit: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    // Centrado en la primera línea del párrafo, no en todo el bloque.
    bullet: {
      width: BULLET,
      height: BULLET,
      marginTop: (typeScale.body.lineHeight - BULLET) / 2,
      borderRadius: BULLET / 2,
      backgroundColor: t.textMuted,
    },
    limitText: { flex: 1 },
    lead: { fontFamily: font.bodySemibold, color: t.text },
  })
