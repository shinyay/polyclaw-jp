#!/bin/bash
# -----------------------------------------------------------------------------
# Deploy ghrunner-aci-10 (ACI-based GitHub Actions self-hosted runner)
# for shinyay/polyclaw-jp.
#
# Pattern: ephemeral runner with GH_PAT-based self-minting registration token.
# Source: https://github.com/shinyay/getting-started-with-self-hosted-runners
#         (docs/runner-registry.md — "How to Add a New Runner")
#
# PREREQUISITES (one-time):
#   1. Set GH_PAT in your shell BEFORE running this script:
#        export GH_PAT='github_pat_xxx...'
#      (DO NOT commit the PAT or paste it in chat.)
#      Use the existing ghrunner-self-mint PAT — its scope is
#      "All repositories" so no scope update is needed for new runners.
#   2. az login + az account set with access to ghrunner-rg.
# -----------------------------------------------------------------------------

set -euo pipefail

# --- Configuration ---
RESOURCE_GROUP="ghrunner-rg"
ACR_NAME="shinyayacr202604"
RUNNER_NAME="ghrunner-aci-10"
RUNNER_REPO="shinyay/polyclaw-jp"
RUNNER_IMAGE="${ACR_NAME}.azurecr.io/ghrunner:latest"
RUNNER_LABELS="azure,linux,x64,aci"
CPU=2
MEMORY=4

# --- Preflight ---
if [[ -z "${GH_PAT:-}" ]]; then
  echo "ERROR: GH_PAT environment variable is not set." >&2
  echo "  Run: export GH_PAT='github_pat_xxx...'" >&2
  echo "  (Use ghrunner-self-mint PAT with Administration: Read & write scope)" >&2
  exit 1
fi

echo ">>> Fetching ACR credentials..."
ACR_USERNAME=$(az acr credential show -n "${ACR_NAME}" \
  --resource-group "${RESOURCE_GROUP}" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show -n "${ACR_NAME}" \
  --resource-group "${RESOURCE_GROUP}" --query "passwords[0].value" -o tsv)

# --- Deploy ACI container ---
echo ">>> Deploying ${RUNNER_NAME} (ephemeral mode) for ${RUNNER_REPO}..."
az container create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${RUNNER_NAME}" \
  --image "${RUNNER_IMAGE}" \
  --registry-login-server "${ACR_NAME}.azurecr.io" \
  --registry-username "${ACR_USERNAME}" \
  --registry-password "${ACR_PASSWORD}" \
  --cpu "${CPU}" \
  --memory "${MEMORY}" \
  --os-type Linux \
  --restart-policy Always \
  --environment-variables \
    "GITHUB_URL=https://github.com/${RUNNER_REPO}" \
    "RUNNER_NAME=${RUNNER_NAME}" \
    "RUNNER_LABELS=${RUNNER_LABELS}" \
    "EPHEMERAL=true" \
  --secure-environment-variables \
    "GH_PAT=${GH_PAT}"

echo ""
echo ">>> Container deployed. Waiting 10 s for startup..."
sleep 10

# --- Verify ---
echo ""
echo ">>> Container state:"
az container show --resource-group "${RESOURCE_GROUP}" --name "${RUNNER_NAME}" \
  --query "{Name:name, State:instanceView.state, RestartCount:instanceView.restartCount}" -o table

echo ""
echo ">>> Container logs (full):"
az container logs --resource-group "${RESOURCE_GROUP}" --name "${RUNNER_NAME}" 2>&1 | tail -50 || true

echo ""
echo ">>> Runner registration in GitHub:"
GH_TOKEN="${GH_PAT}" gh api "repos/${RUNNER_REPO}/actions/runners" \
  --jq '.runners[] | select(.name == "'${RUNNER_NAME}'") | {name, status, labels: [.labels[].name]}'

echo ""
echo "============================================================"
echo " Deployment complete. Next steps:"
echo "   1. Verify runner status is 'online' above"
echo "   2. Enable fork Actions: https://github.com/${RUNNER_REPO}/actions"
echo "   3. Push a commit to trigger CI"
echo "============================================================"
