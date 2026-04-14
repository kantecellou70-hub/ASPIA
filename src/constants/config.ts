export const SESSION_LIMITS = {
  FREE: 3,
  STARTER: 20,
  PRO: 100,
  ENTERPRISE: Infinity,
} as const

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: ['.pdf'],
} as const

export const PLANS_CONFIG = {
  FREE: {
    id: 'free' as const,
    name: 'Gratuit',
    sessions: SESSION_LIMITS.FREE,
    price: 0,
    currency: 'XOF',
    description: 'Découvrez APSIA',
    features: [
      '3 sessions d\'apprentissage',
      'Analyse de PDF',
      'Circuits d\'apprentissage',
      'Quiz basiques',
    ],
  },
  STARTER: {
    id: 'starter' as const,
    name: 'Starter',
    sessions: SESSION_LIMITS.STARTER,
    price: 2500,
    currency: 'XOF',
    description: 'Pour les étudiants actifs',
    features: [
      '20 sessions d\'apprentissage',
      'Analyse de PDF avancée',
      'Circuits illimités',
      'Quiz avec explications',
      'Historique complet',
    ],
  },
  PRO: {
    id: 'pro' as const,
    name: 'Pro',
    sessions: SESSION_LIMITS.PRO,
    price: 7500,
    currency: 'XOF',
    description: 'Pour les professionnels',
    features: [
      '100 sessions d\'apprentissage',
      'Analyse IA prioritaire',
      'Circuits personnalisés',
      'Quiz adaptatifs',
      'Export des résultats',
      'Support prioritaire',
    ],
    is_popular: true,
  },
  ENTERPRISE: {
    id: 'enterprise' as const,
    name: 'Entreprise',
    sessions: SESSION_LIMITS.ENTERPRISE,
    price: 25000,
    currency: 'XOF',
    description: 'Pour les équipes et institutions',
    features: [
      'Sessions illimitées',
      'Analyse IA dédiée',
      'Tableau de bord équipe',
      'API access',
      'Intégrations personnalisées',
      'Support dédié 24/7',
    ],
  },
} as const

export const AI_CONFIG = {
  MAX_STEPS_PER_CIRCUIT: 10,
  MAX_QUESTIONS_PER_QUIZ: 20,
  ANALYSIS_TIMEOUT_MS: 120_000,
} as const

export const APP_CONFIG = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  KKIAPAY_API_KEY: process.env.EXPO_PUBLIC_KKIAPAY_API_KEY ?? '',
  KKIAPAY_SANDBOX: process.env.EXPO_PUBLIC_KKIAPAY_SANDBOX === 'true',
  KKIAPAY_BASE_URL: 'https://api.kkiapay.me',
} as const
