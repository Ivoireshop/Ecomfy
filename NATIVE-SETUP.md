# 📱 Guide Build Natif Android + iOS — VisualPro

> Ce guide s'exécute **sur ton ordinateur** après avoir cloné le repo GitHub. Lovable ne peut pas compiler d'apps natives.

---

## Prérequis

- **Node.js 18+** et `npm`
- **Android Studio** (pour Android)
- **Mac + Xcode 14+** (pour iOS uniquement)
- `ffmpeg` (pour convertir le son — optionnel, le script le fera si présent)

---

## Étape 1 — Cloner et installer

```bash
git clone https://github.com/Ivoireshop/visualpro-african-ai-creations.git
cd visualpro-african-ai-creations
npm install
```

---

## Étape 2 — Ajouter les plateformes (FAIT CETTE ÉTAPE !)

### Android
```bash
npx cap add android
```

### iOS (Mac uniquement)
```bash
npx cap add ios
```

---

## Étape 3 — Build web + Sync natif

```bash
npm run build
npx cap sync
```

---

## Étape 4 — Copier le son de notification 💰

Le son `visualpro-cash.mp3` doit être converti en WAV et copié dans les ressources natives :

### Android
```bash
# Créer le dossier raw si besoin
mkdir -p android/app/src/main/res/raw

# Convertir en WAV (mono, 48kHz ou 44.1kHz recommandé)
ffmpeg -i public/sounds/visualpro-cash.mp3 -ar 48000 -ac 1 android/app/src/main/res/raw/visualpro_cash.wav
```

### iOS (Mac)
1. Ouvrir Xcode : `npx cap open ios`
2. Glisser `visualpro_cash.wav` (converti avec ffmpeg) dans le dossier **App** du projet
3. Cocher **"Copy items if needed"** et coche ta target

---

## Étape 5 — Firebase Android (obligatoire pour les push)

1. Va sur [Firebase Console](https://console.firebase.google.com/)
2. Crée un projet (ou utilise un existant)
3. Ajoute une app Android avec ce **package name** exact :
   ```
   app.lovable.8e12da65322f4003b2ce9fb33dc5ff21
   ```
4. Télécharge `google-services.json`
5. Copie-le ici :
   ```bash
   cp /chemin/vers/google-services.json android/app/google-services.json
   ```
6. Vérifie que les plugins sont bien dans `android/build.gradle` et `android/app/build.gradle` (le `cap sync` le fait normalement)

---

## Étape 6 — Lancer l'app

### Android
```bash
npx cap run android
```
Ou ouvre Android Studio : `npx cap open android`

### iOS (Mac)
```bash
npx cap run ios
```
Ou ouvre Xcode : `npx cap open ios`

---

## 🔁 Script tout-en-un (recommandé)

Après le `git clone` et `npm install`, tu peux aussi lancer :

```bash
bash scripts/setup-native.sh
```

Ce script fait automatiquement :
- Ajoute Android (+ iOS si sur Mac)
- Build + sync
- Convertit le son en WAV pour Android
- Affiche un récap des prochaines étapes manuelles (Firebase, iOS sound, lancement)

---

## 📋 Récap des commandes minimales

```bash
git clone https://github.com/Ivoireshop/visualpro-african-ai-creations.git
cd visualpro-african-ai-creations
npm install
bash scripts/setup-native.sh
# Puis suivre les instructions affichées à l'écran
```

---

## 🔄 Après chaque modification du code

```bash
npm run build
npx cap sync
# Relancer sur l'émulateur/appareil
```

---

## ⚠️ Notes importantes

- **L'app native se connecte à ton projet Lovable en ligne** (pas en local). Le `server.url` dans `capacitor.config.ts` pointe vers `https://8e12da65-322f-4003-b2ce-9fb33dc5ff21.lovableproject.com`
- Pour passer en mode "local" (sans internet), il faudrait embarquer le dossier `dist/` — contacte-moi si tu veux du offline complet.
- Les notifications push FCM nécessitent impérativement le `google-services.json`

---

*Dernière mise à jour : configuration Capacitor Android + iOS pour VisualPro*
