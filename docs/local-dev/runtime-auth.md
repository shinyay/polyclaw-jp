# ローカル開発: Runtime コンテナの Azure 認証

このドキュメントは **ローカル PC で `docker compose` を使って polyclaw を動かす開発者** 向けです。Azure Container Apps へデプロイした polyclaw を使うエンドユーザには関係ありません。

## TL;DR

`scripts/run-tui.sh` は TUI 起動前に **host の `~/.azure/` を `polyclaw-runtime` コンテナの `/runtime-home/.azure/` に冪等 cp** します。これにより BYOK (Foundry Bring Your Own Key) 経由の chat 推論が成功するようになります。手動で何かをする必要は通常ありません。

```bash
docker compose up -d --build
az login                          # 未 login の場合のみ
./scripts/run-tui.sh              # 内部で docker cp が走る
```

## なぜ必要か

### 認証経路の設計

`polyclaw-runtime` コンテナ (`entrypoint.sh`) は起動時に 3 つの認証経路を試します:

| # | 経路 | 必要条件 | 主なユースケース |
|---|------|---------|----------------|
| 1 | Managed Identity | `POLYCLAW_USE_MI=1` + ACA 環境 | Azure Container Apps 本番 |
| 2 | Service Principal | `RUNTIME_SP_APP_ID` + `RUNTIME_SP_PASSWORD` + `RUNTIME_SP_TENANT` env | Docker Compose の正規 SP ルート |
| 3 | いずれもなし | (デフォルト) | ローカル開発 |

ローカル開発 (Docker Compose) では `POLYCLAW_USE_MI` も SP env も与えないため、entrypoint は次のメッセージで起動します:

```
Runtime: no identity credentials found. Running without Azure CLI access.
         Bot endpoint updates will not work until admin provisions a runtime identity.
```

この状態で `app/runtime/agent/byok.py` が `az account get-access-token` を呼ぶと:

```
[byok] az get-access-token failed: ERROR: Please run 'az login' to setup account.
[byok] no bearer token -- Foundry BYOK will not work
```

→ Foundry に bearer token を渡せず、最終的に 360 秒で `[chat.send_prompt] empty response -- model may have timed out` でタイムアウトします。

### 解決手段: host credential を runtime に流す

`runtime` コンテナの `HOME=/runtime-home` (entrypoint で `export`) は **ephemeral** (named volume なし、container 再生成で消失) です。ここに host の `~/.azure/` を `docker cp` で注入すれば、`byok.py` が subprocess で起動する `az` がその credential を読んで token を取得できます。

```
host ~/.azure/  ──docker cp──▶  /runtime-home/.azure/
                                       │
                                       ▼
                            byok.py subprocess → az get-access-token → ✅
```

## いつ再注入が必要か

| 操作 | 再注入の要否 |
|------|------------|
| `docker compose up -d --build` | ⚠️ 必須 (image rebuild + container 再生成) |
| `docker compose down && up -d` | ⚠️ 必須 (container 再生成) |
| `docker compose restart polyclaw-runtime` | ⚠️ 必須 (ephemeral HOME がリセットされる) |
| `docker compose start/stop` (rebuild なし) | ✅ 不要 (1 回 cp すれば残る) |
| host で `az logout` → `az login` | ⚠️ 必須 (新しい token cache を反映するため) |

`scripts/run-tui.sh` は **毎回 TUI 起動前に cp する** ため、上記いずれの場合も script 経由なら自動で対処されます。

## 自動化されている範囲

`scripts/run-tui.sh` 内のロジック (抜粋):

```bash
if command -v docker >/dev/null 2>&1 \
    && docker inspect --type container polyclaw-runtime >/dev/null 2>&1 \
    && [[ -d "${HOME}/.azure" ]]; then
    docker cp "${HOME}/.azure/." polyclaw-runtime:/runtime-home/.azure/
fi
```

- ✅ Docker CLI がない環境 → skip
- ✅ `polyclaw-runtime` コンテナが存在しない (Azure deploy 経路など) → skip
- ✅ host に `~/.azure/` がない → skip
- ✅ cp が失敗しても TUI 起動は継続 (WARNING を出すのみ)

## 手動でやる場合

`scripts/run-tui.sh` を経由せずに `app/tui/run.sh` などを直接実行する場合、または cp 結果を確認したい場合:

```bash
# (1) Container が起動していることを確認
docker inspect --format='{{.State.Status}}' polyclaw-runtime
# → running

# (2) host で az login していることを確認
az account show --output table

# (3) Cp を手動実行
docker cp ~/.azure/. polyclaw-runtime:/runtime-home/.azure/

# (4) Container 内 az が token を取れるか確認 (byok と同じ env を指定)
docker exec \
    -e HOME=/runtime-home \
    -e AZURE_CONFIG_DIR=/runtime-home/.azure \
    polyclaw-runtime \
    az account get-access-token \
        --resource https://cognitiveservices.azure.com \
        --query expiresOn -o tsv
# → 例: 2026-05-30 13:33:58.000000
```

## トラブルシュート

### 症状: `[エラー]: The model did not respond. ...` がチャットで返る

→ Foundry BYOK 認証失敗 (タイムアウト) の典型。`docker logs polyclaw-runtime 2>&1 | grep byok` で確認:

```
[byok] az get-access-token failed: ERROR: Please run 'az login' to setup account.
[byok] no bearer token -- Foundry BYOK will not work
```

これが出ていれば本ドキュメントの手順 (cp 再実行) で解決します。

### 症状: `docker exec polyclaw-runtime az account show` が `Please run 'az login'` を返す

これは **`docker exec` が entrypoint の env を引き継がない** ため正常な現象です。`docker exec` は default で `HOME=/root` (空) を見ますが、byok subprocess は entrypoint 内で起動するため `HOME=/runtime-home` を見ます。byok の挙動を再現するには `-e HOME=/runtime-home -e AZURE_CONFIG_DIR=/runtime-home/.azure` を明示してください (上の手順 (4) 参照)。

### 症状: host で `az account get-access-token` 自体が失敗する

host 側の `az` が auth 切れです。`az login` で再認証してから `scripts/run-tui.sh` を再実行してください。

## 関連 file

- `entrypoint.sh` (L9〜170 付近): runtime container の認証パイプライン本体
- `app/runtime/agent/byok.py`: BYOK provider config と bearer token 取得 (subprocess で `az` を呼ぶ)
- `app/runtime/config/settings.py`: `FOUNDRY_ENDPOINT` 等の関連設定
- `docker-compose.yml`: `polyclaw-runtime` サービス定義 (`POLYCLAW_DATA_DIR=/data` 等)
- `docs/refactor/auth-pipeline.md`: 認証パイプラインのリファクタリング計画 (RC-6 で AuthProvider 抽象化予定)

## 将来の改善 (RC-6 候補)

現状の手動 / scripts/ 経由の cp はあくまでワークアラウンドです。RC-6 (`AuthProvider` 抽象化) で以下を実装する予定です:

- `AuthProvider` インターフェース化 (managed identity / SP / host cp / device code 等を pluggable に)
- ローカル開発時の credential 取得経路を `byok.py` に明示的な fallback として組み込む (subprocess 不要化、`azure-identity` Python SDK 直叩き等)
- エラーメッセージの改善 (現在の `model did not respond` は誤誘導なので、認証失敗時は専用メッセージを出す)

詳細は `docs/refactor/auth-pipeline.md` を参照してください。
