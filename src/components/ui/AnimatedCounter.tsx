import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TextStyle, StyleProp } from 'react-native'
import { colors } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  style?: StyleProp<TextStyle>
}

export function AnimatedCounter({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  style,
}: AnimatedCounterProps) {
  const animatedValue = useRef(new Animated.Value(0)).current
  const displayValue = useRef(0)

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start()
  }, [value, duration, animatedValue])

  animatedValue.addListener(({ value: v }) => {
    displayValue.current = Math.round(v)
  })

  return (
    <AnimatedText
      animatedValue={animatedValue}
      prefix={prefix}
      suffix={suffix}
      style={style}
    />
  )
}

function AnimatedText({
  animatedValue,
  prefix,
  suffix,
  style,
}: {
  animatedValue: Animated.Value
  prefix: string
  suffix: string
  style?: StyleProp<TextStyle>
}) {
  const [displayText, setDisplayText] = React.useState(`${prefix}0${suffix}`)

  useEffect(() => {
    const id = animatedValue.addListener(({ value }) => {
      setDisplayText(`${prefix}${Math.round(value)}${suffix}`)
    })
    return () => animatedValue.removeListener(id)
  }, [animatedValue, prefix, suffix])

  return <Text style={[styles.text, style]}>{displayText}</Text>
}

const styles = StyleSheet.create({
  text: {
    ...textStyles.display,
    color: colors.text.primary,
  },
})
