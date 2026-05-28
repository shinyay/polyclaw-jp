"""Tests for the profile module."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.runtime.state.profile import (
    EMOTIONAL_STATES_JP,
    get_full_profile,
    increment_skill_usage,
    load_profile,
    load_skill_usage,
    log_interaction,
    normalize_emotional_state,
    save_profile,
)


class TestProfile:
    def test_load_default(self, data_dir: Path) -> None:
        profile = load_profile()
        assert profile["name"] == "polyclaw"
        assert profile["emotional_state"] == "平常"

    def test_save_and_load(self, data_dir: Path) -> None:
        profile = load_profile()
        profile["name"] = "TestBot"
        save_profile(profile)
        loaded = load_profile()
        assert loaded["name"] == "TestBot"

    def test_defaults_preserved(self, data_dir: Path) -> None:
        save_profile({"name": "X"})
        loaded = load_profile()
        assert loaded["name"] == "X"
        assert "emotional_state" in loaded

    def test_corrupt_json_returns_default(self, data_dir: Path) -> None:
        path = data_dir / "agent_profile.json"
        path.write_text("NOT JSON")
        profile = load_profile()
        assert profile["name"] == "polyclaw"

    def test_save_normalizes_english_emotional_state(self, data_dir: Path) -> None:
        save_profile({"name": "X", "emotional_state": "focused"})
        loaded = load_profile()
        assert loaded["emotional_state"] == "集中"

    def test_load_normalizes_legacy_english_value(self, data_dir: Path) -> None:
        import json

        path = data_dir / "agent_profile.json"
        path.write_text(json.dumps({"name": "X", "emotional_state": "excited"}))
        loaded = load_profile()
        assert loaded["emotional_state"] == "高揚"

    def test_unknown_emotional_state_defaults_to_neutral(self, data_dir: Path) -> None:
        save_profile({"name": "X", "emotional_state": "schadenfreude"})
        loaded = load_profile()
        assert loaded["emotional_state"] == "平常"


class TestNormalizeEmotionalState:
    @pytest.mark.parametrize("value", sorted(EMOTIONAL_STATES_JP))
    def test_canonical_value_passes_through(self, value: str) -> None:
        assert normalize_emotional_state(value) == value

    @pytest.mark.parametrize(
        ("english", "expected"),
        [
            ("neutral", "平常"),
            ("Calm", "平常"),
            ("curious", "好奇心"),
            ("focused", "集中"),
            ("FOCUSED", "集中"),
            ("excited", "高揚"),
            ("happy", "高揚"),
            ("thoughtful", "思索"),
            ("concerned", "警戒"),
            ("confused", "困惑"),
            ("satisfied", "達成感"),
        ],
    )
    def test_english_fallback_map(self, english: str, expected: str) -> None:
        assert normalize_emotional_state(english) == expected

    def test_whitespace_trimmed(self) -> None:
        assert normalize_emotional_state("  集中  ") == "集中"
        assert normalize_emotional_state(" focused ") == "集中"

    @pytest.mark.parametrize("value", [None, "", "   ", 42, True, [], {}])
    def test_invalid_or_empty_returns_default(self, value) -> None:
        assert normalize_emotional_state(value) == "平常"

    def test_unknown_string_returns_default(self) -> None:
        assert normalize_emotional_state("schadenfreude") == "平常"
        assert normalize_emotional_state("ハッピー") == "平常"


class TestSkillUsage:
    def test_empty_usage(self, data_dir: Path) -> None:
        assert load_skill_usage() == {}

    def test_increment(self, data_dir: Path) -> None:
        increment_skill_usage("web-search")
        increment_skill_usage("web-search")
        increment_skill_usage("note-taking")
        usage = load_skill_usage()
        assert usage["web-search"] == 2
        assert usage["note-taking"] == 1


class TestInteractionLog:
    def test_log_interaction(self, data_dir: Path) -> None:
        log_interaction("chat", channel="web")
        log_interaction("chat", channel="telegram")
        path = data_dir / "interactions.json"
        assert path.exists()

    @pytest.mark.slow
    def test_log_caps_at_1000(self, data_dir: Path) -> None:
        import json

        for i in range(1010):
            log_interaction("chat", channel="web")
        interactions = json.loads((data_dir / "interactions.json").read_text())
        assert len(interactions) == 1000


class TestFullProfile:
    def test_merges_usage(self, data_dir: Path) -> None:
        increment_skill_usage("test-skill")
        full = get_full_profile()
        assert "skill_usage" in full
        assert full["skill_usage"]["test-skill"] == 1
