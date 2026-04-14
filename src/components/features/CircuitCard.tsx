import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import type { Circuit } from '@/types/circuit.types'
import { formatRelativeDate } from '@/utils/formatters'

interface CircuitCardProps {
  circuit: Circuit
  onPress: () => void
}

const statusLabel: Record<Circuit['status'], string> = {
  not_started: 'Non démarré',
  in_progress: 'En cours',
  completed: 'Terminé',
}

const statusVariant: Record<Circuit['status'], 'muted' | 'primary' | 'success'> = {
  not_started: 'muted',
  in_progress: 'primary',
  completed: 'success',
}

export function CircuitCard({ circuit, onPress }: CircuitCardProps) {
  const completionPct =
    circuit.total_steps > 0
      ? Math.round((circuit.completed_steps / circuit.total_steps) * 100)
      : 0

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="git-branch-outline" size={20} color={colors.accent.primary} />
        </View>
        <Badge label={statusLabel[circuit.status]} variant={statusVariant[circuit.status]} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {circuit.title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {circuit.description}
      </Text>

      <ProgressBar
        progress={completionPct}
        showValue
        label={`${circuit.completed_steps}/${circuit.total_steps} étapes`}
        style={styles.progress}
      />

      <Text style={styles.date}>{formatRelativeDate(circuit.created_at)}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  description: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  progress: {},
  date: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
})
