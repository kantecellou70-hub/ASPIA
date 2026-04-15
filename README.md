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
| IA / Analyse PDF | Claude Opus 4.6 (Anthropic) | API |
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
│   └── payment/
│       ├── plans.tsx                 # Comparatif des plans tarifaires
│       └── checkout.tsx              # Paiement Mobile Money (Kkiapay)
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
│   │       └── OptionButton.tsx
│   │
│   ├── constants/
│   │   ├── theme.ts                  # Design system — couleurs, espacements, ombres
│   │   ├── typography.ts             # Styles typographiques
│   │   ├── layout.ts                 # Utilitaires de mise en page
│   │   └── config.ts                 # Feature flags, limites de sessions, clés API publiques
│   │
│   ├── types/                        # Interfaces TypeScript
│   │   ├── auth.types.ts             # User, Session, LoginCredentials
│   │   ├── circuit.types.ts          # Circuit, CircuitStep, Progress
│   │   ├── quiz.types.ts             # Quiz, Question, Attempt
│   │   ├── payment.types.ts          # Payment, Plan, intégration Kkiapay
│   │   └── upload.types.ts           # DocumentFile, UploadProgress
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Initialisation du client Supabase
│   │   └── storage.ts                # Adaptateur AsyncStorage/localStorage pour auth
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
│   │   └── uiStore.ts                # Toasts, modals
│   │
│   ├── hooks/                        # Hooks personnalisés
│   │   ├── useAuth.ts
│   │   ├── useUpload.ts
│   │   ├── useCircuit.ts
│   │   ├── useQuiz.ts
│   │   ├── usePayment.ts
│   │   └── useSession.ts
│   │
│   └── utils/
│       ├── formatters.ts             # Formatage date, nombres, texte
│       └── validators.ts             # Validation email, fichiers
│
├── supabase/
│   ├── config.toml                   # Config Supabase local (ports, auth, storage)
│   ├── migrations/
│   │   └── 20260414000000_init.sql   # Schéma complet de la base de données
│   └── functions/                    # Edge Functions Deno/TypeScript
│       ├── analyze-document/         # Analyse PDF via Claude
│       ├── generate-circuit/         # Génération du parcours pédagogique
│       ├── generate-quiz/            # Génération des questions de quiz
│       ├── submit-quiz/              # Correction et calcul du score
│       ├── initiate-payment/         # Initiation paiement Kkiapay
│       ├── verify-payment/           # Vérification du statut de paiement
│       └── _shared/cors.ts           # Utilitaires CORS partagés
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
| `profiles` | Profil utilisateur (rôle, plan, quota sessions) |
| `documents` | PDFs uploadés (URL storage, métadonnées) |
| `circuits` | Parcours d'apprentissage générés par IA |
| `circuit_steps` | Étapes d'un circuit (contenu, concepts-clés) |
| `quizzes` | Évaluations associées à un circuit |
| `quiz_questions` | Questions (QCM ou vrai/faux) |
| `quiz_options` | Réponses possibles par question |
| `quiz_attempts` | Tentatives utilisateur avec score et réponses (JSONB) |
| `payments` | Historique des paiements (statut, transaction Kkiapay) |

**Bucket Storage** : `documents` — privé, limite 50 Mo, PDF uniquement, chemins isolés par utilisateur.

---

## Architecture IA

Les PDF et la génération de contenu sont entièrement traités côté serveur via des **Supabase Edge Functions** — les clés Anthropic ne sont jamais exposées côté client.

| Fonction | Entrée | Sortie | Modèle |
|---|---|---|---|
| `analyze-document` | `document_id` | Analyse structurée (titre, niveau, concepts) | Claude Opus 4.6 + vision PDF |
| `generate-circuit` | `document_id` | Circuit + 5–8 étapes en base | Claude Opus 4.6 |
| `generate-quiz` | `circuit_id` | Quiz + 5–10 questions en base | Claude Opus 4.6 |
| `submit-quiz` | `attempt_id`, réponses | Score %, feedback détaillé | Logique interne |
| `initiate-payment` | `plan_id`, montant, téléphone | ID transaction Kkiapay | Kkiapay REST |
| `verify-payment` | `transaction_id` | Statut + mise à jour du plan | Kkiapay REST |

### Flux de traitement d'un document

```
1. Sélection PDF          → uploadService.pickDocument()  [50 Mo max]
2. Upload Storage         → Supabase Storage (bucket documents)
3. Insertion DB           → table documents
4. Consommation session   → useSession.consumeSession()
5. Analyse IA             → Edge Function analyze-document → Claude Opus 4.6
6. Génération circuit     → Edge Function generate-circuit → table circuits + circuit_steps
7. Redirection            → /circuit/[id]
```

---

## Plans & Sessions

| Plan | Sessions/mois | Prix |
|---|---|---|
| Gratuit | 3 | 0 XOF |
| Starter | 20 | 2 500 XOF/mois |
| Pro | 100 | 7 500 XOF/mois |
| Entreprise | Illimité | 25 000 XOF/mois |

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
```

### Initialiser la base de données Supabase

#### Option A — CLI (recommandé)
```bash
supabase db push
```

#### Option B — Dashboard SQL Editor
Copier-coller le contenu de `supabase/migrations/20260414000000_init.sql` dans **SQL Editor → Run**.

Si la migration a déjà été partiellement appliquée (erreur "relation already exists"), exécuter uniquement ce correctif pour créer le trigger et les profils manquants :

```sql
-- Recréer la fonction trigger
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

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Créer les profils pour les utilisateurs existants sans profil
INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

### Déployer les Edge Functions

```bash
supabase functions deploy analyze-document
supabase functions deploy generate-circuit
supabase functions deploy generate-quiz
supabase functions deploy submit-quiz
supabase functions deploy initiate-payment
supabase functions deploy verify-payment
```

---

## Configuration Supabase (dashboard)

### Authentication
- **Authentication → Providers → Email** → désactiver **"Confirm email"** (pour le développement)
- La clé **anon public** (Settings → API) est un JWT commençant par `eyJ...` — ne pas confondre avec d'autres types de clés

### Confirmer manuellement un utilisateur existant
Si un compte a été créé avant la désactivation de "Confirm email" :

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'utilisateur@exemple.com';
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
