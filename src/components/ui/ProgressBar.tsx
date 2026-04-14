import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

interface ProgressBarProps {
  progress: number // 0–100
  label?: string
  showValue?: boolean
  color?: string
  height?: number
  style?: ViewStyle
}

export function ProgressBar({
  progress,
  label,
  showValue = false,
  color = colors.accent.primary,
  height = 8,
  style,
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(100, Math.max(0, progress)),
      duration: 400,
      useNativeDriver: false,
    }).start()
  }, [progress, animatedWidth])

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showValue && (
            <Text style={styles.value}>{Math.round(progress)}%</Text>
          )}
        </View>
      )}

      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            { width: widthInterpolated, backgroundColor: color, height },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  value: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  track: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: borderRadius.full,
  },
})
