import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'
import { KpiCard } from '@/components/features/KpiCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { CURRENCY } from '@/constants/config'

// ─── Types réponse Edge Function ──────────────────────────────────────────────

interface KpiData {
  last_updated: string
  active_users: { day: number; week: number; month: number }
  sessions: {
    total_consumed: number
    circuits_month: number
    quizzes_month: number
    estimated_cost_month_usd: number
    estimated_cost_total_usd: number
    cost_alert_triggered: boolean
  }
  revenue: {
    total_month_xof: number
    total_month_gnf: number
    by_day: { date: string; amount_xof: number }[]
    by_plan: Record<string, number>
    transactions_count: number
  }
  conversion: {
    total_users: number
    paid_users: number
    rate_pct: number
    plan_distribution: Record<string, number>
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXof(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} MXOF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k XOF`
  return `${amount} XOF`
}

function formatGnf(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} MGNF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k GNF`
  return `${amount} GNF`
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`
  return `il y a ${Math.round(diff / 3600)}h`
}

const PLAN_COLORS: Record<string, string> = {
  free: colors.text.muted,
  starter: colors.accent.primary,
  pro: colors.accent.secondary,
  enterprise: colors.accent.warning,
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets()
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(String(CURRENCY.DEFAULT_ALERT_THRESHOLD_USD))
  const [editingThreshold, setEditingThreshold] = useState(false)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchKpis = useCallback(async () => {
    try {
      // S'assurer que la session est chargée avant l'appel (évite la race condition au montage)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Session expirée — veuillez vous reconnecter')
      }

      const thresholdNum = parseFloat(threshold) || CURRENCY.DEFAULT_ALERT_THRESHOLD_USD
      const { data, error: fnError } = await supabase.functions.invoke('get-kpis', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { alert_threshold_usd: thresholdNum },
      })
      if (fnError) {
        throw new Error(fnError.message)
      }
      setKpi(data as KpiData)
      setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [threshold])

  // Chargement initial + rafraîchissement toutes les 60 secondes
  useEffect(() => {
    fetchKpis()
    refreshIntervalRef.current = setInterval(fetchKpis, 60_000)
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [fetchKpis])

  // ── Alerte coût ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (kpi?.sessions.cost_alert_triggered) {
      Alert.alert(
        '⚠️ Seuil budgétaire dépassé',
        `Le coût API Claude estimé ce mois (${formatUsd(kpi.sessions.estimated_cost_month_usd)}) dépasse votre seuil de ${formatUsd(parseFloat(threshold))}.`,
        [{ text: 'OK' }],
      )
    }
  }, [kpi?.sessions.cost_alert_triggered])

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
        <Text style={styles.loadingText}>Chargement des KPIs...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accent.error} />
        <Text style={styles.errorTitle}>Accès refusé</Text>
        <Text style={styles.errorSub}>{error}</Text>
      </View>
    )
  }

  if (!kpi) return null

  const alertActive = kpi.sessions.cost_alert_triggered
  const budgetPct = Math.min(
    Math.round((kpi.sessions.estimated_cost_month_usd / (parseFloat(threshold) || 50)) * 100),
    100,
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header
        title="Tableau de bord"
        showBack
        subtitle={`Mis à jour ${timeAgo(kpi.last_updated)}`}
        rightAction={{
          icon: 'refresh',
          onPress: () => { setIsLoading(true); fetchKpis() },
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Alerte budgétaire ──────────────────────────────────────────── */}
        {alertActive && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={18} color={colors.accent.error} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Seuil budgétaire dépassé</Text>
              <Text style={styles.alertBody}>
                Coût estimé : {formatUsd(kpi.sessions.estimated_cost_month_usd)} / {formatUsd(parseFloat(threshold))} seuil
              </Text>
            </View>
          </View>
        )}

        {/* ── Utilisateurs actifs ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Utilisateurs actifs</Text>
        <View style={styles.row}>
          <KpiCard
            label="Aujourd'hui"
            value={String(kpi.active_users.day)}
            icon="person"
            accentColor={colors.accent.info}
            subtitle="utilisateurs"
          />
          <KpiCard
            label="Cette semaine"
            value={String(kpi.active_users.week)}
            icon="people"
            accentColor={colors.accent.primary}
            subtitle="utilisateurs"
          />
          <KpiCard
            label="Ce mois"
            value={String(kpi.active_users.month)}
            icon="stats-chart"
            accentColor={colors.accent.secondary}
            subtitle={`/ ${kpi.conversion.total_users} inscrits`}
          />
        </View>

        {/* ── IA & Sessions ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>IA & Budget Claude</Text>
        <View style={styles.row}>
          <KpiCard
            label="Sessions totales"
            value={kpi.sessions.total_consumed.toLocaleString('fr')}
            icon="flash"
            accentColor={colors.accent.warning}
            subtitle="consommées"
          />
          <KpiCard
            label="Circuits / mois"
            value={String(kpi.sessions.circuits_month)}
            icon="school"
            accentColor={colors.accent.primary}
            subtitle={`Quiz : ${kpi.sessions.quizzes_month}`}
          />
        </View>

        {/* Coût estimé avec barre de progression */}
        <Card style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetLeft}>
              <Ionicons name="logo-usd" size={16} color={alertActive ? colors.accent.error : colors.accent.success} />
              <Text style={styles.budgetTitle}>Coût API estimé ce mois</Text>
            </View>
            <Text style={[styles.budgetAmount, { color: alertActive ? colors.accent.error : colors.accent.success }]}>
              {formatUsd(kpi.sessions.estimated_cost_month_usd)}
            </Text>
          </View>

          {/* Barre de progression budget */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${budgetPct}%`,
                  backgroundColor: alertActive ? colors.accent.error : colors.accent.success,
                },
              ]}
            />
          </View>
          <Text style={styles.budgetSub}>
            {budgetPct}% du seuil · Total historique : {formatUsd(kpi.sessions.estimated_cost_total_usd)}
          </Text>

          {/* Seuil configurable */}
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Seuil d'alerte :</Text>
            {editingThreshold ? (
              <View style={styles.thresholdInput}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  value={threshold}
                  onChangeText={setThreshold}
                  keyboardType="numeric"
                  style={styles.thresholdField}
                  placeholderTextColor={colors.text.muted}
                  autoFocus
                  onBlur={() => setEditingThreshold(false)}
                  onSubmitEditing={() => { setEditingThreshold(false); fetchKpis() }}
                />
              </View>
            ) : (
              <Pressable onPress={() => setEditingThreshold(true)} style={styles.thresholdValue}>
                <Text style={styles.thresholdValueText}>${threshold}</Text>
                <Ionicons name="pencil-outline" size={12} color={colors.text.muted} />
              </Pressable>
            )}
          </View>
        </Card>

        {/* ── Revenus ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Revenus — {new Date().toLocaleDateString('fr', { month: 'long', year: 'numeric' })}</Text>
        <View style={styles.row}>
          <KpiCard
            label="Total XOF"
            value={formatXof(kpi.revenue.total_month_xof)}
            secondaryValue={formatGnf(kpi.revenue.total_month_gnf)}
            icon="card"
            accentColor={colors.accent.success}
            subtitle={`${kpi.revenue.transactions_count} transaction(s)`}
          />
          <KpiCard
            label="Taux conversion"
            value={`${kpi.conversion.rate_pct}%`}
            icon="trending-up"
            accentColor={kpi.conversion.rate_pct >= 10 ? colors.accent.success : colors.accent.warning}
            subtitle={`${kpi.conversion.paid_users} / ${kpi.conversion.total_users} payants`}
          />
        </View>

        {/* Graphique revenus */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenus journaliers (30 jours)</Text>
          <RevenueChart data={kpi.revenue.by_day} showGnf />
        </Card>

        {/* Distribution par plan */}
        {Object.keys(kpi.revenue.by_plan).length > 0 && (
          <Card style={styles.planDistCard}>
            <Text style={styles.planDistTitle}>Revenus par plan</Text>
            {Object.entries(kpi.revenue.by_plan)
              .sort(([, a], [, b]) => b - a)
              .map(([plan, amount]) => (
                <View key={plan} style={styles.planRow}>
                  <View style={[styles.planDot, { backgroundColor: PLAN_COLORS[plan] ?? colors.text.muted }]} />
                  <Text style={[styles.planName, { color: PLAN_COLORS[plan] ?? colors.text.muted }]}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </Text>
                  <Text style={styles.planAmount}>{formatXof(amount)}</Text>
                  <Text style={styles.planAmountGnf}>≈ {formatGnf(amount * CURRENCY.XOF_TO_GNF)}</Text>
                </View>
              ))}
          </Card>
        )}

        {/* ── Navigation admin ───────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/admin-users')}
          style={({ pressed }) => [styles.navLink, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="people" size={18} color={colors.accent.secondary} />
          <Text style={[styles.navLinkText, { color: colors.accent.secondary }]}>Gestion des utilisateurs (CRM)</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/admin-payments')}
          style={({ pressed }) => [styles.navLink, styles.navLinkPayments, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="card" size={18} color={colors.accent.success} />
          <Text style={[styles.navLinkText, { color: colors.accent.success }]}>Paiements & réconciliation</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </Pressable>

        {/* ── Conversion & utilisateurs ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Base utilisateurs</Text>
        <Card style={styles.conversionCard}>
          {/* Barre de conversion */}
          <View style={styles.conversionHeader}>
            <Text style={styles.conversionLabel}>
              {kpi.conversion.paid_users} payants / {kpi.conversion.total_users} inscrits
            </Text>
            <Text style={[
              styles.conversionRate,
              { color: kpi.conversion.rate_pct >= 10 ? colors.accent.success : colors.accent.warning },
            ]}>
              {kpi.conversion.rate_pct}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${kpi.conversion.rate_pct}%`,
                  backgroundColor: kpi.conversion.rate_pct >= 10 ? colors.accent.success : colors.accent.warning,
                },
              ]}
            />
          </View>

          {/* Distribution plans */}
          <View style={styles.planDistRow}>
            {Object.entries(kpi.conversion.plan_distribution)
              .sort(([a], [b]) => ['free', 'starter', 'pro', 'enterprise'].indexOf(a) - ['free', 'starter', 'pro', 'enterprise'].indexOf(b))
              .map(([plan, count]) => (
                <View key={plan} style={styles.planChip}>
                  <View style={[styles.planDot, { backgroundColor: PLAN_COLORS[plan] ?? colors.text.muted }]} />
                  <Text style={styles.planChipText}>{plan}</Text>
                  <Text style={[styles.planChipCount, { color: PLAN_COLORS[plan] ?? colors.text.muted }]}>
                    {count}
                  </Text>
                </View>
              ))}
          </View>
        </Card>

      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  errorTitle: {
    ...textStyles.h3,
    color: colors.accent.error,
    textAlign: 'center',
  },
  errorSub: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    ...textStyles.label,
    color: colors.accent.error,
  },
  alertBody: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetCard: {
    gap: spacing.sm,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  budgetTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  budgetAmount: {
    ...textStyles.h4,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.background.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  budgetSub: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  thresholdLabel: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  thresholdInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 4,
  },
  dollarSign: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  thresholdField: {
    ...textStyles.bodySmall,
    color: colors.text.primary,
    minWidth: 50,
    padding: 0,
  },
  thresholdValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.surface,
  },
  thresholdValueText: {
    ...textStyles.bodySmall,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  chartCard: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  chartTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  planDistCard: {
    gap: spacing.sm,
  },
  planDistTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planName: {
    ...textStyles.label,
    flex: 1,
  },
  planAmount: {
    ...textStyles.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },
  planAmountGnf: {
    ...textStyles.caption,
    color: colors.text.muted,
    width: 80,
    textAlign: 'right',
  },
  conversionCard: {
    gap: spacing.md,
  },
  conversionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversionLabel: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  conversionRate: {
    ...textStyles.h3,
    fontWeight: '700',
  },
  planDistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  planChipText: {
    ...textStyles.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  planChipCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  navLinkPayments: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  navLinkText: {
    ...textStyles.label,
    flex: 1,
    fontWeight: '600',
  },
})
