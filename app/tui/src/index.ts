/**
 * Polyclaw TUI -- entry point.
 *
 * Admin mode:  launches the interactive TUI (disclaimer -> target picker
 *              -> deploy lifecycle & chat).
 *
 * Bot mode:    headless -- Docker build, run, block until Ctrl-C.
 *
 * Start mode:  headless -- build, start, print admin URL, block.
 *              Designed for scripts and CI: no TUI, no disclaimer, no
 *              interactive prompts.
 *
 * Run mode:    headless -- build, start, send a single prompt via the
 *              chat API, print the response, and exit.  Designed for
 *              scripted single-shot interactions.
 *
 * Health mode: check if the stack is already running and healthy.
 */

import {
  buildImage,
  startContainer,
  getAdminSecret,
  resolveKvSecret,
  waitForReady,
  stopContainer,
} from "./deploy/docker.js";
import { launchTUI } from "./ui/tui.js";
import { showDisclaimer } from "./ui/disclaimer.js";
import { pickDeployTarget } from "./ui/target-picker.js";

// -----------------------------------------------------------------------
// Help
// -----------------------------------------------------------------------

function usage(): void {
  console.log("使い方: polyclaw-cli <コマンド> [オプション]");
  console.log("");
  console.log("コマンド:");
  console.log("  admin           ダッシュボードとチャットを備えた対話型 TUI (デフォルト)");
  console.log("  bot             Bot Framework サーバーのみ (ヘッドレス)");
  console.log("  start           ビルド・起動して admin URL を出力 (スクリプト用)");
  console.log("  run <prompt>    スタックを起動してプロンプトを送信し、応答を出力して終了");
  console.log("  setup           ヘッドレスフルセットアップ: ビルド・Foundry デプロイ・チャット検証");
  console.log("  decommission    setup で構築した Azure リソースを破棄");
  console.log("  aca-setup       ヘッドレス ACA セットアップ: ビルド・Foundry + ACA デプロイ・チャット検証");
  console.log("  aca-decommission  ACA + Foundry リソースを破棄");
  console.log("  aca-restart     ACA ランタイムコンテナを再起動");
  console.log("  aca-setup       ヘッドレス ACA セットアップ: ビルド・Foundry + ACA デプロイ・チャット検証");
  console.log("  aca-decommission  ACA + Foundry リソースを破棄");
  console.log("  aca-restart     ACA ランタイムコンテナを再起動");
  console.log("  health          スタックが起動して正常か確認");
  console.log("  stop            起動中のスタックを停止");
  console.log("");
  console.log("環境変数:");
  console.log("  ADMIN_PORT      Admin サーバーポート (デフォルト: 8080)");
  console.log("  BOT_PORT        Bot Framework ポート (デフォルト: 3978)");
  console.log("  POLYCLAW_SETUP_RG              setup 用リソースグループ (デフォルト: polyclaw-e2e-rg)");
  console.log("  POLYCLAW_SETUP_LOCATION        Azure リージョン (デフォルト: eastus)");
  console.log("  POLYCLAW_SETUP_BASE_NAME       Cognitive Services ベース名 (空なら自動)");
  console.log("  POLYCLAW_SETUP_SUBSCRIPTION_ID 対象サブスクリプション ID (空なら先頭)");
  console.log("");
}

const VALID_MODES = ["admin", "bot", "start", "run", "setup", "decommission", "aca-setup", "aca-decommission", "aca-restart", "health", "stop"];

// -----------------------------------------------------------------------
// CLI helpers
// -----------------------------------------------------------------------

/** Build + start the compose stack, returning the instance ID. */
async function ensureStack(
  adminPort: number,
  botPort: number,
  onLine?: (line: string) => void,
): Promise<string> {
  const buildOk = await buildImage(onLine);
  if (!buildOk) {
    console.error("Docker ビルドに失敗しました。");
    process.exit(1);
  }

  try {
    return await startContainer(adminPort, botPort, "bot");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("コンテナの起動に失敗しました:", msg);
    process.exit(1);
  }
}

/** Resolve the admin secret and build the full admin URL. */
async function resolveAdminUrl(port: number): Promise<{ secret: string; url: string }> {
  let secret = await getAdminSecret();
  if (secret.startsWith("@kv:")) {
    secret = await resolveKvSecret(secret);
  }
  const url = secret
    ? `http://localhost:${port}/?secret=${secret}`
    : `http://localhost:${port}`;
  return { secret, url };
}

/** Wait for the stack to become healthy or exit with an error. */
async function waitOrDie(baseUrl: string, instanceId: string): Promise<void> {
  const ready = await waitForReady(baseUrl);
  if (!ready) {
    console.error("サーバーが準備完了になりませんでした。");
    await stopContainer(instanceId);
    process.exit(1);
  }
}

/** Wire Ctrl-C / SIGTERM to gracefully stop the stack. */
function wireShutdown(instanceId: string): void {
  const shutdown = async () => {
    console.log("\n停止中...");
    await stopContainer(instanceId);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = process.argv[2] || "admin";

  if (mode === "-h" || mode === "--help") {
    usage();
    process.exit(0);
  }

  if (!VALID_MODES.includes(mode)) {
    console.error(`不明なコマンド: ${mode}`);
    usage();
    process.exit(1);
  }

  const adminPort = parseInt(process.env.ADMIN_PORT || "8080", 10);
  const botPort = parseInt(process.env.BOT_PORT || "3978", 10);
  const composeAdminPort = 9090;

  // ---- Admin TUI mode ---------------------------------------------------
  if (mode === "admin") {
    await showDisclaimer();

    const target = await pickDeployTarget(adminPort, botPort);
    await launchTUI(adminPort, botPort, target);
    return;
  }

  // ---- Headless setup mode -----------------------------------------------
  if (mode === "setup") {
    const { runHeadlessSetup } = await import("./headless/setup.js");
    await runHeadlessSetup();
    return;
  }

  // ---- Headless decommission mode ----------------------------------------
  if (mode === "decommission") {
    const { runHeadlessDecommission } = await import("./headless/setup.js");
    await runHeadlessDecommission();
    return;
  }

  // ---- ACA headless modes -------------------------------------------------
  if (mode === "aca-setup") {
    const { runAcaHeadlessSetup } = await import("./headless/aca_setup.js");
    await runAcaHeadlessSetup();
    return;
  }

  if (mode === "aca-decommission") {
    const { runAcaHeadlessDecommission } = await import("./headless/aca_setup.js");
    await runAcaHeadlessDecommission();
    return;
  }

  if (mode === "aca-restart") {
    const { runAcaHeadlessRestart } = await import("./headless/aca_setup.js");
    await runAcaHeadlessRestart();
    return;
  }

  // ---- Health check (no build, no start) --------------------------------
  if (mode === "health") {
    try {
      const res = await fetch(`http://localhost:${composeAdminPort}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const body = await res.json();
        console.log(JSON.stringify(body, null, 2));
        process.exit(0);
      } else {
        console.error(`ヘルスチェックに失敗しました: ${res.status} ${res.statusText}`);
        process.exit(1);
      }
    } catch {
      console.error("スタックが起動していないか到達不可です。");
      process.exit(1);
    }
  }

  // ---- Stop -------------------------------------------------------------
  if (mode === "stop") {
    console.log("スタックを停止中...");
    await stopContainer("polyclaw-admin");
    console.log("停止しました。");
    process.exit(0);
  }

  // ---- Start mode (scriptable, headless) --------------------------------
  if (mode === "start") {
    console.log("polyclaw をビルドして起動中...");
    const instanceId = await ensureStack(adminPort, botPort);
    const { url } = await resolveAdminUrl(composeAdminPort);

    console.log(`Runtime: http://localhost:8080`);
    console.log(`Admin:   ${url}`);

    wireShutdown(instanceId);

    console.log("サーバーの起動を待機中...");
    await waitOrDie(`http://localhost:${composeAdminPort}`, instanceId);
    console.log("サーバーの準備が完了しました。Ctrl+C で停止します。");
    await new Promise(() => {});
    return;
  }

  // ---- Run mode (single prompt, headless) -------------------------------
  if (mode === "run") {
    const prompt = process.argv.slice(3).join(" ").trim();
    if (!prompt) {
      console.error("使い方: polyclaw-cli run <プロンプト>");
      process.exit(1);
    }

    const baseUrl = `http://localhost:${composeAdminPort}`;

    // Check if the stack is already running -- skip build/start if so.
    let instanceId = "";
    let alreadyRunning = false;
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
      alreadyRunning = res.ok;
    } catch { /* not running */ }

    if (alreadyRunning) {
      instanceId = "polyclaw-admin";
    } else {
      console.log("polyclaw をビルドして起動中...");
      instanceId = await ensureStack(adminPort, botPort, (line) => {
        if (process.env.VERBOSE) console.log(line);
      });

      console.log("サーバーの起動を待機中...");
      await waitOrDie(baseUrl, instanceId);
    }

    const { secret } = await resolveAdminUrl(composeAdminPort);

    // Send the prompt via the chat WebSocket
    let response = "";
    try {
      const wsUrl = secret
        ? `ws://localhost:${composeAdminPort}/api/chat/ws?token=${secret}`
        : `ws://localhost:${composeAdminPort}/api/chat/ws`;
      const ws = new WebSocket(wsUrl);

      response = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("チャット応答が 120 秒でタイムアウトしました"));
        }, 120_000);

        const chunks: string[] = [];

        ws.onopen = () => {
          ws.send(JSON.stringify({
            action: "send",
            text: prompt,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            if (data.type === "delta" && data.content) {
              chunks.push(data.content);
            } else if (data.type === "done" || data.type === "end") {
              clearTimeout(timeout);
              ws.close();
              resolve(chunks.join(""));
            } else if (data.type === "error") {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(data.content || data.message || "チャットエラー"));
            }
          } catch {
            // Non-JSON message, ignore
          }
        };

        ws.onerror = (err) => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket エラー: ${err}`));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (chunks.length > 0) {
            resolve(chunks.join(""));
          }
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`チャットに失敗しました: ${msg}`);
      if (!alreadyRunning) await stopContainer(instanceId);
      process.exit(1);
    }

    console.log(response);
    if (!alreadyRunning) await stopContainer(instanceId);
    process.exit(0);
  }

  // ---- Bot-only mode (headless) -----------------------------------------
  console.log("polyclaw をビルド中...");
  console.log("");

  const instanceId = await ensureStack(adminPort, botPort);
  const { url: adminUrl } = await resolveAdminUrl(composeAdminPort);

  console.log(`Runtime はポート 8080 | Admin はポート ${composeAdminPort}`);
  console.log(`Admin: ${adminUrl}`);
  console.log("");

  wireShutdown(instanceId);

  console.log("サーバーの起動を待機中...");
  await waitOrDie(`http://localhost:${composeAdminPort}`, instanceId);
  console.log("サーバーの準備が完了しました。Ctrl+C で停止します。");
  await new Promise(() => {});
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("致命的エラー:", msg);
  process.exit(1);
});
