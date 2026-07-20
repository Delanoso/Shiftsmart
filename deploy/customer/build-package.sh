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

# Fresh empty data for a new customer
mkdir -p "${PKG}/data"
cat > "${PKG}/data/sessions.json" <<'EOF'
{
  "sessions": []
}
EOF
cat > "${PKG}/data/employees.json" <<'EOF'
{
  "companyId": "company-1",
  "companyName": "Your Company Name",
  "employees": []
}
EOF
# Keep company.json from the package but ensure sites start empty
python3 - "$PKG/data/company.json" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
data["sites"] = []
data["vendorName"] = ""
data.setdefault("clientCompanyName", "Your Company Name")
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

(cd "$TMP" && zip -rq "${OUT_DIR}/${ZIP_NAME}" shiftsmart-fatigue-check)
rm -rf "$TMP"

echo "Created ${OUT_DIR}/${ZIP_NAME}"
