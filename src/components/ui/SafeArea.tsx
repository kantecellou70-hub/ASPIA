import React from 'react'
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { layout } from '@/constants/layout'

interface SafeAreaProps {
  children: React.ReactNode
  scrollable?: boolean
  style?: ViewStyle
  contentStyle?: ViewStyle
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

export function SafeArea({
  children,
  scrollable = false,
  style,
  contentStyle,
  edges = ['top', 'bottom'],
}: SafeAreaProps) {
  const insets = useSafeAreaInsets()

  const paddingStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom + spacing.md : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  }

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[
          paddingStyle,
          styles.content,
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    )
  }

  return (
    <View style={[styles.container, paddingStyle, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.contentPaddingHorizontal,
  },
})
