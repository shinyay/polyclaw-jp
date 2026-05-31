#!/usr/bin/env bash
# Deploy polyclaw runtime to Azure Container Apps via the admin REST API.
#
# This script automates the curl-based deployment path verified end-to-end
# on 2026-05-31 (PR-A RBAC fix).  It is more reliable than the TUI wizard
# (which has known socket-close issues during long-running ACA deploys).
#
# Required env vars (POLYCLAW_SETUP_* takes precedence over POLYCLAW_*):
#   POLYCLAW_SETUP_RG / POLYCLAW_RG          Azure resource group name
#
# Optional env vars:
#   POLYCLAW_SETUP_LOCATION / POLYCLAW_LOCATION    (default: eastus)
#   POLYCLAW_SETUP_BASE_NAME / POLYCLAW_BASE_NAME  (default: auto-generated)
#   POLYCLAW_IMAGE_TAG                              (default: latest)
#   POLYCLAW_RUNTIME_PORT                           (default: 8080)
#   POLYCLAW_ADMIN_PORT                             (default: 9090)
#
# Usage:
#   POLYCLAW_SETUP_RG=my-rg ./scripts/deploy-aca.sh
#
# Idempotency:
#   - Foundry: skipped if /api/setup/foundry/status returns deployed=true with models
#   - ACA: always re-deployed (API internally cleans stale resources)

set -euo pipefail

# ---------- helpers --------------------------------------------------------

die() { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m[deploy-aca]\033[0m %s\n' "$*"; }
step() { printf '\n\033[33m[%s]\033[0m %s\n' "$1" "$2"; }

require() {
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null 2>&1 || die "$cmd not found in PATH"
    done
}

resolve_env() {
    # $1 = primary name (POLYCLAW_SETUP_*), $2 = fallback (POLYCLAW_*), $3 = default
    local primary="${!1:-}"
    local fallback="${!2:-}"
    if [[ -n "$primary" && -n "$fallback" && "$primary" != "$fallback" ]]; then
        die "$1 and $2 have different values ('$primary' vs '$fallback')"
    fi
    printf '%s' "${primary:-${fallback:-${3:-}}}"
}

# ---------- env resolution -------------------------------------------------

RG="$(resolve_env POLYCLAW_SETUP_RG POLYCLAW_RG '')"
LOCATION="$(resolve_env POLYCLAW_SETUP_LOCATION POLYCLAW_LOCATION 'eastus')"
BASE_NAME="$(resolve_env POLYCLAW_SETUP_BASE_NAME POLYCLAW_BASE_NAME '')"
IMAGE_TAG="${POLYCLAW_IMAGE_TAG:-latest}"
RUNTIME_PORT="${POLYCLAW_RUNTIME_PORT:-8080}"
ADMIN_PORT="${POLYCLAW_ADMIN_PORT:-9090}"

[[ -n "$RG" ]] || die "POLYCLAW_SETUP_RG (or POLYCLAW_RG) is required"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---------- preflight ------------------------------------------------------

step "1/8" "preflight checks"
require az docker jq curl
docker compose version >/dev/null 2>&1 || die "docker compose v2 required"
docker info >/dev/null 2>&1 || die "docker daemon not accessible"
az account show -o none 2>/dev/null || die "Run 'az login' first"

HOST_SUB_ID=$(az account show --query id -o tsv)
HOST_SUB_NAME=$(az account show --query name -o tsv)
log "host subscription: $HOST_SUB_NAME ($HOST_SUB_ID)"
log "target: rg=$RG location=$LOCATION image_tag=$IMAGE_TAG"

# Local image existence
if ! docker image inspect "polyclaw:${IMAGE_TAG}" >/dev/null 2>&1; then
    log "image polyclaw:${IMAGE_TAG} not found locally -- building (this takes 3-5 min)"
    docker compose build admin || die "docker compose build failed"
fi

# ---------- prepare admin container ----------------------------------------

step "2/8" "ensuring admin container is healthy"

# Stop local runtime container if running -- we will use ACA instead.
if docker ps --filter "name=^polyclaw-runtime$" --format '{{.Names}}' | grep -q .; then
    log "stopping local polyclaw-runtime (we use ACA)"
    docker stop polyclaw-runtime >/dev/null || true
    docker rm polyclaw-runtime >/dev/null 2>&1 || true
fi

docker compose up -d admin

# Wait for admin /health
for i in {1..30}; do
    if curl -sf -m 3 "http://localhost:${ADMIN_PORT}/health" >/dev/null 2>&1; then
        break
    fi
    [[ $i -eq 30 ]] && die "admin /health did not respond within 60s"
    sleep 2
done
log "admin is healthy (http://localhost:${ADMIN_PORT})"

# ---------- read admin secret ----------------------------------------------

step "3/8" "fetching ADMIN_SECRET from admin container"
# cut -d= -f2- captures values containing '=' (token may include it).
ADMIN_SECRET=$(docker exec polyclaw-admin sh -c 'grep "^ADMIN_SECRET=" /data/.env | cut -d= -f2-' | tr -d '"' | tr -d "'" | tr -d '\r')
[[ -n "$ADMIN_SECRET" ]] || die "ADMIN_SECRET not found in admin container"
log "admin secret: ${ADMIN_SECRET:0:8}... (length=${#ADMIN_SECRET})"

# ---------- verify admin az auth -------------------------------------------

step "4/8" "verifying Azure auth inside admin container"
# entrypoint sets HOME=/admin-home; docker exec inherits default HOME=/root.
# Pass HOME/AZURE_CONFIG_DIR explicitly so `az` reads the mounted creds.
ADMIN_SUB_ID=$(docker exec -e HOME=/admin-home -e AZURE_CONFIG_DIR=/admin-home/.azure \
    polyclaw-admin az account show --query id -o tsv 2>/dev/null || echo "")
if [[ -z "$ADMIN_SUB_ID" ]]; then
    die "admin container is not authenticated with Azure. Bind-mount ~/.azure via docker-compose.override.yml."
fi
if [[ "$ADMIN_SUB_ID" != "$HOST_SUB_ID" ]]; then
    log "WARNING: host subscription ($HOST_SUB_ID) differs from admin ($ADMIN_SUB_ID)"
    log "         ACA deploy will use the admin subscription."
fi

# ---------- API helper -----------------------------------------------------

API() {
    # $1=timeout_sec  $2=method  $3=path  $4=json_body (optional)
    local timeout="$1" method="$2" path="$3" body="${4:-}"
    if [[ -n "$body" ]]; then
        curl --fail-with-body -sS -m "$timeout" -X "$method" \
            "http://localhost:${ADMIN_PORT}${path}" \
            -H "Authorization: Bearer $ADMIN_SECRET" \
            -H "Content-Type: application/json" \
            -d "$body"
    else
        curl --fail-with-body -sS -m "$timeout" -X "$method" \
            "http://localhost:${ADMIN_PORT}${path}" \
            -H "Authorization: Bearer $ADMIN_SECRET"
    fi
}

# ---------- Foundry: skip if already deployed AND verified in Azure --------

step "5/8" "checking Foundry status"
F_STATUS=$(API 30 GET /api/setup/foundry/status)
F_DEPLOYED=$(jq -r '.deployed // false' <<<"$F_STATUS")
F_MODEL_COUNT=$(jq -r '.deployed_models | length' <<<"$F_STATUS")
F_NAME=$(jq -r '.foundry_name // empty' <<<"$F_STATUS")
F_RG=$(jq -r '.foundry_resource_group // empty' <<<"$F_STATUS")

# Cross-check: status API reads /data/.env which can be stale after a
# manual Azure delete.  Require the actual Cognitive Services account to
# exist in Azure before skipping.
SKIP_FOUNDRY=0
if [[ "$F_DEPLOYED" == "true" && "$F_MODEL_COUNT" -gt 0 && -n "$F_NAME" && -n "$F_RG" ]]; then
    if az cognitiveservices account show -n "$F_NAME" -g "$F_RG" -o none 2>/dev/null; then
        SKIP_FOUNDRY=1
    else
        log "Foundry $F_NAME marked deployed in admin .env but NOT found in Azure -- forcing redeploy"
    fi
fi

if [[ "$SKIP_FOUNDRY" -eq 1 ]]; then
    log "Foundry already deployed: name=$F_NAME models=$F_MODEL_COUNT -- skipping"
else
    log "deploying Foundry (1-2 min) ..."
    F_BODY=$(jq -nc \
        --arg rg "$RG" --arg loc "$LOCATION" --arg bn "$BASE_NAME" \
        '{resource_group:$rg, location:$loc, base_name:$bn, deploy_key_vault:true}')
    F_RESP=$(API 600 POST /api/setup/foundry/deploy "$F_BODY") \
        || { echo "$F_RESP" | jq . >&2 2>/dev/null || echo "$F_RESP" >&2; die "Foundry deploy failed"; }
    F_NAME=$(jq -r '.foundry_name // empty' <<<"$F_RESP")
    F_MODELS=$(jq -r '.deployed_models | length' <<<"$F_RESP")
    log "  -> Foundry: $F_NAME ($F_MODELS models)"
fi

# ---------- ACA: always deploy (API cleans stale resources) ----------------

step "6/8" "deploying to Azure Container Apps (7-10 min, max 45 min)"
A_BODY=$(jq -nc \
    --arg rg "$RG" --arg loc "$LOCATION" \
    --argjson rp "$RUNTIME_PORT" --argjson ap "$ADMIN_PORT" \
    --arg tag "$IMAGE_TAG" \
    '{resource_group:$rg, location:$loc, runtime_port:$rp, admin_port:$ap, image_tag:$tag}')
A_RESP=$(API 2700 POST /api/setup/aca/deploy "$A_BODY") \
    || { echo "$A_RESP" | jq . >&2 2>/dev/null || echo "$A_RESP" >&2; die "ACA deploy failed"; }

FQDN=$(jq -r '.runtime_fqdn // empty' <<<"$A_RESP")
[[ -n "$FQDN" ]] || { echo "$A_RESP" | jq . >&2; die "no runtime_fqdn in response"; }

# Surface any failed steps even on overall success
FAILED_STEPS=$(jq -r '[.steps[]? | select(.status=="failed")] | length' <<<"$A_RESP" 2>/dev/null || echo 0)
if [[ "$FAILED_STEPS" -gt 0 ]]; then
    log "WARNING: $FAILED_STEPS step(s) reported failure (non-fatal):"
    jq -r '.steps[]? | select(.status=="failed") | "  - \(.step): \(.detail)"' <<<"$A_RESP" >&2 || true
fi
log "  -> ACA FQDN: $FQDN"

# Probe runtime health from host
if curl -sf -m 10 "https://${FQDN}/health" >/dev/null 2>&1; then
    log "  -> runtime /health: 200 OK"
else
    log "  -> WARNING: runtime /health unreachable (may be IP-whitelisted)"
fi

# ---------- write docker-compose.override.yml ------------------------------

step "7/8" "writing docker-compose.override.yml (ACA proxy mode)"

OVERRIDE_FILE="$REPO_ROOT/docker-compose.override.yml"
if [[ -f "$OVERRIDE_FILE" ]]; then
    BACKUP="$OVERRIDE_FILE.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$OVERRIDE_FILE" "$BACKUP"
    log "backed up existing override -> $(basename "$BACKUP")"
fi

cat > "$OVERRIDE_FILE" <<EOF
# Auto-generated by scripts/deploy-aca.sh on $(date -Iseconds)
# Switches the local admin container into ACA proxy mode.
# To return to local Docker mode: rm this file, then 'docker compose up -d'
services:
  admin:
    volumes:
      - ${HOME}/.azure:/admin-home/.azure
    environment:
      RUNTIME_URL: "https://${FQDN}"
      POLYCLAW_USE_MI: "1"
EOF
log "wrote $OVERRIDE_FILE"

# ---------- restart admin in ACA proxy mode --------------------------------

step "8/8" "restarting admin in ACA proxy mode"
docker compose up -d admin

for i in {1..30}; do
    if curl -sf -m 3 "http://localhost:${ADMIN_PORT}/health" >/dev/null 2>&1; then
        break
    fi
    [[ $i -eq 30 ]] && die "admin /health did not respond after restart"
    sleep 2
done
log "admin restarted -- proxying to https://${FQDN}"

# ---------- summary --------------------------------------------------------

cat <<EOF

==========================================================
  ✅ ACA deployment complete
==========================================================
  Browser UI:     http://localhost:${ADMIN_PORT}/?secret=${ADMIN_SECRET}
  ACA runtime:    https://${FQDN}
  Resource group: $RG ($LOCATION)
  Foundry:        ${F_NAME:-(unknown)}
==========================================================

Cleanup (when finished):
  POLYCLAW_SETUP_RG=$RG ./scripts/destroy-aca.sh
EOF
