#!/usr/bin/env bash
set -e

echo "=================================="
echo "  VisualPro — Setup Natif"
echo "  Android + iOS (Capacitor)"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect OS
OS="$(uname -s)"
IS_MAC=false
if [ "$OS" = "Darwin" ]; then
  IS_MAC=true
fi

echo -e "${GREEN}✓${NC} OS détecté : $OS"
echo ""

# Step 1: Add platforms
echo "----------------------------------"
echo "Étape 1/4 : Ajout des plateformes"
echo "----------------------------------"

if [ ! -d "android" ]; then
  echo "→ Ajout d'Android..."
  npx cap add android
  echo -e "${GREEN}✓${NC} Android ajouté"
else
  echo -e "${YELLOW}⚠${NC} Android déjà présent — skip"
fi

if [ "$IS_MAC" = true ]; then
  if [ ! -d "ios" ]; then
    echo "→ Ajout d'iOS..."
    npx cap add ios
    echo -e "${GREEN}✓${NC} iOS ajouté"
  else
    echo -e "${YELLOW}⚠${NC} iOS déjà présent — skip"
  fi
else
  echo -e "${YELLOW}⚠${NC} iOS non ajouté (Mac requis)"
fi

echo ""

# Step 2: Build web + sync
echo "----------------------------------"
echo "Étape 2/4 : Build web + Sync natif"
echo "----------------------------------"
npm run build
echo -e "${GREEN}✓${NC} Build web terminé"
npx cap sync
echo -e "${GREEN}✓${NC} Sync natif terminé"

echo ""

# Step 3: Convert + copy sound
echo "----------------------------------"
echo "Étape 3/4 : Son de notification"
echo "----------------------------------"

SOUND_SRC="public/sounds/visualpro-cash.mp3"
ANDROID_RAW="android/app/src/main/res/raw"
ANDROID_SOUND="$ANDROID_RAW/visualpro_cash.wav"

if command -v ffmpeg &> /dev/null; then
  mkdir -p "$ANDROID_RAW"
  if [ ! -f "$ANDROID_SOUND" ]; then
    echo "→ Conversion MP3 → WAV (Android)..."
    ffmpeg -y -i "$SOUND_SRC" -ar 48000 -ac 1 "$ANDROID_SOUND" > /dev/null 2>&1
    echo -e "${GREEN}✓${NC} Son copié dans android/app/src/main/res/raw/visualpro_cash.wav"
  else
    echo -e "${YELLOW}⚠${NC} Son Android déjà présent — skip"
  fi
else
  echo -e "${RED}✗${NC} ffmpeg non trouvé. Installe-le puis convertis manuellement :"
  echo "    ffmpeg -i public/sounds/visualpro-cash.mp3 -ar 48000 -ac 1 android/app/src/main/res/raw/visualpro_cash.wav"
fi

if [ "$IS_MAC" = true ]; then
  IOS_SOUND="ios/App/App/visualpro_cash.wav"
  if [ ! -f "$IOS_SOUND" ]; then
    if command -v ffmpeg &> /dev/null; then
      echo "→ Conversion MP3 → WAV (iOS)..."
      ffmpeg -y -i "$SOUND_SRC" -ar 48000 -ac 1 "$IOS_SOUND" > /dev/null 2>&1
      echo -e "${GREEN}✓${NC} Son copié dans ios/App/App/visualpro_cash.wav"
      echo ""
      echo -e "${YELLOW}IMPORTANT :${NC} Ouvre Xcode et ajoute ce fichier à la target App :"
      echo "    npx cap open ios"
    else
      echo -e "${RED}✗${NC} ffmpeg non trouvé pour iOS"
    fi
  else
    echo -e "${YELLOW}⚠${NC} Son iOS déjà présent — skip"
  fi
fi

echo ""

# Step 4: Check for google-services.json
echo "----------------------------------"
echo "Étape 4/4 : Vérifications"
echo "----------------------------------"

if [ ! -f "android/app/google-services.json" ]; then
  echo -e "${RED}✗${NC} google-services.json MANQUANT"
  echo ""
  echo "→ Va sur https://console.firebase.google.com/"
  echo "→ Crée un projet, ajoute une app Android avec le package :"
  echo "    cloud.visuelpro.app"
  echo "→ Télécharge google-services.json et place-le dans :"
  echo "    android/app/google-services.json"
  echo ""
else
  echo -e "${GREEN}✓${NC} google-services.json présent"
fi

echo ""
echo "=================================="
echo "  RÉCAPITULATIF"
echo "=================================="
echo ""

if [ -d "android" ]; then
  echo -e "${GREEN}✓${NC} Android : prêt"
  echo "  Lancer : npx cap run android"
  echo "  Ou     : npx cap open android (Android Studio)"
  echo ""
fi

if [ "$IS_MAC" = true ] && [ -d "ios" ]; then
  echo -e "${GREEN}✓${NC} iOS : prêt"
  echo "  Lancer : npx cap run ios"
  echo "  Ou     : npx cap open ios (Xcode)"
  echo ""
fi

echo "----------------------------------"
echo "Prochaines étapes manuelles :"
echo "----------------------------------"

if [ ! -f "android/app/google-services.json" ]; then
  echo "  1. Ajouter google-services.json (Firebase)"
fi
if [ "$IS_MAC" = true ] && [ -f "ios/App/App/visualpro_cash.wav" ]; then
  echo "  • Ouvrir Xcode et inclure visualpro_cash.wav dans la target"
fi
echo "  • Activer les permissions Push Notifications dans Xcode (iOS)"
echo "  • Tester sur un vrai appareil (les push ne fonctionnent pas sur simulateur iOS)"
echo ""
echo "À chaque modification du code :"
echo "    npm run build && npx cap sync"
echo ""
