"""Agent profile -- personality, preferences, and usage tracking."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from ..config.settings import cfg
from ..util.singletons import register_singleton

logger = logging.getLogger(__name__)

EMOTIONAL_STATES_JP: frozenset[str] = frozenset({
    "平常",
    "好奇心",
    "集中",
    "達成感",
    "高揚",
    "思索",
    "警戒",
    "困惑",
})

_EMOTIONAL_STATE_DEFAULT = "平常"

_EMOTIONAL_STATE_FALLBACK_MAP: dict[str, str] = {
    # neutral / calm
    "neutral": "平常", "calm": "平常", "stable": "平常", "rested": "平常",
    # curious / interested
    "curious": "好奇心", "interested": "好奇心", "inquisitive": "好奇心",
    "intrigued": "好奇心", "wondering": "好奇心",
    # focused / attentive
    "focused": "集中", "concentrated": "集中", "attentive": "集中",
    "engaged": "集中", "absorbed": "集中",
    # satisfied / accomplished
    "satisfied": "達成感", "accomplished": "達成感", "pleased": "達成感",
    "fulfilled": "達成感", "proud": "達成感",
    # excited / energized
    "excited": "高揚", "energized": "高揚", "enthusiastic": "高揚",
    "eager": "高揚", "thrilled": "高揚", "happy": "高揚", "amused": "高揚",
    # thoughtful / reflective
    "thoughtful": "思索", "reflective": "思索", "contemplative": "思索",
    "pensive": "思索", "musing": "思索",
    # concerned / alert
    "concerned": "警戒", "alert": "警戒", "cautious": "警戒",
    "vigilant": "警戒", "wary": "警戒",
    # confused / puzzled
    "confused": "困惑", "puzzled": "困惑", "perplexed": "困惑",
    "uncertain": "困惑", "lost": "困惑",
}

_DEFAULT_PROFILE: dict[str, Any] = {
    "name": "polyclaw",
    "emoji": "",
    "location": "",
    "emotional_state": _EMOTIONAL_STATE_DEFAULT,
    "preferences": {},
}


def normalize_emotional_state(value: Any) -> str:
    """Coerce *value* to one of EMOTIONAL_STATES_JP.

    Strategy:
    1. Return the value unchanged when it is already a Japanese canonical value.
    2. Map known English synonyms (case-insensitive, trimmed) via
       _EMOTIONAL_STATE_FALLBACK_MAP.
    3. Fall back to "平常" and emit a warning for unknown values.
    """
    if not isinstance(value, str):
        return _EMOTIONAL_STATE_DEFAULT
    stripped = value.strip()
    if not stripped:
        return _EMOTIONAL_STATE_DEFAULT
    if stripped in EMOTIONAL_STATES_JP:
        return stripped
    mapped = _EMOTIONAL_STATE_FALLBACK_MAP.get(stripped.lower())
    if mapped is not None:
        logger.info(
            "[profile.emotional_state] mapped %r -> %r", stripped, mapped
        )
        return mapped
    logger.warning(
        "[profile.emotional_state] unknown value %r, defaulting to %r",
        stripped,
        _EMOTIONAL_STATE_DEFAULT,
    )
    return _EMOTIONAL_STATE_DEFAULT


def _load_json(path: Path, default: Any = None) -> Any:
    """Load a JSON file, returning *default* on any error."""
    if default is None:
        default = {}
    if not path.exists():
        return default() if callable(default) else (dict(default) if isinstance(default, dict) else list(default) if isinstance(default, list) else default)
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return default() if callable(default) else (dict(default) if isinstance(default, dict) else list(default) if isinstance(default, list) else default)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def profile_path() -> Path:
    """Return the path to the agent profile JSON file."""
    return cfg.data_dir / "agent_profile.json"


def _usage_path() -> Path:
    return cfg.data_dir / "skill_usage.json"


def _interactions_path() -> Path:
    return cfg.data_dir / "interactions.json"


def load_profile() -> dict[str, Any]:
    data = _load_json(profile_path(), _DEFAULT_PROFILE)
    for key, default in _DEFAULT_PROFILE.items():
        data.setdefault(key, default)
    data["emotional_state"] = normalize_emotional_state(data.get("emotional_state"))
    return data


def save_profile(profile: dict[str, Any]) -> None:
    if "emotional_state" in profile:
        profile = dict(profile)
        profile["emotional_state"] = normalize_emotional_state(profile["emotional_state"])
    _write_json(profile_path(), profile)


def load_skill_usage() -> dict[str, int]:
    return _load_json(_usage_path(), {})


def increment_skill_usage(skill_name: str) -> None:
    usage = load_skill_usage()
    usage[skill_name] = usage.get(skill_name, 0) + 1
    _write_json(_usage_path(), usage)


def log_interaction(interaction_type: str, channel: str = "") -> None:
    path = _interactions_path()
    interactions = _load_json(path, [])
    interactions.append({
        "type": interaction_type,
        "channel": channel,
        "timestamp": time.time(),
    })
    _write_json(path, interactions[-1000:])


def load_interactions() -> list[dict[str, Any]]:
    """Load the raw interaction log."""
    return _load_json(_interactions_path(), [])


def get_contributions(days: int = 365) -> list[dict[str, Any]]:
    """Aggregate interactions into per-day contribution counts.

    Returns a list of ``{"date": "YYYY-MM-DD", "user": N, "scheduled": N}``
    covering the last *days* days.
    """
    from collections import defaultdict
    from datetime import datetime, timedelta, timezone

    interactions = load_interactions()
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)

    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"user": 0, "scheduled": 0})
    for entry in interactions:
        d = _parse_interaction_date(entry)
        if d is None or d < start:
            continue
        key = d.isoformat()
        itype = entry.get("type", "user")
        if itype == "scheduled":
            buckets[key]["scheduled"] += 1
        else:
            buckets[key]["user"] += 1

    result: list[dict[str, Any]] = []
    cursor = start
    while cursor <= today:
        ds = cursor.isoformat()
        counts = buckets.get(ds, {"user": 0, "scheduled": 0})
        result.append({"date": ds, "user": counts["user"], "scheduled": counts["scheduled"]})
        cursor += timedelta(days=1)
    return result


def _parse_interaction_date(entry: dict[str, Any]) -> Any:
    """Parse an interaction's timestamp to a date, or return None."""
    from datetime import datetime, timezone

    ts = entry.get("timestamp")
    if ts is None:
        return None
    try:
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc).date()
        return datetime.fromisoformat(str(ts)).date()
    except (ValueError, OSError):
        return None


def get_activity_stats() -> dict[str, Any]:
    """Compute summary activity statistics from interactions."""
    from datetime import datetime, timedelta, timezone

    interactions = load_interactions()
    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = today - timedelta(days=today.weekday())

    today_count = 0
    week_count = 0
    month_count = 0
    active_days: set[str] = set()

    for entry in interactions:
        d = _parse_interaction_date(entry)
        if d is None:
            continue
        active_days.add(d.isoformat())
        if d == today:
            today_count += 1
        if d >= week_start:
            week_count += 1
        if d.year == today.year and d.month == today.month:
            month_count += 1

    # Calculate current streak (consecutive days ending today or yesterday)
    streak = 0
    check = today
    if check.isoformat() not in active_days:
        check = today - timedelta(days=1)
    while check.isoformat() in active_days:
        streak += 1
        check -= timedelta(days=1)

    return {
        "total": len(interactions),
        "today": today_count,
        "this_week": week_count,
        "this_month": month_count,
        "streak": streak,
    }


def get_full_profile() -> dict[str, Any]:
    profile = load_profile()
    profile["skill_usage"] = load_skill_usage()
    profile["contributions"] = get_contributions()
    profile["activity_stats"] = get_activity_stats()
    return profile


def _reset() -> None:
    pass  # stateless -- config paths will change on Settings reset


register_singleton(_reset)
