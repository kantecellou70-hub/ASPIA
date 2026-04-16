import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string
  user_id: string
  user_name: string
  plan_id: string
  amount: number
  currency: string
  status: string
  operator: string | null
  phone: string | null
  kkiapay_transaction_id: string | null
  refund_reason: string | null
  refunded_at: string | null
  created_at: string
}

interface FailureStat {
  operator: string
  total: number
  failed: number
  failure_rate_pct: number
}

interface FailureStatsRes {
  global: { total: number; failed: number; failure_rate_pct: number }
  by_operator: FailureStat[]
  since: string
}

interface MonthlyReport {
  period: { year: number; month: number; label: string }
  summary: {
    transactions_completed: number
    transactions_failed: number
    transactions_refunded: number
    total_revenue_xof: number
    total_refunded_xof: number
    net_revenue_xof: number
    estimated_commission_xof: number
    net_after_commission_xof: number
    success_rate_pct: number
  }
  by_operator: Record<string, { count: number; revenue: number; failed_count: number }>
  by_plan: Record<string, { count: number; revenue: number }>
  daily: { date: string; amount_xof: number }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed', 'refunded'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

const STATUS_COLORS: Record<string, string> = {
  completed: colors.accent.success,
  pending:   colors.accent.warning,
  failed:    colors.accent.error,
  refunded:  colors.accent.secondary,
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Réussi',
  pending:   'En attente',
  failed:    'Échoué',
  refunded:  'Remboursé',
}

const PLAN_COLORS: Record<string, string> = {
  free:       colors.text.muted,
  starter:    colors.accent.primary,
  pro:        colors.accent.secondary,
  enterprise: colors.accent.warning,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXof(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} MXOF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k XOF`
  return `${amount} XOF`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Composant ligne ──────────────────────────────────────────────────────────

function PaymentRow({ payment }: { payment: Payment }) {
  const statusColor = STATUS_COLORS[payment.status] ?? colors.text.muted

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/admin-payment/${payment.id}`)}
    >
      {/* Indicateur statut */}
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowAmount}>{formatXof(payment.amount)}</Text>
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}50` }]}>
            <Text style={[styles.statusChipText, { color: statusColor }]}>
              {STATUS_LABELS[payment.status] ?? payment.status}
            </Text>
          </View>
        </View>

        <View style={styles.rowMid}>
          <Text style={styles.rowUser} numberOfLines={1}>{payment.user_name}</Text>
          <View style={[styles.planDot, { backgroundColor: PLAN_COLORS[payment.plan_id] ?? colors.text.muted }]} />
          <Text style={[styles.rowPlan, { color: PLAN_COLORS[payment.plan_id] ?? colors.text.muted }]}>
            {payment.plan_id}
          </Text>
        </View>

        <View style={styles.rowBot}>
          <Text style={styles.rowMeta}>
            {payment.operator ?? 'Mobile Money'}
            {payment.phone ? ` · ${payment.phone}` : ''}
          </Text>
          <Text style={styles.rowDate}>{formatDateTime(payment.created_at)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.text.muted} />
    </Pressable>
  )
}

// ─── Rapport mensuel modal ─────────────────────────────────────────────────────

function MonthlyReportModal({
  visible, report, onClose,
}: {
  visible: boolean
  report: MonthlyReport | null
  onClose: () => void
}) {
  if (!report) return null
  const { summary, by_operator, by_plan, period } = report

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Rapport — {period.label}</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* KPIs */}
          <View style={styles.reportGrid}>
            <ReportStat label="Revenus bruts" value={formatXof(summary.total_revenue_xof)} accent={colors.accent.success} />
            <ReportStat label="Remboursements" value={formatXof(summary.total_refunded_xof)} accent={colors.accent.error} />
            <ReportStat label="Revenus nets" value={formatXof(summary.net_revenue_xof)} accent={colors.accent.primary} />
            <ReportStat label="Commission Kkiapay ~2.5%" value={formatXof(summary.estimated_commission_xof)} accent={colors.accent.warning} />
            <ReportStat label="Net après commission" value={formatXof(summary.net_after_commission_xof)} accent={colors.accent.success} />
            <ReportStat label="Taux de succès" value={`${summary.success_rate_pct}%`} accent={summary.success_rate_pct >= 80 ? colors.accent.success : colors.accent.error} />
          </View>

          {/* Transactions */}
          <View style={styles.reportRow}>
            <TxCount label="Réussies" count={summary.transactions_completed} color={colors.accent.success} />
            <TxCount label="Échouées" count={summary.transactions_failed} color={colors.accent.error} />
            <TxCount label="Remboursées" count={summary.transactions_refunded} color={colors.accent.secondary} />
          </View>

          {/* Par opérateur */}
          {Object.keys(by_operator).length > 0 && (
            <>
              <Text style={styles.reportSection}>Par opérateur</Text>
              {Object.entries(by_operator)
                .sort(([, a], [, b]) => b.revenue - a.revenue)
                .map(([op, data]) => (
                  <View key={op} style={styles.operatorRow}>
                    <View style={styles.operatorLeft}>
                      <Text style={styles.operatorName}>{op}</Text>
                      <Text style={styles.operatorMeta}>{data.count} tx réussies · {data.failed_count} échouées</Text>
                    </View>
                    <Text style={styles.operatorRevenue}>{formatXof(data.revenue)}</Text>
                  </View>
                ))}
            </>
          )}

          {/* Par plan */}
          {Object.keys(by_plan).length > 0 && (
            <>
              <Text style={styles.reportSection}>Par plan</Text>
              {Object.entries(by_plan)
                .sort(([, a], [, b]) => b.revenue - a.revenue)
                .map(([plan, data]) => (
                  <View key={plan} style={styles.operatorRow}>
                    <View style={styles.operatorLeft}>
                      <View style={styles.planRow}>
                        <View style={[styles.planDot, { backgroundColor: PLAN_COLORS[plan] ?? colors.text.muted }]} />
                        <Text style={[styles.operatorName, { color: PLAN_COLORS[plan] ?? colors.text.muted }]}>
                          {plan.charAt(0).toUpperCase() + plan.slice(1)}
                        </Text>
                      </View>
                      <Text style={styles.operatorMeta}>{data.count} souscription(s)</Text>
                    </View>
                    <Text style={styles.operatorRevenue}>{formatXof(data.revenue)}</Text>
                  </View>
                ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

function ReportStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.reportStatItem}>
      <Text style={styles.reportStatLabel}>{label}</Text>
      <Text style={[styles.reportStatValue, { color: accent }]}>{value}</Text>
    </View>
  )
}

function TxCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.txCount, { borderColor: `${color}40` }]}>
      <Text style={[styles.txCountNum, { color }]}>{count}</Text>
      <Text style={styles.txCountLabel}>{label}</Text>
    </View>
  )
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets()
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [failureStats, setFailureStats] = useState<FailureStatsRes | null>(null)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const sessionRef = useRef<string | null>(null)

  const getToken = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    const { data: { session } } = await supabase.auth.getSession()
    sessionRef.current = session?.access_token ?? null
    return sessionRef.current
  }, [])

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const token = await getToken()
    if (!token) throw new Error('Session expirée')
    const { data, error } = await supabase.functions.invoke('admin-payments', {
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
    if (error) throw error
    return data
  }, [getToken])

  const fetchList = useCallback(async (reset = false) => {
    try {
      const targetPage = reset ? 1 : page
      if (!reset) setIsLoadingMore(true)

      const res = await invoke({
        action: 'list',
        page: targetPage,
        page_size: 25,
        ...(filterStatus !== 'all' ? { filter_status: filterStatus } : {}),
      }) as { payments: Payment[]; total: number; total_pages: number }

      if (reset) {
        setPayments(res.payments)
        setPage(1)
      } else {
        setPayments((prev) => targetPage === 1 ? res.payments : [...prev, ...res.payments])
      }
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (e) {
      console.error('payments list error:', e)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }, [page, filterStatus, invoke])

  const fetchFailureStats = useCallback(async () => {
    try {
      const res = await invoke({ action: 'failure_stats' })
      setFailureStats(res as FailureStatsRes)
    } catch { /* silencieux */ }
  }, [invoke])

  useEffect(() => {
    setIsLoading(true)
    setPage(1)
    fetchList(true)
    fetchFailureStats()
  }, [filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setIsRefreshing(true)
    setPage(1)
    fetchList(true)
    fetchFailureStats()
  }, [fetchList, fetchFailureStats])

  const onEndReached = useCallback(() => {
    if (!isLoadingMore && page < totalPages) {
      setPage((p) => p + 1)
      fetchList(false)
    }
  }, [isLoadingMore, page, totalPages, fetchList])

  const openReport = useCallback(async () => {
    setReportLoading(true)
    setShowReport(true)
    try {
      const now = new Date()
      const res = await invoke({
        action: 'monthly_report',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      setReport(res as MonthlyReport)
    } catch { /* silencieux */ } finally {
      setReportLoading(false)
    }
  }, [invoke])

  // ── Stats alertes ─────────────────────────────────────────────────────────
  const criticalOperators = failureStats?.by_operator.filter((o) => o.failure_rate_pct > 30) ?? []
  const hasAlerts = criticalOperators.length > 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header
        title="Paiements"
        showBack
        subtitle={`${total} transactions`}
        rightAction={{ icon: 'document-text-outline', onPress: openReport }}
      />

      {/* Filtres */}
      <FlatList
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => {
          const color = item === 'all' ? colors.accent.primary : STATUS_COLORS[item]
          const isActive = filterStatus === item
          return (
            <Pressable
              onPress={() => setFilterStatus(item)}
              style={[
                styles.filterChip,
                isActive && { borderColor: color, backgroundColor: `${color}18` },
              ]}
            >
              <Text style={[
                styles.filterLabel,
                isActive && { color },
              ]}>
                {item === 'all' ? 'Tous' : STATUS_LABELS[item]}
              </Text>
            </Pressable>
          )
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PaymentRow payment={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <>
              {/* Alertes taux d'échec */}
              {hasAlerts && (
                <View style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <Ionicons name="warning" size={16} color={colors.accent.error} />
                    <Text style={styles.alertTitle}>Taux d'échec élevé détecté</Text>
                  </View>
                  {criticalOperators.map((op) => (
                    <View key={op.operator} style={styles.alertRow}>
                      <Text style={styles.alertOp}>{op.operator}</Text>
                      <Text style={styles.alertRate}>{op.failure_rate_pct}% d'échec</Text>
                      <Text style={styles.alertCount}>({op.failed}/{op.total})</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Stats opérateurs (30j) */}
              {failureStats && (
                <Card style={styles.statsCard}>
                  <View style={styles.statsHeader}>
                    <Text style={styles.statsTitle}>Taux d'échec par opérateur (30j)</Text>
                    <Text style={[
                      styles.globalRate,
                      { color: failureStats.global.failure_rate_pct > 20 ? colors.accent.error : colors.accent.success },
                    ]}>
                      Global: {failureStats.global.failure_rate_pct}%
                    </Text>
                  </View>
                  {failureStats.by_operator.slice(0, 5).map((op) => (
                    <View key={op.operator} style={styles.opStatRow}>
                      <Text style={styles.opName} numberOfLines={1}>{op.operator}</Text>
                      <View style={styles.opBarTrack}>
                        <View style={[
                          styles.opBarFill,
                          {
                            width: `${Math.min(op.failure_rate_pct, 100)}%` as unknown as number,
                            backgroundColor: op.failure_rate_pct > 30
                              ? colors.accent.error
                              : op.failure_rate_pct > 15
                              ? colors.accent.warning
                              : colors.accent.success,
                          },
                        ]} />
                      </View>
                      <Text style={styles.opRate}>{op.failure_rate_pct}%</Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="card-outline" size={40} color={colors.text.muted} />
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore
              ? <ActivityIndicator color={colors.accent.primary} style={{ paddingVertical: spacing.lg }} />
              : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
        />
      )}

      {/* Bouton rapport */}
      <Pressable
        onPress={openReport}
        style={[styles.reportFab, { bottom: insets.bottom + spacing.lg }]}
      >
        <Ionicons name="bar-chart-outline" size={18} color="#fff" />
        <Text style={styles.reportFabText}>Rapport mensuel</Text>
      </Pressable>

      {/* Modal rapport */}
      <MonthlyReportModal
        visible={showReport}
        report={reportLoading ? null : report}
        onClose={() => setShowReport(false)}
      />

      {showReport && reportLoading && (
        <View style={styles.reportLoadingOverlay}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
          <Text style={styles.reportLoadingText}>Génération du rapport...</Text>
        </View>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterBar: { maxHeight: 44, flexGrow: 0 },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  filterLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: { ...textStyles.bodySmall, color: colors.text.muted },
  listContent: { paddingTop: spacing.sm },
  alertCard: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  alertTitle: { ...textStyles.label, color: colors.accent.error, fontWeight: '700' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertOp: { ...textStyles.bodySmall, color: colors.text.secondary, flex: 1 },
  alertRate: { ...textStyles.label, color: colors.accent.error, fontWeight: '700' },
  alertCount: { ...textStyles.caption, color: colors.text.muted },
  statsCard: { margin: spacing.md, marginBottom: 0, gap: spacing.sm },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsTitle: { ...textStyles.label, color: colors.text.secondary },
  globalRate: { ...textStyles.label, fontWeight: '700' },
  opStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  opName: { ...textStyles.caption, color: colors.text.secondary, width: 80 },
  opBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  opBarFill: { height: 6, borderRadius: 3 },
  opRate: { ...textStyles.caption, color: colors.text.muted, width: 36, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  rowPressed: { backgroundColor: colors.background.surface },
  statusBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.md },
  rowContent: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowAmount: { ...textStyles.h4, color: colors.text.primary, fontWeight: '700' },
  statusChip: {
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  rowMid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowUser: { ...textStyles.bodySmall, color: colors.text.secondary, flex: 1 },
  planDot: { width: 7, height: 7, borderRadius: 4 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowPlan: { ...textStyles.caption, fontWeight: '600', textTransform: 'capitalize' },
  rowBot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMeta: { ...textStyles.caption, color: colors.text.muted },
  rowDate: { ...textStyles.caption, color: colors.text.muted },
  separator: { height: 1, backgroundColor: colors.border.subtle, marginLeft: spacing.md },
  reportFab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  reportFabText: { ...textStyles.label, color: '#fff', fontWeight: '700' },
  reportLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,16,26,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  reportLoadingText: { ...textStyles.body, color: colors.text.secondary },
  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background.primary },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalTitle: { ...textStyles.h4, color: colors.text.primary },
  modalClose: { padding: 4 },
  modalScroll: { flex: 1 },
  modalContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reportStatItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: 3,
  },
  reportStatLabel: { ...textStyles.caption, color: colors.text.muted },
  reportStatValue: { ...textStyles.h4, fontWeight: '700' },
  reportRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  txCount: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    backgroundColor: colors.background.surface,
    gap: 3,
  },
  txCountNum: { ...textStyles.h3, fontWeight: '700' },
  txCountLabel: { ...textStyles.caption, color: colors.text.muted },
  reportSection: { ...textStyles.label, color: colors.text.secondary, marginTop: spacing.xs },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing.sm,
  },
  operatorLeft: { flex: 1, gap: 2 },
  operatorName: { ...textStyles.label, color: colors.text.primary },
  operatorMeta: { ...textStyles.caption, color: colors.text.muted },
  operatorRevenue: { ...textStyles.label, color: colors.accent.success, fontWeight: '600' },
})
