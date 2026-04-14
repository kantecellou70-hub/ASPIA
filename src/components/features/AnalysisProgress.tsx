import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { UploadProgress, UploadStatus } from '@/types/upload.types'

const steps: { status: UploadStatus; label: string; icon: string }[] = [
  { status: 'uploading', label: 'Upload du document', icon: '📤' },
  { status: 'analyzing', label: 'Analyse IA', icon: '🔍' },
  { status: 'generating', label: 'Génération du circuit', icon: '⚡' },
  { status: 'completed', label: 'Prêt !', icon: '✅' },
]

const statusOrder: UploadStatus[] = ['uploading', 'analyzing', 'generating', 'completed']

interface AnalysisProgressProps {
  progress: UploadProgress
}

export function AnalysisProgress({ progress }: AnalysisProgressProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (progress.status !== 'completed' && progress.status !== 'error') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      )
      pulse.start()
      return () => pulse.stop()
    }
  }, [progress.status, pulseAnim])

  const currentStatusIndex = statusOrder.indexOf(progress.status)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.Text style={[styles.statusEmoji, { opacity: pulseAnim }]}>
          {progress.status === 'completed' ? '✅' : progress.status === 'error' ? '❌' : '⚙️'}
        </Animated.Text>
        <Text style={styles.statusText}>{progress.step}</Text>
      </View>

      <ProgressBar
        progress={progress.progress}
        showValue
        color={
          progress.status === 'error'
            ? colors.accent.error
            : progress.status === 'completed'
            ? colors.accent.success
            : colors.accent.primary
        }
        height={10}
        style={styles.progressBar}
      />

      <View style={styles.steps}>
        {steps.map((step, index) => {
          const isDone = currentStatusIndex > index || progress.status === 'completed'
          const isActive = statusOrder[currentStatusIndex] === step.status

          return (
            <View key={step.status} style={styles.stepRow}>
              <View style={[styles.stepDot, isDone && styles.stepDotDone, isActive && styles.stepDotActive]}>
                {isDone && <Text style={styles.dotCheck}>✓</Text>}
              </View>
              <Text style={[styles.stepLabel, (isDone || isActive) && styles.stepLabelActive]}>
                {step.icon} {step.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusEmoji: {
    fontSize: 48,
  },
  statusText: {
    ...textStyles.h4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  progressBar: {
    marginHorizontal: spacing.xs,
  },
  steps: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.accent.success,
    borderColor: colors.accent.success,
  },
  stepDotActive: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  dotCheck: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  stepLabel: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  stepLabelActive: {
    color: colors.text.primary,
  },
})
