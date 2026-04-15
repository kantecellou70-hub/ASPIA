import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import type { CourseSummary } from '@/types/quiz.types'

interface CourseSummaryModalProps {
  visible: boolean
  summary: CourseSummary | null
  isLoading: boolean
  onClose: () => void
}

export function CourseSummaryModal({
  visible,
  summary,
  isLoading,
  onClose,
}: CourseSummaryModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                <Ionicons name="sparkles" size={18} color={colors.accent.secondary} />
                <Text style={styles.title}>Résumé IA</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
            {summary && (
              <Text style={styles.subtitle} numberOfLines={2}>{summary.title}</Text>
            )}
          </View>

          {/* Contenu */}
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.accent.secondary} size="large" />
              <Text style={styles.loadingText}>Claude génère votre résumé...</Text>
              <Text style={styles.loadingSubtext}>Environ 15–30 secondes</Text>
            </View>
          ) : summary ? (
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Sections par étape */}
              {summary.sections.map((section, i) => (
                <View key={i} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>{section.step_title}</Text>
                  </View>

                  <View style={styles.keyPoints}>
                    {section.key_points.map((point, j) => (
                      <View key={j} style={styles.keyPointRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.keyPointText}>{point}</Text>
                      </View>
                    ))}
                  </View>

                  {section.key_concepts.length > 0 && (
                    <View style={styles.conceptsRow}>
                      {section.key_concepts.map((concept, k) => (
                        <View key={k} style={styles.conceptChip}>
                          <Text style={styles.conceptText}>{concept}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              {/* Glossaire */}
              {summary.glossary.length > 0 && (
                <View style={styles.block}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="book-outline" size={16} color={colors.accent.info} />
                    <Text style={styles.blockTitle}>Glossaire</Text>
                  </View>
                  {summary.glossary.map((entry, i) => (
                    <View key={i} style={styles.glossaryRow}>
                      <Text style={styles.glossaryTerm}>{entry.term}</Text>
                      <Text style={styles.glossaryDef}>{entry.definition}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Conseils d'étude */}
              {summary.study_tips.length > 0 && (
                <View style={styles.block}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="bulb-outline" size={16} color={colors.accent.warning} />
                    <Text style={styles.blockTitle}>Conseils d'étude</Text>
                  </View>
                  {summary.study_tips.map((tip, i) => (
                    <View key={i} style={styles.tipRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.accent.success} />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.loadingState}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.text.muted} />
              <Text style={styles.loadingText}>Résumé indisponible</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 26, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: colors.border.default,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  loadingSubtext: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  sectionTitle: {
    ...textStyles.label,
    color: colors.text.primary,
    flex: 1,
  },
  keyPoints: {
    gap: 6,
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent.secondary,
    marginTop: 7,
    flexShrink: 0,
  },
  keyPointText: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 19,
  },
  conceptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  conceptChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  conceptText: {
    fontSize: 10,
    color: colors.accent.secondary,
    fontWeight: '500',
  },
  block: {
    gap: spacing.sm,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  blockTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  glossaryRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 2,
  },
  glossaryTerm: {
    ...textStyles.label,
    color: colors.accent.info,
  },
  glossaryDef: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipText: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 19,
  },
})
