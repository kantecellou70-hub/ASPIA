import React, { useState, useEffect, useCallback } from 'react'
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { CircuitCard } from '@/components/features/CircuitCard'
import { SessionCounter } from '@/components/features/SessionCounter'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { useAuthStore } from '@/store/authStore'
import { useCircuit } from '@/hooks/useCircuit'
import { useLearningProfile, type OnboardingData } from '@/hooks/useLearningProfile'
import { supabase } from '@/lib/supabase'
import {
  GUINEE_NIVEAUX,
  GUINEE_FILIERES,
  GUINEE_MATIERES_BEPC,
  GUINEE_VILLES,
  OBJECTIFS_ELEVE,
} from '@/constants/config'

// ── Onboarding Step types ────────────────────────────────────────────────────

const NIVEAUX = GUINEE_NIVEAUX
const FILIERES = [...GUINEE_FILIERES.lycee, ...GUINEE_FILIERES.universite]
const OBJECTIFS = OBJECTIFS_ELEVE
const LEARNING_STYLES = [
  { key: 'visual', label: 'Visuel', icon: 'eye-outline' },
  { key: 'auditory', label: 'Auditif', icon: 'headset-outline' },
  { key: 'reading', label: 'Lecture', icon: 'book-outline' },
  { key: 'kinesthetic', label: 'Pratique', icon: 'hand-left-outline' },
]
const AVAILABLE_TIMES = ['< 1h/jour', '1–2h/jour', '2–4h/jour', '> 4h/jour']
const SUBJECTS_LIST = GUINEE_MATIERES_BEPC
const DIFFICULTIES_LIST = ['Comprendre les cours', 'Mémoriser', 'Gérer mon temps', 'Trouver des ressources', 'Rester motivé']

type OnboardingStep = 1 | 2 | 3

interface ChipProps {
  label: string
  selected: boolean
  onPress: () => void
  icon?: string
}

function Chip({ label, selected, onPress, icon }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={selected ? colors.text.primary : colors.text.muted}
        />
      )}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

// ── Onboarding Screen ────────────────────────────────────────────────────────

function OnboardingScreen({
  step,
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  isLast,
}: {
  step: OnboardingStep
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  isLast: boolean
}) {
  const toggle = useCallback((field: keyof OnboardingData, value: string) => {
    const arr = (data[field] as string[] | undefined) ?? []
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
    onChange({ [field]: next })
  }, [data, onChange])

  return (
    <ScrollView
      style={styles.onboardingContainer}
      contentContainerStyle={styles.onboardingContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress */}
      <View style={styles.onboardingProgress}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[styles.progressDot, step >= n && styles.progressDotActive]}
          />
        ))}
      </View>

      {step === 1 && (
        <>
          <Text style={styles.onboardingTitle}>Parle-nous de toi 🎓</Text>
          <Text style={styles.onboardingSubtitle}>Pour personnaliser ton expérience APSIA</Text>

          <Text style={styles.fieldLabel}>Ton niveau</Text>
          <View style={styles.chipRow}>
            {NIVEAUX.map((n) => (
              <Chip key={n} label={n} selected={data.niveau === n} onPress={() => onChange({ niveau: n })} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Ta filière / domaine</Text>
          <View style={styles.chipRow}>
            {FILIERES.map((s) => (
              <Chip key={s} label={s} selected={data.filiere === s} onPress={() => onChange({ filiere: s })} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Ton objectif principal</Text>
          <View style={styles.chipRow}>
            {OBJECTIFS.map((o) => (
              <Chip key={o} label={o} selected={data.objectif === o} onPress={() => onChange({ objectif: o })} />
            ))}
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.onboardingTitle}>Ton style d'apprentissage 🧠</Text>
          <Text style={styles.onboardingSubtitle}>Comment tu apprends le mieux ?</Text>

          <Text style={styles.fieldLabel}>Style d'apprentissage</Text>
          <View style={styles.chipRow}>
            {LEARNING_STYLES.map((ls) => (
              <Chip
                key={ls.key}
                label={ls.label}
                icon={ls.icon}
                selected={data.learning_style === ls.key}
                onPress={() => onChange({ learning_style: ls.key })}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Temps disponible par jour</Text>
          <View style={styles.chipRow}>
            {AVAILABLE_TIMES.map((t) => (
              <Chip key={t} label={t} selected={data.available_time === t} onPress={() => onChange({ available_time: t })} />
            ))}
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.onboardingTitle}>Tes matières & défis 📚</Text>
          <Text style={styles.onboardingSubtitle}>Dis-nous ce que tu veux travailler</Text>

          <Text style={styles.fieldLabel}>Matières à travailler</Text>
          <View style={styles.chipRow}>
            {SUBJECTS_LIST.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={(data.subjects ?? []).includes(s)}
                onPress={() => toggle('subjects', s)}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Tes difficultés (optionnel)</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES_LIST.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={(data.difficulties ?? []).includes(d)}
                onPress={() => toggle('difficulties', d)}
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.onboardingActions}>
        {step > 1 ? (
          <Button label="Retour" onPress={onBack} variant="ghost" style={styles.backBtn} />
        ) : (
          <Button label="Ignorer" onPress={onSkip} variant="ghost" style={styles.backBtn} />
        )}
        <Button
          label={isLast ? 'Analyser mon profil →' : 'Suivant →'}
          onPress={onNext}
          style={styles.nextBtn}
        />
      </View>
    </ScrollView>
  )
}

// ── Analyzing Screen ─────────────────────────────────────────────────────────

function AnalyzingScreen() {
  return (
    <View style={styles.analyzingContainer}>
      <ActivityIndicator size="large" color={colors.accent.primary} />
      <Text style={styles.analyzingTitle}>APSIA analyse ton profil...</Text>
      <Text style={styles.analyzingSubtitle}>Génération de tes recommandations personnalisées</Text>
    </View>
  )
}

// ── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { circuits, fetchUserCircuits, isLoading } = useCircuit()
  const { profile } = useLearningProfile()

  useEffect(() => { fetchUserCircuits() }, [fetchUserCircuits])

  const firstName = user?.full_name?.split(' ')[0] ?? 'là'
  const recentCircuits = circuits.slice(0, 5)
  const inProgress = circuits.filter((c) => c.status === 'in_progress').length
  const completed = circuits.filter((c) => c.status === 'completed').length
  const recommendations = (profile?.ai_recommendations?.recommendations ?? []).slice(0, 3)
  const motivational = profile?.ai_recommendations?.motivational_message

  return (
    <FlatList
      style={styles.dashboardContainer}
      contentContainerStyle={[styles.dashboardContent, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {/* Header */}
          <View style={styles.dashHeader}>
            <View>
              <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
              <Text style={styles.subtitle}>Continuez votre apprentissage</Text>
            </View>
            <SessionCounter />
          </View>

          {/* Motivational */}
          {motivational && (
            <GlassCard style={styles.motivCard}>
              <Text style={styles.motivText}>✨ {motivational}</Text>
            </GlassCard>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{circuits.length}</Text>
              <Text style={styles.statLabel}>Circuits</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.accent.warning }]}>{inProgress}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.accent.success }]}>{completed}</Text>
              <Text style={styles.statLabel}>Terminés</Text>
            </View>
          </View>

          {/* Strengths / weaknesses */}
          {profile && ((profile.strengths?.length ?? 0) > 0 || (profile.weaknesses?.length ?? 0) > 0) && (
            <GlassCard style={styles.profileCard}>
              {(profile.strengths?.length ?? 0) > 0 && (
                <View>
                  <Text style={styles.profileCardTitle}>💪 Points forts</Text>
                  <View style={styles.chipRow}>
                    {profile.strengths!.slice(0, 4).map((s) => (
                      <View key={s} style={[styles.chip, styles.chipSuccess]}>
                        <Text style={[styles.chipText, { color: colors.accent.success }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {(profile.weaknesses?.length ?? 0) > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.profileCardTitle}>🎯 À améliorer</Text>
                  <View style={styles.chipRow}>
                    {profile.weaknesses!.slice(0, 4).map((w) => (
                      <View key={w} style={[styles.chip, styles.chipWarning]}>
                        <Text style={[styles.chipText, { color: colors.accent.warning }]}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </GlassCard>
          )}

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recommandations IA</Text>
              {recommendations.map((rec, i) => (
                <GlassCard key={i} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <Text style={styles.recTitle}>{rec.title}</Text>
                    <View style={[
                      styles.priorityBadge,
                      { backgroundColor: rec.priority === 'high' ? colors.accent.error : rec.priority === 'medium' ? colors.accent.warning : colors.accent.info },
                    ]}>
                      <Text style={styles.priorityText}>{rec.priority}</Text>
                    </View>
                  </View>
                  <Text style={styles.recDesc}>{rec.description}</Text>
                </GlassCard>
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && circuits.length === 0 && (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🚀</Text>
              <Text style={styles.emptyTitle}>Commencez votre premier circuit</Text>
              <Text style={styles.emptySubtitle}>
                Importe ton cours ou prends une photo — APSIA génère ton circuit d'apprentissage en 30s
              </Text>
              <Button
                label="Importer un cours"
                onPress={() => router.push('/(tabs)/chat')}
                style={styles.emptyButton}
              />
            </GlassCard>
          )}

          {circuits.length > 0 && <Text style={styles.sectionTitle}>Circuits récents</Text>}
        </>
      }
      data={recentCircuits}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CircuitCard circuit={item} onPress={() => router.push(`/circuit/${item.id}`)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  )
}

// ── Main HomeScreen ──────────────────────────────────────────────────────────

const ANALYSIS_TIMEOUT_MS = 20_000

const DEFAULT_PROFILE_ON_ERROR = {
  learning_style: 'reading',
  strengths: [] as string[],
  weaknesses: [] as string[],
  ai_recommendations: {
    recommendations: [],
    study_plan: '',
    motivational_message: 'Bienvenue sur APSIA ! Commence à réviser pour voir ton profil se construire.',
  },
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { analyzeProfile, isAnalyzing } = useLearningProfile()

  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [showDashboard, setShowDashboard] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (user.onboarding_completed) {
      setShowDashboard(true)
    } else {
      setOnboardingStep(1)
    }
  }, [user])

  const handleOnboardingChange = useCallback((patch: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...patch }))
  }, [])

  const markOnboardingDone = useCallback(async () => {
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true, learning_style: onboardingData.learning_style ?? 'reading' })
          .eq('id', user.id)
      } catch {
        // non-blocking
      }
    }
    setShowDashboard(true)
    setOnboardingStep(null)
  }, [user, onboardingData.learning_style])

  const handleNext = useCallback(async () => {
    if (onboardingStep === 3) {
      setAnalyzeError(null)
      try {
        // Race the AI call against a 20 s timeout
        await Promise.race([
          analyzeProfile(onboardingData),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ANALYSIS_TIMEOUT_MS),
          ),
        ])
        await markOnboardingDone()
      } catch (e) {
        const isTimeout = (e as Error).message === 'timeout'
        setAnalyzeError(
          isTimeout
            ? "L'analyse a pris trop de temps. Ton profil de base a été créé."
            : "L'analyse IA a échoué. Tu peux continuer avec un profil par défaut.",
        )
        // Store a minimal profile so the dashboard isn't empty
        if (user) {
          try {
            await supabase
              .from('learning_profiles')
              .upsert({ user_id: user.id, ...onboardingData, ...DEFAULT_PROFILE_ON_ERROR }, { onConflict: 'user_id' })
          } catch {
            // non-blocking
          }
        }
        // Don't block the user — mark onboarding done and show dashboard
        await markOnboardingDone()
      }
    } else if (onboardingStep !== null) {
      setOnboardingStep((prev) => (prev! + 1) as OnboardingStep)
    }
  }, [onboardingStep, onboardingData, analyzeProfile, markOnboardingDone, user])

  const handleBack = useCallback(() => {
    if (onboardingStep && onboardingStep > 1) {
      setOnboardingStep((prev) => (prev! - 1) as OnboardingStep)
    }
  }, [onboardingStep])

  const handleSkip = useCallback(async () => {
    await markOnboardingDone()
  }, [markOnboardingDone])

  if (isAnalyzing) {
    return (
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        <AnalyzingScreen />
      </View>
    )
  }

  if (onboardingStep !== null && !showDashboard) {
    return (
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        <OnboardingScreen
          step={onboardingStep}
          data={onboardingData}
          onChange={handleOnboardingChange}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={handleSkip}
          isLast={onboardingStep === 3}
        />
        {analyzeError && (
          <View style={styles.analyzeErrorBanner}>
            <Text style={styles.analyzeErrorText}>{analyzeError}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
      <DashboardScreen />
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  analyzeErrorBanner: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent.warning,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  analyzeErrorText: {
    ...textStyles.caption,
    color: colors.accent.warning,
    textAlign: 'center',
  },

  // Onboarding
  onboardingContainer: {
    flex: 1,
  },
  onboardingContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  onboardingProgress: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background.elevated,
  },
  progressDotActive: {
    backgroundColor: colors.accent.primary,
  },
  onboardingTitle: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  onboardingSubtitle: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  fieldLabel: {
    ...textStyles.h4,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipSelected: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  chipSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  chipWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  chipText: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  chipTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  backBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },

  // Analyzing
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  analyzingTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  analyzingSubtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Dashboard
  dashboardContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  dashboardContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  motivCard: {
    padding: spacing.md,
  },
  motivText: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  statValue: {
    ...textStyles.h2,
    color: colors.accent.primary,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  profileCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  profileCardTitle: {
    ...textStyles.body,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  recCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recTitle: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
    textTransform: 'uppercase',
  },
  recDesc: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
})
