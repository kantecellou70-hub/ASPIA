import React, { useEffect } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { CircuitCard } from '@/components/features/CircuitCard'
import { useCircuit } from '@/hooks/useCircuit'

export default function LibraryScreen() {
  const insets = useSafeAreaInsets()
  const { circuits, fetchUserCircuits, isLoading } = useCircuit()

  useEffect(() => {
    fetchUserCircuits()
  }, [fetchUserCircuits])

  return (
    <FlatList
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 80 },
        circuits.length === 0 && styles.emptyContent,
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Bibliothèque</Text>
          <Text style={styles.subtitle}>{circuits.length} circuit(s)</Text>
        </View>
      }
      data={circuits}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CircuitCard
          circuit={item}
          onPress={() => router.push(`/circuit/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={colors.accent.primary} size="large" />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>Bibliothèque vide</Text>
            <Text style={styles.emptyText}>
              Importez des cours pour les retrouver ici.
            </Text>
          </View>
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  emptyContent: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
