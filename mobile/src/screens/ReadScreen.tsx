import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the read flow (card C4: camera → OCR → read aloud).
 * AppShell only renders this once every model is ready.
 */
export function ReadScreen() {
  return (
    <View style={styles.container} testID="read-screen">
      <Text style={styles.title} accessibilityRole="header">
        Soma Nami
      </Text>
      <Text style={styles.body}>All models ready. Reading comes next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  body: { fontSize: 22, lineHeight: 30 },
});
