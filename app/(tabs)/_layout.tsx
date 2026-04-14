import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius } from '@/constants/theme'
import { textStyles } from '@/constants/typography'

type TabName = 'home' | 'upload' | 'library' | 'profile'

const tabs: { name: TabName; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'home', label: 'Accueil', icon: 'home-outline', iconActive: 'home' },
  { name: 'upload', label: 'Importer', icon: 'cloud-upload-outline', iconActive: 'cloud-upload' },
  { name: 'library', label: 'Bibliothèque', icon: 'library-outline', iconActive: 'library' },
  { name: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
]

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarBackground: () => <View style={styles.tabBarBg} />,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={24}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  tabLabel: {
    ...textStyles.caption,
    fontWeight: '600',
  },
  tabItem: {
    paddingTop: spacing.xs,
  },
})
