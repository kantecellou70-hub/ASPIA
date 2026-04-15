import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUiStore } from '@/store/uiStore'
import { colors, spacing, borderRadius } from '@/constants/theme'

const TYPE_COLORS = {
  success: colors.accent.success,
  error: colors.accent.error,
  warning: colors.accent.warning,
  info: colors.accent.info,
} as const

const TYPE_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
} as const

function ToastItem({ toast }: { toast: { id: string; type: keyof typeof TYPE_COLORS; message: string } }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [opacity])

  const color = TYPE_COLORS[toast.type]

  return (
    <Animated.View style={[styles.toast, { opacity, borderLeftColor: color }]}>
      <Text style={[styles.icon, { color }]}>{TYPE_ICONS[toast.type]}</Text>
      <Text style={styles.message} numberOfLines={3}>{toast.message}</Text>
    </Animated.View>
  )
}

export function ToastContainer() {
  const { toasts } = useUiStore()
  const insets = useSafeAreaInsets()

  if (toasts.length === 0) return null

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm }]} pointerEvents="none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  message: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
})
