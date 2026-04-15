import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line, Text as SvgText } from 'react-native-svg'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { layout } from '@/constants/layout'

interface DataPoint {
  date: string       // YYYY-MM-DD
  amount_xof: number
}

interface RevenueChartProps {
  data: DataPoint[]
  /** Afficher aussi la valeur en GNF (1 XOF = 20 GNF) */
  showGnf?: boolean
}

const CHART_HEIGHT = 140
const PADDING = { top: 12, bottom: 28, left: 8, right: 8 }
const CHART_WIDTH = layout.screenWidth - spacing.lg * 2 - spacing.md * 2  // card padding

function formatAmount(xof: number): string {
  if (xof >= 1_000_000) return `${(xof / 1_000_000).toFixed(1)}M`
  if (xof >= 1_000) return `${Math.round(xof / 1_000)}k`
  return String(xof)
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function RevenueChart({ data, showGnf = true }: RevenueChartProps) {
  const { points, pathFill, pathLine, maxVal, nonZeroDays } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], pathFill: '', pathLine: '', maxVal: 0, nonZeroDays: 0 }
    }

    const values = data.map((d) => d.amount_xof)
    const maxVal = Math.max(...values, 1)
    const nonZeroDays = values.filter((v) => v > 0).length

    const innerW = CHART_WIDTH - PADDING.left - PADDING.right
    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom
    const step = innerW / Math.max(data.length - 1, 1)

    const pts = data.map((d, i) => ({
      x: PADDING.left + i * step,
      y: PADDING.top + innerH - (d.amount_xof / maxVal) * innerH,
    }))

    // SVG path pour la ligne
    const lineD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ')

    // SVG path pour le remplissage (area)
    const lastPt = pts[pts.length - 1]
    const firstPt = pts[0]
    const fillD = `${lineD} L ${lastPt.x.toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} L ${firstPt.x.toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} Z`

    return { points: pts, pathFill: fillD, pathLine: lineD, maxVal, nonZeroDays }
  }, [data])

  const hasData = nonZeroDays > 0

  // Trouver le point max pour afficher le label
  const peakIndex = useMemo(() => {
    if (!data || data.length === 0) return -1
    return data.reduce((maxI, d, i, arr) => d.amount_xof > arr[maxI].amount_xof ? i : maxI, 0)
  }, [data])

  return (
    <View style={styles.container}>
      {/* Labels axes */}
      <View style={styles.yLabels}>
        <Text style={styles.axisLabel}>{formatAmount(maxVal)} XOF</Text>
        <Text style={styles.axisLabel}>0</Text>
      </View>

      {hasData ? (
        <Svg
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          style={styles.svg}
        >
          <Defs>
            <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent.primary} stopOpacity="0.35" />
              <Stop offset="1" stopColor={colors.accent.primary} stopOpacity="0.02" />
            </LinearGradient>
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.accent.secondary} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.accent.primary} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Ligne de base */}
          <Line
            x1={PADDING.left}
            y1={PADDING.top + CHART_HEIGHT - PADDING.bottom - PADDING.top}
            x2={CHART_WIDTH - PADDING.right}
            y2={PADDING.top + CHART_HEIGHT - PADDING.bottom - PADDING.top}
            stroke={colors.border.subtle}
            strokeWidth="1"
          />

          {/* Zone de remplissage */}
          <Path d={pathFill} fill="url(#fillGrad)" />

          {/* Ligne principale */}
          <Path
            d={pathLine}
            stroke="url(#lineGrad)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Point de pic */}
          {peakIndex >= 0 && points[peakIndex] && data[peakIndex].amount_xof > 0 && (
            <>
              <Circle
                cx={points[peakIndex].x}
                cy={points[peakIndex].y}
                r={5}
                fill={colors.accent.primary}
                stroke={colors.background.primary}
                strokeWidth={2}
              />
              <SvgText
                x={Math.min(points[peakIndex].x, CHART_WIDTH - 60)}
                y={points[peakIndex].y - 10}
                fontSize="10"
                fill={colors.accent.primary}
                fontWeight="600"
              >
                {formatAmount(data[peakIndex].amount_xof)} XOF
              </SvgText>
            </>
          )}

          {/* Étiquettes X : première et dernière date */}
          {data.length > 0 && (
            <>
              <SvgText
                x={PADDING.left}
                y={CHART_HEIGHT - 4}
                fontSize="9"
                fill={colors.text.muted}
              >
                {formatDate(data[0].date)}
              </SvgText>
              <SvgText
                x={CHART_WIDTH - PADDING.right - 24}
                y={CHART_HEIGHT - 4}
                fontSize="9"
                fill={colors.text.muted}
              >
                {formatDate(data[data.length - 1].date)}
              </SvgText>
            </>
          )}
        </Svg>
      ) : (
        <View style={[styles.svg, styles.emptyState]}>
          <Text style={styles.emptyText}>Aucune transaction ce mois</Text>
        </View>
      )}

      {/* Légende */}
      {showGnf && maxVal > 0 && (
        <Text style={styles.gnfLabel}>
          ≈ {formatAmount(maxVal * 20)} GNF au pic
        </Text>
      )}
      <Text style={styles.footerLabel}>
        30 derniers jours · {nonZeroDays} jour(s) avec transactions
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  yLabels: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: PADDING.bottom,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 1,
    pointerEvents: 'none',
  },
  axisLabel: {
    fontSize: 9,
    color: colors.text.muted,
  },
  svg: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
  },
  emptyText: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  gnfLabel: {
    fontSize: 10,
    color: colors.accent.secondary,
    textAlign: 'right',
  },
  footerLabel: {
    fontSize: 10,
    color: colors.text.muted,
  },
})
