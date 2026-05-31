#!/usr/bin/env bash
# Tear down the Azure resources provisioned by scripts/deploy-aca.sh.
#
# Removes:
#   1. The resource group (Foundry, KV, ACR, ACA env, ACA app, MI, etc.)
#   2. Soft-deleted Key Vault entries (so the name can be reused)
#   3. Soft-deleted Cognitive Services accounts (Foundry)
#
# Preserved (not touched):
#   - docker-compose.override.yml (run 'rm docker-compose.override.yml' manually
#     if you want to return to local Docker mode)
#
# Required env vars:
#   POLYCLAW_SETUP_RG / POLYCLAW_RG  Azure resource group to delete
#
# Usage:
#   POLYCLAW_SETUP_RG=my-rg ./scripts/destroy-aca.sh        # interactive confirm
#   POLYCLAW_SETUP_RG=my-rg ./scripts/destroy-aca.sh --yes  # skip confirmation
#
# Safety:
#   Interactive mode requires typing the exact RG name to confirm.
#   --yes still prints the resource summary before deleting.

set -euo pipefail

# ---------- helpers --------------------------------------------------------

die() { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\033[36m[destroy-aca]\033[0m %s\n' "$*"; }
step() { printf '\n\033[33m[%s]\033[0m %s\n' "$1" "$2"; }

require() {
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null 2>&1 || die "$cmd not found in PATH"
    done
}

resolve_env() {
    local primary="${!1:-}"
    local fallback="${!2:-}"
    if [[ -n "$primary" && -n "$fallback" && "$primary" != "$fallback" ]]; then
        die "$1 and $2 have different values ('$primary' vs '$fallback')"
    fi
    printf '%s' "${primary:-${fallback:-}}"
}

# ---------- arg parsing ----------------------------------------------------

YES=0
for arg in "$@"; do
    case "$arg" in
        --yes|-y) YES=1 ;;
        --help|-h)
            sed -n '1,30p' "$0"
            exit 0
            ;;
        *) die "Unknown argument: $arg" ;;
    esac
done

RG="$(resolve_env POLYCLAW_SETUP_RG POLYCLAW_RG)"
[[ -n "$RG" ]] || die "POLYCLAW_SETUP_RG (or POLYCLAW_RG) is required"

# ---------- preflight ------------------------------------------------------

step "1/6" "preflight checks"
require az jq
az account show -o none 2>/dev/null || die "Run 'az login' first"

SUB_ID=$(az account show --query id -o tsv)
SUB_NAME=$(az account show --query name -o tsv)
log "subscription: $SUB_NAME ($SUB_ID)"

# ---------- inspect target RG ----------------------------------------------

step "2/6" "inspecting resource group '$RG'"

RG_EXISTS=1
if ! az group show -n "$RG" -o none 2>/dev/null; then
    log "RG '$RG' not found -- skipping RG delete (will still scan for soft-deleted resources)"
    RG_EXISTS=0
fi

# Pre-fetch KV/Foundry names + locations BEFORE deletion -- after RG delete
# we cannot retrieve them with `az resource list`.
KV_LIST=""
FOUNDRY_LIST=""
RESOURCE_COUNT=0

if [[ "$RG_EXISTS" -eq 1 ]]; then
    RESOURCES=$(az resource list -g "$RG" \
        --query "[].{name:name, type:type, location:location}" -o json)
    RESOURCE_COUNT=$(jq 'length' <<<"$RESOURCES")
    KV_LIST=$(jq -r '.[] | select(.type=="Microsoft.KeyVault/vaults") | "\(.name)|\(.location)"' <<<"$RESOURCES")
    FOUNDRY_LIST=$(jq -r '.[] | select(.type=="Microsoft.CognitiveServices/accounts") | "\(.name)|\(.location)"' <<<"$RESOURCES")
fi

KV_COUNT=$(printf '%s\n' "$KV_LIST" | grep -c '^[^[:space:]]' || true)
FOUNDRY_COUNT=$(printf '%s\n' "$FOUNDRY_LIST" | grep -c '^[^[:space:]]' || true)

# ---------- summary --------------------------------------------------------

step "3/6" "destruction plan"
cat <<EOF
==========================================================
  Subscription:   $SUB_NAME ($SUB_ID)
  Resource Group: $RG  $([ "$RG_EXISTS" -eq 1 ] && echo "(EXISTS)" || echo "(NOT FOUND)")
  Resources:      $RESOURCE_COUNT
  Key Vaults:     $KV_COUNT  (will be purged from soft-delete)
  Foundries:      $FOUNDRY_COUNT  (will be purged from soft-delete)
==========================================================
EOF

if [[ "$KV_COUNT" -gt 0 ]]; then
    printf '  KV targets:\n'
    while IFS='|' read -r n l; do [[ -n "$n" ]] && printf '    - %s (%s)\n' "$n" "$l"; done <<<"$KV_LIST"
fi
if [[ "$FOUNDRY_COUNT" -gt 0 ]]; then
    printf '  Foundry targets:\n'
    while IFS='|' read -r n l; do [[ -n "$n" ]] && printf '    - %s (%s)\n' "$n" "$l"; done <<<"$FOUNDRY_LIST"
fi
echo ""

# ---------- confirmation ---------------------------------------------------

if [[ "$RG_EXISTS" -eq 1 ]]; then
    if [[ $YES -eq 1 ]]; then
        log "--yes specified; proceeding without typed confirmation"
    else
        printf "To confirm DELETION, type the resource group name exactly:\n  > "
        read -r REPLY
        # Strict comparison (no trim) -- accidental whitespace should fail
        if [[ "$REPLY" != "$RG" ]]; then
            die "Confirmation mismatch ('$REPLY' != '$RG'). Aborted."
        fi
    fi

    # ---------- delete RG --------------------------------------------------

    step "4/6" "deleting resource group (may take 5-15 min)"
    az group delete -n "$RG" -y --no-wait
    log "delete initiated (async). Waiting for completion..."

    POLL_INTERVAL=30
    POLL_MAX=60   # 30 min cap
    POLL_COUNT=0
    while az group show -n "$RG" -o none 2>/dev/null; do
        POLL_COUNT=$((POLL_COUNT + 1))
        if [[ $POLL_COUNT -gt $POLL_MAX ]]; then
            log "WARNING: RG still exists after $(( POLL_MAX * POLL_INTERVAL / 60 )) min. Proceeding anyway."
            break
        fi
        sleep "$POLL_INTERVAL"
        printf '  ... waiting (%dm elapsed)\n' "$(( POLL_COUNT * POLL_INTERVAL / 60 ))"
    done
    log "RG deletion confirmed (or polling cap reached)"
else
    step "4/6" "skipping RG delete (RG does not exist)"
fi

# ---------- purge soft-deleted Key Vaults ----------------------------------

step "5/6" "purging soft-deleted Key Vaults"
if [[ "$KV_COUNT" -eq 0 ]]; then
    log "no Key Vaults to purge"
else
    while IFS='|' read -r NAME LOC; do
        [[ -z "$NAME" ]] && continue
        # Verify it is actually in the soft-deleted list before purging.
        if az keyvault list-deleted --query "[?name=='$NAME'] | [0]" -o json 2>/dev/null \
                | jq -e '.name' >/dev/null 2>&1; then
            log "purging KV: $NAME ($LOC)"
            if ! az keyvault purge -n "$NAME" -l "$LOC" -o none 2>/dev/null; then
                log "  WARNING: purge failed for $NAME (continuing)"
            fi
        else
            log "KV $NAME not in soft-delete list (may already be purged) -- skipping"
        fi
    done <<<"$KV_LIST"
fi

# ---------- purge soft-deleted Cognitive Services (Foundry) ----------------

step "6/6" "purging soft-deleted Cognitive Services accounts"
if [[ "$FOUNDRY_COUNT" -eq 0 ]]; then
    log "no Cognitive Services accounts to purge"
else
    while IFS='|' read -r NAME LOC; do
        [[ -z "$NAME" ]] && continue
        # az cognitiveservices account purge requires --name, --location, --resource-group
        # The RG here is the original RG (the deleted accounts retain their RG reference).
        if az cognitiveservices account list-deleted --query "[?name=='$NAME'] | [0]" -o json 2>/dev/null \
                | jq -e '.name' >/dev/null 2>&1; then
            log "purging Foundry: $NAME ($LOC)"
            if ! az cognitiveservices account purge \
                    -n "$NAME" -l "$LOC" -g "$RG" -o none 2>/dev/null; then
                log "  WARNING: purge failed for $NAME (continuing)"
            fi
        else
            log "Foundry $NAME not in soft-delete list (may already be purged) -- skipping"
        fi
    done <<<"$FOUNDRY_LIST"
fi

# ---------- summary --------------------------------------------------------

cat <<EOF

==========================================================
  ✅ Destroy complete
==========================================================
  Deleted RG:     $RG
  Purged KVs:     $KV_COUNT
  Purged Foundry: $FOUNDRY_COUNT

  Note: docker-compose.override.yml is preserved.
  To return to local Docker mode:
    rm docker-compose.override.yml
    docker compose down && docker compose up -d
==========================================================
EOF
