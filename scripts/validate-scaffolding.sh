#!/bin/bash

# Script de validation pour le ticket 01-scaffolding-expo
# Vérifie tous les critères d'acceptation

set -e

echo "=== Validation du scaffolding Expo ==="
echo ""

# Couleurs pour les résultats
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour vérifier un critère
check() {
  local description="$1"
  local command="$2"
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $description"
    return 0
  else
    echo -e "${RED}✗${NC} $description"
    return 1
  fi
}

# Vérification des critères
errors=0

check "Le dossier mobile/ existe" "[ -d 'mobile' ]" || ((errors++))
check "Le fichier package.json existe" "[ -f 'mobile/package.json' ]" || ((errors++))
check "Le fichier tsconfig.json existe" "[ -f 'mobile/tsconfig.json' ]" || ((errors++))
check "Le fichier eas.json existe" "[ -f 'mobile/eas.json' ]" || ((errors++))
check "Le fichier .env existe" "[ -f 'mobile/.env' ]" || ((errors++))
check "Le fichier tailwind.config.js existe" "[ -f 'mobile/tailwind.config.js' ]" || ((errors++))
check "Le fichier babel.config.js existe" "[ -f 'mobile/babel.config.js' ]" || ((errors++))
check "Le fichier metro.config.js existe" "[ -f 'mobile/metro.config.js' ]" || ((errors++))
check "Le fichier nativewind-env.d.ts existe" "[ -f 'mobile/nativewind-env.d.ts' ]" || ((errors++))
check "Le dossier src/app existe" "[ -d 'mobile/src/app' ]" || ((errors++))
check "Le dossier (tabs) existe" "[ -d 'mobile/src/app/(tabs)' ]" || ((errors++))
check "Le dossier (auth) existe" "[ -d 'mobile/src/app/(auth)' ]" || ((errors++))

# Vérification des contenus
check "TypeScript strict est activé" "grep -q '\"strict\": true' mobile/tsconfig.json" || ((errors++))
check "EXPO_PUBLIC_API_URL est défini" "grep -q 'EXPO_PUBLIC_API_URL=http://localhost:8000' mobile/.env" || ((errors++))
check "eas.json contient le profil preview" "grep -q '\"preview\"' mobile/eas.json" || ((errors++))
check "eas.json contient le profil production" "grep -q '\"production\"' mobile/eas.json" || ((errors++))
check "package.json a le bon nom" "grep -q '\"name\": \"ifvm-mobile\"' mobile/package.json" || ((errors++))
check "package.json a le bon slug" "grep -q '\"slug\": \"ifvm-mobile\"' mobile/package.json" || ((errors++))

echo ""
echo "=== Résumé ==="
if [ $errors -eq 0 ]; then
  echo -e "${GREEN}Tous les critères sont remplis !${NC}"
  exit 0
else
  echo -e "${RED}$errors critère(s) non rempli(s)${NC}"
  exit 1
fi
