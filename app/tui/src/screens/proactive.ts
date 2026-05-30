/**
 * Proactive screen -- manage bidirectional proactive follow-up messages.
 */

import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  ScrollBoxRenderable,
  type SelectOption,
} from "@opentui/core";
import { Screen } from "./screen.js";
import { Colors } from "../utils/theme.js";
import { formatSessionTime } from "../utils/format.js";

interface ProactiveState {
  enabled: boolean;
  messages_sent_today?: number;
  hours_since_last_sent?: number | null;
  pending?: {
    deliver_at: string;
    message: string;
    context?: string;
  } | null;
  preferences?: {
    min_gap_hours?: number;
    max_daily?: number;
    avoided_topics?: string[];
    preferred_times?: string;
  };
  history?: HistoryEntry[];
}

interface HistoryEntry {
  id: string;
  delivered_at: string;
  message: string;
  context?: string;
  reaction?: string;
  reaction_detail?: string;
}

export class ProactiveScreen extends Screen {
  private statusText!: TextRenderable;
  private enabledText!: TextRenderable;
  private pendingText!: TextRenderable;
  private actionSelect!: SelectRenderable;
  private resultText!: TextRenderable;
  private prefsText!: TextRenderable;
  private historySelect!: SelectRenderable;
  private historyDetailText!: TextRenderable;

  private history: HistoryEntry[] = [];

  async build(): Promise<void> {
    this.container = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.bg,
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
      rowGap: 1,
      padding: 1,
    });

    // Status line
    this.statusText = this.text("読み込み中...");
    this.container.add(this.statusText);

    // Enabled indicator
    this.enabledText = this.text("");
    this.container.add(this.enabledText);

    // Pending follow-up
    const pendingBox = this.section(" 次のフォローアップ ", 8);
    this.pendingText = this.text("予定されたフォローアップはありません。");
    pendingBox.add(this.pendingText);
    this.container.add(pendingBox);

    // Actions
    this.actionSelect = new SelectRenderable(this.renderer, {
      options: [
        { name: "プロアクティブ送信を切替", description: "" },
        { name: "予定中のフォローアップをキャンセル", description: "" },
      ],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      height: 3,
    });
    this.container.add(this.actionSelect);

    this.actionSelect.on("itemSelected", () => {
      const idx = this.actionSelect.getSelectedIndex();
      if (idx === 0) this.toggleEnabled();
      else if (idx === 1) this.cancelPending();
    });

    // Result
    this.resultText = this.text("");
    this.container.add(this.resultText);

    // Preferences
    const prefsBox = this.section(" 設定 ", 8);
    this.prefsText = this.text("読み込み中...");
    prefsBox.add(this.prefsText);
    this.container.add(prefsBox);

    // Sent history
    const historyBox = this.section(" 送信履歴 ", 12);
    this.historySelect = new SelectRenderable(this.renderer, {
      options: [{ name: "(送信履歴なし)", description: "" }],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      flexGrow: 1,
    });
    historyBox.add(this.historySelect);
    this.container.add(historyBox);

    this.historySelect.on("selectionChanged", () => {
      this.showHistoryDetail(this.historySelect.getSelectedIndex());
    });

    // History detail
    this.historyDetailText = this.text("");
    this.container.add(this.historyDetailText);
  }

  refresh(): void {
    this.loadState();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private text(content: string): TextRenderable {
    return new TextRenderable(this.renderer, { content, fg: Colors.muted, width: "100%" });
  }

  private section(title: string, height?: number): BoxRenderable {
    return new BoxRenderable(this.renderer, {
      border: true,
      borderColor: Colors.border,
      title,
      backgroundColor: Colors.surface,
      width: "100%",
      ...(height ? { height } : { flexGrow: 1 }),
      padding: 1,
      flexDirection: "column",
    });
  }

  // -----------------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------------

  private async loadState(): Promise<void> {
    try {
      const state = (await this.api.fetch("/api/proactive")) as ProactiveState;

      // Status line
      const sentToday = state.messages_sent_today ?? 0;
      const hoursSince = state.hours_since_last_sent;
      const lastSent = hoursSince != null ? `${hoursSince.toFixed(1)} 時間前` : "なし";
      const enabledLabel = state.enabled ? "\x1b[32m有効\x1b[0m" : "\x1b[90m無効\x1b[0m";
      this.statusText.content = `  プロアクティブ: ${enabledLabel}  |  本日の送信数: ${sentToday}  |  最終送信: ${lastSent}`;

      this.enabledText.content = state.enabled
        ? "  \x1b[32m●\x1b[0m 会話後にフォローアップメッセージをスケジュールします"
        : "  \x1b[90m●\x1b[0m プロアクティブなフォローアップは無効です";

      // Pending
      const pending = state.pending;
      if (pending) {
        this.pendingText.content = [
          `  \x1b[34m●\x1b[0m 予定日時: ${formatSessionTime(pending.deliver_at)}`,
          "",
          `  メッセージ: "${pending.message}"`,
          "",
          `  コンテキスト: ${pending.context || "(なし)"}`,
        ].join("\n");
      } else {
        this.pendingText.content = "  現在予定中のフォローアップはありません。";
      }

      // Preferences
      const p = state.preferences || {};
      this.prefsText.content = [
        `  最小間隔:         ${p.min_gap_hours ?? 4} 時間`,
        `  1日の上限:        ${p.max_daily ?? 3}`,
        `  避けるトピック:   ${(p.avoided_topics || []).join(", ") || "(なし)"}`,
        `  希望時間帯:       ${p.preferred_times || "(任意)"}`,
      ].join("\n");

      // History
      this.history = (state.history || []).slice().reverse();
      if (this.history.length === 0) {
        this.historySelect.options = [{ name: "(送信履歴なし)", description: "" }];
      } else {
        const opts: SelectOption[] = this.history.map((h) => {
          const time = formatSessionTime(h.delivered_at);
          const reaction = h.reaction ? ` [${h.reaction}]` : "";
          const preview = (h.message || "").slice(0, 50);
          return { name: `\x1b[34m●\x1b[0m ${time}${reaction}  ${preview}`, description: "" };
        });
        this.historySelect.options = opts;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.statusText.content = `  \x1b[31mエラー: ${msg}\x1b[0m`;
    }
  }

  private showHistoryDetail(index: number): void {
    if (index < 0 || index >= this.history.length) return;
    const h = this.history[index];
    this.historyDetailText.content = [
      `  ID:           ${h.id}`,
      `  配信日時:     ${formatSessionTime(h.delivered_at)}`,
      `  メッセージ:   ${h.message}`,
      `  コンテキスト: ${h.context || "(なし)"}`,
      `  反応:         ${h.reaction || "(なし)"}`,
      `  詳細:         ${h.reaction_detail || "(なし)"}`,
    ].join("\n");
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  private async toggleEnabled(): Promise<void> {
    try {
      const state = (await this.api.fetch("/api/proactive")) as ProactiveState;
      const newEnabled = !state.enabled;
      await this.api.fetchRaw("/api/proactive/enabled", {
        method: "PUT",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      this.resultText.content = `  \x1b[32mプロアクティブ送信を${newEnabled ? "有効化" : "無効化"}しました\x1b[0m`;
      this.loadState();
    } catch (err: unknown) {
      this.resultText.content = `  \x1b[31m${err instanceof Error ? err.message : err}\x1b[0m`;
    }
  }

  private async cancelPending(): Promise<void> {
    try {
      const res = await this.api.fetchRaw("/api/proactive/pending", { method: "DELETE" });
      const data = (await res.json()) as { status?: string };
      this.resultText.content = data.status === "cancelled"
        ? "  \x1b[32mフォローアップをキャンセルしました\x1b[0m"
        : "  \x1b[90mキャンセル対象のフォローアップがありません\x1b[0m";
      this.loadState();
    } catch (err: unknown) {
      this.resultText.content = `  \x1b[31m${err instanceof Error ? err.message : err}\x1b[0m`;
    }
  }
}
