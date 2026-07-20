#!/usr/bin/env bash
# Builds a customer install zip (no node_modules) for Option 2 handoff.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/dist-packages"
STAMP="$(date +%Y%m%d)"
ZIP_NAME="shiftsmart-fatigue-check-customer-${STAMP}.zip"

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
PKG="${TMP}/shiftsmart-fatigue-check"
mkdir -p "$PKG"

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude dist-packages \
  --exclude .git \
  --exclude .env \
  --exclude data/sessions.json \
  --exclude 'data/*.db' \
  --exclude 'data/*.db-*' \
  "${ROOT}/" "${PKG}/"

# Fresh session store for new customer
echo '{"sessions":[]}' > "${PKG}/data/sessions.json"

(cd "$TMP" && zip -rq "${OUT_DIR}/${ZIP_NAME}" shiftsmart-fatigue-check)
rm -rf "$TMP"

echo "Created ${OUT_DIR}/${ZIP_NAME}"
