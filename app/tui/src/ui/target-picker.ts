/**
 * Deployment target picker -- interactive selector shown before the TUI
 * launches. Runs in a lightweight OpenTUI renderer.
 *
 * Supports two targets:
 *   - Local Docker (always available)
 *   - Azure Container Apps (requires `az` CLI + login)
 *
 * When an ACA deployment already exists, sub-options allow reconnecting,
 * deploying fresh, or removing the deployment entirely.
 */

import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { Colors, LogoColors } from "../utils/theme.js";
import { resetTerminal } from "../utils/terminal.js";
import { LOGO_TEXT } from "../config/constants.js";
import { createMascotLogoLines } from "./mascot.js";
import type { DeployTarget, TargetType } from "../deploy/target.js";
import { DockerDeployTarget } from "../deploy/docker.js";
import {
  AcaDeployTarget,
  checkAzCliInstalled,
  checkAzLoggedIn,
  getExistingDeployment,
  removeDeployment,
} from "../deploy/aca.js";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface TargetOption {
  id: TargetType;
  label: string;
  description: string;
  available: boolean;
  detail?: string;
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Let the user choose a deployment target.
 *
 * If `POLYCLAW_TARGET` is set, skips the interactive picker.
 */
export async function pickDeployTarget(
  adminPort: number,
  botPort: number,
): Promise<DeployTarget> {
  const envTarget = process.env.POLYCLAW_TARGET?.toLowerCase();
  if (envTarget === "docker") return new DockerDeployTarget();
  if (envTarget === "aca") {
    const existing = await getExistingDeployment();
    return new AcaDeployTarget(!!existing);
  }

  return showPicker(adminPort, botPort);
}

// -----------------------------------------------------------------------
// Interactive picker
// -----------------------------------------------------------------------

async function showPicker(
  _adminPort: number,
  _botPort: number,
): Promise<DeployTarget> {
  return new Promise<DeployTarget>(async (resolve) => {
    let selectedIndex = 0;
    let acaExisting: Awaited<ReturnType<typeof getExistingDeployment>> = null;
    let acaSubIndex = 1; // 0=Reconnect, 1=Deploy fresh, 2=Remove
    const acaSubLabels = ["再接続", "新規デプロイ", "削除"];

    const options: TargetOption[] = [
      { id: "docker", label: "ローカル Docker", description: "ローカルでビルドして実行 (デフォルト)", available: true },
      { id: "aca", label: "Azure Container Apps \x1b[32m(試験的)\x1b[0m", description: "Azure にデプロイ (永続化、クラウドホスト)", available: false, detail: "確認中..." },
    ];

    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      targetFps: 30,
      prependInputHandlers: [
        (sequence: string) => {
          if (sequence === "\x1b[A") { selectedIndex = Math.max(0, selectedIndex - 1); refreshItems(); return true; }
          if (sequence === "\x1b[B") { selectedIndex = Math.min(options.length - 1, selectedIndex + 1); refreshItems(); return true; }
          if (sequence === "\x1b[D") {
            if (options[selectedIndex].id === "aca" && options[selectedIndex].available) {
              acaSubIndex = Math.max(acaExisting ? 0 : 1, acaSubIndex - 1);
              refreshItems();
            }
            return true;
          }
          if (sequence === "\x1b[C") {
            if (options[selectedIndex].id === "aca" && options[selectedIndex].available) {
              acaSubIndex = Math.min(acaExisting ? acaSubLabels.length - 1 : 1, acaSubIndex + 1);
              refreshItems();
            }
            return true;
          }
          if (sequence === "\r" || sequence === "\n") {
            const selected = options[selectedIndex];
            if (!selected.available) return true;

            renderer.stop();
            renderer.destroy();
            resetTerminal();
            process.stdout.write("\x1b[2J\x1b[H");

            if (selected.id === "docker") {
              resolve(new DockerDeployTarget());
            } else if (acaExisting && acaSubIndex === 2) {
              process.stdout.write("\n");
              removeDeployment((line) => process.stdout.write(line + "\n"))
                .then(() => { process.stdout.write("\n完了。終了します。\n"); process.exit(0); })
                .catch((err) => { process.stdout.write(`\n削除に失敗しました: ${(err as Error).message}\n`); process.exit(1); });
              return true;
            } else {
              resolve(new AcaDeployTarget(acaExisting ? acaSubIndex === 0 : false));
            }
            return true;
          }
          return false;
        },
      ],
    });

    renderer.setBackgroundColor(Colors.bg);

    const root = new BoxRenderable(renderer, {
      id: "picker-root",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
    });
    renderer.root.add(root);

    // Mascot + block-text logo
    const mascotLines = createMascotLogoLines(renderer, LOGO_TEXT, LogoColors);
    for (const line of mascotLines) root.add(line);
    root.add(new TextRenderable(renderer, { id: "picker-subtitle", content: "  デプロイターゲット", fg: Colors.muted }));

    root.add(new TextRenderable(renderer, { id: "picker-spacer0", content: "", fg: Colors.bg }));
    root.add(new TextRenderable(renderer, { id: "picker-hint", content: "矢印キーで選択、Enter で確定、Ctrl+C で終了", fg: Colors.muted }));
    root.add(new TextRenderable(renderer, { id: "picker-spacer", content: "", fg: Colors.bg }));

    const itemRenderables: TextRenderable[] = [];
    for (let i = 0; i < options.length; i++) {
      const item = new TextRenderable(renderer, {
        id: `target-opt-${i}`,
        content: renderItem(options[i], i, selectedIndex),
        fg: i === selectedIndex ? "#FFD700" : Colors.text,
      });
      root.add(item);
      itemRenderables.push(item);
    }

    root.add(new TextRenderable(renderer, { id: "picker-spacer2", content: "", fg: Colors.bg }));
    const statusLine = new TextRenderable(renderer, { id: "picker-status", content: "", fg: Colors.muted });
    root.add(statusLine);
    const acaSubLine = new TextRenderable(renderer, { id: "aca-sub-line", content: "", fg: Colors.muted });
    root.add(acaSubLine);

    function renderItem(opt: TargetOption, index: number, sel: number): string {
      const pointer = index === sel ? "\u25b6 " : "  ";
      const status = opt.available ? "" : ` [${opt.detail || "利用不可"}]`;
      return `${pointer}${opt.label}  --  ${opt.description}${status}`;
    }

    function refreshItems(): void {
      for (let i = 0; i < options.length; i++) {
        try {
          (itemRenderables[i] as unknown as { content: string }).content = renderItem(options[i], i, selectedIndex);
          (itemRenderables[i] as unknown as { fg: string }).fg =
            i === selectedIndex ? (options[i].available ? "#FFD700" : "#D29922") : Colors.text;
        } catch { /* ignore */ }
      }

      // ACA sub-options
      if (options[selectedIndex].id === "aca" && options[selectedIndex].available) {
        try {
          const parts = acaSubLabels.map((label, i) => {
            if (!acaExisting && (i === 0 || i === 2)) return `  ${label}`;
            return i === acaSubIndex ? `\u25b6 ${label}` : `  ${label}`;
          });
          (acaSubLine as unknown as { content: string }).content = parts.join("  |");
          (acaSubLine as unknown as { fg: string }).fg = acaSubIndex === 2 ? Colors.red : Colors.accent;
        } catch { /* ignore */ }
      } else {
        try { (acaSubLine as unknown as { content: string }).content = ""; } catch { /* ignore */ }
      }

      renderer.requestRender();
    }

    // Background ACA availability check
    (async () => {
      const azInstalled = await checkAzCliInstalled();
      if (!azInstalled) {
        options[1].detail = "az CLI がインストールされていません";
        refreshItems();
        try {
          (statusLine as unknown as { content: string }).content = "ACA を利用するには Azure CLI が必要です。https://aka.ms/installazurecli からインストールしてください。";
          (statusLine as unknown as { fg: string }).fg = Colors.red;
        } catch { /* ignore */ }
        renderer.requestRender();
        return;
      }

      const loginResult = await checkAzLoggedIn();
      if (!loginResult.loggedIn) {
        options[1].detail = "未ログイン (実行: az login)";
        refreshItems();
        try {
          (statusLine as unknown as { content: string }).content = "先に 'az login' を実行し、CLI を再起動してください。";
          (statusLine as unknown as { fg: string }).fg = Colors.red;
        } catch { /* ignore */ }
        renderer.requestRender();
        return;
      }

      options[1].available = true;
      options[1].detail = undefined;
      options[1].description = `Azure にデプロイ (${loginResult.account})`;
      refreshItems();

      acaExisting = await getExistingDeployment();
      if (acaExisting) {
        try {
          (statusLine as unknown as { content: string }).content = `既存のデプロイを検出: ${acaExisting.appName} (${acaExisting.fqdn})`;
          (statusLine as unknown as { fg: string }).fg = Colors.green;
        } catch { /* ignore */ }
        acaSubIndex = 0;
        refreshItems();
      } else {
        try {
          (statusLine as unknown as { content: string }).content = `${loginResult.account} としてログイン中`;
          (statusLine as unknown as { fg: string }).fg = Colors.muted;
        } catch { /* ignore */ }
      }
      renderer.requestRender();
    })();

    renderer.requestRender();
  });
}
