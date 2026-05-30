/**
 * Azure Container Apps deployment target.
 *
 * Architecture: **local admin (permanent) + runtime deployed to ACA**.
 *
 * The TUI starts the admin container locally via ``docker compose up
 * admin``.  It calls ``POST /api/setup/aca/deploy`` which tags and pushes
 * the locally-built image to ACR, provisions ACA infrastructure, and
 * deploys the **runtime container only** to ACA with external ingress
 * restricted to the deployer's IP.
 *
 * The local admin stays running permanently and proxies ``/api/*``
 * requests to the ACA runtime via ``RUNTIME_URL``.  The admin is
 * **never** deployed to ACA.
 *
 * External communication (bots, channels) flows through the local
 * tunnel -> local admin -> ACA runtime.
 *
 * Prerequisites: ``az`` CLI installed and logged in, Docker running.
 */

import { resolve } from "path";
import type { DeployResult, LogStream } from "../config/types.js";
import type { DeployTarget } from "./target.js";
import { exec } from "./process.js";
import {
  buildImage,
  buildAcaImage,
  stopContainer,
  getAdminSecret,
  resolveKvSecret,
  waitForReady,
  writeAzureOverride,
} from "./docker.js";

const PROJECT_ROOT = resolve(import.meta.dir, "../../../..");

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

export async function checkAzCliInstalled(): Promise<boolean> {
  try {
    const { exitCode } = await exec(["az", "version"]);
    return exitCode === 0;
  } catch {
    return false;
  }
}

export async function checkAzLoggedIn(): Promise<{ loggedIn: boolean; account?: string }> {
  try {
    const { stdout, exitCode } = await exec(["az", "account", "show", "--output", "json"]);
    if (exitCode !== 0) return { loggedIn: false };
    const data = JSON.parse(stdout);
    return {
      loggedIn: true,
      account: `${data.user?.name || "?"} (${data.name || data.id || "?"})`,
    };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Check whether the admin container is running and already has an ACA
 * deployment.  Returns a lightweight info object or ``null``.
 */
export async function getExistingDeployment(): Promise<{ appName: string; fqdn: string } | null> {
  try {
    let secret = await getAdminSecret();
    if (secret.startsWith("@kv:")) secret = await resolveKvSecret(secret);
    const headers: Record<string, string> = {};
    if (secret) headers["Authorization"] = `Bearer ${secret}`;
    const res = await fetch("http://localhost:9090/api/setup/aca/status", {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { deployed?: boolean; runtime_fqdn?: string };
    if (data.deployed && data.runtime_fqdn) {
      return { appName: "polyclaw-runtime", fqdn: data.runtime_fqdn };
    }
  } catch {
    /* admin not running or ACA not deployed */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Remove deployment
// ---------------------------------------------------------------------------

export async function removeDeployment(onLine?: (line: string) => void): Promise<boolean> {
  const log = onLine || (() => {});

  // Try the admin's destroy endpoint first
  try {
    log("Admin に ACA デプロイの撤去をリクエスト中...");
    let secret = await getAdminSecret();
    if (secret.startsWith("@kv:")) secret = await resolveKvSecret(secret);
    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) authHeaders["Authorization"] = `Bearer ${secret}`;
    const res = await fetch("http://localhost:9090/api/setup/aca/destroy", {
      method: "POST",
      headers: authHeaders,
      body: "{}",
      signal: AbortSignal.timeout(120_000),
    });
    const data = (await res.json()) as {
      status: string;
      steps?: Array<{ step: string; status: string }>;
    };
    for (const step of data.steps || []) {
      log(`  ${step.step}: ${step.status}`);
    }
    log(data.status === "ok" ? "ACA デプロイを削除しました。" : "警告: 一部の撤去ステップが失敗した可能性があります。");
  } catch {
    log("Admin に接続できません。ACA 撤去をスキップします。");
  }

  // Stop the local admin container
  log("Admin コンテナを停止中...");
  await stopContainer("polyclaw-admin");
  log("完了。");
  return true;
}

// ---------------------------------------------------------------------------
// ACA Deploy Target
// ---------------------------------------------------------------------------

export class AcaDeployTarget implements DeployTarget {
  readonly name = "Azure Container Apps";
  readonly lifecycleTied = false;

  private _secret = "";
  private _imageTag = "aca";

  constructor(private _reconnect = false) {}

  /** Build auth headers for admin API calls. */
  private _authHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this._secret) h["Authorization"] = `Bearer ${this._secret}`;
    return h;
  }

  /**
   * Deploy flow:
   * 1. Build image + start admin container locally
   * 2. Wait for admin to be healthy
   * 3. If reconnecting, check for existing ACA deployment
   * 4. Call POST /api/setup/aca/deploy on the local admin
   * 5. Admin handles: docker push to ACR, ACA infra, runtime container
   * 6. Return local admin URL (admin stays running permanently)
   */
  async deploy(
    adminPort: number,
    botPort: number,
    mode: string,
    onLine?: (line: string) => void,
  ): Promise<DeployResult> {
    const log = onLine || (() => {});
    const localUrl = "http://localhost:9090";

    // -- Step 1: Start local admin container --------------------------------
    if (this._reconnect) {
      log("Admin コンテナの稼働状況を確認中...");
      const healthy = await waitForReady(localUrl, 5_000);
      if (!healthy) {
        log("Admin が未起動です。イメージをビルドして起動中...");
        // Build the native image for the local admin container
        const localOk = await buildImage(onLine);
        if (!localOk) throw new Error("Docker compose build に失敗");
        // Build the amd64 image for ACA runtime (pushed to ACR later)
        log("ACA 用の linux/amd64 イメージをビルド中...");
        const acaOk = await buildAcaImage(this._imageTag, onLine);
        if (!acaOk) throw new Error("Docker build (linux/amd64) に失敗");
        await this._startAdminOnly(adminPort, botPort, mode);
      }
    } else {
      log("Docker イメージをビルド中...");
      const localOk = await buildImage(onLine);
      if (!localOk) throw new Error("Docker compose build に失敗");

      log("ACA 用の linux/amd64 イメージをビルド中...");
      const acaOk = await buildAcaImage(this._imageTag, onLine);
      if (!acaOk) throw new Error("Docker build (linux/amd64) に失敗");

      log("ローカル Admin コンテナを起動中...");
      await this._startAdminOnly(adminPort, botPort, mode);
    }

    // -- Step 2: Wait for local admin to be healthy -----------------------
    log("ローカル Admin のヘルスチェック待ち...");
    const healthy = await waitForReady(localUrl, 120_000);
    if (!healthy) throw new Error("Admin コンテナの起動に失敗。確認: docker logs polyclaw-admin");
    log("ローカル Admin が正常稼働。");

    // -- Fetch admin secret for authenticated API calls -------------------
    this._secret = await getAdminSecret();
    if (this._secret.startsWith("@kv:")) {
      log("Key Vault から Admin secret を解決中...");
      this._secret = await resolveKvSecret(this._secret);
    }
    if (!this._secret) {
      log("警告: Admin secret を取得できませんでした。API 呼び出しが失敗する可能性があります。");
    }

    // -- Step 3: Check for existing ACA deployment (reconnect) ------------
    if (this._reconnect) {
      const existing = await this._checkExistingAca(localUrl, log);
      if (existing) {
        return { baseUrl: existing, instanceId: "polyclaw-admin", reconnected: true };
      }
      log("既存の ACA デプロイなし。新規デプロイ中...");
    }

    // -- Step 4: Trigger ACA deployment via local admin API ---------------
    log("ACA デプロイを起動中 (ビルド済みイメージを ACR に push)...");
    log("ランタイムを ACA にデプロイします。30〜40 分かかる場合があります。");

    const deployRes = await fetch(`${localUrl}/api/setup/aca/deploy`, {
      method: "POST",
      headers: this._authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        resource_group: "polyclaw-rg",
        location: "eastus",
        runtime_port: 8080,
        admin_port: 9090,
        image_tag: this._imageTag,
      }),
      signal: AbortSignal.timeout(2_700_000), // 45 min
    });

    const result = (await deployRes.json()) as {
      status: string;
      message: string;
      runtime_fqdn?: string;
      steps?: Array<{ step: string; status: string; detail?: string }>;
      deploy_id?: string;
    };

    // Log each step
    for (const step of result.steps || []) {
      const icon = step.status === "ok" ? "+" : step.status === "skipped" ? "-" : "!";
      log(`  [${icon}] ${step.step}${step.detail ? `: ${step.detail}` : ""}`);
    }

    if (result.status !== "ok" || !result.runtime_fqdn) {
      throw new Error(`ACA デプロイに失敗: ${result.message}`);
    }

    log(`ACA ランタイム (外部、IP ホワイトリスト適用): https://${result.runtime_fqdn}`);
    log("ローカル Admin は引き続き稼働 -- RUNTIME_URL 経由で ACA ランタイムをプロキシ。");
    return { baseUrl: localUrl, instanceId: "polyclaw-admin", reconnected: false };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Start only the admin service from docker-compose.yml. */
  private async _startAdminOnly(
    _adminPort: number,
    _botPort: number,
    _mode: string,
  ): Promise<void> {
    // Stop any existing stack first
    try {
      await exec(["docker", "compose", "down", "--remove-orphans"], PROJECT_ROOT);
    } catch { /* may not be running */ }

    writeAzureOverride();

    const { exitCode, stderr } = await exec(
      ["docker", "compose", "up", "-d", "admin"],
      PROJECT_ROOT,
    );
    if (exitCode !== 0) {
      throw new Error(`docker compose up admin failed (exit ${exitCode}): ${stderr}`);
    }
  }

  /** Check if ACA deployment exists and runtime is reachable. */
  private async _checkExistingAca(
    localUrl: string,
    log: (line: string) => void,
  ): Promise<string | null> {
    try {
      const res = await fetch(`${localUrl}/api/setup/aca/status`, {
        headers: this._authHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        deployed?: boolean;
        runtime_fqdn?: string;
      };
      if (data.deployed && data.runtime_fqdn) {
        log(`既存の ACA デプロイを検出: runtime ${data.runtime_fqdn}`);
        log("再接続中 -- ローカル Admin は引き続き稼働。");
        return localUrl;
      }
    } catch { /* not deployed */ }
    return null;
  }

  streamLogs(_instanceId: string, _onLine: (line: string) => void): LogStream {
    // For ACA, we can't stream Docker logs. Return a no-op stream.
    return {
      stop: () => {},
    };
  }

  async waitForReady(baseUrl: string, timeoutMs?: number): Promise<boolean> {
    return waitForReady(baseUrl, timeoutMs);
  }

  async disconnect(_instanceId: string): Promise<void> {
    // ACA deployments are not tied to the TUI lifecycle.
    // Nothing to stop.
  }

  async getAdminSecret(_instanceId?: string): Promise<string> {
    return this._secret || getAdminSecret();
  }

  async resolveKvSecret(secret: string, instanceId?: string): Promise<string> {
    return resolveKvSecret(secret, instanceId);
  }
}
