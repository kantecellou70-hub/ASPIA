import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { PDFDropZone } from '@/components/features/PDFDropZone'
import { AnalysisProgress } from '@/components/features/AnalysisProgress'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { SessionCounter } from '@/components/features/SessionCounter'
import { useUpload } from '@/hooks/useUpload'

export default function UploadScreen() {
  const insets = useSafeAreaInsets()
  const { selectedFile, progress, pickDocument, startUpload, reset } = useUpload()

  const isIdle = progress.status === 'idle'
  const isProcessing = ['uploading', 'analyzing', 'generating'].includes(progress.status)
  const isCompleted = progress.status === 'completed'
  const isError = progress.status === 'error'

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Importer un cours</Text>
          <Text style={styles.subtitle}>PDF — max 50 Mo</Text>
        </View>
        <SessionCounter />
      </View>

      {isProcessing || isCompleted ? (
        <GlassCard style={styles.progressCard}>
          <AnalysisProgress progress={progress} />
          {isCompleted && (
            <Button
              label="Nouvelle importation"
              onPress={reset}
              variant="ghost"
              fullWidth
              style={styles.resetButton}
            />
          )}
        </GlassCard>
      ) : (
        <>
          <PDFDropZone
            file={selectedFile}
            onPress={pickDocument}
            disabled={isProcessing}
          />

          {isError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                ❌ Une erreur est survenue. Réessayez.
              </Text>
            </View>
          )}

          {selectedFile && (
            <Button
              label="Analyser avec l'IA"
              onPress={startUpload}
              loading={isProcessing}
              fullWidth
              size="lg"
            />
          )}

          {selectedFile && (
            <Button
              label="Choisir un autre fichier"
              onPress={pickDocument}
              variant="ghost"
              fullWidth
            />
          )}
        </>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  progressCard: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  resetButton: {
    marginTop: spacing.sm,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: {
    ...textStyles.body,
    color: colors.accent.error,
  },
})
