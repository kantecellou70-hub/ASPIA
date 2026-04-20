import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { PLANS } from '@/constants/config'
import { formatGNF } from '@/utils/formatters'
import { useAuthStore } from '@/store/authStore'
import type { PlanId } from '@/constants/config'

function PlanCard({
  planId,
  isCurrentPlan,
  isRecommended,
  onSelect,
}: {
  planId: PlanId
  isCurrentPlan: boolean
  isRecommended?: boolean
  onSelect: () => void
}) {
  const plan = PLANS[planId]
  const tierColor = colors.tier[planId] ?? colors.accent.primary

  return (
    <View style={[
      styles.card,
      { borderColor: isRecommended ? tierColor : colors.border.default },
      isRecommended && styles.cardRecommended,
    ]}>
      {isRecommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.recommendedText}>⭐ Recommandé</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <Text style={[styles.planName, { color: tierColor }]}>{plan.name}</Text>
        <View>
          <Text style={styles.planPrice}>{formatGNF(plan.price)}</Text>
          {plan.price > 0 && <Text style={styles.planPriceSub}>/mois</Text>}
        </View>
      </View>
      <Text style={styles.planDesc}>{plan.description}</Text>
      <View style={styles.features}>
        {plan.features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Text style={[styles.featureCheck, { color: tierColor }]}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {isCurrentPlan ? (
        <View style={[styles.currentBadge, { borderColor: tierColor }]}>
          <Text style={[styles.currentText, { color: tierColor }]}>Plan actuel</Text>
        </View>
      ) : (
        <Button
          label={plan.price === 0 ? 'Plan gratuit' : `Choisir ${plan.name}`}
          onPress={onSelect}
          disabled={plan.price === 0}
          style={[styles.selectBtn, plan.price === 0 && styles.selectBtnDisabled]}
        />
      )}
    </View>
  )
}

export default function PlansScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  function handleSelect(planId: PlanId) {
    const plan = PLANS[planId]
    if (plan.price === 0) return
    router.push({ pathname: '/payment/checkout', params: { plan_id: planId } })
  }

  const currentPlan = (user?.plan ?? 'alpha') as PlanId

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Header title="Abonnements" showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Choisis ton plan — même prix qu'un répétiteur traditionnel, disponible 24h/24
        </Text>

        <Text style={styles.sectionTitle}>Plans individuels</Text>

        {(['alpha', 'beta', 'gamma'] as PlanId[]).map((planId) => (
          <PlanCard
            key={planId}
            planId={planId}
            isCurrentPlan={currentPlan === planId}
            isRecommended={planId === 'gamma'}
            onSelect={() => handleSelect(planId)}
          />
        ))}

        <Text style={styles.sectionTitle}>Pour les établissements</Text>
        <Text style={styles.sectionSubtitle}>
          Dashboard proviseur · Suivi par classe · Rapports mensuels PDF
        </Text>

        {(['ecole_beta', 'ecole_gamma'] as PlanId[]).map((planId) => (
          <PlanCard
            key={planId}
            planId={planId}
            isCurrentPlan={currentPlan === planId}
            onSelect={() => handleSelect(planId)}
          />
        ))}

        <Text style={styles.note}>
          💳 Paiement via Mobile Money (MTN, Orange) — sans carte bancaire
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginTop: -spacing.sm,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    position: 'relative',
  },
  cardRecommended: {
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  recommendedText: {
    ...textStyles.caption,
    color: '#fff',
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    ...textStyles.h3,
    fontWeight: '800',
  },
  planPrice: {
    ...textStyles.h3,
    color: colors.text.primary,
    textAlign: 'right',
    fontWeight: '800',
  },
  planPriceSub: {
    ...textStyles.caption,
    color: colors.text.muted,
    textAlign: 'right',
  },
  planDesc: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  features: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureCheck: {
    fontWeight: '700',
    fontSize: 14,
  },
  featureText: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  currentBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  currentText: {
    ...textStyles.label,
    fontWeight: '700',
  },
  selectBtn: {
    marginTop: spacing.xs,
  },
  selectBtnDisabled: {
    opacity: 0.5,
  },
  note: {
    ...textStyles.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
