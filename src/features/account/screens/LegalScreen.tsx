import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { userMessage } from '@/lib/api/errors'
import { ErrorState, Icon, ListRow, ListSection, Screen, Skeleton, space, Text, useStyles, type Theme } from '@/ui'
import { ArrowSquareOutIcon } from 'phosphor-react-native/src/icons/ArrowSquareOut'
import { EnvelopeIcon } from 'phosphor-react-native/src/icons/Envelope'
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText'
import { CLAIM_TERMS, contactMailto, PRIVACY_CONTACT_EMAIL, SIC_URL } from '../contact'
import { effectiveDateLabel, legalDocumentsOf } from '../legal'
import { useLegalQuery } from '../queries'
import { useOpenLink } from '../useOpenLink'

export function LegalScreen() {
  const styles = useStyles(makeStyles)
  const legal = useLegalQuery()
  const open = useOpenLink()
  const documents = legalDocumentsOf(legal.data)
  const effective = effectiveDateLabel(legal.data?.effectiveDate)
  // El correo sale del back; la constante local solo cubre un back que aún no lo traiga.
  const contactEmail = legal.data?.privacyContactEmail ?? PRIVACY_CONTACT_EMAIL
  const mailto = contactMailto(contactEmail)

  return (
    <Screen
      mode="scroll"
      edges={['bottom']}
      refreshing={legal.isRefetching && !legal.isPending}
      onRefresh={() => void legal.refetch()}
    >
      <Stack.Screen options={{ title: 'Términos y privacidad' }} />
      <View style={styles.page}>
        {legal.isPending ? (
          <View style={styles.skeletons} accessible accessibilityLabel="Cargando documentos" accessibilityRole="progressbar">
            <Skeleton width="50%" height={space.lg} />
            <Skeleton height={space.xxxl} />
            <Skeleton height={space.xxxl} />
          </View>
        ) : legal.isError ? (
          <ErrorState
            title="No pudimos cargar los documentos"
            message={userMessage(legal.error)}
            onRetry={() => void legal.refetch()}
            retrying={legal.isRefetching}
          />
        ) : (
          <>
            <View
              style={styles.version}
              accessible
              accessibilityLabel={`Versión vigente ${legal.data.consentVersion}${effective ? `, desde el ${effective}` : ''}`}
            >
              <Text variant="caption" color="textMuted">
                VERSIÓN VIGENTE
              </Text>
              <Text variant="data">{legal.data.consentVersion}</Text>
              {effective ? (
                <Text variant="footnote" color="textMuted">
                  Desde <Text variant="data" color="text">{effective}</Text>
                </Text>
              ) : null}
            </View>

            <ListSection title="Documentos" footer="Se abren en el navegador. Si cambian, te pediremos aceptarlos de nuevo.">
              {documents.map((doc) => (
                <ListRow
                  key={doc.key}
                  title={doc.title}
                  subtitle={doc.subtitle}
                  icon={FileTextIcon}
                  chevron={false}
                  trailing={<Icon icon={ArrowSquareOutIcon} size={20} color="textSubtle" />}
                  accessibilityHint="Se abre en el navegador"
                  onPress={() => void open(doc.url)}
                />
              ))}
            </ListSection>
          </>
        )}

        <ListSection
          title="Tus datos"
          footer={`Respondemos consultas en máximo ${CLAIM_TERMS.queryBusinessDays} días hábiles y reclamos en ${CLAIM_TERMS.claimBusinessDays} (Ley 1581 de 2012). Si no te respondemos, puedes quejarte ante la Superintendencia de Industria y Comercio.`}
        >
          {mailto ? (
            <ListRow
              title="Consultas y reclamos"
              subtitle={contactEmail ?? undefined}
              icon={EnvelopeIcon}
              chevron={false}
              accessibilityHint="Abre tu app de correo"
              onPress={() => void open(mailto)}
            />
          ) : null}
          <ListRow
            title="Superintendencia de Industria y Comercio"
            subtitle="La autoridad de protección de datos en Colombia."
            icon={FileTextIcon}
            chevron={false}
            trailing={<Icon icon={ArrowSquareOutIcon} size={20} color="textSubtle" />}
            accessibilityHint="Se abre en el navegador"
            onPress={() => void open(SIC_URL)}
          />
        </ListSection>
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xl },
    skeletons: { gap: space.md },
    version: { gap: space.xs },
  })
