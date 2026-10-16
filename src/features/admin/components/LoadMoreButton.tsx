import { StyleSheet, View } from 'react-native'
import { userMessage } from '@/lib/api/errors'
import { Button, space, useToast } from '@/ui'

type LoadMoreButtonProps = { label: string; loading: boolean; onPress: () => Promise<unknown> }

// Pie de lista del panel: pide la página siguiente; si falla, avisa sin perder lo que ya se ve.
export function LoadMoreButton({ label, loading, onPress }: LoadMoreButtonProps) {
  const toast = useToast()
  return (
    <View style={styles.more}>
      <Button
        label={label}
        variant="secondary"
        loading={loading}
        onPress={() => void onPress().catch((error) => toast.show(userMessage(error), 'danger'))}
      />
    </View>
  )
}

const styles = StyleSheet.create({ more: { paddingHorizontal: space.gutter, paddingVertical: space.lg } })
