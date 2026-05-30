/**
 * Application-wide constants.
 *
 * Consolidates magic strings, logo art, command lists, and animation
 * data so they are defined once and referenced everywhere.
 */

import type { SlashCommand } from "./types.js";

// ---------------------------------------------------------------------------
// Block text logo: POLYCLAW
// ---------------------------------------------------------------------------

export const LOGO_TEXT = [
  "████   ███  █     █   █  ████ █      ███  █   █",
  "█   █ █   █ █     █   █ █     █     █   █ █   █",
  "████  █   █ █      █ █  █     █     █████ █ █ █",
  "█     █   █ █       █   █     █     █   █ █ █ █",
  "█      ███  █████   █    ████ █████ █   █  █ █ ",
] as const;

/** Decorative RPG-style divider rendered below the logo. */
export const LOGO_DIVIDER =
  "  ◆━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◆  ";

// ---------------------------------------------------------------------------
// Mascot pixel art
// ---------------------------------------------------------------------------

/**
 * 14x10 pixel grid for the cat-in-crab-costume mascot.
 *
 * Pixel codes:
 *   0 = transparent
 *   1 = shell (red)
 *   3 = face (cream)
 *   4 = eyes (near-black)
 *   5 = inner ear (pink)
 *   6 = antenna (orange)
 *   7 = mouth (dark red)
 *   8 = accent / blush (pink)
 */
export const MASCOT_GRID = [
  "00060000060000",
  "00006000060000",
  "00011111111000",
  "00151111115100",
  "01113333331110",
  "01134433443110",
  "01183333338110",
  "00133388333100",
  "00013333331000",
  "00001111110000",
] as const;

export const MASCOT_PALETTE: Record<number, string> = {
  1: "#D03030",   // shell (red)
  3: "#F5E6D2",   // face (cream)
  4: "#1E1414",   // eyes (near-black)
  5: "#FFA0A0",   // inner ear (pink)
  6: "#FF6B20",   // antenna (orange)
  7: "#783737",   // mouth (dark red)
  8: "#FF8296",   // accent / blush (pink)
};

// ---------------------------------------------------------------------------
// Spinner animation
// ---------------------------------------------------------------------------

export const SPINNER_FRAMES = [
  "\u280B", "\u2819", "\u2839", "\u2838",
  "\u283C", "\u2834", "\u2826", "\u2827",
  "\u2807", "\u280F",
] as const;

// ---------------------------------------------------------------------------
// Startup phases (progress bar)
// ---------------------------------------------------------------------------

export const STARTUP_PHASES = [
  { key: "build",  label: "ビルド" },
  { key: "start",  label: "コンテナ" },
  { key: "server", label: "サーバー" },
  { key: "azure",  label: "Azure" },
  { key: "tunnel", label: "Tunnel" },
  { key: "bot",    label: "Bot" },
] as const;

export const STATUS_ITEMS = [
  { key: "azure",  label: "Azure" },
  { key: "tunnel", label: "Tunnel" },
  { key: "bot",    label: "Bot" },
] as const;

// Progress bar characters
export const BAR_FILL  = "\u2588"; // █
export const BAR_LIGHT = "\u2500"; // ─
export const BAR_WIDTH = 48;

// ---------------------------------------------------------------------------
// Autocomplete max visible items
// ---------------------------------------------------------------------------

export const MAX_AC_VISIBLE = 10;

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/new",         desc: "新しいセッションを開始" },
  { cmd: "/model",       desc: "AI モデルを切替" },
  { cmd: "/models",      desc: "利用可能なモデルを一覧" },
  { cmd: "/status",      desc: "システム状態" },
  { cmd: "/session",     desc: "現在のセッション情報" },
  { cmd: "/sessions",    desc: "最近のセッションを一覧" },
  { cmd: "/config",      desc: "ランタイム設定を表示/変更" },
  { cmd: "/clear",       desc: "すべてのメモリを消去" },
  { cmd: "/help",        desc: "すべてのコマンドを表示" },
  { cmd: "/skills",      desc: "インストール済みスキルを一覧" },
  { cmd: "/addskill",    desc: "スキルをインストール" },
  { cmd: "/removeskill", desc: "スキルを削除" },
  { cmd: "/plugins",     desc: "プラグインを一覧" },
  { cmd: "/plugin",      desc: "プラグインを有効化/無効化" },
  { cmd: "/mcp",         desc: "MCP サーバーを管理" },
  { cmd: "/schedules",   desc: "スケジュール済みタスクを一覧" },
  { cmd: "/schedule",    desc: "タスクを作成/削除" },
  { cmd: "/profile",     desc: "エージェントプロフィール" },
  { cmd: "/channels",    desc: "チャネル設定" },
  { cmd: "/preflight",   desc: "セキュリティチェックを実行" },
  { cmd: "/phone",       desc: "音声通話先番号を設定" },
  { cmd: "/call",        desc: "設定済み番号に発信" },
  { cmd: "/change",      desc: "最近のセッションに切替" },
  { cmd: "/quit",        desc: "終了" },
  { cmd: "/exit",        desc: "終了" },
];

// ---------------------------------------------------------------------------
// Disclaimer persistence flag
// ---------------------------------------------------------------------------

export const DISCLAIMER_FLAG = `${process.env.HOME || "/tmp"}/.polyclaw_disclaimer_accepted`;

// Tab labels for the main TUI (component-based mode)
export const TAB_LABELS = [
  "ダッシュボード",
  "セットアップ",
  "チャット",
  "セッション",
  "スキル",
  "プラグイン",
  "MCP",
  "スケジュール",
  "プロアクティブ",
  "プロフィール",
  "ワークスペース",
] as const;
