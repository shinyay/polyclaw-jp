"""Tests for assign_rbac -- Foundry + Key Vault role assignments to runtime MI."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.runtime.services.deployment._models import StepTracker
from app.runtime.services.deployment.aca_provision import assign_rbac


@pytest.fixture()
def az() -> MagicMock:
    """az mock that always returns ok=True with empty stderr."""
    mock = MagicMock()
    mock.account_info.return_value = {"id": "sub-test-1234"}
    mock.ok.return_value = (True, "ok")
    mock.last_stderr = ""
    return mock


@pytest.fixture()
def steps() -> StepTracker:
    return StepTracker()


def _scopes_from_calls(az: MagicMock) -> list[str]:
    """Extract --scope argument from every az.ok call."""
    scopes: list[str] = []
    for call in az.ok.call_args_list:
        args = call.args
        if "--scope" in args:
            scopes.append(args[args.index("--scope") + 1])
    return scopes


def _roles_from_calls(az: MagicMock) -> list[str]:
    roles: list[str] = []
    for call in az.ok.call_args_list:
        args = call.args
        if "--role" in args:
            roles.append(args[args.index("--role") + 1])
    return roles


class TestAssignRbacFoundry:
    """Foundry (Cognitive Services User) role assignment."""

    def test_assigns_cognitive_services_user_on_foundry_scope(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        assign_rbac(
            az, "mi-client-id", "polyclaw-rg", steps,
            foundry_name="polyclawjp48654",
        )
        roles = _roles_from_calls(az)
        scopes = _scopes_from_calls(az)
        assert "Cognitive Services User" in roles
        idx = roles.index("Cognitive Services User")
        assert scopes[idx] == (
            "/subscriptions/sub-test-1234/resourceGroups/polyclaw-rg"
            "/providers/Microsoft.CognitiveServices/accounts/polyclawjp48654"
        )

    def test_skips_when_foundry_name_empty(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        assign_rbac(az, "mi-client-id", "polyclaw-rg", steps, foundry_name="")
        assert "Cognitive Services User" not in _roles_from_calls(az)

    def test_uses_foundry_rg_override_when_provided(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        """When Foundry lives in a separate RG (e.g. shared prereq RG)."""
        assign_rbac(
            az, "mi-client-id", "polyclaw-rg", steps,
            foundry_name="polyclawjp48654",
            foundry_rg="shared-foundry-rg",
        )
        roles = _roles_from_calls(az)
        scopes = _scopes_from_calls(az)
        idx = roles.index("Cognitive Services User")
        assert "/resourceGroups/shared-foundry-rg/" in scopes[idx]
        assert "/resourceGroups/polyclaw-rg/" not in scopes[idx]


class TestAssignRbacKeyVault:
    """Key Vault (Key Vault Secrets User) role assignment."""

    def test_assigns_secrets_user_on_kv_scope(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        assign_rbac(
            az, "mi-client-id", "polyclaw-rg", steps,
            kv_name="polyclawjp48654-kv",
        )
        roles = _roles_from_calls(az)
        scopes = _scopes_from_calls(az)
        assert "Key Vault Secrets User" in roles
        idx = roles.index("Key Vault Secrets User")
        assert scopes[idx] == (
            "/subscriptions/sub-test-1234/resourceGroups/polyclaw-rg"
            "/providers/Microsoft.KeyVault/vaults/polyclawjp48654-kv"
        )

    def test_skips_when_kv_name_empty(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        assign_rbac(az, "mi-client-id", "polyclaw-rg", steps, kv_name="")
        assert "Key Vault Secrets User" not in _roles_from_calls(az)

    def test_uses_kv_rg_override_when_provided(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        """When KV lives in a separate prereq RG."""
        assign_rbac(
            az, "mi-client-id", "polyclaw-rg", steps,
            kv_name="polyclawjp48654-kv",
            kv_rg="polyclaw-prereq-rg",
        )
        roles = _roles_from_calls(az)
        scopes = _scopes_from_calls(az)
        idx = roles.index("Key Vault Secrets User")
        assert "/resourceGroups/polyclaw-prereq-rg/" in scopes[idx]


class TestAssignRbacBaseline:
    """Baseline RG-scoped roles always assigned."""

    def test_always_assigns_bot_contributor_and_reader(
        self, az: MagicMock, steps: StepTracker
    ) -> None:
        assign_rbac(az, "mi-client-id", "polyclaw-rg", steps)
        roles = _roles_from_calls(az)
        assert "Azure Bot Service Contributor Role" in roles
        assert "Reader" in roles

    def test_subscription_id_missing_skips_foundry_and_kv(
        self, steps: StepTracker
    ) -> None:
        """When account_info returns no id, scoped assignments are skipped."""
        az = MagicMock()
        az.account_info.return_value = {}
        az.ok.return_value = (True, "ok")
        az.last_stderr = ""
        assign_rbac(
            az, "mi-client-id", "polyclaw-rg", steps,
            foundry_name="polyclawjp48654",
            kv_name="polyclawjp48654-kv",
        )
        roles = _roles_from_calls(az)
        assert "Cognitive Services User" not in roles
        assert "Key Vault Secrets User" not in roles
