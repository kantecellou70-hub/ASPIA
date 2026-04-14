import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing, shadows } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Badge } from '@/components/ui/Badge'
import type { Plan } from '@/types/payment.types'
import { formatCurrency } from '@/utils/formatters'

interface PlanCardProps {
  plan: Plan
  isCurrentPlan?: boolean
  onSelect: () => void
}

const tierAccents: Record<Plan['id'], string> = {
  free: colors.tier.free,
  starter: colors.tier.starter,
  pro: colors.tier.pro,
  enterprise: colors.tier.enterprise,
}

export function PlanCard({ plan, isCurrentPlan = false, onSelect }: PlanCardProps) {
  const accent = tierAccents[plan.id]
  const isPopular = plan.is_popular

  return (
    <Pressable
      onPress={onSelect}
      disabled={isCurrentPlan}
      style={({ pressed }) => [
        styles.card,
        isPopular && styles.popular,
        isCurrentPlan && styles.currentPlan,
        pressed && !isCurrentPlan && styles.pressed,
        { borderColor: isPopular ? accent : isCurrentPlan ? colors.accent.success : colors.border.default },
      ]}
    >
      {isPopular && (
        <View style={[styles.popularBadge, { backgroundColor: accent }]}>
          <Text style={styles.popularBadgeText}>⭐ Populaire</Text>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={[styles.planName, { color: accent }]}>{plan.name}</Text>
          <Text style={styles.planDescription}>{plan.description}</Text>
        </View>
        {isCurrentPlan && (
          <Badge label="Actuel" variant="success" />
        )}
      </View>

      <View style={styles.pricing}>
        {plan.price === 0 ? (
          <Text style={styles.priceText}>Gratuit</Text>
        ) : (
          <>
            <Text style={[styles.priceText, { color: accent }]}>
              {formatCurrency(plan.price, plan.currency)}
            </Text>
            <Text style={styles.pricePeriod}>/mois</Text>
          </>
        )}
      </View>

      <View style={styles.sessions}>
        <Ionicons name="flash" size={16} color={accent} />
        <Text style={styles.sessionsText}>
          {plan.sessions === Infinity ? 'Sessions illimitées' : `${plan.sessions} sessions`}
        </Text>
      </View>

      <View style={styles.features}>
        {plan.features.map((feature, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent.success} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {!isCurrentPlan && (
        <View style={[styles.selectButton, { backgroundColor: `${accent}20`, borderColor: accent }]}>
          <Text style={[styles.selectButtonText, { color: accent }]}>
            {plan.price === 0 ? 'Plan actuel' : 'Choisir ce plan'}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  popular: {
    ...shadows.glow,
  },
  currentPlan: {},
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  popularBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  popularBadgeText: {
    ...textStyles.caption,
    color: '#fff',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    ...textStyles.h3,
  },
  planDescription: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  pricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  priceText: {
    ...textStyles.h1,
    color: colors.text.primary,
  },
  pricePeriod: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  sessions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.surface,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  sessionsText: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  features: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  selectButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  selectButtonText: {
    ...textStyles.button,
  },
})
