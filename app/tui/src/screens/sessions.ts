/**
 * Sessions screen -- browse recorded chat sessions.
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
import { formatSessionTime, formatDuration, formatSize } from "../utils/format.js";

export class SessionsScreen extends Screen {
  private statsText!: TextRenderable;
  private policyText!: TextRenderable;
  private sessionSelect!: SelectRenderable;
  private detailText!: TextRenderable;
  private messagesScroll!: ScrollBoxRenderable;

  private sessions: Record<string, unknown>[] = [];

  async build(): Promise<void> {
    this.container = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.bg,
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
      rowGap: 1,
      padding: 1,
    });

    this.statsText = this.text("読み込み中...");
    this.container.add(this.statsText);

    this.policyText = this.text("");
    this.container.add(this.policyText);

    const listBox = this.section(" セッション ", 15);
    this.sessionSelect = new SelectRenderable(this.renderer, {
      options: [{ name: "読み込み中...", description: "" }],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      flexGrow: 1,
    });
    listBox.add(this.sessionSelect);
    this.container.add(listBox);

    this.sessionSelect.on("itemSelected", () => {
      this.openSession(this.sessionSelect.getSelectedIndex());
    });

    const detailBox = this.section(" セッション詳細 ");
    this.detailText = this.text("上のリストからセッションを選択してください。");
    detailBox.add(this.detailText);

    this.messagesScroll = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.surface,
      flexGrow: 1,
      width: "100%",
      flexDirection: "column",
    });
    detailBox.add(this.messagesScroll);
    this.container.add(detailBox);
  }

  refresh(): void {
    this.loadSessions();
    this.loadStats();
    this.loadPolicy();
  }

  // -----------------------------------------------------------------------
  // Factory helpers
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
  // Data loading
  // -----------------------------------------------------------------------

  private async loadStats(): Promise<void> {
    try {
      const stats = await this.api.getSessionStats();
      this.statsText.content = `  セッション: ${stats.total_sessions ?? 0}  |  メッセージ: ${stats.total_messages ?? 0}  |  ストレージ: ${formatSize((stats.total_size_bytes as number) ?? 0)}`;
    } catch {
      this.statsText.content = "  統計を取得できません";
    }
  }

  private async loadPolicy(): Promise<void> {
    try {
      const p = await this.api.getSessionPolicy();
      const labels: Record<string, string> = { never: "永久保持", "24h": "24 時間", "7d": "7 日", "30d": "30 日" };
      this.policyText.content = `  保存ポリシー: ${labels[p.policy] || p.policy}`;
    } catch {
      this.policyText.content = "";
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      this.sessions = await this.api.listSessions() as Record<string, unknown>[];
      if (this.sessions.length === 0) {
        this.sessionSelect.options = [{ name: "(セッション記録なし)", description: "" }];
        return;
      }
      const opts: SelectOption[] = this.sessions.map((s) => {
        const time = formatSessionTime(s.started_at as string);
        const status = s.ended_at ? "" : " [稼働中]";
        const preview = ((s.first_message as string) || "(空)").slice(0, 50);
        return { name: `${time}${status}  ${s.message_count} 件  ${s.model || "?"}  ${preview}`, description: "" };
      });
      this.sessionSelect.options = opts;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.sessionSelect.options = [{ name: `エラー: ${msg}`, description: "" }];
    }
  }

  private async openSession(index: number): Promise<void> {
    if (index < 0 || index >= this.sessions.length) return;
    const s = this.sessions[index];

    try {
      const session = await this.api.getSession(s.id as string) as Record<string, unknown>;
      if (!session || session.status === "error") {
        this.detailText.content = `\x1b[31m${(session?.message as string) || "セッションが見つかりません"}\x1b[0m`;
        return;
      }

      // Clear old messages
      for (const child of this.messagesScroll.getChildren()) {
        this.messagesScroll.remove(child.id);
      }

      const started = formatSessionTime(session.started_at as string);
      const ended = session.ended_at ? formatSessionTime(session.ended_at as string) : "稼働中";
      const dur = session.ended_at ? formatDuration(session.started_at as string, session.ended_at as string) : "";
      this.detailText.content = `  ${session.model || "?"}  |  ${session.channel || "web"}  |  ${started} -> ${ended}  ${dur ? "(" + dur + ")" : ""}  |  ${session.message_count} 件のメッセージ`;

      // Build timeline
      const timeline: { kind: string; ts: string; data: Record<string, unknown> }[] = [];
      for (const msg of (session.messages as Record<string, unknown>[]) || []) {
        timeline.push({ kind: "message", ts: msg.timestamp as string, data: msg });
      }
      for (const tc of (session.tool_calls as Record<string, unknown>[]) || []) {
        timeline.push({ kind: "tool", ts: tc.timestamp as string, data: tc });
      }
      timeline.sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));

      let toolGroup: Record<string, unknown>[] = [];
      const flushTools = () => {
        if (toolGroup.length === 0) return;
        const names = toolGroup.map((t) => this.humanizeTool(t.tool as string)).join(", ");
        this.messagesScroll.add(new TextRenderable(this.renderer, {
          content: `  \x1b[90m[${toolGroup.length} ツール: ${names}]\x1b[0m`,
          fg: Colors.muted,
          width: "100%",
        }));
        toolGroup = [];
      };

      for (const entry of timeline) {
        if (entry.kind === "tool") {
          toolGroup.push(entry.data);
        } else {
          flushTools();
          const msg = entry.data;
          const roleColor = msg.role === "user" ? "\x1b[36m" : msg.role === "assistant" ? "\x1b[32m" : "\x1b[90m";
          const label = msg.role === "user" ? "あなた" : msg.role === "system" ? "システム" : "アシスタント";
          const time = formatSessionTime(msg.timestamp as string);

          this.messagesScroll.add(new TextRenderable(this.renderer, {
            content: `${roleColor}${label}\x1b[0m \x1b[90m${time}\x1b[0m\n${msg.text}`,
            fg: Colors.text,
            width: "100%",
            marginBottom: 1,
          }));
        }
      }
      flushTools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.detailText.content = `\x1b[31mエラー: ${msg}\x1b[0m`;
    }
  }

  private humanizeTool(name: string): string {
    if (!name || name === "unknown") return "実行中";
    const segments = name.split("__");
    const clean = segments.length > 1 ? segments[segments.length - 1] : name;
    return clean.replace(/_/g, " ").replace(/-/g, " ");
  }
}
