export const colors = {
  background: {
    primary: '#07101a',
    secondary: '#0a1628',
    card: '#0f2035',
    surface: '#162840',
    elevated: '#1a3050',
  },
  accent: {
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    secondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#475569',
    disabled: '#334155',
    inverse: '#07101a',
  },
  border: {
    default: '#1e3a5f',
    subtle: '#132030',
    focus: '#3b82f6',
    glass: 'rgba(255, 255, 255, 0.08)',
  },
  glass: {
    background: 'rgba(15, 32, 53, 0.85)',
    border: 'rgba(255, 255, 255, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.05)',
  },
  tier: {
    alpha: '#64748b',
    beta: '#3b82f6',
    gamma: '#8b5cf6',
    ecole_beta: '#06b6d4',
    ecole_gamma: '#f59e0b',
  },
  overlay: 'rgba(7, 16, 26, 0.7)',
  transparent: 'transparent',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  glowPurple: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const
