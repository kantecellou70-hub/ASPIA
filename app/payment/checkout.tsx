import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { PLANS_CONFIG } from '@/constants/config'
import { usePayment } from '@/hooks/usePayment'
import { validators } from '@/utils/validators'
import { formatCurrency } from '@/utils/formatters'
import type { PlanTier } from '@/types/auth.types'

export default function CheckoutScreen() {
  const { plan_id } = useLocalSearchParams<{ plan_id: PlanTier }>()
  const insets = useSafeAreaInsets()
  const { isLoading, initiatePayment, verifyPayment } = usePayment()
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | undefined>()

  const planKey = (plan_id?.toUpperCase() ?? 'FREE') as keyof typeof PLANS_CONFIG
  const plan = PLANS_CONFIG[planKey]

  async function handlePay() {
    const error = validators.phone(phone)
    setPhoneError(error)
    if (error) return

    const transactionId = await initiatePayment({
      plan_id: plan_id,
      amount: plan.price,
      phone: phone.replace(/\s/g, ''),
    })

    if (!transactionId) return

    // Attendre la confirmation puis vérifier
    const payment = await verifyPayment(transactionId)
    if (payment?.status === 'completed') {
      router.replace('/(tabs)/home')
    }
  }

  if (!plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Plan introuvable</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}>
      <Header title="Paiement" showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Récap commande */}
        <GlassCard style={styles.summary}>
          <Text style={styles.summaryLabel}>Plan sélectionné</Text>
          <Text style={styles.summaryPlan}>{plan.name}</Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Sessions</Text>
            <Text style={styles.summaryValue}>
              {plan.sessions === Infinity ? 'Illimitées' : plan.sessions}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Montant total</Text>
            <Text style={[styles.summaryValue, styles.summaryPrice]}>
              {formatCurrency(plan.price, plan.currency)}
            </Text>
          </View>
        </GlassCard>

        {/* Paiement Mobile Money */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Paiement Mobile Money</Text>
          <Text style={styles.sectionSubtitle}>
            Entrez votre numéro de téléphone pour recevoir la demande de paiement
          </Text>

          <Input
            label="Numéro de téléphone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            error={phoneError}
            placeholder="+229 XX XX XX XX"
            hint="Format : +229XXXXXXXX (Bénin) ou votre numéro local"
          />
        </View>

        <View style={styles.trustBadges}>
          {['🔒 Paiement sécurisé', '⚡ Activation immédiate', '🔄 Remboursable sous 7j'].map((t) => (
            <View key={t} style={styles.trustItem}>
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={`Payer ${formatCurrency(plan.price, plan.currency)}`}
          onPress={handlePay}
          loading={isLoading}
          fullWidth
          size="lg"
        />
      </View>
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
  errorText: { ...textStyles.body, color: colors.text.muted },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryLabel: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  summaryPlan: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryKey: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  summaryPrice: {
    color: colors.accent.primary,
    ...textStyles.h4,
  },
  paymentSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trustItem: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  trustText: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
})
