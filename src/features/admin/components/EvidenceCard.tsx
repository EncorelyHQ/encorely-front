import { StyleSheet, View } from 'react-native'
import { Icon, radius, space, Text, useStyles, type Theme } from '@/ui'
import { bogotaLabel } from '../model/datetime'
import { parseEvidence } from '../model/evidence'
import { SealCheckIcon, SealWarningIcon } from '../icons'
import type { AdminEvidence } from '../types'

type EvidenceCardProps = {
  evidence: AdminEvidence
  index: number
  reportedUserId: string | null
}

function sentAtLabel(ms: number | null): string | null {
  if (ms === null) return null
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : bogotaLabel(date.toISOString()) || null
}

export function EvidenceCard({ evidence, index, reportedUserId }: EvidenceCardProps) {
  const styles = useStyles(makeStyles)
  const parsed = parseEvidence(evidence.plaintext)
  const sentAt = parsed.kind === 'message' ? sentAtLabel(parsed.sentAt) : null
  // El payload firmado dice quién lo envió: si no es la cuenta reportada, el moderador debe saberlo.
  const otherSender =
    parsed.kind === 'message' && parsed.senderId !== null && reportedUserId !== null && parsed.senderId !== reportedUserId

  return (
    <View style={styles.card} accessible accessibilityLabel={accessibilityText(index, evidence.verified, parsed.kind === 'message' ? parsed.body : null, sentAt)}>
      <View style={styles.header}>
        <Icon
          icon={evidence.verified ? SealCheckIcon : SealWarningIcon}
          size={20}
          color={evidence.verified ? 'verified' : 'danger'}
          weight="fill"
        />
        <Text variant="callout" color={evidence.verified ? 'verified' : 'text'} style={styles.flex}>
          {evidence.verified ? 'Verificado: el mensaje es auténtico' : 'No verificado'}
        </Text>
      </View>
      {!evidence.verified ? (
        <Text variant="footnote" color="textMuted">
          No se pudo comprobar que la cuenta reportada enviara este texto. Tómalo como referencia, no como prueba.
        </Text>
      ) : null}

      {parsed.kind === 'message' ? (
        <View style={styles.quote}>
          <Text variant="body" selectable>
            {parsed.body || 'Mensaje vacío'}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" color="textMuted">
          No pudimos leer el contenido de este mensaje.
        </Text>
      )}

      {sentAt ? (
        <Text variant="footnote" color="textSubtle">
          Enviado el <Text variant="data" color="textSubtle">{sentAt}</Text> (hora de Bogotá)
        </Text>
      ) : null}
      {otherSender ? (
        <Text variant="footnote" color="danger">
          Lo envió una cuenta distinta a la reportada.
        </Text>
      ) : null}
    </View>
  )
}

function accessibilityText(index: number, verified: boolean, body: string | null, sentAt: string | null): string {
  const parts = [`Mensaje ${index + 1}`, verified ? 'Verificado, el mensaje es auténtico' : 'No verificado']
  parts.push(body !== null ? `Dice: ${body || 'mensaje vacío'}` : 'Contenido ilegible')
  if (sentAt) parts.push(`Enviado el ${sentAt}`)
  return `${parts.join('. ')}.`
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      gap: space.sm,
      padding: space.lg,
      borderRadius: radius.sm + 4,
      backgroundColor: t.surface,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    flex: { flex: 1 },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: t.borderInput,
      paddingLeft: space.md,
      paddingVertical: space.xs,
    },
  })
