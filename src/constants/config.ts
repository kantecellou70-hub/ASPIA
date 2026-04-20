export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: ['.pdf'],
} as const

// ── Plans tarifaires APSIA (GNF) ─────────────────────────────────────────────

export const PLANS = {
  alpha: {
    id: 'alpha',
    name: 'Alpha',
    price: 0,
    currency: 'GNF',
    sessions_limit: 3,
    description: 'Découverte gratuite',
    features: [
      '3 sessions pour découvrir',
      'Analyse de PDF',
      'Circuit d\'apprentissage',
      'Quiz basiques',
    ],
  },
  beta: {
    id: 'beta',
    name: 'Beta',
    price: 20000,
    currency: 'GNF',
    sessions_limit: 20,
    description: 'Élève actif',
    features: [
      '20 sessions/mois — idéal pour réviser régulièrement',
      'Analyse de PDF avancée',
      'Circuits illimités',
      'Quiz avec explications',
      'Historique complet',
    ],
  },
  gamma: {
    id: 'gamma',
    name: 'Gamma',
    price: 50000,
    currency: 'GNF',
    sessions_limit: 999999,
    description: 'Révision intensive',
    features: [
      'Sessions illimitées — même prix qu\'un répétiteur',
      'Analyse IA prioritaire',
      'Circuits personnalisés',
      'Quiz adaptatifs',
      'Export des résultats',
      'Support prioritaire',
    ],
    is_popular: true,
  },
  ecole_beta: {
    id: 'ecole_beta',
    name: 'École Beta',
    price: 15000,
    currency: 'GNF',
    sessions_limit: 20,
    description: 'Établissements scolaires',
    features: [
      '20 sessions/élève/mois',
      'Dashboard proviseur',
      'Suivi par classe',
      'Rapports mensuels PDF automatiques',
    ],
  },
  ecole_gamma: {
    id: 'ecole_gamma',
    name: 'École Gamma',
    price: 35000,
    currency: 'GNF',
    sessions_limit: 999999,
    description: 'Établissements — accès illimité',
    features: [
      'Sessions illimitées/élève',
      'Dashboard proviseur complet',
      'Suivi par classe',
      'Rapports mensuels PDF automatiques',
      'Support dédié',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS
export const FREE_SESSIONS_LIMIT = 3
export const DEFAULT_PLAN: PlanId = 'alpha'

// ── Données éducatives guinéennes ─────────────────────────────────────────────

export const GUINEE_NIVEAUX = [
  '6ème', '7ème', '8ème', '9ème',
  '10ème (2nde)', '11ème (1ère)', '12ème (Terminale)',
  'Université - Licence 1', 'Université - Licence 2',
  'Université - Licence 3', 'Master',
]

export const GUINEE_FILIERES = {
  lycee: ['SM', 'SS', 'SE', 'A', 'B1', 'C', 'D'],
  universite: ['Médecine', 'Droit', 'Économie', 'Lettres', 'Sciences', 'Informatique', 'Ingénierie'],
}

export const GUINEE_MATIERES_BEPC = [
  'Mathématiques',
  'Français',
  'Sciences Physiques',
  'Sciences Naturelles',
  'Histoire-Géographie',
  'Anglais',
  'Éducation Civique et Morale',
]

export const GUINEE_MATIERES_BAC = {
  SM: ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Philosophie', 'Anglais', 'Histoire-Géo'],
  SS: ['Histoire-Géographie', 'Français', 'Philosophie', 'Mathématiques', 'Économie', 'Anglais', 'SVT'],
  SE: ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Philosophie', 'Anglais'],
  A:  ['Français', 'Philosophie', 'Histoire-Géo', 'Latin/Langues', 'Anglais', 'Mathématiques'],
  C:  ['Mathématiques', 'Physique-Chimie', 'Français', 'Philosophie', 'Anglais', 'Informatique'],
  D:  ['SVT', 'Physique-Chimie', 'Mathématiques', 'Français', 'Philosophie', 'Anglais'],
} as const

export const GUINEE_VILLES = [
  'Conakry', 'Labé', 'Kankan', 'Kindia', 'Faranah',
  'Mamou', 'Boké', 'Nzérékoré', 'Autre',
]

export const EXAMENS_DATES = {
  BEPC: 'Juin',
  BAC: 'Juillet',
} as const

export const OBJECTIFS_ELEVE = [
  'Réussir le BEPC',
  'Réussir le BAC',
  'Améliorer mes notes',
  'Préparer un concours',
]

// ── IA ────────────────────────────────────────────────────────────────────────

export const AI_CONFIG = {
  MAX_STEPS_PER_CIRCUIT: 10,
  MAX_QUESTIONS_PER_QUIZ: 20,
  ANALYSIS_TIMEOUT_MS: 120_000,
} as const

/**
 * Coûts Claude par opération (en USD).
 * Circuit/Analyse : Claude Opus 4.6 ($15/MTok in, $75/MTok out)
 * Quiz/Résumé     : Claude Sonnet 4.6 ($3/MTok in, $15/MTok out) — ~5x moins cher
 */
export const CLAUDE_COST_USD = {
  PER_ANALYSIS: 0.16,
  PER_CIRCUIT: 0.375,
  PER_QUIZ: 0.042,
  PER_SUMMARY: 0.032,
} as const

export const MONTHLY_TOKEN_LIMITS = {
  alpha:      100_000,
  beta:       1_000_000,
  gamma:      5_000_000,
  ecole_beta: 1_000_000,
  ecole_gamma: -1,
} as const

export const CURRENCY = {
  DEFAULT_ALERT_THRESHOLD_USD: 50,
} as const

export const APP_CONFIG = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  KKIAPAY_API_KEY: process.env.EXPO_PUBLIC_KKIAPAY_API_KEY ?? '',
  KKIAPAY_SANDBOX: process.env.EXPO_PUBLIC_KKIAPAY_SANDBOX === 'true',
  KKIAPAY_BASE_URL: 'https://api.kkiapay.me',
} as const

// Alias de rétrocompatibilité pour les composants qui utilisent encore PLANS_CONFIG
/** @deprecated Utiliser PLANS à la place */
export const PLANS_CONFIG = {
  FREE: PLANS.alpha,
  STARTER: PLANS.beta,
  PRO: PLANS.gamma,
  ENTERPRISE: PLANS.ecole_gamma,
} as const
