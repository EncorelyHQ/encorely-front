import { StyleSheet, View } from 'react-native'
import { space, Text, useStyles, type Theme } from '@/ui'

export function OrDivider() {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.line} />
      <Text variant="footnote" color="textSubtle">
        o
      </Text>
      <View style={styles.line} />
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.border },
  })
