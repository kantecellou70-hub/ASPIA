import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { PlanCard } from '@/components/features/PlanCard'
import { PLANS_CONFIG } from '@/constants/config'
import { useAuthStore } from '@/store/authStore'
import type { Plan } from '@/types/payment.types'

const plans: Plan[] = [
  { ...PLANS_CONFIG.FREE, sessions: PLANS_CONFIG.FREE.sessions },
  { ...PLANS_CONFIG.STARTER, sessions: PLANS_CONFIG.STARTER.sessions },
  { ...PLANS_CONFIG.PRO, sessions: PLANS_CONFIG.PRO.sessions },
  { ...PLANS_CONFIG.ENTERPRISE, sessions: PLANS_CONFIG.ENTERPRISE.sessions as number },
]

export default function PlansScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  function handleSelect(plan: Plan) {
    if (plan.price === 0) return
    router.push({ pathname: '/payment/checkout', params: { plan_id: plan.id } })
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Header title="Abonnements" showBack />

      <FlatList
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.subtitle}>
              Choisissez le plan adapté à votre rythme d'apprentissage
            </Text>
          </View>
        }
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlanCard
            plan={item}
            isCurrentPlan={user?.plan === item.id}
            onSelect={() => handleSelect(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        showsVerticalScrollIndicator={false}
      />
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
  intro: {
    paddingVertical: spacing.md,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
  },
})
