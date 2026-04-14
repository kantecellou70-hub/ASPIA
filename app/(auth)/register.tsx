import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SocialLoginButton } from '@/components/features/SocialLoginButton'
import { useAuth } from '@/hooks/useAuth'
import { validators, validate } from '@/utils/validators'

export default function RegisterScreen() {
  const insets = useSafeAreaInsets()
  const { signUp, signInWithOAuth, isSubmitting } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ full_name?: string; email?: string; password?: string }>({})

  function handleValidate(): boolean {
    const e = validate(
      { full_name: fullName, email, password },
      {
        full_name: validators.fullName,
        email: validators.email,
        password: validators.password,
      },
    )
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleRegister() {
    if (!handleValidate()) return
    await signUp({ full_name: fullName.trim(), email: email.trim(), password })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Commencez gratuitement — 3 sessions offertes</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Nom complet"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={errors.full_name}
            placeholder="Prénom Nom"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
            error={errors.email}
            placeholder="vous@exemple.com"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            secureToggle
            leftIcon="lock-closed-outline"
            error={errors.password}
            placeholder="8 caractères minimum"
          />

          <Button
            label="Créer mon compte"
            onPress={handleRegister}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.registerButton}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.social}>
          <SocialLoginButton provider="google" onPress={() => signInWithOAuth('google')} loading={isSubmitting} />
          <SocialLoginButton provider="apple" onPress={() => signInWithOAuth('apple')} loading={isSubmitting} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ? </Text>
          <Text style={styles.footerLink} onPress={() => router.replace('/(auth)/login')}>
            Se connecter
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...textStyles.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  form: {
    gap: spacing.md,
  },
  registerButton: {
    marginTop: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  social: {
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  footerLink: {
    ...textStyles.body,
    color: colors.accent.primary,
    fontWeight: '600',
  },
})
