import React, { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, borderRadius, spacing } from '@/constants/theme'
import { textStyles, fontSizes } from '@/constants/typography'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  secureToggle?: boolean
  containerStyle?: ViewStyle
  leftIcon?: keyof typeof Ionicons.glyphMap
}

export function Input({
  label,
  error,
  hint,
  secureToggle = false,
  containerStyle,
  leftIcon,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isSecure, setIsSecure] = useState(props.secureTextEntry ?? false)

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          !!error && styles.errorBorder,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? colors.accent.primary : colors.text.muted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          {...props}
          style={[styles.input, leftIcon && styles.inputWithIcon]}
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.accent.primary}
          secureTextEntry={secureToggle ? isSecure : props.secureTextEntry}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
        />

        {secureToggle && (
          <Pressable onPress={() => setIsSecure((v) => !v)} style={styles.eyeButton}>
            <Ionicons
              name={isSecure ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.text.muted}
            />
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.background.elevated,
  },
  errorBorder: {
    borderColor: colors.accent.error,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  error: {
    ...textStyles.caption,
    color: colors.accent.error,
  },
  hint: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
})
