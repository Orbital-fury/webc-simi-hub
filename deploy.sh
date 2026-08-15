#!/bin/bash
set -e

# Configuration
PI_USER="orbital"
PI_HOST="192.168.1.201"
SOURCE_DIR="./dist/webc-simi-hub/"
TARGET_DIR="apps/webc-simi/dist/hub"
TEMP_DIR="apps/webc-simi/dist/hub_temp"

echo "🔄 Préparation du dossier temporaire sur le Pi..."
ssh ${PI_USER}@${PI_HOST} "
  if [ -d '${TARGET_DIR}' ]; then
    rm -rf '${TEMP_DIR}'
    mv '${TARGET_DIR}' '${TEMP_DIR}'
  fi
  mkdir -p '${TARGET_DIR}'
"

echo "🚀 Transfert avec rsync..."
if rsync -avz --delete --exclude='.git/' --filter=':- .gitignore' ${SOURCE_DIR} ${PI_USER}@${PI_HOST}:${TARGET_DIR}; then
  echo "✅ Transfert réussi ! Suppression de la sauvegarde temporaire..."
  ssh ${PI_USER}@${PI_HOST} "rm -rf '${TEMP_DIR}'"
else
  echo "❌ Échec du transfert ! Restauration de la version précédente..."
  ssh ${PI_USER}@${PI_HOST} "
    rm -rf '${TARGET_DIR}'
    if [ -d '${TEMP_DIR}' ]; then
      mv '${TEMP_DIR}' '${TARGET_DIR}'
    fi
  "
  exit 1
fi

echo "🎉 Déploiement terminé avec succès !"