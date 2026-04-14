import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'
import { Button } from '@/components/ui/Button'

const features = [
  { icon: '📄', title: 'Importez vos cours', desc: 'Uploader n\'importe quel PDF' },
  { icon: '⚡', title: 'Circuit IA', desc: 'Un parcours personnalisé généré pour vous' },
  { icon: '🧠', title: 'Quiz adaptatif', desc: 'Testez et ancrez vos connaissances' },
]

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>A</Text>
        </View>
        <Text style={styles.appName}>APSIA</Text>
        <Text style={styles.tagline}>
          Transformez vos documents en parcours d'apprentissage intelligent
        </Text>
      </View>

      <View style={styles.features}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>{f.icon}</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label="Commencer"
          onPress={() => router.push('/(auth)/register')}
          fullWidth
          size="lg"
        />
        <Button
          label="J'ai déjà un compte"
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          fullWidth
          size="lg"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
  },
  appName: {
    ...textStyles.display,
    color: colors.text.primary,
    letterSpacing: 6,
  },
  tagline: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
  features: {
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  featureDesc: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  actions: {
    gap: spacing.sm,
  },
})
