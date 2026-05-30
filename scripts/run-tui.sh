#!/usr/bin/env bash
# Launch the Polyclaw TUI (app/tui) -- the updated CLI that can manage
# the backend and frontend from an interactive terminal UI.
#
# Usage:
#   ./scripts/run-tui.sh          # admin mode (default)
#   ./scripts/run-tui.sh bot      # headless bot mode
#   ./scripts/run-tui.sh --help
set -euo pipefail

# --- R2-pure local development: refresh runtime Azure credentials --------
#
# When polyclaw-runtime is started via docker compose locally (without
# managed identity or service principal env), the BYOK auth path needs
# the host's `az login` credentials in /runtime-home/.azure/.  Without
# this, the first chat send times out with "model did not respond"
# (actual cause: `az get-access-token` fails with "Please run 'az login'").
#
# This block runs idempotently before every TUI launch and is safe to
# skip when the runtime container is not present (e.g. Azure deploy).
# See docs/local-dev/runtime-auth.md for details.
if command -v docker >/dev/null 2>&1 \
    && docker inspect --type container polyclaw-runtime >/dev/null 2>&1 \
    && [[ -d "${HOME}/.azure" ]]; then
    echo "[run-tui] Refreshing polyclaw-runtime Azure credentials from host ~/.azure/ ..."
    if docker cp "${HOME}/.azure/." polyclaw-runtime:/runtime-home/.azure/ >/dev/null 2>&1; then
        echo "[run-tui]   done."
    else
        echo "[run-tui]   WARNING: docker cp failed -- continuing anyway." >&2
    fi
fi

exec "$(dirname "$0")/../app/tui/run.sh" "$@"
