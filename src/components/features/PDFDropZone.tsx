import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { UPLOAD_LIMITS } from '@/constants/config'
import type { DocumentFile } from '@/types/upload.types'
import { formatFileSize } from '@/utils/formatters'

interface PDFDropZoneProps {
  file: DocumentFile | null
  onPress: () => void
  disabled?: boolean
}

export function PDFDropZone({ file, onPress, disabled = false }: PDFDropZoneProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.zone,
        file && styles.zoneWithFile,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {file ? (
        <View style={styles.fileInfo}>
          <View style={styles.fileIcon}>
            <Ionicons name="document-text" size={32} color={colors.accent.primary} />
          </View>
          <View style={styles.fileMeta}>
            <Text style={styles.fileName} numberOfLines={2}>
              {file.name}
            </Text>
            <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color={colors.accent.success} />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload-outline" size={36} color={colors.accent.primary} />
          </View>
          <Text style={styles.title}>Sélectionner un PDF</Text>
          <Text style={styles.subtitle}>
            Appuyez pour choisir un fichier depuis votre appareil
          </Text>
          <Text style={styles.limit}>
            Taille max : {UPLOAD_LIMITS.MAX_FILE_SIZE_MB} Mo
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  zone: {
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.background.card,
    minHeight: 180,
    justifyContent: 'center',
  },
  zoneWithFile: {
    borderStyle: 'solid',
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  placeholder: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    textAlign: 'center',
  },
  limit: {
    ...textStyles.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  fileIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  fileSize: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
})
