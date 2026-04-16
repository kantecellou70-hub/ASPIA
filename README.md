# APSIA

Application mobile d'apprentissage intelligent — transforme vos PDF en parcours pédagogiques IA personnalisés avec quiz adaptatifs et paiement intégré (Mobile Money).

---

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework mobile | React Native | 0.83.4 |
| Expo | Expo SDK | ~55.0.0 |
| Navigation | Expo Router (file-based) | ~55.0.12 |
| Langage | TypeScript strict | ~5.9.2 |
| État global | Zustand | ^5.0.12 |
| Backend / Auth / DB | Supabase | ^2.103.0 |
| IA — analyse & circuit | Claude Opus 4.6 (Anthropic) | API |
| IA — quiz & résumé | Claude Sonnet 4.6 (Anthropic) | API (~5x moins cher) |
| Paiement | Kkiapay (Mobile Money XOF) | REST |
| Animations | React Native Reanimated | 4.2.1 |
| Icônes | @expo/vector-icons | ^15.1.1 |
| Build | EAS (Expo Application Services) | CLI 14.0+ |

---

## Architecture du projet

```
APSIA/
├── app/                              # Routes Expo Router (file-based)
│   ├── _layout.tsx                   # Root layout — providers + listener auth + ToastContainer
│   ├── index.tsx                     # Redirecteur auth/non-auth
│   ├── (auth)/                       # Groupe écrans d'authentification
│   │   ├── welcome.tsx               # Écran d'accueil
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                       # Navigation principale (Tab Bar)
│   │   ├── home.tsx                  # Circuits récents + compteur sessions
│   │   ├── upload.tsx                # Dépôt PDF + barre de progression
│   │   ├── library.tsx               # Bibliothèque documents & circuits
│   │   └── profile.tsx               # Profil utilisateur + plan
│   ├── circuit/[id].tsx              # Détail d'un circuit pédagogique
│   ├── quiz/[id].tsx                 # Interface de passage d'un quiz
│   ├── quiz/results/[id].tsx         # Résultats & feedback du quiz
│   ├── payment/
│   │   ├── plans.tsx                 # Comparatif des plans tarifaires
│   │   └── checkout.tsx              # Paiement Mobile Money (Kkiapay)
│   ├── admin.tsx                     # Tableau de bord admin (KPIs)
│   ├── admin-users.tsx               # CRM — liste utilisateurs avec filtres
│   ├── admin-user/[id].tsx           # CRM — profil détaillé + actions admin
│   ├── admin-payments.tsx            # Paiements & réconciliation
│   └── admin-payment/[id].tsx        # Détail transaction + remboursement
│
├── src/
│   ├── components/
│   │   ├── ui/                       # Composants de base réutilisables
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx / GlassCard.tsx
│   │   │   ├── Input.tsx / Modal.tsx / Badge.tsx
│   │   │   ├── ProgressBar.tsx / AnimatedCounter.tsx
│   │   │   ├── Header.tsx / SafeArea.tsx
│   │   │   └── Toast.tsx             # Notifications système (succès, erreur, info)
│   │   └── features/                 # Composants métier
│   │       ├── CircuitCard.tsx
│   │       ├── QuestionCard.tsx      # Rendu des questions de quiz
│   │       ├── PlanCard.tsx          # Affichage des plans tarifaires
│   │       ├── PDFDropZone.tsx
│   │       ├── AnalysisProgress.tsx
│   │       ├── ScoreDisplay.tsx
│   │       ├── SessionCounter.tsx
│   │       ├── SocialLoginButton.tsx
│   │       ├── OptionButton.tsx
│   │       ├── QuizSetupModal.tsx    # Sélection difficulté / nombre de questions
│   │       ├── CourseSummaryModal.tsx# Résumé condensé d'un circuit
│   │       ├── KpiCard.tsx           # Carte KPI admin
│   │       └── RevenueChart.tsx      # Graphique revenus (admin)
│   │
│   ├── constants/
│   │   ├── theme.ts                  # Design system — couleurs, espacements, ombres
│   │   ├── typography.ts             # Styles typographiques
│   │   ├── layout.ts                 # Utilitaires de mise en page
│   │   └── config.ts                 # Plans, limites sessions, coûts IA, limites tokens
│   │
│   ├── types/                        # Interfaces TypeScript
│   │   ├── auth.types.ts             # User, Session, LoginCredentials
│   │   ├── circuit.types.ts          # Circuit, CircuitStep, Progress
│   │   ├── quiz.types.ts             # Quiz, Question, Attempt, CourseSummary
│   │   ├── payment.types.ts          # Payment, Plan, intégration Kkiapay
│   │   └── upload.types.ts           # DocumentFile, UploadProgress
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Initialisation du client Supabase
│   │   ├── storage.ts                # Adaptateur AsyncStorage/localStorage pour auth
│   │   └── offlineCache.ts           # Cache local pour le mode hors-ligne
│   │
│   ├── services/                     # Logique métier
│   │   ├── auth.service.ts           # Authentification (sign in/up, OAuth, sign out)
│   │   ├── upload.service.ts         # Upload PDF vers Supabase Storage
│   │   ├── ai.service.ts             # Orchestration des Edge Functions IA
│   │   ├── quiz.service.ts           # Opérations de données quiz
│   │   ├── payment.service.ts        # Intégration paiement Kkiapay
│   │   └── profile.service.ts        # Gestion du profil utilisateur
│   │
│   ├── store/                        # Stores Zustand
│   │   ├── authStore.ts              # État auth (isAuthenticated basé sur session uniquement)
│   │   ├── sessionStore.ts           # Quota de sessions
│   │   ├── uploadStore.ts            # Progression d'upload
│   │   ├── uiStore.ts                # Toasts, modals
│   │   └── offlineStore.ts           # File d'attente uploads hors-ligne
│   │
│   ├── hooks/                        # Hooks personnalisés
│   │   ├── useAuth.ts
│   │   ├── useUpload.ts              # Upload + chiffrement + analyse IA
│   │   ├── useCircuit.ts
│   │   ├── useQuiz.ts
│   │   ├── usePayment.ts
│   │   ├── useSession.ts
│   │   ├── useNetwork.ts             # Détection réseau (NetInfo)
│   │   └── useOfflineSync.ts         # Synchronisation de la file hors-ligne
│   │
│   └── utils/
│       ├── formatters.ts             # Formatage date, nombres, texte
│       └── validators.ts             # Validation email, fichiers
│
├── supabase/
│   ├── config.toml                   # Config Supabase local (ports, auth, storage)
│   ├── migrations/
│   │   ├── 20260414000000_init.sql              # Schéma complet de la base de données
│   │   ├── 20260415000000_crm_fields.sql        # city, is_banned sur profiles
│   │   ├── 20260415000001_payment_fields.sql    # operator, refund_reason, refunded_at sur payments
│   │   ├── 20260415000002_ai_cost_optimization.sql  # ai_usage, ai_daily_costs, file_hash, RPCs
│   │   └── 20260415000003_security_compliance.sql   # audit_logs, rate_limit_buckets, vault, RPCs
│   └── functions/                    # Edge Functions Deno/TypeScript
│       ├── _shared/
│       │   ├── cors.ts               # Utilitaires CORS
│       │   ├── ai-tracker.ts         # Cap mensuel tokens + enregistrement consommation
│       │   ├── rate-limiter.ts       # Rate limiting par fenêtre glissante (PostgreSQL)
│       │   ├── audit.ts              # Journaux d'audit (audit_logs)
│       │   └── crypto.ts             # AES-256-GCM via Web Crypto API
│       ├── analyze-document/         # Analyse PDF via Claude Opus (+ hash SHA-256 + déchiffrement)
│       ├── generate-circuit/         # Circuit pédagogique — cache deux niveaux + Opus
│       ├── generate-quiz/            # Quiz — Claude Sonnet (~5x moins cher)
│       ├── generate-summary/         # Résumé condensé — Claude Sonnet
│       ├── submit-quiz/              # Correction et calcul du score
│       ├── initiate-payment/         # Initiation paiement Kkiapay + détection opérateur
│       ├── verify-payment/           # Vérification statut + mise à jour plan
│       ├── get-kpis/                 # KPIs admin (utilisateurs, revenus, IA)
│       ├── admin-crm/                # CRM utilisateurs (list, detail, ban, plan…)
│       ├── admin-payments/           # Paiements admin (list, refund, rapport mensuel)
│       ├── check-daily-costs/        # Alerte webhook si coût journalier > seuil
│       ├── encrypt-document/         # Chiffrement PDF au repos (AES-256-GCM + Vault)
│       └── purge-expired-data/       # Purge RGPD (Storage + Vault + DB)
│
├── assets/                           # Icônes et splash screen
├── vercel.json                       # Configuration déploiement web Vercel
├── app.json                          # Configuration Expo (bundle IDs, plugins)
├── eas.json                          # Profils de build EAS
├── tsconfig.json                     # TypeScript strict + alias @/* → src/*
└── .env.example                      # Modèle de variables d'environnement
```

---

## Schéma de base de données

Toutes les tables utilisent RLS (Row Level Security) — chaque utilisateur n'accède qu'à ses propres données.

| Table | Description |
|---|---|
| `profiles` | Profil utilisateur (rôle, plan, quota sessions, ville, rétention données) |
| `documents` | PDFs uploadés (storage path, hash SHA-256, vault_key_id, is_encrypted) |
| `circuits` | Parcours d'apprentissage générés par IA |
| `circuit_steps` | Étapes d'un circuit (contenu, concepts-clés) |
| `quizzes` | Évaluations associées à un circuit |
| `quiz_questions` | Questions (QCM ou vrai/faux) |
| `quiz_options` | Réponses possibles par question |
| `quiz_attempts` | Tentatives utilisateur avec score et réponses (JSONB) |
| `payments` | Historique des paiements (statut, opérateur, transaction Kkiapay, remboursement) |
| `ai_usage` | Consommation tokens IA par utilisateur et par mois |
| `ai_daily_costs` | Coûts journaliers globaux (pour alertes seuil) |
| `audit_logs` | Journal d'accès et d'actions (qui, quoi, quand, IP) |
| `rate_limit_buckets` | Compteurs de rate limiting par fenêtre glissante |

**Bucket Storage** : `documents` — privé, limite 50 Mo, PDF uniquement, chemins isolés par utilisateur.

---

## Architecture IA

Les PDF et la génération de contenu sont entièrement traités côté serveur via des **Supabase Edge Functions** — les clés Anthropic ne sont jamais exposées côté client.

| Fonction | Entrée | Sortie | Modèle | Note |
|---|---|---|---|---|
| `analyze-document` | `document_id` | Analyse structurée (titre, niveau, concepts) | Claude Opus 4.6 | Déchiffre le PDF si chiffré |
| `generate-circuit` | `document_id` | Circuit + 5–8 étapes en base | Claude Opus 4.6 | Cache SHA-256 deux niveaux |
| `generate-quiz` | `circuit_id` | Quiz + questions en base | Claude Sonnet 4.6 | ~5x moins cher qu'Opus |
| `generate-summary` | `circuit_id` | Résumé condensé (JSON) | Claude Sonnet 4.6 | Non persisté — cache client |
| `submit-quiz` | `attempt_id`, réponses | Score %, feedback | Logique interne | — |
| `initiate-payment` | `plan_id`, montant, téléphone | ID transaction Kkiapay | Kkiapay REST | Détecte l'opérateur |
| `verify-payment` | `transaction_id` | Statut + mise à jour du plan | Kkiapay REST | — |
| `encrypt-document` | `document_id` | PDF chiffré dans Storage | Web Crypto AES-256-GCM | Clé dans Vault |
| `purge-expired-data` | — | Suppression données expirées | — | RGPD, pg_cron mensuel |
| `check-daily-costs` | — | Alerte webhook si seuil dépassé | — | pg_cron toutes les heures |

### Flux de traitement d'un document

```
1. Sélection PDF          → uploadService.pickDocument()  [50 Mo max]
2. Upload Storage         → Supabase Storage (bucket documents)
3. Insertion DB           → table documents
4. Consommation session   → useSession.consumeSession()
5. Chiffrement PDF        → Edge Function encrypt-document (AES-256-GCM + Vault)
6. Analyse IA             → Edge Function analyze-document → Claude Opus 4.6
7. Génération circuit     → Edge Function generate-circuit → table circuits + circuit_steps
8. Redirection            → /circuit/[id]
```

### Optimisation des coûts IA

- **Claude Sonnet** pour quiz et résumés (~5x moins cher qu'Opus, qualité suffisante)
- **Cache circuit** : deux niveaux — par `document_id`, puis par hash SHA-256 (re-uploads)
- **Cap mensuel tokens** par plan (free: 100k, starter: 1M, pro: 5M, enterprise: illimité)
- **Alerte coûts** : webhook (Slack/Discord/générique) si dépense journalière > seuil configuré

### Sécurité & conformité

- **Chiffrement PDF** : AES-256-GCM, clé stockée dans Supabase Vault (pgsodium)
- **Rate limiting** : 3 fenêtres glissantes (minute/heure/jour) par plan et par opération
- **Audit logs** : traçabilité de toutes les actions IA et admin (user_id, IP, action, statut)
- **Rétention des données** : purge automatique configurable par utilisateur (`data_retention_months`)

---

## Plans & Sessions

| Plan | Sessions/mois | Tokens IA/mois | Prix |
|---|---|---|---|
| Gratuit | 3 | 100 000 | 0 XOF |
| Starter | 20 | 1 000 000 | 2 500 XOF/mois |
| Pro | 100 | 5 000 000 | 7 500 XOF/mois |
| Entreprise | Illimité | Illimité | 25 000 XOF/mois |

---

## Installation

### Prérequis

- Node.js 20+ (via [fnm](https://github.com/Schniz/fnm) ou nvm)
- Java 17 (`sudo apt install openjdk-17-jdk` sur Ubuntu)
- Android Studio avec SDK Android 34+ (pour l'émulateur)
- Compte [Supabase](https://supabase.com) avec projet créé
- Compte [Kkiapay](https://kkiapay.me) (mode sandbox disponible)

### Démarrage rapide

```bash
# Cloner et installer les dépendances
git clone <repo>
cd APSIA
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les valeurs dans .env (voir section ci-dessous)

# Lancer le serveur de développement
npx expo start --clear

# Dans le menu interactif :
#   a  → Android (émulateur ou appareil connecté)
#   w  → Web (navigateur)
#   Scan QR → Expo Go sur téléphone réel
```

### Variables d'environnement

Créez `.env` à la racine à partir de `.env.example` :

```env
# Supabase (côté client — clé publique uniquement)
# Récupérer sur : supabase.com/dashboard → Settings → API
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   # commence toujours par eyJ

# Kkiapay (clé publique uniquement)
EXPO_PUBLIC_KKIAPAY_API_KEY=votre-cle-publique
EXPO_PUBLIC_KKIAPAY_SANDBOX=true
```

Les secrets serveur (jamais exposés côté client) sont configurés via la CLI Supabase :

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set KKIAPAY_PRIVATE_KEY=...
supabase secrets set KKIAPAY_PUBLIC_KEY=...
supabase secrets set KKIAPAY_SANDBOX=true

# Optionnel — alertes coûts IA
supabase secrets set DAILY_COST_ALERT_THRESHOLD_USD=10
supabase secrets set ALERT_WEBHOOK_URL=https://hooks.slack.com/...
supabase secrets set ALERT_WEBHOOK_TYPE=slack   # slack | discord | generic
```

### Initialiser la base de données Supabase

#### Option A — CLI (recommandé)
```bash
supabase db push
```

#### Option B — Dashboard SQL Editor
Exécuter les migrations dans l'ordre dans **SQL Editor → Run** :

1. `supabase/migrations/20260414000000_init.sql`
2. `supabase/migrations/20260415000000_crm_fields.sql`
3. `supabase/migrations/20260415000001_payment_fields.sql`
4. `supabase/migrations/20260415000002_ai_cost_optimization.sql`
5. `supabase/migrations/20260415000003_security_compliance.sql`

Si la migration init a déjà été partiellement appliquée (erreur "relation already exists"), exécuter uniquement ce correctif pour recréer le trigger :

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

### Déployer les Edge Functions

```bash
# Fonctions core
supabase functions deploy analyze-document
supabase functions deploy generate-circuit
supabase functions deploy generate-quiz
supabase functions deploy generate-summary
supabase functions deploy submit-quiz
supabase functions deploy initiate-payment
supabase functions deploy verify-payment

# Fonctions admin
supabase functions deploy get-kpis
supabase functions deploy admin-crm
supabase functions deploy admin-payments

# Fonctions système
supabase functions deploy encrypt-document
supabase functions deploy purge-expired-data
supabase functions deploy check-daily-costs
```

---

## Configuration Supabase (dashboard)

### Authentication
- **Authentication → Providers → Email** → désactiver **"Confirm email"** (pour le développement)
- La clé **anon public** (Settings → API) est un JWT commençant par `eyJ...` — ne pas confondre avec d'autres types de clés

### Vault (chiffrement PDF)
L'extension **Vault** (pgsodium) doit être activée dans **Database → Extensions → Vault**.
Elle est activée par défaut sur Supabase Cloud.

### Confirmer manuellement un utilisateur existant
Si un compte a été créé avant la désactivation de "Confirm email" :

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'utilisateur@exemple.com';
```

### Passer un compte en admin
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@exemple.com');
```

---

## Configuration Android (Ubuntu)

### 1. Dépendances système

```bash
# Java 17
sudo apt update && sudo apt install -y openjdk-17-jdk

# Node.js 20+ via fnm
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20 && fnm use 20
```

### 2. Variables d'environnement shell

Ajoutez dans `~/.bashrc` puis rechargez (`source ~/.bashrc`) :

```bash
# Java
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"

# Android SDK (installé via Android Studio)
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# fnm (Node.js)
export PATH="/home/$USER/.local/share/fnm:$PATH"
eval "$(fnm env --use-on-cd --shell bash)"

# Android tools
export PATH="$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

### 3. Télécharger la system image Android

```bash
sdkmanager --licenses
sdkmanager "system-images;android-34;google_apis_playstore;x86_64"
```

### 4. Créer un AVD (émulateur)

```bash
echo "no" | avdmanager create avd \
  -n Pixel_API34 \
  -k "system-images;android-34;google_apis_playstore;x86_64" \
  -d "pixel_6"

emulator -list-avds
# → Pixel_API34
```

### 5. Lancer l'émulateur

```bash
emulator @Pixel_API34 -no-snapshot-load &
adb wait-for-device
adb shell getprop sys.boot_completed  # → 1 quand prêt
adb devices                           # → emulator-5554   device
```

### 6. Lancer l'app

```bash
cd ~/Documents/Projets/APSIA
fnm use 20
npx expo start --clear
# Appuyer sur : a
```

> **Expo Go absent ?** Installez-le manuellement :
> ```bash
> wget -O /tmp/ExpoGo.apk https://d1ahtucjixef4r.cloudfront.net/Exponent-2.33.2.apk
> adb install -r /tmp/ExpoGo.apk
> ```

---

## Déploiement Web (Vercel)

### Configuration (`vercel.json`)

```json
{
  "buildCommand": "npx expo export --platform web",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [{ "source": "/:path*", "destination": "/index.html" }]
}
```

Le dossier `dist/` est exclu du git (`.gitignore`) — Vercel exécute le build à chaque déploiement.

### Variables d'environnement Vercel

Dashboard → **Settings → Environment Variables** (toutes les envs) :

| Variable | Valeur |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon `eyJ...` |
| `EXPO_PUBLIC_KKIAPAY_API_KEY` | Clé publique Kkiapay |
| `EXPO_PUBLIC_KKIAPAY_SANDBOX` | `true` |

> Les variables `EXPO_PUBLIC_*` sont **injectées au moment du build**, pas au runtime. Tout changement de variable nécessite un redéploiement.

### Déployer

```bash
# Via CLI
npm i -g vercel
vercel --prod

# Via Git (recommandé) — déclenche un build automatique
git push origin main
```

### Tester le build en local avant de déployer

```bash
npx expo export --platform web
# → génère dist/ avec index.html + _expo/static/js/
```

---

## Build production mobile

```bash
# APK preview (Android)
eas build --platform android --profile preview

# Production
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## Design system

Thème sombre (fond `#07101a`) avec composants glass-morphism.

| Catégorie | Détail |
|---|---|
| Couleur d'accent | Bleu `#3b82f6` (primaire), Violet (secondaire) |
| Fonds | primary, secondary, card, surface, elevated |
| Texte | primary, secondary, muted, disabled |
| Plans | free (gris), starter (bleu), pro (violet), enterprise (ambre) |
| Espacements | xs 4px → xxxl 64px |
| Ombres | sm, md, lg, glow (bleu), glowPurple |

---

## Notes techniques

- **Nouvelle architecture React Native** activée (`newArchEnabled: true` dans `app.json`)
- **Routes typées** Expo Router activées (`experiments.typedRoutes`)
- **Mode sombre** forcé (`userInterfaceStyle: "dark"`)
- **Alias TypeScript** : `@/*` → `src/*`
- **Interface utilisateur** en français (permissions iOS/Android localisées)
- **RLS Supabase** : isolation stricte des données par utilisateur
- **Sécurité** : clés Anthropic et Kkiapay privées exclusivement côté serveur (Edge Functions)
- **`isAuthenticated`** : dérivé de la session Supabase uniquement (pas du profil) — évite les déconnexions si le profil est temporairement inaccessible
- **Toast** : notifications système visibles via `useUiStore().showToast()`, rendu global dans `_layout.tsx`
- **Mode hors-ligne** : uploads mis en file d'attente dans `offlineStore` et synchronisés à la reconnexion via `useOfflineSync`
- **Auth Edge Functions** : pattern `supabaseUser.auth.getUser(token)` avec token explicite (ne pas utiliser `getUser()` sans argument — la session n'est pas disponible côté serveur)
