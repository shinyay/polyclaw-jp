/**
 * Scheduler screen -- CRUD for scheduled tasks.
 */

import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  InputRenderable,
  ScrollBoxRenderable,
  type SelectOption,
} from "@opentui/core";
import { Screen } from "./screen.js";
import { Colors } from "../utils/theme.js";

interface ScheduledTask {
  id: string;
  description?: string;
  prompt?: string;
  cron?: string;
  run_at?: string;
  last_run?: string;
  next_run?: string;
  created_at?: string;
}

export class SchedulerScreen extends Screen {
  capturesInput = true;

  private taskSelect!: SelectRenderable;
  private detailText!: TextRenderable;
  private resultText!: TextRenderable;
  private actionSelect!: SelectRenderable;

  // Create form
  private descInput!: InputRenderable;
  private promptInput!: InputRenderable;
  private cronInput!: InputRenderable;
  private runAtInput!: InputRenderable;

  private tasks: ScheduledTask[] = [];

  async build(): Promise<void> {
    this.container = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.bg,
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
      rowGap: 1,
      padding: 1,
    });

    // Task list
    const listBox = this.section(" 予定タスク ", 10);
    this.taskSelect = this.createSelect();
    listBox.add(this.taskSelect);
    this.container.add(listBox);

    this.taskSelect.on("selectionChanged", () => {
      this.showTaskDetail(this.taskSelect.getSelectedIndex());
    });

    // Actions
    this.actionSelect = new SelectRenderable(this.renderer, {
      options: [
        { name: "新規タスクを作成", description: "" },
        { name: "選択中のタスクを削除", description: "" },
      ],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      height: 3,
    });
    this.container.add(this.actionSelect);

    this.actionSelect.on("itemSelected", () => {
      const i = this.actionSelect.getSelectedIndex();
      if (i === 0) this.createTask();
      else if (i === 1) this.deleteSelected();
    });

    // Create form
    const formBox = this.section(" 新規タスク ");
    this.descInput = this.addFormField(formBox, "説明:", "このタスクの内容");
    this.promptInput = this.addFormField(formBox, "プロンプト:", "エージェントに送信するプロンプト");
    this.cronInput = this.addFormField(formBox, "cron 式 (繰り返し用):", "0 9 * * * (毎日 9 時)");
    this.runAtInput = this.addFormField(formBox, "実行日時 (ISO 形式、単発用):", "2025-01-01T09:00:00");
    this.container.add(formBox);

    // Detail
    this.detailText = this.text("");
    this.container.add(this.detailText);

    // Result
    this.resultText = this.text("");
    this.container.add(this.resultText);
  }

  refresh(): void {
    this.loadTasks();
  }

  // -----------------------------------------------------------------------
  // Factory helpers
  // -----------------------------------------------------------------------

  private text(content: string): TextRenderable {
    return new TextRenderable(this.renderer, { content, fg: Colors.muted, width: "100%" });
  }

  private input(placeholder: string): InputRenderable {
    return new InputRenderable(this.renderer, { placeholder, textColor: Colors.text, width: "100%" });
  }

  private createSelect(): SelectRenderable {
    return new SelectRenderable(this.renderer, {
      options: [{ name: "読み込み中...", description: "" }],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      flexGrow: 1,
    });
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
      rowGap: 1,
    });
  }

  private addFormField(parent: BoxRenderable, label: string, placeholder: string): InputRenderable {
    parent.add(new TextRenderable(this.renderer, { content: label, fg: Colors.muted, width: "100%", height: 1 }));
    const inp = this.input(placeholder);
    parent.add(inp);
    return inp;
  }

  // -----------------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------------

  private async loadTasks(): Promise<void> {
    try {
      this.tasks = (await this.api.listSchedules()) as unknown as ScheduledTask[];
      if (this.tasks.length === 0) {
        this.taskSelect.options = [{ name: "(予定タスクなし)", description: "" }];
        return;
      }
      const opts: SelectOption[] = this.tasks.map((t) => {
        const cron = t.cron ? `cron: ${t.cron}` : t.run_at ? `日時: ${t.run_at}` : "予定なし";
        return { name: `${t.description || "(無題)"}  ${cron}`, description: "" };
      });
      this.taskSelect.options = opts;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.taskSelect.options = [{ name: `エラー: ${msg}`, description: "" }];
    }
  }

  private showTaskDetail(index: number): void {
    if (index < 0 || index >= this.tasks.length) return;
    const t = this.tasks[index];
    this.detailText.content = [
      `  ${t.description || "(無題)"}`,
      "",
      `  ID:        ${t.id}`,
      `  プロンプト: ${(t.prompt || "").slice(0, 60)}`,
      `  cron:      ${t.cron || "(なし)"}`,
      `  実行日時:  ${t.run_at || "(なし)"}`,
      `  前回実行:  ${t.last_run || "(未実行)"}`,
      `  次回実行:  ${t.next_run || "(不明)"}`,
      `  作成日時:  ${t.created_at || ""}`,
    ].join("\n");
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  private async createTask(): Promise<void> {
    const prompt = this.promptInput.value?.trim();
    if (!prompt) {
      this.resultText.content = "  \x1b[31mプロンプトは必須です\x1b[0m";
      return;
    }
    const body: Record<string, string> = {
      description: this.descInput.value?.trim() || "",
      prompt,
    };
    const cron = this.cronInput.value?.trim();
    const runAt = this.runAtInput.value?.trim();
    if (cron) body.cron = cron;
    if (runAt) body.run_at = runAt;

    try {
      await this.api.createSchedule(body);
      this.resultText.content = "  \x1b[32mタスクを作成しました\x1b[0m";
      for (const inp of [this.descInput, this.promptInput, this.cronInput, this.runAtInput]) {
        inp.value = "";
      }
      this.loadTasks();
    } catch (err: unknown) {
      this.resultText.content = `  \x1b[31m${err instanceof Error ? err.message : err}\x1b[0m`;
    }
  }

  private async deleteSelected(): Promise<void> {
    const index = this.taskSelect.getSelectedIndex();
    if (index < 0 || index >= this.tasks.length) return;
    try {
      await this.api.deleteSchedule(this.tasks[index].id);
      this.resultText.content = "  \x1b[32mタスクを削除しました\x1b[0m";
      this.loadTasks();
    } catch (err: unknown) {
      this.resultText.content = `  \x1b[31m${err instanceof Error ? err.message : err}\x1b[0m`;
    }
  }
}
