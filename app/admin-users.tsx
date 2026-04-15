import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
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
import { Badge } from '@/components/ui/Badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmUser {
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

interface ListResponse {
  users: CrmUser[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const PLAN_FILTERS = ['all', 'free', 'starter', 'pro', 'enterprise', 'banned'] as const
type PlanFilter = typeof PLAN_FILTERS[number]

const PLAN_COLORS: Record<string, string> = {
  free: colors.text.muted,
  starter: colors.accent.primary,
  pro: colors.accent.secondary,
  enterprise: colors.accent.warning,
}

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

function buildCsv(users: CrmUser[]): string {
  const header = 'ID,Nom,Email,Plan,Rôle,Sessions utilisées,Limite,Ville,Banni,Inscrit le'
  const rows = users.map((u) =>
    [
      u.id,
      `"${u.full_name.replace(/"/g, '""')}"`,
      u.email,
      u.plan,
      u.role,
      u.sessions_used,
      u.sessions_limit === -1 ? 'illimité' : u.sessions_limit,
      u.city ?? '',
      u.is_banned ? 'oui' : 'non',
      formatDate(u.created_at),
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

// ─── Composant ligne ──────────────────────────────────────────────────────────

function UserRow({ user }: { user: CrmUser }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/admin-user/${user.id}`)}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>
          {user.full_name?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{user.full_name || '—'}</Text>
          {user.is_banned && (
            <View style={styles.bannedChip}>
              <Ionicons name="ban" size={10} color={colors.accent.error} />
              <Text style={styles.bannedText}>banni</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowEmail} numberOfLines={1}>{user.email}</Text>
        <View style={styles.rowMeta}>
          <Badge
            label={user.plan.toUpperCase()}
            variant={BADGE_VARIANTS[user.plan] ?? 'muted'}
            style={styles.planBadge}
          />
          {user.city ? (
            <Text style={styles.rowCity}>
              <Ionicons name="location-outline" size={10} color={colors.text.muted} /> {user.city}
            </Text>
          ) : null}
          <Text style={styles.rowSessions}>
            {user.sessions_used}/{user.sessions_limit === -1 ? '∞' : user.sessions_limit} sessions
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
    </Pressable>
  )
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets()
  const [users, setUsers] = useState<CrmUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterPlan, setFilterPlan] = useState<PlanFilter>('all')
  const [search, setSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const invoke = useCallback(
    async (pageNum: number, plan: PlanFilter, q: string): Promise<ListResponse | null> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const body: Record<string, unknown> = {
        action: 'list',
        page: pageNum,
        page_size: PAGE_SIZE,
      }
      if (plan === 'banned') {
        // filtre côté client après fetch — on passe sans filter_plan
      } else if (plan !== 'all') {
        body.filter_plan = plan
      }
      if (q.trim()) body.search = q.trim()

      const { data, error: fnErr } = await supabase.functions.invoke('admin-crm', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })
      if (fnErr) throw fnErr
      return data as ListResponse
    },
    [],
  )

  const load = useCallback(async (reset = false) => {
    try {
      const targetPage = reset ? 1 : page
      if (!reset) setIsLoadingMore(true)
      const res = await invoke(targetPage, filterPlan, search)
      if (!res) return

      let fetched = res.users
      // Filtre 'banned' côté client
      if (filterPlan === 'banned') fetched = fetched.filter((u) => u.is_banned)

      if (reset) {
        setUsers(fetched)
        setPage(1)
      } else {
        setUsers((prev) => (targetPage === 1 ? fetched : [...prev, ...fetched]))
      }
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }, [page, filterPlan, search, invoke])

  // Chargement initial
  useEffect(() => {
    setIsLoading(true)
    setPage(1)
    load(true)
  }, [filterPlan]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche avec debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setIsLoading(true)
      setPage(1)
      load(true)
    }, 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setIsRefreshing(true)
    setPage(1)
    load(true)
  }, [load])

  const onEndReached = useCallback(() => {
    if (!isLoadingMore && page < totalPages) {
      setPage((p) => p + 1)
      load(false)
    }
  }, [isLoadingMore, page, totalPages, load])

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(async () => {
    try {
      // Récupérer toutes les pages pour l'export
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const body: Record<string, unknown> = {
        action: 'list',
        page: 1,
        page_size: 1000,
      }
      if (filterPlan !== 'all' && filterPlan !== 'banned') body.filter_plan = filterPlan
      if (search.trim()) body.search = search.trim()

      const { data } = await supabase.functions.invoke('admin-crm', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })
      let allUsers: CrmUser[] = (data as ListResponse).users ?? []
      if (filterPlan === 'banned') allUsers = allUsers.filter((u) => u.is_banned)

      const csv = buildCsv(allUsers)
      await Share.share({
        title: 'Export utilisateurs APSIA',
        message: csv,
      })
    } catch (e) {
      console.error('CSV export error:', e)
    }
  }, [filterPlan, search])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <Header
        title="Utilisateurs"
        showBack
        subtitle={`${total} inscrits`}
        rightAction={{ icon: 'share-outline', onPress: exportCsv }}
      />

      {/* Barre de recherche */}
      <View style={[styles.searchRow, { paddingTop: spacing.sm }]}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un nom…"
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filtres plan */}
      <FlatList
        data={PLAN_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setFilterPlan(item)}
            style={[
              styles.filterChip,
              filterPlan === item && styles.filterChipActive,
              item === 'banned' && filterPlan === item && styles.filterChipBanned,
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                filterPlan === item && styles.filterLabelActive,
                item !== 'all' && item !== 'banned' && { color: PLAN_COLORS[item] ?? colors.text.secondary },
                item === 'banned' && { color: filterPlan === item ? colors.accent.error : colors.text.muted },
              ]}
            >
              {item === 'all' ? 'Tous' : item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        )}
      />

      {/* Liste */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.accent.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={40} color={colors.text.muted} />
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                color={colors.accent.primary}
                style={{ paddingVertical: spacing.lg }}
              />
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  searchInput: {
    flex: 1,
    ...textStyles.body,
    color: colors.text.primary,
    padding: 0,
  },
  filterBar: {
    maxHeight: 44,
    flexGrow: 0,
  },
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
  filterChipActive: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  filterChipBanned: {
    borderColor: colors.accent.error,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  filterLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterLabelActive: {
    color: colors.accent.primary,
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background.primary,
  },
  rowPressed: {
    backgroundColor: colors.background.surface,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowName: {
    ...textStyles.label,
    color: colors.text.primary,
    flex: 1,
  },
  bannedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bannedText: {
    fontSize: 10,
    color: colors.accent.error,
    fontWeight: '700',
  },
  rowEmail: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  planBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  rowCity: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  rowSessions: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginLeft: 'auto',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 16 + 42 + 16, // left padding + avatar + gap
  },
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
  emptyText: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
