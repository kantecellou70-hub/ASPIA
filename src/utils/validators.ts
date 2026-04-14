export const validators = {
  email(value: string): string | undefined {
    if (!value.trim()) return 'Email requis'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email invalide'
    return undefined
  },

  password(value: string): string | undefined {
    if (!value) return 'Mot de passe requis'
    if (value.length < 8) return 'Au moins 8 caractères'
    return undefined
  },

  fullName(value: string): string | undefined {
    if (!value.trim()) return 'Nom complet requis'
    if (value.trim().length < 2) return 'Nom trop court'
    return undefined
  },

  phone(value: string): string | undefined {
    const cleaned = value.replace(/\s/g, '')
    if (!cleaned) return 'Numéro de téléphone requis'
    // Numéros africains : commence par + ou des chiffres, 8–15 chiffres
    if (!/^\+?[0-9]{8,15}$/.test(cleaned)) return 'Numéro de téléphone invalide'
    return undefined
  },

  required(value: string, fieldName = 'Ce champ'): string | undefined {
    if (!value.trim()) return `${fieldName} est requis`
    return undefined
  },
}

/**
 * Valide un objet selon un schéma de validateurs.
 * Retourne un objet avec les erreurs (vide si tout est valide).
 */
export function validate<T extends Record<string, string>>(
  values: T,
  schema: Partial<Record<keyof T, (v: string) => string | undefined>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {}
  for (const key in schema) {
    const validate = schema[key]
    const error = validate?.(values[key] ?? '')
    if (error) errors[key] = error
  }
  return errors
}
