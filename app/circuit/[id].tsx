import React, { useEffect } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StepItem } from '@/components/features/StepItem'
import { useCircuit } from '@/hooks/useCircuit'

export default function CircuitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { circuit, isLoading, fetchCircuit, markStepCompleted } = useCircuit(id)

  const completionPct = circuit
    ? Math.round((circuit.completed_steps / circuit.total_steps) * 100)
    : 0

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </View>
    )
  }

  if (!circuit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Circuit introuvable</Text>
      </View>
    )
  }

  const sortedSteps = [...(circuit.steps ?? [])].sort((a, b) => a.order - b.order)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header title={circuit.title} showBack />

      <FlatList
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Badge
              label={circuit.status === 'completed' ? 'Terminé' : circuit.status === 'in_progress' ? 'En cours' : 'Non démarré'}
              variant={circuit.status === 'completed' ? 'success' : circuit.status === 'in_progress' ? 'primary' : 'muted'}
            />
            <Text style={styles.description}>{circuit.description}</Text>
            <ProgressBar
              progress={completionPct}
              label={`${circuit.completed_steps}/${circuit.total_steps} étapes`}
              showValue
              height={10}
            />

            {circuit.status === 'completed' && (
              <Button
                label="Passer le quiz"
                onPress={() => router.push(`/quiz/${circuit.id}`)}
                fullWidth
                size="lg"
              />
            )}

            <Text style={styles.stepsTitle}>Étapes du circuit</Text>
          </View>
        }
        data={sortedSteps}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const previousStep = sortedSteps[index - 1]
          const isLocked = index > 0 && previousStep && !previousStep.is_completed

          return (
            <StepItem
              step={item}
              onMarkCompleted={markStepCompleted}
              isLocked={isLocked}
            />
          )
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  description: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  stepsTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
})
