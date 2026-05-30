/**
 * Setup screen -- Azure auth, tunnel, configuration, infrastructure.
 */

import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  SelectRenderable,
  ScrollBoxRenderable,
} from "@opentui/core";
import { Screen } from "./screen.js";
import { Colors } from "../utils/theme.js";

export class SetupScreen extends Screen {
  capturesInput = true;

  private authText!: TextRenderable;
  private configText!: TextRenderable;
  private infraText!: TextRenderable;
  private resultText!: TextRenderable;

  private botRgInput!: InputRenderable;
  private botLocationInput!: InputRenderable;
  private botNameInput!: InputRenderable;
  private tgTokenInput!: InputRenderable;
  private tgWhitelistInput!: InputRenderable;

  private actionSelect!: SelectRenderable;

  async build(): Promise<void> {
    this.container = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.bg,
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
      rowGap: 1,
      padding: 1,
    });

    // -- Auth status --
    const authBox = this.createSection(" 認証 ");
    this.authText = this.createText("読み込み中...");
    authBox.add(this.authText);
    this.container.add(authBox);

    // -- Actions --
    const actionsBox = this.createSection(" 操作 ");
    this.actionSelect = new SelectRenderable(this.renderer, {
      options: [
        { name: "Azure ログイン", description: "Azure にログインする" },
        { name: "Azure ログアウト", description: "Azure からログアウトする" },
        { name: "Foundry デプロイ", description: "Bicep で AI モデルをデプロイ" },
        { name: "トンネル開始", description: "開発トンネルを起動" },
        { name: "スモークテスト実行", description: "Copilot 接続を検証" },
        { name: "設定を保存", description: "ボット/チャネル設定を保存" },
        { name: "インフラデプロイ", description: "Azure リソースを作成" },
        { name: "インフラ撤去", description: "Azure リソースを削除" },
        { name: "事前チェック実行", description: "前提条件を全件検証" },
      ],
      textColor: Colors.text,
      selectedTextColor: Colors.accent,
      width: "100%",
      height: 12,
    });
    actionsBox.add(this.actionSelect);
    this.container.add(actionsBox);

    this.actionSelect.on("itemSelected", () => {
      this.handleAction(this.actionSelect.getSelectedIndex());
    });

    // -- Bot configuration form --
    const configBox = this.createSection(" ボット設定 ");
    configBox.add(this.createLabel("リソースグループ:"));
    this.botRgInput = this.createInput("polyclaw-rg", "polyclaw-rg");
    configBox.add(this.botRgInput);
    configBox.add(this.createLabel("リージョン:"));
    this.botLocationInput = this.createInput("eastus", "eastus");
    configBox.add(this.botLocationInput);
    configBox.add(this.createLabel("ボット表示名:"));
    this.botNameInput = this.createInput("polyclaw", "polyclaw");
    configBox.add(this.botNameInput);
    configBox.add(this.createLabel("Telegram トークン (任意):"));
    this.tgTokenInput = this.createInput("@BotFather から取得したボットトークン");
    configBox.add(this.tgTokenInput);
    configBox.add(this.createLabel("Telegram ホワイトリスト (任意):"));
    this.tgWhitelistInput = this.createInput("カンマ区切りのユーザー名");
    configBox.add(this.tgWhitelistInput);
    this.container.add(configBox);

    // -- Config status --
    this.configText = this.createText("");
    this.container.add(this.configText);

    // -- Infra status --
    const infraBox = this.createSection(" インフラ状態 ");
    this.infraText = this.createText("読み込み中...");
    infraBox.add(this.infraText);
    this.container.add(infraBox);

    // -- Result area --
    this.resultText = this.createText("");
    this.container.add(this.resultText);
  }

  refresh(): void {
    this.loadAuthStatus();
    this.loadBotConfig();
    this.loadInfraStatus();
    this.loadChannelConfig();
  }

  // -----------------------------------------------------------------------
  // Factory helpers
  // -----------------------------------------------------------------------

  private createSection(title: string): BoxRenderable {
    return new BoxRenderable(this.renderer, {
      border: true,
      borderColor: Colors.border,
      title,
      backgroundColor: Colors.surface,
      width: "100%",
      padding: 1,
      flexDirection: "column",
      rowGap: 1,
    });
  }

  private createText(content: string): TextRenderable {
    return new TextRenderable(this.renderer, { content, fg: Colors.muted, width: "100%" });
  }

  private createLabel(text: string): TextRenderable {
    return new TextRenderable(this.renderer, { content: text, fg: Colors.muted, width: "100%", height: 1 });
  }

  private createInput(placeholder: string, defaultVal = ""): InputRenderable {
    const inp = new InputRenderable(this.renderer, { placeholder, textColor: Colors.text, width: "100%" });
    if (defaultVal) inp.value = defaultVal;
    return inp;
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  private async loadAuthStatus(): Promise<void> {
    try {
      const s = await this.api.getSetupStatus();
      const azOk = s.azure?.logged_in ?? false;
      const tunnelOk = s.tunnel?.active ?? false;
      const dot = (ok: boolean) => ok ? "\x1b[32m●\x1b[0m" : "\x1b[31m●\x1b[0m";
      this.authText.content = [
        `  ${dot(azOk)} Azure    ${azOk ? `${s.azure?.user ?? ""} (${s.azure?.subscription ?? ""})` : "未ログイン -- 下の「Azure ログイン」を実行してください"}`,
        `  ${dot(tunnelOk)} Tunnel   ${tunnelOk ? (s.tunnel?.url ?? "稼働中") : "停止中 -- 下の「トンネル開始」を実行してください"}`,
      ].join("\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.authText.content = `\x1b[31m  状態取得エラー: ${msg}\x1b[0m`;
    }
  }

  private async loadBotConfig(): Promise<void> {
    try {
      const cfg = await this.api.getBotConfig();
      this.botRgInput.value = cfg.resource_group || "polyclaw-rg";
      this.botLocationInput.value = cfg.location || "eastus";
      this.botNameInput.value = cfg.display_name || "polyclaw";
    } catch { /* use defaults */ }
  }

  private async loadInfraStatus(): Promise<void> {
    try {
      const r = await this.api.getInfraStatus();
      const prov = r.provisioned as Record<string, Record<string, unknown>> | undefined;
      const lines: string[] = [];
      if (prov?.tunnel) lines.push(`  トンネル: ${prov.tunnel.active ? prov.tunnel.url : "未起動"}`);
      if (prov?.bot) lines.push(`  ボット:   ${prov.bot.deployed ? `${prov.bot.name} (${prov.bot.resource_group})` : "未デプロイ"}`);
      const channels = prov?.channels as Record<string, Record<string, unknown>> | undefined;
      if (channels?.telegram) lines.push(`  Telegram: ${channels.telegram.live ? "稼働中" : "未作成"}`);
      this.infraText.content = lines.length > 0 ? lines.join("\n") : "  まだインフラはデプロイされていません。";
    } catch {
      this.infraText.content = "  読み込めませんでした。";
    }
  }

  private async loadChannelConfig(): Promise<void> {
    try {
      const cfg = await this.api.getChannelsConfig();
      if (cfg.telegram?.token) {
        this.configText.content = "  Telegram: \x1b[32m設定済み\x1b[0m";
        this.tgWhitelistInput.value = cfg.telegram.whitelist || "";
      } else {
        this.configText.content = "  Telegram: \x1b[90m未設定\x1b[0m";
      }
    } catch { /* ignore */ }
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  private async handleAction(index: number): Promise<void> {
    const actions: (() => Promise<void>)[] = [
      () => this.doAzureLogin(),
      () => this.doAzureLogout(),
      () => this.doDeployFoundry(),
      () => this.doStartTunnel(),
      () => this.doSmokeTest(),
      () => this.doSaveConfiguration(),
      () => this.doDeployInfra(),
      () => this.doDecommissionInfra(),
      () => this.doPreflightChecks(),
    ];
    if (actions[index]) await actions[index]();
  }

  private setResult(msg: string): void {
    this.resultText.content = msg;
  }

  private async doAzureLogin(): Promise<void> {
    this.setResult("  Azure ログインを開始しています...");
    try {
      const r = await this.api.azureLogin();
      if (r.status === "already_logged_in") {
        this.setResult(`  \x1b[32m${r.user} としてすでにログイン済み\x1b[0m`);
      } else if (r.code) {
        this.setResult(`  ${r.url} を開いて以下のコードを入力してください: \x1b[1m${r.code}\x1b[0m\n  完了を待機中...`);
        await this.pollAzure();
      } else {
        this.setResult(`  ${r.message || "ログインを開始しました -- ターミナルを確認してください"}`);
      }
      this.loadAuthStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31mエラー: ${msg}\x1b[0m`);
    }
  }

  private async pollAzure(): Promise<void> {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const c = await this.api.azureCheck();
        if (c.status === "logged_in") {
          this.setResult("  \x1b[32mAzure ログインに成功しました!\x1b[0m");
          this.loadAuthStatus();
          return;
        }
      } catch { /* keep trying */ }
    }
    this.setResult("  \x1b[33mログインがタイムアウトしました。再度お試しください。\x1b[0m");
  }

  private async doAzureLogout(): Promise<void> {
    try {
      await this.api.azureLogout();
      this.setResult("  Azure からログアウトしました。");
      this.loadAuthStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doDeployFoundry(): Promise<void> {
    this.setResult("  Bicep で Foundry インフラをデプロイ中...");
    try {
      const r = await this.api.fetchRaw("/api/setup/foundry/deploy", {
        method: "POST",
        body: JSON.stringify({ resource_group: "polyclaw-rg", location: "eastus" }),
        signal: AbortSignal.timeout(600_000),
      });
      const body = await r.json();
      if (body.status === "ok") {
        this.setResult(`  \x1b[32mFoundry をデプロイしました!\x1b[0m\n  エンドポイント: ${body.foundry_endpoint}\n  モデル: ${(body.deployed_models || []).join(", ")}`);
      } else {
        this.setResult(`  \x1b[31mデプロイに失敗: ${body.error || "原因不明"}\x1b[0m`);
      }
      this.loadAuthStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31mError: ${msg}\x1b[0m`);
    }
  }

  private async doStartTunnel(): Promise<void> {
    this.setResult("  トンネルを起動中...");
    try {
      const r = await this.api.startTunnel();
      if (r.status === "ok") {
        this.setResult(`  \x1b[32mトンネルを起動: ${r.url}\x1b[0m${r.endpoint_updated ? "\n  ボットのエンドポイントを更新しました" : ""}`);
      } else {
        this.setResult(`  \x1b[31m${r.message}\x1b[0m`);
      }
      this.loadAuthStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doSmokeTest(): Promise<void> {
    this.setResult("  スモークテストを実行中...");
    try {
      const r = await this.api.smokeTest() as Record<string, unknown>;
      const lines: string[] = [];
      lines.push(r.status === "ok" ? "  \x1b[32mスモークテスト合格\x1b[0m" : "  \x1b[31mスモークテスト失敗\x1b[0m");
      const steps = r.steps as Array<{ ok: boolean; step: string; detail?: string }> | undefined;
      if (steps) {
        for (const s of steps) {
          lines.push(`    ${s.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${s.step}: ${s.detail || ""}`);
        }
      }
      this.setResult(lines.join("\n"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doSaveConfiguration(): Promise<void> {
    this.setResult("  設定を保存中...");
    try {
      const body: Record<string, unknown> = {
        bot: {
          resource_group: this.botRgInput.value || "polyclaw-rg",
          location: this.botLocationInput.value || "eastus",
          display_name: this.botNameInput.value || "polyclaw",
        },
        telegram: {} as Record<string, string>,
      };
      const tgToken = this.tgTokenInput.value?.trim();
      if (tgToken) {
        (body.telegram as Record<string, string>).token = tgToken;
        (body.telegram as Record<string, string>).whitelist = this.tgWhitelistInput.value?.trim() || "";
      }
      const r = await this.api.saveConfiguration(body);
      this.setResult(this.formatStepResult(r));
      this.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doDeployInfra(): Promise<void> {
    this.setResult("  \x1b[33mインフラをデプロイ中... 数分かかる場合があります。\x1b[0m");
    try {
      const r = await this.api.deployInfra();
      this.setResult(this.formatStepResult(r));
      this.loadInfraStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doDecommissionInfra(): Promise<void> {
    this.setResult("  \x1b[33mインフラを撤去中...\x1b[0m");
    try {
      const r = await this.api.decommissionInfra();
      this.setResult(this.formatStepResult(r));
      this.loadInfraStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private async doPreflightChecks(): Promise<void> {
    this.setResult("  事前チェックを実行中...");
    try {
      const r = await this.api.getPreflight();
      const checks = (r as Record<string, unknown>).checks as Array<{ ok: boolean; check: string; detail: string }> | undefined;
      const labels: Record<string, string> = {
        bot_credentials: "ボット認証情報",
        jwt_validation: "JWT 検証",
        tunnel: "トンネル",
        tenant_id: "テナント ID",
        endpoint_auth: "エンドポイント認証",
        telegram_security: "Telegram セキュリティ",
        acs_voice: "ACS / 音声",
        acs_callback_security: "ACS コールバックセキュリティ",
      };
      const lines: string[] = [];
      for (const c of checks || []) {
        const icon = c.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        lines.push(`    ${icon} ${labels[c.check] || c.check}: ${c.detail}`);
      }
      this.setResult(lines.length > 0 ? lines.join("\n") : "  実行可能なチェックがありません。");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setResult(`  \x1b[31m${msg}\x1b[0m`);
    }
  }

  private formatStepResult(r: Record<string, unknown>): string {
    const lines: string[] = [];
    const msg = r.message as string | undefined;
    lines.push(r.status === "ok"
      ? `  \x1b[32m${msg}\x1b[0m`
      : `  \x1b[31m${msg}\x1b[0m`);
    const steps = r.steps as Array<{ status: string; step: string; detail?: string }> | undefined;
    if (steps) {
      for (const s of steps) {
        const icon = s.status === "ok" ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        lines.push(`    ${icon} ${s.step}: ${s.detail || s.status}`);
      }
    }
    return lines.join("\n");
  }
}
