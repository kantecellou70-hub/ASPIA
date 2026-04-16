import React, { useCallback, useEffect, useState } from 'react'
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
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentDetail {
  id: string
  user_id: string
  user_name: string
  user_current_plan: string
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
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_ICONS: Record<string, 'checkmark-circle' | 'time' | 'close-circle' | 'return-down-back'> = {
  completed: 'checkmark-circle',
  pending:   'time',
  failed:    'close-circle',
  refunded:  'return-down-back',
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
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Composant ────────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function AdminPaymentDetail() {
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRefundInput, setShowRefundInput] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée')
    const { data, error: fnErr } = await supabase.functions.invoke('admin-payments', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    })
    if (fnErr) throw fnErr
    return data
  }, [])

  const fetchDetail = useCallback(async () => {
    try {
      const data = await invoke({ action: 'detail', payment_id: id })
      setPayment(data as PaymentDetail)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [id, invoke])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const confirmRefund = useCallback(() => {
    if (!payment) return
    const reason = refundReason.trim() || 'Remboursement administrateur'

    Alert.alert(
      'Confirmer le remboursement',
      `Rembourser ${formatXof(payment.amount)} à ${payment.user_name} ?\n\nMotif : ${reason}\n\nCette action est irréversible. Le plan de l'utilisateur sera rétabli à "free".`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rembourser',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true)
              const res = await invoke({
                action: 'refund',
                payment_id: id,
                refund_reason: reason,
              }) as { success: boolean; kkiapay_refund_processed: boolean }

              setShowRefundInput(false)
              setRefundReason('')
              await fetchDetail()

              Alert.alert(
                'Remboursement enregistré',
                res.kkiapay_refund_processed
                  ? 'Le remboursement a été traité via Kkiapay et enregistré en base.'
                  : 'Remboursement enregistré en base. Le remboursement Kkiapay devra être fait manuellement depuis leur dashboard.',
                [{ text: 'OK' }],
              )
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur lors du remboursement')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ],
    )
  }, [payment, refundReason, id, invoke, fetchDetail])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Header title="Transaction" showBack />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </View>
    )
  }

  if (error || !payment) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Header title="Transaction" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.accent.error} />
          <Text style={styles.errorText}>{error ?? 'Transaction introuvable'}</Text>
        </View>
      </View>
    )
  }

  const statusColor = STATUS_COLORS[payment.status] ?? colors.text.muted
  const canRefund = payment.status === 'completed'

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header
        title="Détail transaction"
        showBack
        subtitle={payment.kkiapay_transaction_id ?? payment.id.slice(0, 8).toUpperCase()}
        rightAction={{ icon: 'refresh', onPress: () => { setIsLoading(true); fetchDetail() } }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Statut principal ──────────────────────────────────────────────── */}
        <View style={[styles.statusHero, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}10` }]}>
          <Ionicons name={STATUS_ICONS[payment.status] ?? 'help-circle'} size={40} color={statusColor} />
          <View style={styles.statusHeroText}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {STATUS_LABELS[payment.status] ?? payment.status}
            </Text>
            <Text style={styles.amountHero}>{formatXof(payment.amount)}</Text>
          </View>
          <Text style={styles.dateHero}>{formatDateTime(payment.created_at)}</Text>
        </View>

        {/* ── Détails paiement ──────────────────────────────────────────────── */}
        <Card style={styles.infoCard}>
          <Text style={styles.cardTitle}>Détails du paiement</Text>
          <InfoRow label="Plan souscrit" value={payment.plan_id.charAt(0).toUpperCase() + payment.plan_id.slice(1)} valueColor={PLAN_COLORS[payment.plan_id]} />
          <InfoRow label="Montant" value={`${payment.amount} ${payment.currency}`} valueColor={colors.accent.success} />
          <InfoRow label="Opérateur" value={payment.operator ?? 'Non détecté'} />
          {payment.phone && <InfoRow label="Téléphone" value={payment.phone} />}
          {payment.kkiapay_transaction_id && (
            <InfoRow label="ID Kkiapay" value={payment.kkiapay_transaction_id} />
          )}
          <InfoRow label="ID interne" value={payment.id} />
          <InfoRow label="Créé le" value={formatDateTime(payment.created_at)} />
          <InfoRow label="Mis à jour" value={formatDateTime(payment.updated_at)} />
        </Card>

        {/* ── Utilisateur ───────────────────────────────────────────────────── */}
        <Card style={styles.infoCard}>
          <Text style={styles.cardTitle}>Utilisateur</Text>
          <InfoRow label="Nom" value={payment.user_name} />
          <InfoRow label="Plan actuel" value={payment.user_current_plan} valueColor={PLAN_COLORS[payment.user_current_plan]} />
          <InfoRow label="ID utilisateur" value={payment.user_id} />
        </Card>

        {/* ── Remboursement existant ────────────────────────────────────────── */}
        {payment.status === 'refunded' && (
          <Card style={styles.refundedCard}>
            <View style={styles.refundedHeader}>
              <Ionicons name="return-down-back" size={18} color={colors.accent.secondary} />
              <Text style={styles.refundedTitle}>Remboursé</Text>
            </View>
            {payment.refunded_at && (
              <InfoRow label="Date de remboursement" value={formatDateTime(payment.refunded_at)} />
            )}
            {payment.refund_reason && (
              <InfoRow label="Motif" value={payment.refund_reason} />
            )}
          </Card>
        )}

        {/* ── Action remboursement ──────────────────────────────────────────── */}
        {canRefund && (
          <>
            {!showRefundInput ? (
              <Pressable
                onPress={() => setShowRefundInput(true)}
                disabled={actionLoading}
                style={styles.refundBtn}
              >
                <Ionicons name="return-down-back" size={16} color={colors.accent.error} />
                <Text style={styles.refundBtnText}>Rembourser cette transaction</Text>
              </Pressable>
            ) : (
              <Card style={styles.refundForm}>
                <Text style={styles.refundFormTitle}>Motif du remboursement</Text>
                <TextInput
                  style={styles.refundInput}
                  value={refundReason}
                  onChangeText={setRefundReason}
                  placeholder="Ex: Doublon, erreur de plan, demande client…"
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />
                <View style={styles.refundActions}>
                  <Pressable
                    onPress={() => { setShowRefundInput(false); setRefundReason('') }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmRefund}
                    disabled={actionLoading}
                    style={styles.confirmRefundBtn}
                  >
                    {actionLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.confirmRefundText}>Confirmer le remboursement</Text>
                    }
                  </Pressable>
                </View>
                <Text style={styles.refundNote}>
                  Le plan de l'utilisateur sera rétabli à "free". Si Kkiapay ne supporte pas le remboursement via API, une note sera laissée et vous devrez le traiter manuellement depuis le dashboard Kkiapay.
                </Text>
              </Card>
            )}
          </>
        )}

      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: { ...textStyles.bodySmall, color: colors.accent.error, textAlign: 'center' },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  statusHero: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusHeroText: { alignItems: 'center', gap: 4 },
  statusLabel: { ...textStyles.label, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  amountHero: { ...textStyles.h2, color: colors.text.primary, fontWeight: '800' },
  dateHero: { ...textStyles.caption, color: colors.text.muted },
  infoCard: { gap: 0, padding: 0, overflow: 'hidden' },
  cardTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
    padding: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoLabel: { ...textStyles.bodySmall, color: colors.text.muted, flexShrink: 0 },
  infoValue: { ...textStyles.bodySmall, color: colors.text.primary, flex: 1, textAlign: 'right' },
  refundedCard: {
    gap: spacing.xs,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderColor: 'rgba(139,92,246,0.25)',
  },
  refundedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  refundedTitle: { ...textStyles.label, color: colors.accent.secondary, fontWeight: '700' },
  refundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  refundBtnText: { ...textStyles.label, color: colors.accent.error, fontWeight: '700' },
  refundForm: { gap: spacing.md },
  refundFormTitle: { ...textStyles.label, color: colors.text.secondary },
  refundInput: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    color: colors.text.primary,
    ...textStyles.body,
    minHeight: 80,
  },
  refundActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cancelBtnText: { ...textStyles.label, color: colors.text.secondary },
  confirmRefundBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.error,
    minHeight: 40,
  },
  confirmRefundText: { ...textStyles.label, color: '#fff', fontWeight: '700' },
  refundNote: {
    ...textStyles.caption,
    color: colors.text.muted,
    lineHeight: 16,
    fontStyle: 'italic',
  },
})
