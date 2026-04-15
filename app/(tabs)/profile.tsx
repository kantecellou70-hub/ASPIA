import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from '@/hooks/useSession'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user, signOut } = useAuth()
  const { sessionsUsed, sessionsLimit, sessionsRemaining } = useSession()

  const sessionPct = sessionsLimit === Infinity ? 0 : Math.round((sessionsUsed / sessionsLimit) * 100)

  const planVariant: Record<string, 'muted' | 'primary' | 'info' | 'warning'> = {
    free: 'muted',
    starter: 'primary',
    pro: 'info',
    enterprise: 'warning',
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profil</Text>

      {/* Avatar + infos */}
      <Card style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Badge
            label={user?.plan?.toUpperCase() ?? 'FREE'}
            variant={planVariant[user?.plan ?? 'free'] ?? 'muted'}
            style={styles.planBadge}
          />
        </View>
      </Card>

      {/* Sessions */}
      <Card style={styles.sessionsCard}>
        <View style={styles.sessionsHeader}>
          <Text style={styles.cardTitle}>Sessions</Text>
          <Text style={styles.sessionsValue}>
            {sessionsLimit === Infinity ? '∞' : `${sessionsRemaining} restante(s)`}
          </Text>
        </View>

        {sessionsLimit !== Infinity && (
          <ProgressBar
            progress={sessionPct}
            label={`${sessionsUsed} / ${sessionsLimit} utilisées`}
            showValue
            color={sessionsRemaining <= 1 ? colors.accent.warning : colors.accent.primary}
          />
        )}

        <Button
          label="Gérer mon abonnement"
          onPress={() => router.push('/payment/plans')}
          variant="secondary"
          fullWidth
          style={styles.upgradeButton}
        />
      </Card>

      {/* Lien tableau de bord — visible uniquement pour les admins */}
      {user?.role === 'admin' && (
        <Card onPress={() => router.push('/admin')} style={styles.adminCard}>
          <Ionicons name="bar-chart" size={20} color={colors.accent.secondary} />
          <Text style={[styles.menuLabel, styles.adminLabel]}>Tableau de bord admin</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent.secondary} />
        </Card>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        {[
          { icon: 'help-circle-outline' as const, label: 'Aide & support' },
          { icon: 'shield-outline' as const, label: 'Confidentialité' },
          { icon: 'document-text-outline' as const, label: 'Conditions d\'utilisation' },
        ].map((item) => (
          <Card key={item.label} style={styles.menuItem}>
            <Ionicons name={item.icon} size={20} color={colors.text.secondary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </Card>
        ))}
      </View>

      <Button
        label="Se déconnecter"
        onPress={signOut}
        variant="danger"
        fullWidth
      />
    </ScrollView>
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
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userName: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  userEmail: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  planBadge: {
    alignSelf: 'flex-start',
  },
  sessionsCard: {
    gap: spacing.md,
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  sessionsValue: {
    ...textStyles.body,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  upgradeButton: {
    marginTop: spacing.xs,
  },
  menu: {
    gap: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  menuLabel: {
    ...textStyles.body,
    color: colors.text.secondary,
    flex: 1,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  adminLabel: {
    color: colors.accent.secondary,
    fontWeight: '600',
  },
})
