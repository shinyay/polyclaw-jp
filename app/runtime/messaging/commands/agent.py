"""Agent-related commands -- skills, plugins, MCP, schedules."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...registries.plugins import get_plugin_registry
from ...registries.skills import get_registry as get_skill_registry
from ...scheduler import get_scheduler
from ...state.mcp_config import McpConfigStore

if TYPE_CHECKING:
    from ._dispatcher import CommandContext, CommandDispatcher


async def cmd_skills(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    from ...config.settings import cfg

    skills: list[str] = []
    if cfg.user_skills_dir.is_dir():
        for d in sorted(cfg.user_skills_dir.iterdir()):
            if d.is_dir() and (d / "SKILL.md").exists():
                skills.append(d.name)
    lines = [f"スキル ({len(skills)} 件):"] + [f"  - {name}" for name in skills]
    if not skills:
        lines.append("  (なし)")
    await ctx.reply("\n".join(lines))


async def cmd_addskill(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split(maxsplit=1)
    if len(parts) < 2:
        reg = get_skill_registry()
        try:
            catalog = await reg.fetch_catalog()
            available = [s for s in catalog if not s.installed]
            if available:
                lines = [f"インストール可能なスキル ({len(available)} 件):"]
                for s in available:
                    desc = f" - {s.description}" if s.description else ""
                    lines.append(f"  {s.name}{desc}  [{s.source}]")
                lines.append("\n使い方: /addskill <name>")
            else:
                lines = ["カタログ上のスキルはすべてインストール済みです。", "使い方: /addskill <name>"]
        except Exception as exc:
            lines = [f"カタログの取得に失敗しました: {exc}", "使い方: /addskill <name>"]
        await ctx.reply("\n".join(lines))
        return
    name = parts[1].strip()
    reg = get_skill_registry()
    await ctx.reply(f"スキル '{name}' をインストールしています...")
    ok = await reg.install(name)
    await ctx.reply(f"スキル '{name}' をインストールしました。" if ok else f"スキル '{name}' のインストールに失敗しました。")


async def cmd_removeskill(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split(maxsplit=1)
    if len(parts) < 2:
        reg = get_skill_registry()
        installed = reg.list_installed()
        if installed:
            lines = [f"インストール済みスキル ({len(installed)} 件):"] + [f"  {s.name}" for s in installed]
            lines.append("\n使い方: /removeskill <name>")
        else:
            lines = ["インストール済みのスキルはありません。", "使い方: /removeskill <name>"]
        await ctx.reply("\n".join(lines))
        return
    name = parts[1].strip()
    reg = get_skill_registry()
    removed = reg.remove(name)
    await ctx.reply(f"スキル '{name}' を削除しました。" if removed else f"スキル '{name}' が見つかりません。")


async def cmd_plugins(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    reg = get_plugin_registry()
    plugins = reg.list_plugins()
    if not plugins:
        await ctx.reply("プラグインはありません。")
        return
    lines = [f"プラグイン ({len(plugins)} 件):"]
    for p in plugins:
        icon = "+" if p.get("enabled") else "-"
        desc = f" - {p['description']}" if p.get("description") else ""
        lines.append(f"  [{icon}] {p['id']}{desc} ({p.get('skill_count', 0)} skills)")
    lines.append("\n使い方: /plugin enable <id> または /plugin disable <id>")
    await ctx.reply("\n".join(lines))


async def cmd_plugin(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    if len(parts) < 3:
        await ctx.reply("使い方: /plugin enable <id> または /plugin disable <id>")
        return
    action, plugin_id = parts[1].lower(), parts[2].strip()
    reg = get_plugin_registry()
    if action == "enable":
        result = reg.enable_plugin(plugin_id)
        await ctx.reply(f"プラグイン '{plugin_id}' を有効化しました。" if result else f"プラグイン '{plugin_id}' が見つかりません。")
    elif action == "disable":
        result = reg.disable_plugin(plugin_id)
        await ctx.reply(f"プラグイン '{plugin_id}' を無効化しました。" if result else f"プラグイン '{plugin_id}' が見つかりません。")
    else:
        await ctx.reply(f"不明なアクション '{action}' です。")


async def cmd_mcp(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    store = McpConfigStore()
    if len(parts) == 1:
        servers = store.list_servers()
        if not servers:
            await ctx.reply("MCP サーバーは未登録です。")
            return
        lines = [f"MCP サーバー ({len(servers)} 件):"]
        for s in servers:
            icon = "+" if s.get("enabled") else "-"
            builtin = " [builtin]" if s.get("builtin") else ""
            lines.append(f"  [{icon}] {s['name']} ({s.get('type', '?')}){builtin}")
            if s.get("description"):
                lines.append(f"        {s['description']}")
        await ctx.reply("\n".join(lines))
        return

    action = parts[1].lower()
    if action == "add":
        if len(parts) < 4:
            await ctx.reply("使い方: /mcp add <name> <url>")
            return
        try:
            store.add_server(parts[2], "http", url=parts[3])
            await ctx.reply(f"MCP サーバー '{parts[2]}' を追加しました。/new で新しいセッションを開始すると有効になります。")
        except ValueError as exc:
            await ctx.reply(f"エラー: {exc}")
    elif action == "remove":
        if len(parts) < 3:
            await ctx.reply("使い方: /mcp remove <name>")
            return
        try:
            ok = store.remove_server(parts[2])
            await ctx.reply(f"MCP サーバー '{parts[2]}' を削除しました。" if ok else f"MCP サーバー '{parts[2]}' が見つかりません。")
        except ValueError as exc:
            await ctx.reply(f"エラー: {exc}")
    elif action in ("enable", "disable"):
        if len(parts) < 3:
            await ctx.reply(f"使い方: /mcp {action} <name>")
            return
        ok = store.set_enabled(parts[2], action == "enable")
        action_jp = "有効化" if action == "enable" else "無効化"
        await ctx.reply(f"MCP サーバー '{parts[2]}' を {action_jp} しました。" if ok else f"MCP サーバー '{parts[2]}' が見つかりません。")
    else:
        await ctx.reply(f"不明な MCP アクション '{action}' です。")


async def cmd_schedules(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    sched = get_scheduler()
    tasks = sched.list_tasks()
    if not tasks:
        await ctx.reply("スケジュール済みタスクはありません。\n\n使い方: /schedule add <cron> <prompt>")
        return
    lines = [f"スケジュール済みタスク ({len(tasks)} 件):"]
    for t in tasks:
        icon = "+" if t.enabled else "-"
        schedule = t.cron or (f"{t.run_at} に 1 回実行" if t.run_at else "?")
        lines.append(f"  [{icon}] {t.id} - {t.description}")
        lines.append(f"        スケジュール: {schedule}  |  最終実行: {t.last_run[:16] if t.last_run else '未実行'}")
    await ctx.reply("\n".join(lines))


async def cmd_schedule(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    if len(parts) < 2:
        await ctx.reply("使い方: /schedule add <cron> <prompt> または /schedule remove <id>")
        return
    action = parts[1].lower()
    sched = get_scheduler()
    if action == "add":
        if len(parts) < 8:
            await ctx.reply("使い方: /schedule add <min> <hour> <dom> <month> <dow> <prompt>")
            return
        cron = " ".join(parts[2:7])
        prompt = " ".join(parts[7:])
        try:
            task = sched.add(description=prompt[:60], prompt=prompt, cron=cron)
            await ctx.reply(f"スケジュールタスクを作成しました:\n  ID: {task.id}\n  Cron: {cron}\n  プロンプト: {prompt}")
        except ValueError as exc:
            await ctx.reply(f"エラー: {exc}")
    elif action == "remove":
        if len(parts) < 3:
            await ctx.reply("使い方: /schedule remove <id>")
            return
        ok = sched.remove(parts[2])
        await ctx.reply(f"タスク '{parts[2]}' を削除しました。" if ok else f"タスク '{parts[2]}' が見つかりません。")
