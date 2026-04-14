import React from 'react'
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { layout } from '@/constants/layout'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap
    onPress: () => void
  }
  style?: ViewStyle
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
}: HeaderProps) {
  const insets = useSafeAreaInsets()

  function handleBack() {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack && (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={layout.headerIconSize} color={colors.text.primary} />
          </Pressable>
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {rightAction && (
          <Pressable onPress={rightAction.onPress} style={styles.rightButton} hitSlop={8}>
            <Ionicons name={rightAction.icon} size={layout.headerIconSize} color={colors.text.primary} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: layout.contentPaddingHorizontal,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.headerHeight,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  rightButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
