"""Tests for the agent prompt builder."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.runtime.agent.prompt import (
    _build_mcp_section,
    _build_persona_name_directive,
    _build_sandbox_section,
    _load_mcp_guidance,
    build_system_prompt,
    load_soul,
    soul_exists,
)


class TestLoadSoul:
    def test_creates_placeholder_if_missing(self, data_dir: Path):
        from app.runtime.config.settings import cfg

        cfg.soul_path.parent.mkdir(parents=True, exist_ok=True)
        if cfg.soul_path.exists():
            cfg.soul_path.unlink()
        soul = load_soul()
        assert len(soul) > 0
        assert cfg.soul_path.exists()

    def test_reads_existing_soul(self, data_dir: Path):
        from app.runtime.config.settings import cfg

        cfg.soul_path.parent.mkdir(parents=True, exist_ok=True)
        cfg.soul_path.write_text("I am a custom soul.")
        soul = load_soul()
        assert soul == "I am a custom soul."


class TestSoulExists:
    def test_returns_false_if_file_missing(self, data_dir: Path):
        from app.runtime.config.settings import cfg

        if cfg.soul_path.exists():
            cfg.soul_path.unlink()
        assert not soul_exists()

    def test_returns_false_if_placeholder(self, data_dir: Path):
        from app.runtime.config.settings import cfg

        cfg.soul_path.parent.mkdir(parents=True, exist_ok=True)
        cfg.soul_path.write_text("This is a placeholder identity for testing.")
        assert not soul_exists()

    def test_returns_true_if_custom(self, data_dir: Path):
        from app.runtime.config.settings import cfg

        cfg.soul_path.parent.mkdir(parents=True, exist_ok=True)
        cfg.soul_path.write_text("I am a real custom agent identity.")
        assert soul_exists()


class TestBuildMcpSection:
    @patch("app.runtime.state.mcp_config.McpConfigStore")
    def test_no_servers(self, MockStore):
        MockStore.return_value.list_servers.return_value = []
        result = _build_mcp_section()
        assert "No MCP servers" in result

    @patch("app.runtime.state.mcp_config.McpConfigStore")
    def test_with_disabled_servers(self, MockStore):
        MockStore.return_value.list_servers.return_value = [
            {"name": "test", "enabled": False, "type": "http"},
        ]
        result = _build_mcp_section()
        assert "No MCP servers" in result

    @patch("app.runtime.agent.prompt._get_mcp_guidance", return_value={})
    @patch("app.runtime.state.mcp_config.McpConfigStore")
    def test_with_enabled_server(self, MockStore, mock_guidance):
        MockStore.return_value.list_servers.return_value = [
            {"name": "my-server", "enabled": True, "type": "http", "description": "My server"},
        ]
        result = _build_mcp_section()
        assert "my-server" in result
        assert "http" in result

    @patch("app.runtime.state.mcp_config.McpConfigStore")
    def test_handles_exception(self, MockStore):
        MockStore.return_value.list_servers.side_effect = RuntimeError("fail")
        result = _build_mcp_section()
        assert "No MCP" in result


class TestBuildSandboxSection:
    @patch("app.runtime.state.sandbox_config.SandboxConfigStore")
    def test_disabled(self, MockStore):
        MockStore.return_value.config.enabled = False
        result = _build_sandbox_section()
        assert result == ""

    @patch("app.runtime.state.sandbox_config.SandboxConfigStore")
    def test_error_returns_empty(self, MockStore):
        MockStore.side_effect = RuntimeError("fail")
        result = _build_sandbox_section()
        assert result == ""


class TestBuildSystemPrompt:
    @patch("app.runtime.agent.prompt._get_system_prompt_template")
    @patch("app.runtime.agent.prompt._build_sandbox_section", return_value="")
    @patch("app.runtime.agent.prompt._build_mcp_section", return_value="No MCP")
    @patch("app.runtime.state.profile.load_profile")
    @patch("app.runtime.agent.prompt.soul_exists", return_value=True)
    @patch("app.runtime.agent.prompt.load_soul", return_value="My Soul")
    def test_builds_prompt(
        self, mock_soul, mock_exists, mock_profile, mock_mcp, mock_sandbox, mock_template
    ):
        mock_profile.return_value = {"name": "TestBot", "emotional_state": "高揚", "location": "Cloud"}
        mock_template.return_value = "{bootstrap}{soul}{mcp_servers}"
        result = build_system_prompt()
        assert "My Soul" in result

    @patch("app.runtime.agent.prompt._get_system_prompt_template")
    @patch("app.runtime.agent.prompt._build_sandbox_section", return_value="")
    @patch("app.runtime.agent.prompt._build_mcp_section", return_value="No MCP")
    @patch("app.runtime.state.profile.load_profile")
    @patch("app.runtime.agent.prompt.soul_exists", return_value=False)
    @patch("app.runtime.agent.prompt.load_soul", return_value="placeholder")
    def test_bootstrap_section_when_no_soul(
        self, mock_soul, mock_exists, mock_profile, mock_mcp, mock_sandbox, mock_template
    ):
        mock_profile.return_value = {"name": "", "emotional_state": "平常"}
        mock_template.return_value = "{bootstrap}{soul}{mcp_servers}"
        result = build_system_prompt()
        assert "placeholder" in result

    @patch("app.runtime.agent.prompt._get_system_prompt_template")
    @patch("app.runtime.agent.prompt._build_sandbox_section", return_value="")
    @patch("app.runtime.agent.prompt._build_mcp_section", return_value="No MCP")
    @patch("app.runtime.state.profile.load_profile")
    @patch("app.runtime.agent.prompt.soul_exists", return_value=True)
    @patch("app.runtime.agent.prompt.load_soul", return_value="Soul")
    def test_profile_preferences(
        self, mock_soul, mock_exists, mock_profile, mock_mcp, mock_sandbox, mock_template
    ):
        mock_profile.return_value = {
            "name": "Agent",
            "emotional_state": "平常",
            "location": "NYC",
            "preferences": {"style": "formal"},
        }
        mock_template.return_value = "{bootstrap}{soul}{mcp_servers}"
        result = build_system_prompt()
        assert "formal" in result or "Agent" in result


class TestBuildPersonaNameDirective:
    """Tests for _build_persona_name_directive (PR-2.3 C1).

    Verifies the bootstrap prompt persona-name placeholder substitution:
    - User-selected names (anything other than ``polyclaw``) → directive
      tells the agent to adopt that name.
    - Default ``polyclaw`` or empty → directive falls back to the
      "choose your own name" wording.
    """

    def test_user_selected_japanese_name(self):
        directive = _build_persona_name_directive("八雲")
        assert "八雲" in directive
        assert "ユーザーがセットアップで選択しました" in directive
        assert "SOUL.md" in directive

    def test_user_selected_preset_octo(self):
        directive = _build_persona_name_directive("オクト")
        assert "オクト" in directive
        assert "ユーザー" in directive

    def test_user_selected_custom_english_name(self):
        directive = _build_persona_name_directive("Zephyr")
        assert "Zephyr" in directive
        assert "ユーザー" in directive

    def test_default_polyclaw_name_falls_back(self):
        directive = _build_persona_name_directive("polyclaw")
        assert "polyclaw" not in directive
        assert "ユニークな名前" in directive
        assert "Copilot" in directive  # The "avoid these" example

    def test_empty_name_falls_back(self):
        directive = _build_persona_name_directive("")
        assert "ユニークな名前" in directive

    def test_none_name_falls_back(self):
        directive = _build_persona_name_directive(None)  # type: ignore[arg-type]
        assert "ユニークな名前" in directive

    def test_whitespace_name_falls_back(self):
        directive = _build_persona_name_directive("   ")
        assert "ユニークな名前" in directive

    def test_name_with_surrounding_whitespace_is_trimmed(self):
        directive = _build_persona_name_directive("  雷神  ")
        assert "雷神" in directive
        assert "  雷神  " not in directive  # Trimmed in output


class TestBootstrapPromptFormatting:
    """End-to-end format() check on the real bootstrap_prompt.md template.

    Ensures the persona_name_directive placeholder is wired correctly and
    that all required substitution keys are present.
    """

    def test_template_format_with_user_name(self):
        from app.runtime.agent.prompt import _load_template

        template = _load_template("bootstrap_prompt.md")
        result = template.format(
            soul_path="/data/SOUL.md",
            profile_path="/data/agent_profile.json",
            persona_name_directive=_build_persona_name_directive("八雲"),
        )
        assert "八雲" in result
        assert "/data/SOUL.md" in result
        assert "/data/agent_profile.json" in result
        assert "ユーザーがセットアップで選択しました" in result

    def test_template_format_with_default_name(self):
        from app.runtime.agent.prompt import _load_template

        template = _load_template("bootstrap_prompt.md")
        result = template.format(
            soul_path="/data/SOUL.md",
            profile_path="/data/agent_profile.json",
            persona_name_directive=_build_persona_name_directive("polyclaw"),
        )
        assert "ユニークな名前" in result
        assert "polyclaw" not in result.split("###")[1].split("###")[0]  # not in Step 1

