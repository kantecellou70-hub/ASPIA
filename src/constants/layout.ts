import { Dimensions, Platform } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallScreen: SCREEN_WIDTH < 375,
  isMediumScreen: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768,
  isLargeScreen: SCREEN_WIDTH >= 768,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',

  // Safe area approximations (overridden by useSafeAreaInsets in components)
  tabBarHeight: 72,
  headerHeight: 56,
  bottomInset: Platform.OS === 'ios' ? 34 : 16,
  topInset: Platform.OS === 'ios' ? 44 : 24,

  // Content
  contentPaddingHorizontal: 20,
  contentMaxWidth: 480,

  // Icons
  tabIconSize: 24,
  headerIconSize: 22,
} as const
