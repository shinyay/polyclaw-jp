# 設定モデルの現状分析

> RC-1 成果物。**現状把握のみ**。改善案は RC-3 〜 RC-5 で議論。

## エグゼクティブサマリ

polyclaw の設定アクセスは **4 つの異なるレイヤー** から可能だが、各レイヤーがアクセス可能なキー集合が一致しておらず、ユーザに混乱を与える。

特に **`FOUNDRY_ENDPOINT` は Web UI から設定できない** (本日 2026-05-30 のセッションで実体験)。

## 四層構造

```mermaid
flowchart TD
    User[ユーザ] --> SW[Setup wizard]
    User --> UI[Web UI 設定保存]
    User --> Manual[手動 .env 編集]
    Operator[Operator/DevOps] --> ENV[環境変数]

    SW --> EnvFile[/data/.env]
    UI --> WhitelistRoute[/api/setup/config\nALLOWED_KEYS のみ]
    WhitelistRoute --> EnvFile
    Manual --> EnvFile
    ENV --> Settings
    EnvFile --> Settings
    KV[Azure Key Vault\n@kv: prefix] --> Settings
    Settings --> AgentCode[agent.py / byok.py / その他]

    style WhitelistRoute fill:#fcc,color:#000
    style EnvFile fill:#ffc,color:#000
    style Settings fill:#cfc,color:#000
```

赤 = 制約付き、黄 = 全キー書き込み可能、緑 = 全キー読み取り可能。

## Layer 1: `Settings` singleton (read source of truth)

| 項目 | 内容 |
|---|---|
| ファイル | `app/runtime/config/settings.py` |
| 行数 | 266 行 |
| 型 | `dataclass` (frozen ではない) |
| キー数 | 約 70 |
| 取得方法 | `from ..config.settings import cfg` で singleton 取得 |
| データソース優先順位 | 環境変数 → DOTENV → POLYCLAW_DATA_DIR/.env → ./.env |
| KV 解決 | `@kv:secret-name` prefix の値を Key Vault 経由で解決 |

### 主要キー (抜粋)

| キー | 用途 | デフォルト | 注記 |
|---|---|---|---|
| `FOUNDRY_ENDPOINT` | BYOK モード切替の根幹 | (none) | Web UI 設定 **不可** |
| `COPILOT_MODEL` | 使用モデル | `gpt-4.1` | Web UI 設定可能 |
| `BOT_PORT` | Bot 待受 port | 3978 | Web UI 設定可能 |
| `ADMIN_SECRET` | Web UI 認証 token | (auto-generated) | entrypoint で生成、書き換え禁止 |
| `RUNTIME_URL` | admin → runtime プロキシ URL | (auto) | ACA/Docker 切替時 stale 削除あり |
| `RUNTIME_SP_APP_ID` | runtime SP credential | (none) | Setup wizard が provision |
| `RUNTIME_SP_PASSWORD` | runtime SP credential | (none) | KV 推奨 (`@kv:` prefix) |
| `RUNTIME_SP_TENANT` | runtime SP credential | (none) | |
| `KV_URL` | Key Vault endpoint | (none) | KV 機能の前提 |
| `ACS_*` | Azure Communication Services | (none) | Voice 機能用 |
| `AOAI_*` | Azure OpenAI for voice | (none) | Voice 機能用 |
| `POLYCLAW_DATA_DIR` | データルート | `/data` (container) | 通常変更不要 |

## Layer 2: `/data/.env` ファイル (persistent storage)

| 項目 | 内容 |
|---|---|
| パス | `/data/.env` (container) または `./.env` (ローカル) |
| 読み込み | `entrypoint.sh` L66-71 で起動時に source |
| 書き込み主体 | (1) admin の Setup wizard 経由 (2) 手動 docker exec (3) Web UI 設定保存 |
| フォーマット | KEY=VALUE (shell 形式) |
| パーミッション | container 内 root 所有 |
| 共有範囲 | `polyclaw-data` named volume 経由で admin / runtime 両 container が読む |

### 観察 (2026-05-30 R2-pure 実験から)

- admin が起動時に書き込む例: `ADMIN_SECRET="wP50F5ixFn8NHyEhG9z75q4FceV58Y3S"`
- 手動投入が必要だった例: `FOUNDRY_ENDPOINT=https://.../` + `COPILOT_MODEL=gpt-4.1`
- 上書きリスク: 全文置換すると `ADMIN_SECRET` が消える (rubber-duck 指摘で気付いた)

## Layer 3: Web UI 設定保存 API

| 項目 | 内容 |
|---|---|
| ファイル | `app/runtime/server/setup/_routes.py` L438-441 |
| エンドポイント | `POST /api/setup/config` |
| ホワイトリスト | `_ALLOWED_CONFIG_KEYS = {COPILOT_MODEL, BOT_PORT}` |
| 効果 | この 2 キーのみ Web UI 経由で永続化可能 |

### 問題

- `FOUNDRY_ENDPOINT`, `KV_URL`, `RUNTIME_SP_*`, `ACS_*` 等は Web UI で触れない
- ユーザは「設定画面に項目がない → 設定できない」と判断する
- 実際は Setup wizard か手動 .env 編集が必要だが、その誘導 UI がない

## Layer 4: Setup wizard

| 項目 | 内容 |
|---|---|
| ファイル | `app/frontend/src/pages/SetupWizard.tsx` (推定 600+ 行) |
| 役割 | Azure provisioning + SP creation + ACS / AOAI 設定をガイド |
| エンドポイント | Layer 3 とは別の specialized endpoints |
| 設定範囲 | Azure 関連 (deployment, SP, ACS, AOAI), GitHub Copilot OAuth など |
| 制約 | Azure subscription level の admin 権限が前提 |

## 散らかりっぷり: 同じ設定キーの「設定方法」マトリクス

| キー | env 変数 | .env 手動編集 | Web UI 保存 | Setup wizard | 一貫性 |
|---|---|---|---|---|---|
| `COPILOT_MODEL` | ✅ | ✅ | ✅ | ❌ | 🟢 |
| `BOT_PORT` | ✅ | ✅ | ✅ | ❌ | 🟢 |
| `FOUNDRY_ENDPOINT` | ✅ | ✅ | ❌ | △ (間接) | 🔴 |
| `RUNTIME_SP_*` | ✅ | ✅ | ❌ | ✅ (provision) | 🟡 |
| `ACS_*` | ✅ | ✅ | ❌ | ✅ | 🟡 |
| `AOAI_*` | ✅ | ✅ | ❌ | ✅ | 🟡 |
| `KV_URL` | ✅ | ✅ | ❌ | ❌ | 🔴 |
| `ADMIN_SECRET` | ❌ (auto) | ⚠️ (壊す) | ❌ | ❌ | 🟢 (意図通り) |

🔴 = ユーザ困惑大、🟡 = Setup wizard 経由で間接的に可、🟢 = 一貫

## 課題リスト (RC-3 〜 RC-5 で対処)

| # | 課題 | 影響 | 対処 Phase |
|---|---|---|---|
| C-01 | `Settings` が dataclass だが frozen でない → 実行時改変リスク | 内部品質 | RC-3 |
| C-02 | キー追加時に 3-4 場所更新が必要 (Settings, .env doc, _ALLOWED_CONFIG_KEYS, Setup wizard) | DX | RC-4 |
| C-03 | 設定の出所が runtime で不明 (環境変数 / .env / KV のどれから来たか log されない) | デバッグ | RC-3 |
| C-04 | `_ALLOWED_CONFIG_KEYS` ホワイトリストが厳しすぎる | UX | RC-4 |
| C-05 | Setup wizard と Web UI 設定保存が別物体験 | UX | RC-7 |
| C-06 | rebuild 不要な設定変更で container restart が必要 (起動時のみ読まれる) | UX | RC-3 |
| C-07 | `.env` 書き込み時に既存キー保護がない (全文上書きで壊す) | データ完全性 | RC-4 |

## 参考: 本日 (2026-05-30) の体感事例

ユーザが「polyclaw-jp で日本語 LLM 応答を見たい」と要望 → 必要な設定は `FOUNDRY_ENDPOINT` だけだが:

1. Web UI に設定欄なし (C-04)
2. Setup wizard は SP 作成前提で重い (本ケースでは不要)
3. 結局 `docker exec polyclaw-runtime sed -i ... && cat >> /data/.env` の手動操作 (C-04 + C-07)
4. `docker compose restart runtime` で再読込 (C-06)

この体験全体が、polyclaw-jp 配布の adoption 障壁になる。
