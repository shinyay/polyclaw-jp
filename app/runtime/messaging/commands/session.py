"""Session and model management commands."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from ...config.settings import cfg

if TYPE_CHECKING:
    from ._dispatcher import CommandContext, CommandDispatcher


async def cmd_new(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    await dispatcher._agent.new_session()
    if dispatcher._session_store:
        dispatcher._session_store.start_session(uuid.uuid4().hex[:12], model=cfg.copilot_model)
    await ctx.reply("新しいセッションを開始しました。")


async def cmd_model(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split(maxsplit=1)
    if len(parts) < 2:
        await ctx.reply(f"現在のモデル: {cfg.copilot_model}\n\n使い方: /model <name>")
        return
    new_model = parts[1].strip()
    old_model = cfg.copilot_model
    cfg.write_env(COPILOT_MODEL=new_model)
    await dispatcher._agent.new_session()
    if dispatcher._session_store:
        dispatcher._session_store.start_session(uuid.uuid4().hex[:12], model=new_model)
    await ctx.reply(f"モデルを切り替えました: {old_model} -> {new_model}\n新しいセッションを開始しました。")


async def cmd_models(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    models = await dispatcher._agent.list_models()
    if not models:
        await ctx.reply("利用可能なモデルはありません。")
        return
    current = cfg.copilot_model
    lines = ["利用可能なモデル", ""]
    for m in models:
        marker = " *" if m["id"] == current else ""
        cost = f" ({m['billing_multiplier']}x)" if m.get("billing_multiplier", 1.0) != 1.0 else ""
        reasoning = f"  [reasoning: {', '.join(m['reasoning_efforts'])}]" if m.get("reasoning_efforts") else ""
        policy = m.get("policy", "enabled")
        if policy != "enabled":
            lines.append(f"  {m['id']}{marker}{cost}  ({policy})")
        else:
            lines.append(f"  {m['id']}{marker}{cost}{reasoning}")
    lines.append(f"\n現在のモデル: {current}\n切り替えは /model <name> を使用してください。")
    await ctx.reply("\n".join(lines))


async def cmd_session(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    lines = [
        "セッション情報",
        f"  稼働中: {'はい' if dispatcher._agent.has_session else 'いいえ'}",
        f"  モデル: {cfg.copilot_model}",
        "  Playwright MCP: 有効",
    ]
    await ctx.reply("\n".join(lines))


async def cmd_sessions(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    if not dispatcher._session_store:
        await ctx.reply("セッションストアが利用できません。")
        return
    sessions = dispatcher._session_store.list_sessions()
    if not sessions:
        await ctx.reply("記録されたセッションはありません。")
        return
    stats = dispatcher._session_store.get_session_stats()
    lines = [f"セッション ({stats['total_sessions']} 件 / {stats['total_messages']} メッセージ)", ""]
    for s in sessions[:10]:
        started = s.get("started_at", "?")[:16]
        lines.append(f"  {s['id']}  {started}  {s.get('model', '?')}  ({s.get('message_count', 0)} 件)")
    if len(sessions) > 10:
        lines.append(f"  ... ほか {len(sessions) - 10} 件")
    await ctx.reply("\n".join(lines))


async def cmd_sessions_sub(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    if len(parts) >= 2 and parts[1].lower() == "clear":
        if not dispatcher._session_store:
            await ctx.reply("セッションストアが利用できません。")
            return
        count = dispatcher._session_store.clear_all()
        await ctx.reply(f"すべてのセッションを削除しました ({count} 件)。")
    else:
        await cmd_sessions(dispatcher, ctx)


async def cmd_session_sub(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    if len(parts) >= 3 and parts[1].lower() == "delete":
        if not dispatcher._session_store:
            await ctx.reply("セッションストアが利用できません。")
            return
        ok = dispatcher._session_store.delete_session(parts[2])
        await ctx.reply(f"セッション '{parts[2]}' を削除しました。" if ok else f"セッション '{parts[2]}' が見つかりません。")
    else:
        await cmd_session(dispatcher, ctx)


async def cmd_change(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    if not dispatcher._session_store:
        await ctx.reply("セッションストアが利用できません。")
        return
    sessions = dispatcher._session_store.list_sessions()
    if not sessions:
        await ctx.reply("切り替え可能なセッションがありません。/new で新しいセッションを開始してください。")
        return
    lines = ["最近のセッション:", ""]
    for i, s in enumerate(sessions[:5], 1):
        started = s.get("started_at", "?")[:16]
        lines.append(f"  {i}. {started}  {s.get('model', '?')}  ({s.get('message_count', 0)} 件)")
        lines.append(f"     ID: {s['id']}")
    await ctx.reply("\n".join(lines))


async def cmd_clear(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    cleared = 0
    if cfg.memory_dir.is_dir():
        for f in cfg.memory_dir.rglob("*"):
            if f.is_file():
                f.unlink()
                cleared += 1
    await ctx.reply(f"メモリーをクリアしました ({cleared} ファイル削除)。")
