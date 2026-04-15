import React from 'react'
import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

interface KpiCardProps {
  label: string
  value: string
  subtitle?: string
  /** Valeur secondaire affichée sous la valeur principale (ex: conversion GNF) */
  secondaryValue?: string
  /** Icône Ionicons */
  icon?: keyof typeof Ionicons.glyphMap
  /** Couleur de l'accentuation */
  accentColor?: string
  /** Tendance : +12 → positif, -3 → négatif */
  trend?: number
  trendLabel?: string
  style?: ViewStyle
}

export function KpiCard({
  label,
  value,
  subtitle,
  secondaryValue,
  icon,
  accentColor = colors.accent.primary,
  trend,
  trendLabel,
  style,
}: KpiCardProps) {
  const trendPositive = trend !== undefined && trend >= 0
  const trendColor = trend === undefined
    ? colors.text.muted
    : trendPositive
      ? colors.accent.success
      : colors.accent.error
  const trendIcon = trendPositive ? 'trending-up' : 'trending-down'

  return (
    <View style={[styles.card, style]}>
      {/* En-tête */}
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconBox, { backgroundColor: `${accentColor}18` }]}>
            <Ionicons name={icon} size={16} color={accentColor} />
          </View>
        )}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>

      {/* Valeur principale */}
      <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
        {value}
      </Text>

      {/* Valeur secondaire */}
      {secondaryValue && (
        <Text style={styles.secondaryValue} numberOfLines={1}>{secondaryValue}</Text>
      )}

      {/* Sous-titre ou tendance */}
      {(subtitle || trend !== undefined) && (
        <View style={styles.footer}>
          {trend !== undefined && (
            <View style={styles.trendRow}>
              <Ionicons name={trendIcon} size={12} color={trendColor} />
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trend > 0 ? '+' : ''}{trend}%
              </Text>
            </View>
          )}
          {trendLabel && (
            <Text style={styles.trendLabel}>{trendLabel}</Text>
          )}
          {subtitle && !trendLabel && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...textStyles.caption,
    color: colors.text.muted,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  secondaryValue: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  trendLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  subtitle: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
})
