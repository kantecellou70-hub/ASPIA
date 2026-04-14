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
import { validators } from '@/utils/validators'

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const { signIn, signInWithOAuth, isSubmitting } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate(): boolean {
    const e = {
      email: validators.email(email),
      password: validators.password(password),
    }
    setErrors(e)
    return !e.email && !e.password
  }

  async function handleLogin() {
    if (!validate()) return
    await signIn({ email: email.trim(), password })
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
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Bon retour sur APSIA 👋</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="••••••••"
          />

          <Button
            label="Se connecter"
            onPress={handleLogin}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.loginButton}
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
          <Text style={styles.footerText}>Pas encore de compte ? </Text>
          <Text style={styles.footerLink} onPress={() => router.replace('/(auth)/register')}>
            S'inscrire
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
  loginButton: {
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
