import React, { useEffect } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { CircuitCard } from '@/components/features/CircuitCard'
import { SessionCounter } from '@/components/features/SessionCounter'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { useAuthStore } from '@/store/authStore'
import { useCircuit } from '@/hooks/useCircuit'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { circuits, fetchUserCircuits, isLoading } = useCircuit()

  useEffect(() => {
    fetchUserCircuits()
  }, [fetchUserCircuits])

  const firstName = user?.full_name?.split(' ')[0] ?? 'là'
  const inProgressCircuits = circuits.filter((c) => c.status === 'in_progress')
  const recentCircuits = circuits.slice(0, 5)

  return (
    <FlatList
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
              <Text style={styles.subtitle}>Continuez votre apprentissage</Text>
            </View>
            <SessionCounter />
          </View>

          {inProgressCircuits.length === 0 && circuits.length === 0 && (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🚀</Text>
              <Text style={styles.emptyTitle}>Commencez votre premier circuit</Text>
              <Text style={styles.emptySubtitle}>
                Importez un PDF pour qu'APSIA génère un parcours d'apprentissage IA personnalisé
              </Text>
              <Button
                label="Importer un cours"
                onPress={() => router.push('/(tabs)/upload')}
                style={styles.emptyButton}
              />
            </GlassCard>
          )}

          {circuits.length > 0 && (
            <Text style={styles.sectionTitle}>Circuits récents</Text>
          )}
        </>
      }
      data={recentCircuits}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CircuitCard
          circuit={item}
          onPress={() => router.push(`/circuit/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      showsVerticalScrollIndicator={false}
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
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
})
