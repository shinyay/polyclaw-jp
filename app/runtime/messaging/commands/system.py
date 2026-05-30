"""System, status, and infrastructure commands."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

from ...config.settings import cfg
from ...scheduler import get_scheduler
from ...state.profile import load_profile

if TYPE_CHECKING:
    from ._dispatcher import CommandContext, CommandDispatcher

BOOT_TIME = time.monotonic()


async def cmd_status(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    uptime_seconds = int(time.monotonic() - BOOT_TIME)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    sched = get_scheduler()
    tasks = sched.list_tasks()
    active_tasks = [t for t in tasks if t.enabled]
    total_reqs = sum(dispatcher._agent.request_counts.values())

    lines = [
        "システム状態",
        f"  モデル: {cfg.copilot_model}",
        f"  稼働時間: {hours}h {minutes}m {seconds}s",
        f"  累積リクエスト数: {total_reqs}",
    ]
    for model, count in sorted(dispatcher._agent.request_counts.items()):
        lines.append(f"    {model}: {count}")
    if ctx.channel_ctx is not None:
        channels = ctx.channel_ctx.connected_channels
        lines.append(f"  接続中チャネル: {', '.join(sorted(channels)) or 'なし'}")
        lines.append(f"  会話参照数: {ctx.channel_ctx.conversation_refs_count}")
    lines.append(f"  スケジュールタスク: {len(active_tasks)} 件有効 / {len(tasks)} 件合計")
    lines.append(f"  データディレクトリ: {cfg.data_dir}")
    await ctx.reply("\n".join(lines))


async def cmd_channels(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    lines = ["チャネル設定\n"]
    tg = dispatcher.infra.channels.telegram
    if tg.token:
        masked = tg.token[:8] + "..." + tg.token[-4:] if len(tg.token) > 12 else "***"
        lines.append(f"Telegram:\n  トークン: {masked}\n  ホワイトリスト: {tg.whitelist or '(なし)'}")
    else:
        lines.append("Telegram: 未設定")
    lines.append(f"\nBot Framework:\n  App ID: {cfg.bot_app_id[:8] + '...' if cfg.bot_app_id else '未設定'}")
    lines.append(f"  テナント: {cfg.bot_app_tenant_id[:8] + '...' if cfg.bot_app_tenant_id else '未設定'}")
    lines.append(f"  Admin secret: {'設定済み' if cfg.admin_secret else '未設定'}")
    if ctx.channel_ctx is not None:
        refs = ctx.channel_ctx.conversation_refs
        lines.append(f"\nアクティブな会話 ({len(refs)} 件):")
        for r in refs:
            user_name = r.user.name if r.user else "?"
            lines.append(f"  - {r.channel_id}: {user_name}")
    await ctx.reply("\n".join(lines))


async def cmd_profile(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    profile = load_profile()
    lines = [
        "エージェントプロファイル",
        f"  名前: {profile.get('name') or '(未設定)'}",
        f"  場所: {profile.get('location') or '(未設定)'}",
        f"  感情状態: {profile.get('emotional_state', '平常')}",
    ]
    prefs = profile.get("preferences", {})
    if prefs:
        lines.append("  設定:")
        for k, v in prefs.items():
            lines.append(f"    {k}: {v}")
    await ctx.reply("\n".join(lines))


async def cmd_config(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split(maxsplit=2)
    if len(parts) == 1:
        lines = [
            "ランタイム設定",
            f"  モデル: {cfg.copilot_model}",
            f"  Admin ポート: {cfg.admin_port}",
            f"  Bot ポート: {cfg.bot_port}",
            f"  データディレクトリ: {cfg.data_dir}",
            f"  Admin secret: {'設定済み' if cfg.admin_secret else '未設定'}",
            "\n使い方: /config <KEY> <VALUE>",
        ]
        await ctx.reply("\n".join(lines))
        return
    if len(parts) < 3:
        await ctx.reply("使い方: /config <KEY> <VALUE>")
        return
    key = parts[1].upper()
    allowed = {"COPILOT_MODEL", "ADMIN_PORT", "BOT_PORT", "VOICE_TARGET_NUMBER", "ACS_SOURCE_NUMBER"}
    if key not in allowed:
        await ctx.reply(f"'{key}' は設定できません。設定可能なキー: {', '.join(sorted(allowed))}")
        return
    cfg.write_env(**{key: parts[2]})
    await ctx.reply(f"設定を更新しました: {key} = {parts[2]}")


async def cmd_preflight(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    import aiohttp as _aiohttp

    base = f"http://127.0.0.1:{cfg.admin_port}"
    headers = {"Authorization": f"Bearer {cfg.admin_secret}"} if cfg.admin_secret else {}
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.get(f"{base}/api/setup/preflight", headers=headers, timeout=_aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status != 200:
                    await ctx.reply(f"プリフライトチェックに失敗しました (HTTP {resp.status})。")
                    return
                data = await resp.json()
    except Exception as exc:
        await ctx.reply(f"プリフライトエンドポイントに接続できません: {exc}")
        return

    checks = data.get("checks", [])
    lines = [f"プリフライトチェック ({data.get('status', '?').upper()})"]
    for c in checks:
        icon = "OK" if c.get("ok") else "!!"
        lines.append(f"  [{icon}] {c['check']}: {c.get('detail', '')}")
    await ctx.reply("\n".join(lines))


async def cmd_phone(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split(maxsplit=1)
    if len(parts) < 2:
        await ctx.reply(f"現在の発信先番号: {cfg.voice_target_number or '(未設定)'}\n\n使い方: /phone <番号>")
        return
    number = parts[1].strip()
    if not number.startswith("+"):
        await ctx.reply("電話番号は + (国番号) で始めてください。")
        return
    cfg.write_env(VOICE_TARGET_NUMBER=number)
    await ctx.reply(f"音声発信先番号を {number} に設定しました。")


async def cmd_call(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    import aiohttp as _aiohttp

    target = cfg.voice_target_number
    if not target:
        await ctx.reply("発信先番号が未設定です。まず /phone <番号> で設定してください。")
        return
    base = f"http://127.0.0.1:{cfg.admin_port}"
    headers = {"Authorization": f"Bearer {cfg.admin_secret}"} if cfg.admin_secret else {}
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.post(f"{base}/api/voice/call", json={"target_number": target}, headers=headers, timeout=_aiohttp.ClientTimeout(total=30)) as resp:
                data = await resp.json()
                if resp.status == 200:
                    await ctx.reply(f"{target} へ発信しています...")
                else:
                    await ctx.reply(f"発信に失敗しました: {data.get('error', f'HTTP {resp.status}')}")
    except Exception as exc:
        await ctx.reply(f"発信に失敗しました: {exc}")


async def cmd_lockdown(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    parts = ctx.text.split()
    if len(parts) < 2:
        state = "有効" if cfg.lockdown_mode else "無効"
        await ctx.reply(f"ロックダウンモード: {state}\n\n使い方: /lockdown on | /lockdown off")
        return
    action = parts[1].lower()
    if action not in ("on", "off"):
        await ctx.reply("使い方: /lockdown on | /lockdown off")
        return
    if action == "on":
        if cfg.lockdown_mode:
            await ctx.reply("ロックダウンモードはすでに有効です。")
            return
        cfg.write_env(LOCKDOWN_MODE="1", TUNNEL_RESTRICTED="1")
        from ...services.cloud.azure import AzureCLI
        az = AzureCLI()
        az.ok("logout")
        az.invalidate_cache("account", "show")
        await ctx.reply("ロックダウンモードを有効化しました\n\n  - Azure CLI からサインアウト\n  - 管理画面を無効化")
    else:
        if not cfg.lockdown_mode:
            await ctx.reply("ロックダウンモードはすでに無効です。")
            return
        cfg.write_env(LOCKDOWN_MODE="", TUNNEL_RESTRICTED="")
        await ctx.reply("ロックダウンモードを無効化しました\n\n  - 管理画面を再有効化")


async def cmd_help(dispatcher: CommandDispatcher, ctx: CommandContext) -> None:
    lines = [
        "利用可能なコマンド",
        "",
        "  /new, /model <name>, /models, /status, /session, /config",
        "  /skills, /addskill <name>, /removeskill <name>",
        "  /plugins, /plugin enable|disable <id>",
        "  /mcp, /mcp add|remove|enable|disable <name>",
        "  /schedules, /schedule add|remove",
        "  /sessions, /session delete <id>, /sessions clear",
        "  /change, /profile, /channels, /clear",
        "  /phone <number>, /call, /preflight, /lockdown, /help",
    ]
    await ctx.reply("\n".join(lines))
