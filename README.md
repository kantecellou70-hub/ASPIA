# APSIA

Application mobile d'apprentissage intelligent — transforme vos PDF en parcours pédagogiques IA personnalisés avec quiz adaptatifs et paiement intégré.

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Expo ~54 / React Native 0.81 |
| Navigation | Expo Router v55 (file-based) |
| État global | Zustand v5 |
| Backend / Auth / DB | Supabase |
| Paiement | Kkiapay (Mobile Money) |
| Langage | TypeScript 5.9 strict |
| Build | EAS (Expo Application Services) |

## Structure du projet

```
app/                        # Routes Expo Router
  _layout.tsx               # Root layout (providers, auth listener)
  index.tsx                 # Redirect auth/no-auth
  (auth)/                   # Écrans d'authentification
    welcome.tsx
    login.tsx
    register.tsx
  (tabs)/                   # Navigation principale
    home.tsx
    upload.tsx
    library.tsx
    profile.tsx
  circuit/[id].tsx          # Détail d'un circuit
  quiz/[id].tsx             # Passage d'un quiz
  quiz/results/[id].tsx     # Résultats du quiz
  payment/
    plans.tsx               # Choix d'abonnement
    checkout.tsx            # Paiement Mobile Money

src/
  constants/                # Design system (theme, typography, config, layout)
  types/                    # Types TypeScript (auth, circuit, quiz, upload, payment)
  lib/                      # Clients tiers (supabase.ts)
  services/                 # Logique métier (auth, ai, upload, quiz, payment, profile)
  store/                    # Stores Zustand (auth, session, upload, ui)
  hooks/                    # Hooks personnalisés (useAuth, useUpload, useQuiz…)
  components/
    ui/                     # Composants de base (Button, Card, Input, Modal…)
    features/               # Composants métier (CircuitCard, QuestionCard, PlanCard…)
  utils/                    # Utilitaires (formatters, validators)
```

## Installation

### Prérequis

- Node.js 20+ (via [fnm](https://github.com/Schniz/fnm) ou nvm)
- Java 17 (`sudo apt install openjdk-17-jdk` sur Ubuntu)
- Android Studio avec SDK Android 34+ (pour l'émulateur)

### Démarrage rapide

```bash
# Cloner et installer
git clone <repo>
cd APSIA
npm install

# Configurer les variables d'environnement
cp .env.example .env
# → Remplir EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_KKIAPAY_API_KEY

# Lancer le serveur de développement
npx expo start

# Dans le menu Expo :
#   a → Android (émulateur ou appareil)
#   w → Web (navigateur)
#   Scan QR → Expo Go sur téléphone réel
```

### Variables d'environnement

Créez un fichier `.env` à la racine (voir `.env.example`) :

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key

EXPO_PUBLIC_KKIAPAY_API_KEY=votre-cle-publique
EXPO_PUBLIC_KKIAPAY_SANDBOX=true
```

## Configuration Android (Ubuntu)

### 1. Installer les dépendances système

```bash
# Java 17 (requis par Android SDK tools)
sudo apt update && sudo apt install -y openjdk-17-jdk

# Node.js 20+ via fnm
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20 && fnm use 20
```

### 2. Configurer les variables d'environnement

Ajoutez ces lignes dans `~/.bashrc` puis relancez le terminal (`source ~/.bashrc`) :

```bash
# Java
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"

# Android SDK (installé via Android Studio)
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# fnm (Node.js)
export PATH="/home/$USER/.local/share/fnm:$PATH"
eval "$(fnm env --use-on-cd --shell bash)"

# Android tools dans le PATH
export PATH="$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

### 3. Télécharger la system image Android

```bash
# Accepter les licences
sdkmanager --licenses

# Télécharger Android 34 avec Google Play (~1.5 Go)
sdkmanager "system-images;android-34;google_apis_playstore;x86_64"
```

### 4. Créer un AVD (émulateur)

```bash
# Créer un émulateur Pixel 6 — Android 34
echo "no" | avdmanager create avd \
  -n Pixel_API34 \
  -k "system-images;android-34;google_apis_playstore;x86_64" \
  -d "pixel_6"

# Vérifier que l'AVD est bien créé
emulator -list-avds
# → Pixel_API34
```

### 5. Lancer l'émulateur

```bash
# Lancer en arrière-plan
emulator @Pixel_API34 -no-snapshot-load &

# Attendre que le boot soit complet
adb wait-for-device
adb shell getprop sys.boot_completed
# → 1  (prêt)

# Vérifier que l'émulateur est détecté
adb devices
# → emulator-5554   device
```

### 6. Lancer l'app sur l'émulateur

```bash
cd ~/Documents/Projets/APSIA
fnm use 20
npx expo start
npx expo start --clear
npx expo install --fix
# Dans le menu interactif, appuyer sur : a
```

Expo installe automatiquement Expo Go et ouvre l'application.

> **Note :** Si Expo Go n'est pas installé automatiquement (mode offline), installez-le manuellement :
> ```bash
> wget -O /tmp/ExpoGo.apk https://d1ahtucjixef4r.cloudfront.net/Exponent-2.33.2.apk
> adb install -r /tmp/ExpoGo.apk
> ```

## Build production

```bash
# Preview APK (Android)
eas build --platform android --profile preview

# Production
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Architecture IA

L'analyse des PDF et la génération des circuits/quiz sont orchestrées par des **Supabase Edge Functions** (clés IA côté serveur uniquement) :

| Fonction | Rôle |
|---|---|
| `analyze-document` | Extraction du contenu PDF |
| `generate-circuit` | Création du parcours d'apprentissage |
| `generate-quiz` | Génération des questions |
| `submit-quiz` | Correction et calcul du score |
| `initiate-payment` | Initiation paiement Kkiapay |
| `verify-payment` | Vérification et mise à jour du plan |

## Plans & Sessions

| Plan | Sessions | Prix |
|---|---|---|
| Gratuit | 3 | 0 XOF |
| Starter | 20 | 2 500 XOF/mois |
| Pro | 100 | 7 500 XOF/mois |
| Entreprise | ∞ | 25 000 XOF/mois |

