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
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Header } from '@/components/ui/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmProfile {
  id: string
  full_name: string
  email: string
  plan: string
  role: string
  sessions_used: number
  sessions_limit: number
  city?: string
  is_banned: boolean
  created_at: string
  updated_at: string
}

interface QuizAttempt {
  id: string
  score: number
  started_at: string
  completed_at: string | null
}

interface Payment {
  id: string
  amount: number
  plan_id: string
  status: string
  created_at: string
}

interface DetailResponse {
  profile: CrmProfile
  last_activity: string
  recent_attempts: QuizAttempt[]
  payments: Payment[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const

const BADGE_VARIANTS: Record<string, 'muted' | 'primary' | 'info' | 'warning'> = {
  free: 'muted',
  starter: 'primary',
  pro: 'info',
  enterprise: 'warning',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatXof(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} MXOF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k XOF`
  return `${amount} XOF`
}

function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)}h`
  return `il y a ${Math.round(diff / 86400)}j`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [giftInput, setGiftInput] = useState('')
  const [showGiftInput, setShowGiftInput] = useState(false)

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée')
    const { data, error: fnErr } = await supabase.functions.invoke('admin-crm', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    })
    if (fnErr) throw fnErr
    return data
  }, [])

  const fetchDetail = useCallback(async () => {
    try {
      const data = await invoke({ action: 'detail', user_id: id })
      setDetail(data as DetailResponse)
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

  // ── Actions ──────────────────────────────────────────────────────────────────

  const changePlan = useCallback((newPlan: string) => {
    Alert.alert(
      'Changer le plan',
      `Passer ${detail?.profile.full_name} au plan "${newPlan}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setActionLoading(true)
              await invoke({ action: 'change_plan', user_id: id, new_plan: newPlan })
              await fetchDetail()
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inconnue')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ],
    )
  }, [detail, id, invoke, fetchDetail])

  const giftSessions = useCallback(async () => {
    const n = parseInt(giftInput, 10)
    if (!n || n <= 0) {
      Alert.alert('Valeur invalide', 'Entrez un nombre de sessions > 0')
      return
    }
    try {
      setActionLoading(true)
      await invoke({ action: 'gift_sessions', user_id: id, sessions_to_add: n })
      setGiftInput('')
      setShowGiftInput(false)
      await fetchDetail()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }, [giftInput, id, invoke, fetchDetail])

  const toggleBan = useCallback(() => {
    const isBanned = detail?.profile.is_banned
    const action = isBanned ? 'unban' : 'ban'
    const label = isBanned ? 'Débannir' : 'Bannir'
    const message = isBanned
      ? `Débannir ${detail?.profile.full_name} et rétablir son accès ?`
      : `Bannir ${detail?.profile.full_name} ? Son accès sera immédiatement révoqué.`

    Alert.alert(label, message, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: label,
        style: isBanned ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true)
            await invoke({ action, user_id: id })
            await fetchDetail()
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inconnue')
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }, [detail, id, invoke, fetchDetail])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Header title="Profil utilisateur" showBack />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </View>
    )
  }

  if (error || !detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Header title="Profil utilisateur" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.accent.error} />
          <Text style={styles.errorText}>{error ?? 'Utilisateur introuvable'}</Text>
        </View>
      </View>
    )
  }

  const { profile, last_activity, recent_attempts, payments } = detail
  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header
        title={profile.full_name || 'Utilisateur'}
        showBack
        subtitle={profile.email}
        rightAction={{ icon: 'refresh', onPress: () => { setIsLoading(true); fetchDetail() } }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banni ───────────────────────────────────────────────────────── */}
        {profile.is_banned && (
          <View style={styles.bannedBanner}>
            <Ionicons name="ban" size={18} color={colors.accent.error} />
            <Text style={styles.bannedBannerText}>Utilisateur banni</Text>
          </View>
        )}

        {/* ── Profil ──────────────────────────────────────────────────────── */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {profile.full_name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.full_name || '—'}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={profile.plan.toUpperCase()}
                  variant={BADGE_VARIANTS[profile.plan] ?? 'muted'}
                />
                <Badge
                  label={profile.role}
                  variant="muted"
                />
              </View>
            </View>
          </View>

          <View style={styles.statGrid}>
            <StatItem label="Inscrit le" value={formatDate(profile.created_at)} />
            <StatItem label="Dernière activité" value={timeAgo(last_activity)} />
            {profile.city && <StatItem label="Ville" value={profile.city} />}
          </View>
        </Card>

        {/* ── Sessions ────────────────────────────────────────────────────── */}
        <Card style={styles.sessionsCard}>
          <Text style={styles.cardTitle}>Sessions</Text>
          <View style={styles.statGrid}>
            <StatItem label="Utilisées" value={String(profile.sessions_used)} accent={colors.accent.primary} />
            <StatItem
              label="Limite"
              value={profile.sessions_limit === -1 ? '∞' : String(profile.sessions_limit)}
              accent={colors.accent.secondary}
            />
            <StatItem
              label="Restantes"
              value={
                profile.sessions_limit === -1
                  ? '∞'
                  : String(Math.max(0, profile.sessions_limit - profile.sessions_used))
              }
              accent={colors.accent.success}
            />
          </View>
        </Card>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Actions admin</Text>

        {/* Changer le plan */}
        <Card style={styles.actionCard}>
          <Text style={styles.actionLabel}>Changer le plan</Text>
          <View style={styles.planRow}>
            {PLANS.map((p) => (
              <Pressable
                key={p}
                onPress={() => changePlan(p)}
                disabled={actionLoading || p === profile.plan}
                style={[
                  styles.planChip,
                  p === profile.plan && styles.planChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.planChipText,
                    p === profile.plan && styles.planChipTextActive,
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Offrir sessions */}
        <Card style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionLabel}>Offrir des sessions</Text>
            {!showGiftInput && (
              <Pressable
                onPress={() => setShowGiftInput(true)}
                style={styles.actionBtn}
                disabled={actionLoading}
              >
                <Ionicons name="gift-outline" size={14} color={colors.accent.success} />
                <Text style={[styles.actionBtnText, { color: colors.accent.success }]}>Offrir</Text>
              </Pressable>
            )}
          </View>
          {showGiftInput && (
            <View style={styles.giftRow}>
              <TextInput
                style={styles.giftInput}
                value={giftInput}
                onChangeText={setGiftInput}
                keyboardType="number-pad"
                placeholder="Nombre de sessions"
                placeholderTextColor={colors.text.muted}
                autoFocus
              />
              <Pressable
                onPress={giftSessions}
                disabled={actionLoading}
                style={[styles.actionBtn, styles.actionBtnGreen]}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.actionBtnWhite}>Confirmer</Text>
                }
              </Pressable>
              <Pressable
                onPress={() => { setShowGiftInput(false); setGiftInput('') }}
                style={styles.cancelBtn}
              >
                <Ionicons name="close" size={18} color={colors.text.muted} />
              </Pressable>
            </View>
          )}
        </Card>

        {/* Bannir / Débannir */}
        <Pressable
          onPress={toggleBan}
          disabled={actionLoading}
          style={[
            styles.banBtn,
            profile.is_banned && styles.unbanBtn,
          ]}
        >
          <Ionicons
            name={profile.is_banned ? 'checkmark-circle-outline' : 'ban'}
            size={16}
            color={profile.is_banned ? colors.accent.success : colors.accent.error}
          />
          <Text style={[
            styles.banBtnText,
            { color: profile.is_banned ? colors.accent.success : colors.accent.error },
          ]}>
            {profile.is_banned ? 'Débannir cet utilisateur' : 'Bannir cet utilisateur'}
          </Text>
        </Pressable>

        {/* ── Activité quiz ────────────────────────────────────────────────── */}
        {recent_attempts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Derniers quiz</Text>
            <Card style={styles.listCard}>
              {recent_attempts.map((a, i) => (
                <View
                  key={a.id}
                  style={[
                    styles.attemptRow,
                    i < recent_attempts.length - 1 && styles.attemptBorder,
                  ]}
                >
                  <View style={[
                    styles.scoreBadge,
                    { backgroundColor: a.score >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)' },
                  ]}>
                    <Text style={[
                      styles.scoreText,
                      { color: a.score >= 70 ? colors.accent.success : colors.accent.error },
                    ]}>
                      {a.score}%
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attemptDate}>{formatDateTime(a.started_at)}</Text>
                    {a.completed_at && (
                      <Text style={styles.attemptDuration}>
                        {Math.round((new Date(a.completed_at).getTime() - new Date(a.started_at).getTime()) / 60000)} min
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* ── Paiements ────────────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Paiements ({formatXof(totalPaid)} total)</Text>
            <Card style={styles.listCard}>
              {payments.map((p, i) => (
                <View
                  key={p.id}
                  style={[
                    styles.paymentRow,
                    i < payments.length - 1 && styles.attemptBorder,
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.paymentPlan}>{p.plan_id}</Text>
                    <Text style={styles.paymentDate}>{formatDate(p.created_at)}</Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>{formatXof(p.amount)}</Text>
                    <View style={[
                      styles.statusChip,
                      { backgroundColor: p.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: p.status === 'completed' ? colors.accent.success : colors.accent.warning },
                      ]}>
                        {p.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

      </ScrollView>
    </View>
  )
}

// ─── StatItem ─────────────────────────────────────────────────────────────────

function StatItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : undefined]}>{value}</Text>
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
  errorText: {
    ...textStyles.bodySmall,
    color: colors.accent.error,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  bannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  bannedBannerText: {
    ...textStyles.label,
    color: colors.accent.error,
    fontWeight: '700',
  },
  profileCard: {
    gap: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  profileEmail: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  statValue: {
    ...textStyles.label,
    color: colors.text.primary,
    fontWeight: '600',
  },
  sessionsCard: {
    gap: spacing.md,
  },
  cardTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  actionCard: {
    gap: spacing.sm,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  planChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  planChipActive: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  planChipText: {
    ...textStyles.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  planChipTextActive: {
    color: colors.accent.primary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  actionBtnGreen: {
    backgroundColor: colors.accent.success,
    borderColor: colors.accent.success,
  },
  actionBtnText: {
    ...textStyles.caption,
    fontWeight: '600',
  },
  actionBtnWhite: {
    ...textStyles.caption,
    color: '#fff',
    fontWeight: '600',
  },
  giftRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  giftInput: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    color: colors.text.primary,
    ...textStyles.body,
  },
  cancelBtn: {
    padding: 6,
  },
  banBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    padding: spacing.md,
  },
  unbanBtn: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  banBtnText: {
    ...textStyles.label,
    fontWeight: '700',
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  attemptBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attemptDate: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  attemptDuration: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  paymentPlan: {
    ...textStyles.label,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  paymentDate: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    ...textStyles.label,
    color: colors.accent.success,
    fontWeight: '600',
  },
  statusChip: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
})
