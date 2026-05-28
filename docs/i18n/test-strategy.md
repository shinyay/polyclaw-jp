# Polyclaw 日本語化 テスト戦略

## はじめに

- 本ドキュメントの目的は、日本語化作業に伴うテスト更新の方針を統一することです。
- A 案（全面日本語化）に伴い、ユーザ可視メッセージや LLM プロンプトは日本語になります。
- テストコードは「ユーザに見えるものは日本語、開発者しか見ないものは英語」に追従します。
- 内部ログ、docstring、コメント、開発者向け assertion diagnostic は英語維持を原則とします。
- ユーザ可視メッセージ、LLM プロンプト、`SKILL.md` 本文に対する assert は日本語化対象です。
- 本文中のファイル数、行数、影響ファイルは 2026-05-27 時点の実調査結果です。
- 調査は `app/runtime/tests/`、`app/frontend/e2e/`、`pyproject.toml`、`conftest.py` を対象にしました。
- このドキュメントは実装手順書ではなく、Phase ごとのテスト更新判断基準です。

## 0. 前提調査結果

### 0.2 Python テスト規模

- `app/runtime/tests/` の directory entry 数: 73
- `app/runtime/tests/*.py` の総行数: 19,020 行
- `test_*.py` の数: 71
- 追加の Python テスト関連ファイル: `__init__.py`, `conftest.py`
- 最大規模ファイル: `test_e2e_setup_process.py` (2,038 行)
- 次点: `test_monitoring.py` (722 行), `test_server_routes_extra.py` (654 行)
- `wc -l ... | tail -10` の末尾には `19020 total` が出力されました。

### 0.4 `conftest.py` から分かること

- root `conftest.py` は `--run-slow` と `--run-e2e-setup` を追加します。
- `@pytest.mark.slow` は `--run-slow` なしでは skip されます。
- `@pytest.mark.e2e_setup` は `--run-e2e-setup` なしでは skip されます。
- runtime `conftest.py` は autouse fixture を 2 つ持ちます。
- `_isolate_data_dir` は `POLYCLAW_DATA_DIR`, `POLYCLAW_PROJECT_ROOT`, `DOTENV_PATH` を tmp path に差し替えます。
- `_reset_singletons` は各テスト前後に `reset_all_singletons()` を呼びます。
- どちらの autouse fixture も `e2e_setup` marker 付きテストでは外部 Docker 駆動のため skip されます。
- `mock_agent` fixture は `agent.send.return_value = "mock response"` を返します。
- `mock response` は LLM モック値なので、原則として英語のまま許容します。
- ただし、LLM 応答の言語を検証するテストでは個別に日本語応答へ上書きします。

### 0.5 `pyproject.toml` の pytest 設定

```toml
[tool.pytest.ini_options]
testpaths = ["tests", "app/runtime/tests", "app/cli/tests"]
asyncio_mode = "auto"
filterwarnings = ["ignore::DeprecationWarning"]
markers = [
    "slow: marks tests as slow (skipped by default, include with '--run-slow')",
    "e2e_setup: full E2E setup-process test against real Azure (skipped by default, include with '--run-e2e-setup')",
]
```

### 0.6 grep で見つかった代表的な影響ファイル

- 英文 assert 候補の先頭 30 件には 28 ファイルが出ました。
- LLM 応答依存候補の必須 grep では 5 ファイルが出ました。
- エラー文言 assert 候補の必須 grep では 6 ファイルが出ました。
- 詳細 grep ではユーザ可視メッセージ候補を 13 ファイルに絞り込みました。
- 詳細 grep では LLM / prompt 依存候補を 9 テストファイル + `conftest.py` に絞り込みました。
- Markdown / SKILL / PLUGIN 内容依存候補は 6 ファイルです。
- 影響分類は overlap を許容します。
- 例: `test_chat_handler.py` はユーザ可視 message と LLM 応答の両方に該当します。

### 0.7 Frontend E2E 調査結果

- `app/frontend/e2e/` には 9 TypeScript ファイルがあります。
- 総行数は 1,604 行です。
- spec ファイルは 8 件、helper は `helpers.ts` 1 件です。
- 現状の locator は `getByText`, `getByRole`, `getByPlaceholder` が中心です。
- `getByTestId` / `data-testid` の利用は検出されませんでした。
- `toHaveScreenshot` / `toMatchSnapshot` は現状検出されませんでした。
- ただし日本語化後の visual diff 発生に備え、baseline 方針は Phase 5 に定めます。

### 0.8 Frontend E2E ファイル別 locator 数

| ファイル | 行数 | text | role | placeholder | text assert | testid | screenshot |
|---|---:|---:|---:|---:|---:|---:|---:|
| `auth.spec.ts` | 98 | 1 | 1 | 2 | 0 | 0 | 0 |
| `chat.spec.ts` | 92 | 3 | 0 | 0 | 1 | 0 | 0 |
| `environments-workspace-foundry.spec.ts` | 219 | 25 | 10 | 1 | 1 | 0 | 0 |
| `helpers.ts` | 492 | 0 | 0 | 0 | 0 | 0 | 0 |
| `mcp-schedules-proactive.spec.ts` | 229 | 29 | 20 | 1 | 0 | 0 | 0 |
| `sessions.spec.ts` | 75 | 10 | 3 | 0 | 0 | 0 | 0 |
| `settings-profile.spec.ts` | 149 | 14 | 9 | 1 | 0 | 0 | 0 |
| `setup.spec.ts` | 81 | 6 | 4 | 4 | 0 | 0 | 0 |
| `skills-plugins.spec.ts` | 169 | 15 | 17 | 0 | 0 | 0 | 0 |

## 1. 全体方針

### 1.1 4 つの選択肢の比較

| アプローチ | 説明 | 採否 |
|---|---|---|
| A. assert を日本語に直接書き換え | 可読性が高く、実際の UI / API 文言をそのまま検証できる。訳語変更時は再修正が必要。 | **採用**（ユニットテスト） |
| B. i18n key 比較に置換 | i18n フレームワークを導入する場合は安定するが、今回は i18n フレームワーク不使用方針のため不可。 | 不採用 |
| C. 部分一致 + 言語非依存 key | 例: `assert response.code == "SAVED"`。HTTP status や JSON key は互換性維持に向く。 | 一部採用（HTTP 応答） |
| D. data-testid 中心、テキスト assert 最小化 | Playwright の locator を翻訳に強くできる。UI の翻訳品質は必要箇所だけ text assert で見る。 | **採用**（Frontend E2E） |

### 1.2 採用方針（まとめ）

- Python ユニットテスト: 日本語直書き assert（A）
- HTTP API レスポンス（key 化されているもの）: status code + code key 比較（C）
- Frontend E2E（Playwright）: data-testid ロケータ中心、テキスト assert は最小化（D）
- スクリーンショット baseline: A 案実装完了時（Phase 5）に一括リセット
- LLM 応答テスト: judge prompt も日本語化、mock 応答は英語のまま許容
- 内部ログ（logger）: 英語維持のため、ログ assert は変更不要
- docstring / コメント / test diagnostic message: 開発者向けなので英語維持
- API の `status: "ok"` / `status: "error"`: consumer 互換のため英語維持
- API の `code: "INVALID_INPUT"` のような machine-readable code: 英語維持

### 1.3 判断ルール

- ブラウザ、チャット、Telegram、電話、TUI に表示される文字列は日本語 assert に変更します。
- LLM に渡す system / developer / task prompt は日本語 assert に変更します。
- `SKILL.md` body は LLM が読むユーザ向け instruction として日本語 assert に変更します。
- `PLUGIN.json` の `id`, skill id, dependency name は英語維持です。
- mock の入力値として置いた英語は、出力仕様でなければ変更不要です。
- failure message だけの `assert condition, "Failed to ..."` は開発者向けなので変更不要です。
- `pytest.raises(..., match="...")` は例外が API 境界外の内部例外なら英語維持です。
- 同じ例外文が UI / API に露出する場合のみ日本語化します。

## 2. レイヤ別影響分析

### 2.1 Python ユニットテスト（`app/runtime/tests/`）

#### 2.1.1 ファイル総数と規模

- 総ファイル数: 73 Python ファイル
- `test_*.py`: 71 ファイル
- 補助ファイル: `__init__.py`, `conftest.py`
- 総行数: 19,020 行
- `--run-slow` で除外されるテストは Phase 5 で別途検証します。
- `--run-e2e-setup` で除外される Azure 実環境 E2E は Phase 5 で別途検証します。
- 通常の Phase 内確認では marker なしの targeted pytest を優先します。
- 影響分類は重複ありです。
- 直接文言 assert の最優先はカテゴリ A です。
- prompt / template 変更と同時に壊れる可能性が高いのはカテゴリ B と C です。

#### 2.1.2 影響カテゴリ別ファイルリスト

##### A. ユーザ可視メッセージに依存するテスト（直接書換要）

- 判定数: 18 ファイル
- 判定基準: API `message` / `detail`、WebSocket `content`、command reply、ユーザに返る tool result を assert していること。
- `test_commands.py` — command reply 全般。例: line 40 `Commands`, line 68 `New session`, line 77 `Current model`, line 180 `Cannot set`, line 332 `Scheduled task created`。
- `test_chat_handler.py` — WebSocket message content。例: line 92 session/new, line 102 clear/removed, line 152 `Unknown action`, line 163 `not found`。
- `test_bot_endpoint.py` — Bot endpoint error message。例: line 41 `not configured`。
- `test_bot_handler.py` — bot reply activity text。例: line 94-97 `_reply(ctx, "Hello!")` と送信 text。
- `test_content_safety_routes.py` — Content Safety API message/detail/step detail。例: line 78, 92, 165, 275, 290, 316, 342, 368。
- `test_monitoring.py` — monitoring API message。例: line 519, 563, 576, 604, 645, 694, 718。
- `test_server_routes_extra.py` — server route message。例: line 123 `No manifest`。
- `test_prompt_shield.py` — shield result detail。例: line 101 `skipped`, line 177 `No endpoint`, line 218 `Token acquisition`。
- `test_azure_cli.py` — Azure CLI helper result message。例: line 107, 157, 193, 198, 233。
- `test_bicep_deploy.py` — deploy result error。例: line 106 `Resource group creation failed`, line 151 `Bicep deployment failed`。
- `test_smoke_test.py` — smoke test step detail exposed to status output。例: line 179, 249, 277, 297。
- `test_identity_routes.py` — identity route detail。例: line 154 `Role not assigned to this identity`, line 200 `wrong scope`。
- `test_hitl.py` — HITL confirmation / shield feedback。例: line 103-105 confirmation includes tool name and approval hint, line 336 `Attack found` mock detail。
- `test_scheduler.py` — scheduled notification message. 例: line 178 `Test`, line 179 `result text`, line 195 `(no output)`。
- `test_agent_tools.py` — LLM tool result messages. 例: `cancelled`, `not found`, `status: error` around schedule / voice call helpers。
- `test_extract_media.py` — media prompt text. 例: line 49 `Attached image`, line 58 `Attached document`。
- `test_media_outgoing.py` — outgoing media rejection reason. 例: line 132 `Too large`。
- `test_foundry_iq.py` — user-visible sync message. 例: line 205 `2 index`。

##### B. LLM プロンプト内容に依存するテスト

- 判定数: 10 ファイル
- 判定基準: `agent.send`, `run_one_shot`, `build_system_prompt`, transcript formatting, prompt body、LLM mock 応答に依存すること。
- `test_prompt.py` — `build_system_prompt()`、`bootstrap_prompt.md`、`system_prompt.md`、`mcp_guidance.md`、`sandbox_prompt.md` の組み立て。
- `test_memory.py` — transcript prefix。例: line 54 `User: hello`, line 55 `Assistant: hi`。
- `test_memory_formation.py` — transcript / session timing prompt。例: line 73 `User: Hello`, line 74 `Assistant: Hi!`, line 284 `No previous sessions`, line 294 `Total sessions recorded`, line 305 `Average gap`。
- `test_one_shot.py` — `_send_and_wait(session, "test prompt", ...)` と LLM 最終 text の捕捉。
- `test_realtime_tools.py` — `_run_one_shot_realtime` と `handle_invoke_agent`。例: line 93 `Error` / `no prompt`, line 99 `Response to: hello`。
- `test_agent.py` — `build_system_prompt` を patch した agent start / send flow。
- `test_agent_concurrency.py` — concurrent agent flows with `build_system_prompt` patch and `agent.send` mock。
- `test_chat_handler.py` — `agent.send = AsyncMock(return_value="bot reply")` を WebSocket output として扱う。
- `test_hitl.py` — HITL confirmation prompt / approval instruction が LLM またはユーザ判断に渡る。
- `test_extract_media.py` — `build_media_prompt()` が LLM に渡す添付説明文を生成する。

##### C. テンプレート / Markdown / SKILL.md 本文に依存するテスト

- 判定数: 9 ファイル
- 判定基準: runtime templates、Markdown prompt、`SKILL.md` body、plugin skill content、guardrails templates endpoint に依存すること。
- `test_prompt.py` — prompt template placeholders と rendered system prompt。
- `test_memory.py` — memory transcript format。日本語化後の `User:` / `Assistant:` 方針に追従。
- `test_memory_formation.py` — `memory_transcript_prompt.md` に渡る transcript / timing summary。
- `test_scheduler.py` — scheduler notification と `scheduler_prompt.md` 連携の周辺テスト。
- `test_skills_registry.py` — synthetic `SKILL.md` body と `get_skill_content()`。例: line 150-152 `My skill content`。
- `test_plugins_registry.py` — plugin `SKILL.md` / `PLUGIN.json` 内容。例: helper `_make_skill()` と setup skill body。
- `test_commands.py` — command 経由で skill / plugin / schedule 表示文が露出する。
- `test_server_routes_extra.py` — remote `.md` skill install / plugin route message。
- `test_e2e_setup_process.py` — `/api/guardrails/templates` を検証する E2E setup test。例: line 1083-1084。

##### D. 影響を受けないテスト（内部ロジック・モック・状態）

- 推定: 残り約 45-50 ファイル
- 例: `test_state_stores.py`、`test_async_helpers.py`、`test_env_file.py`、`test_json_store.py`、`test_settings.py`。
- 例: `test_singletons.py`、`test_session_store.py`、`test_deploy_state.py`、`test_resource_tracker.py`。
- 例: `test_tunnel_restriction.py`、`test_policy_bridge.py`、`test_guardrails_policy_validation.py`。
- 内部 ID、enum、status key、file existence、state persistence の検証は基本的に変更不要です。
- assertion diagnostic の英語は変更不要です。
- mock input の英語は output contract でない限り変更不要です。

#### 2.1.3 修正アプローチ

- assert 文字列は日本語直書きに変更します。
- ただし API の `status`, `code`, `id`, `type`, `name` は原則英語維持です。
- 長文メッセージは全文一致を避け、安定した日本語名詞・動詞語幹で部分一致します。
- エラー本文は「何が失敗したか」を示す語を優先して assert します。
- 文末の「です」「ました」「ください」は揺れやすいため、必要な場合だけ検証します。
- glossary がある場合は glossary の訳語と一致させます。
- glossary 未定義の用語はテスト修正時に glossary 追加を検討します。
- テスト入力としての英語（`"hello"`, `"test prompt"`）は必要がなければ維持します。
- ユーザに返る mock 応答だけを日本語に変更します。
- 失敗時診断メッセージ（`assert ok, "Deploy failed"`）は開発者向けなので英語維持です。

```python
# Before
assert "Failed to save" in response["message"]

# After
assert "保存" in response["message"]
```

```python
# 良い: 「保存」は訳語として安定
assert "保存" in response["message"]

# 避ける: 文末変更で壊れやすい
assert "保存できませんでした" in response["message"]
```

#### 2.1.4 pytest 実行方針

- Phase 中は対象ファイルだけを指定して実行します。
- 例: `pytest app/runtime/tests/test_prompt.py app/runtime/tests/test_memory_formation.py`
- marker なし通常テストを先に通します。
- slow / e2e_setup は Phase 5 で実環境条件を満たすときに実行します。
- autouse fixture により data dir と singleton は隔離されるため、文言変更テストも既存 isolation を使います。
- mock_agent fixture の `mock response` を一括変更しないでください。
- 必要なテストだけ `mock_agent.send.return_value = "保存しました"` のように上書きします。

### 2.2 Frontend E2E (Playwright)

#### 2.2.1 現状

- `app/frontend/e2e/` 配下に Playwright テストファイルがあります。
- TypeScript E2E ファイル数: 9
- spec ファイル数: 8
- helper ファイル数: 1 (`helpers.ts`)
- 総行数: 1,604 行
- `mockApi(page)` と `bypassAuth(page)` helper で test isolation しています。
- `playwright.config.ts` の `testDir` は `./e2e` です。
- `fullyParallel: true` です。
- preview server は `npm run preview -- --port 4173` です。
- `baseURL` は `http://localhost:4173` です。
- 現状は `getByText`, `getByRole({ name })`, `getByPlaceholder` が多用されています。
- `getByTestId` は現状 0 件です。
- `data-testid` も E2E / frontend src 検索では検出されませんでした。
- screenshot assertion は現状 0 件ですが、将来追加を想定して baseline 方針を定めます。

#### 2.2.2 影響範囲

- 全テキストベース locator（`getByText('Save')` 等）は日本語化の影響を受けます。
- `getByRole('button', { name: 'Save' })` も accessible name が翻訳されるため影響を受けます。
- `getByPlaceholder('Azure Bot App ID')` も placeholder 翻訳で影響を受けます。
- `locator('.class', { hasText: '...' })` も文言依存なので影響を受けます。
- mock data の固有名詞（`GitHub Status`, `daily-briefing`）は英語維持の場合があります。
- product label と mock fixture data を分けて判断します。
- visual baseline は現状なしですが、Phase 5 の方針に含めます。

#### 2.2.3 移行戦略

- 段階 1: 既存テストの locator を `data-testid` ベースに移行します。
- 各 Frontend コンポーネントの主要要素に `data-testid` を付与します。
- 例: `<button data-testid="save-button">保存</button>`
- Playwright: `page.getByTestId('save-button').click()`
- 段階 2: テキスト assert が必要な箇所は日本語化と同時に書き換えます。
- 例: `await expect(page.getByText('Save')).toBeVisible()` を避けます。
- 例: `await expect(page.getByTestId('save-button')).toBeVisible()` を優先します。
- 段階 3: UI 文言そのものを検証すべき代表箇所のみ `getByText('保存')` を残します。
- 段階 4: Phase 5 で screenshot baseline が存在する場合だけ一括更新します。
- 更新コマンドは `npx playwright test --update-snapshots` です。
- baseline diff は全件目視確認します。

#### 2.2.4 ファイル別優先度

- 最優先: `mcp-schedules-proactive.spec.ts`。text 29 件、role 20 件で最も影響が大きいです。
- 最優先: `environments-workspace-foundry.spec.ts`。text 25 件、role 10 件です。
- 高: `skills-plugins.spec.ts`。text 15 件、role 17 件です。
- 高: `settings-profile.spec.ts`。settings/profile の主要 UI 文言を広く検証しています。
- 中: `setup.spec.ts`。placeholder 4 件と setup wizard の文言を検証しています。
- 中: `sessions.spec.ts`。session UI の text locator が中心です。
- 低: `auth.spec.ts`。件数は少ないですが login label はユーザ可視です。
- 低: `chat.spec.ts`。件数は少ないですが message text の期待値は慎重に扱います。
- 変更不要: `helpers.ts`。現状 locator 文言 assert はありません。

### 2.3 HTTP API テスト

#### 2.3.1 方針

- ステータスコード + JSON 構造の検証は言語非依存です。
- `{"status": "error", "message": "..."}` の `message` フィールドは日本語化対象です。
- `status` フィールドの値（`"ok"`, `"error"`）は英語維持です。
- エラーコード文字列（`code: "INVALID_INPUT"` 等）は英語維持です。
- route path、query parameter、JSON key は英語維持です。
- API consumer 互換のため machine-readable field を翻訳しません。
- human-readable field だけ日本語 assert に変更します。

#### 2.3.2 例

```python
# Before
async def test_invalid_input(client):
    res = await client.post("/api/...", json={...})
    assert res.status == 400
    body = await res.json()
    assert body["status"] == "error"
    assert "missing field" in body["message"]

# After
async def test_invalid_input(client):
    res = await client.post("/api/...", json={...})
    assert res.status == 400
    body = await res.json()
    assert body["status"] == "error"  # 英語維持
    assert "必須" in body["message"]  # 日本語化
```

#### 2.3.3 対象候補

- `test_bot_endpoint.py`
- `test_content_safety_routes.py`
- `test_monitoring.py`
- `test_server_routes_extra.py`
- `test_identity_routes.py`
- `test_prompt_shield.py`
- `test_smoke_test.py`
- `test_foundry_iq.py`
- これらは HTTP status / JSON key は維持し、message / detail のみ置換します。

## 3. LLM 応答テスト

### 3.1 `mock_agent` の扱い

- `app/runtime/tests/conftest.py` の `mock_agent` fixture は `send.return_value = "mock response"` です。
- これは LLM をモックしているので、応答内容に依存するテストでなければ変更不要です。
- 一括で日本語化すると無関係なテスト差分が増えるため避けます。
- 必要に応じて個別テストで `mock_agent.send.return_value = "保存しました"` に上書きします。
- `test_chat_handler.py` の `bot reply` も、UI 出力として検証する場合だけ日本語化します。
- `test_agent_concurrency.py` の `bot reply` は並行制御テストなら英語維持可能です。

### 3.2 LLM-as-judge の日本語化

- `aitl_reviewer.py` の judge prompt も日本語化対象です。
- LLM が日本語応答を判断する必要があるためです。
- `memory_formation` の transcript prompt も日本語化します。
- `memory_transcript_prompt.md` は Phase 1 で変更します。
- `system_prompt.md` と `bootstrap_prompt.md` も Phase 1 で変更します。
- `scheduler_prompt.md` と `proactive_generate_prompt.md` も Phase 1 で変更します。
- judge prompt のテストでは「日本語応答を日本語基準で評価する」ことを確認します。

### 3.3 実 LLM を呼ぶテスト（`@pytest.mark.slow`）

- 環境変数で実 LLM への接続を制御します。
- 日本語化後は応答も日本語で来るため、assert を日本語化します。
- CI では `--run-slow` を付けません。
- slow テストは Phase 5 の手動検証枠に入れます。
- ですます調、敬体、禁止表現への追従は sampling 検証にします。
- 完全一致 assert は避けます。
- 意味判定には部分一致または LLM-as-judge を使います。

## 4. テスト修正のフェーズ計画

### Phase 1 完了時

- templates/ の日本語化を完了します。
- 影響テスト: カテゴリ B と C のうち prompt/template 直結ファイルです。
- 最初に着手すべきファイルは `test_prompt.py` です。
- 次に `test_memory.py` と `test_memory_formation.py` を修正します。
- 続いて `test_realtime_tools.py` と `test_one_shot.py` を確認します。
- SKILL.md 本文方針に合わせて `test_skills_registry.py` と `test_plugins_registry.py` を確認します。
- このタイミングで assert を日本語化し、targeted smoke test を実行します。
- 推奨コマンド: `pytest app/runtime/tests/test_prompt.py app/runtime/tests/test_memory.py app/runtime/tests/test_memory_formation.py`

### Phase 2 完了時

- Frontend 日本語化を完了します。
- 影響テスト: Frontend E2E 全 8 spec ファイルです。
- `data-testid` ベース移行を先に行います。
- 日本語 text assert は代表的なラベルだけに限定します。
- `mcp-schedules-proactive.spec.ts` と `environments-workspace-foundry.spec.ts` を優先します。
- `skills-plugins.spec.ts` と `settings-profile.spec.ts` を次に修正します。
- スクリーンショット baseline はまだ更新しません。
- 現状 screenshot assert は 0 件ですが、追加されていた場合も Phase 5 まで保留します。

### Phase 3 完了時

- Backend ユーザ可視メッセージ日本語化を完了します。
- 影響テスト: カテゴリ A の 18 ファイルです。
- `test_commands.py` を最優先で修正します。
- 次に `test_chat_handler.py`、`test_bot_endpoint.py`、`test_content_safety_routes.py` を修正します。
- HTTP API は status / code を維持し、message / detail を日本語化します。
- command reply は直接日本語 assert にします。
- deploy / monitoring diagnostic が UI に露出する場合は日本語 assert にします。
- test diagnostic だけの英語は維持します。

### Phase 4 完了時

- TUI 日本語化を完了します。
- 影響テスト: 現時点で TUI 専用テストは確認対象外です。
- 主に手動検証を行います。
- CJK 表示幅、折り返し、テーブル幅を重点確認します。
- Bun / Ink の snapshot test が追加された場合は data-testid 相当の安定 selector 方針を検討します。

### Phase 5

- 全テスト一括実行を行います。
- 通常 pytest: `pytest`
- 必要に応じて slow: `pytest --run-slow`
- Azure 実環境がある場合のみ e2e setup: `pytest --run-e2e-setup app/runtime/tests/test_e2e_setup_process.py`
- Playwright: frontend package の既存 test command を使用します。
- screenshot baseline がある場合は一括リセットします。
- コマンド例: `npx playwright test --update-snapshots`
- baseline diff を全件目視確認します。
- 失敗するテストを修正します。
- 必要に応じてリグレッションテストを追加します。

## 5. 自動化チェック

### 5.1 用語ブレ検出（任意）

- `glossary.md` に登録された訳語と異なる表記をテスト中で使用していないか検出します。
- 例: 「ワークスペース」と「Workspace」の混在を検出します。
- 例: 「スケジュール」と「予定タスク」の混在を検出します。
- 例: 「接続」と「連携」の使い分けを検出します。
- 簡易スクリプトは Phase 3 以降に追加検討します。
- 追加する場合も既存 lint toolchain に過剰な依存を増やしません。

```bash
# glossary.md から「英語 | 訳語」を抽出し、テストコード中の訳語揺れを grep する想定
# 実装は任意。Phase 5 の前に必要性を再判断する。
```

### 5.2 文体チェック（任意）

- ですます調の逸脱を検出します。
- 全角句読点方針を検出します。
- 絵文字方針違反を検出します。
- 候補: pre-commit hook で簡易チェックします。
- LLM 応答は完全な静的検出が難しいため、system prompt と代表応答を重点確認します。

### 5.3 baseline 不一致警告（任意）

- スクリーンショットテストの diff が出た時に PR で警告します。
- 現状 screenshot assertion は検出されていません。
- 将来追加された場合、Phase 5 で baseline 更新と review gate を設定します。

### 5.4 英語 assert 残存チェック

- 日本語化対象の残存英語を grep で確認します。
- ただし開発者向け英語は除外します。
- 除外例: log assert、exception match、test diagnostic、mock input、machine-readable key。

```bash
rg -n 'assert.*"[A-Z][a-z]+ [a-z]+' app/runtime/tests -g '*.py'
rg -n 'getByText\(|getByRole\([^\n]*name:' app/frontend/e2e -g '*.ts'
```

## 6. 既知のリスクと対策

### 6.1 Telegram MarkdownV2 エスケープ

- 日本語と特殊文字の組み合わせで Telegram API がエラーを返す可能性があります。
- 対策: `test_formatting.py` に日本語入力テストケースを追加します。
- 例: `保存しました（ID: 123）` の括弧、コロン、句読点を検証します。
- MarkdownV2 の `_`, `*`, `[`, `]`, `(`, `)` などの escape を再確認します。

### 6.2 CJK 文字列長の判定

- Python の `len()` は文字数であり、表示幅ではありません。
- 日本語は East Asian Width により terminal 表示幅がずれます。
- TUI のテーブル整形時に注意します。
- 対策: `wcwidth` ライブラリ使用、または `unicodedata.east_asian_width` を検討します。
- 既存依存を増やす前に Bun / Ink 側の表示挙動を確認します。

### 6.3 LLM の言語追従の不確実性

- system prompt で「ですます調」を指定しても、LLM が稀にタメ口で応答する可能性があります。
- 対策: `@pytest.mark.slow` の実 LLM テストで応答口調を sampling 検証します。
- 完全一致ではなく、禁止表現や敬体終止の割合を見ます。
- LLM-as-judge prompt も日本語にします。

### 6.4 部分一致 assert の過剰緩和

- 翻訳ブレに強くしすぎると regression を見逃します。
- 例: `assert "エラー" in message` だけでは弱すぎます。
- 対策: domain noun + action verb の 2 語を組み合わせます。
- 例: `assert "保存" in message and "設定" in message`

### 6.5 API consumer 互換性

- `status`, `code`, `type`, `id` を翻訳すると既存 consumer が壊れます。
- 対策: machine-readable fields は英語維持をテストで明示します。
- `message` / `detail` / `description` は human-readable かどうかを個別判断します。

### 6.6 Frontend locator の一時的不安定化

- 日本語化と selector 移行を同時に行うと failure 原因が分かりにくくなります。
- 対策: 可能なら先に `data-testid` 移行 PR、次に日本語化 PR と分けます。
- 分けられない場合も commit / diff hunk を分離します。
- `getByRole` は accessibility 検証として一部残してよいですが、name は日本語にします。

### 6.7 mock data と product copy の混同

- `GitHub Status`, `daily-briefing`, `dep-001` は mock data の可能性があります。
- product copy と mock fixture data を区別します。
- mock data の固有名詞は英語維持で問題ありません。
- UI label として表示される `Installed`, `Marketplace`, `Save` は日本語化対象です。

## 7. 完了基準（Definition of Done）

各 Phase のテスト完了基準:

- [ ] 該当 Phase の修正対象テストが全て pass する
- [ ] `--run-slow` 抜きの通常テストで失敗ゼロ
- [ ] スクリーンショット baseline（Phase 5 のみ）が更新済みかつレビュー済み
- [ ] 新規日本語 assert が glossary.md と一致している
- [ ] 既存の英語 assert が残っていないか grep で確認した
- [ ] 残した英語 assert は machine-readable / developer-only / mock input として理由を説明できる
- [ ] `mock_agent` fixture の一括日本語化を避け、必要なテストだけ個別上書きした
- [ ] Frontend E2E の主要操作が `data-testid` または安定 locator で実行される
- [ ] HTTP API の `status` / `code` / JSON key が英語維持される
- [ ] LLM prompt と judge prompt が日本語応答を前提に更新される

## 8. Phase 別対象ファイル一覧

### 8.1 Phase 1: prompt / template

- `app/runtime/tests/test_prompt.py`
- `app/runtime/tests/test_memory.py`
- `app/runtime/tests/test_memory_formation.py`
- `app/runtime/tests/test_realtime_tools.py`
- `app/runtime/tests/test_one_shot.py`
- `app/runtime/tests/test_extract_media.py`
- `app/runtime/tests/test_skills_registry.py`
- `app/runtime/tests/test_plugins_registry.py`
- `app/runtime/tests/test_scheduler.py`

### 8.2 Phase 2: frontend E2E

- `app/frontend/e2e/auth.spec.ts`
- `app/frontend/e2e/chat.spec.ts`
- `app/frontend/e2e/environments-workspace-foundry.spec.ts`
- `app/frontend/e2e/mcp-schedules-proactive.spec.ts`
- `app/frontend/e2e/sessions.spec.ts`
- `app/frontend/e2e/settings-profile.spec.ts`
- `app/frontend/e2e/setup.spec.ts`
- `app/frontend/e2e/skills-plugins.spec.ts`
- `app/frontend/e2e/helpers.ts` は helper として原則変更不要です。

### 8.3 Phase 3: backend user-visible messages

- `app/runtime/tests/test_commands.py`
- `app/runtime/tests/test_chat_handler.py`
- `app/runtime/tests/test_bot_endpoint.py`
- `app/runtime/tests/test_bot_handler.py`
- `app/runtime/tests/test_content_safety_routes.py`
- `app/runtime/tests/test_monitoring.py`
- `app/runtime/tests/test_server_routes_extra.py`
- `app/runtime/tests/test_prompt_shield.py`
- `app/runtime/tests/test_azure_cli.py`
- `app/runtime/tests/test_bicep_deploy.py`
- `app/runtime/tests/test_smoke_test.py`
- `app/runtime/tests/test_identity_routes.py`
- `app/runtime/tests/test_hitl.py`
- `app/runtime/tests/test_scheduler.py`
- `app/runtime/tests/test_agent_tools.py`
- `app/runtime/tests/test_media_outgoing.py`
- `app/runtime/tests/test_foundry_iq.py`
- `app/runtime/tests/test_extract_media.py`

## 11. 推奨される最初の修正対象

- Phase 1 の最初の修正対象は `app/runtime/tests/test_prompt.py` です。
- 理由は system prompt / bootstrap prompt / MCP guidance / sandbox prompt の組み立てを直接検証するためです。
- `test_prompt.py` が通ると prompt template placeholder の破損を早期に検出できます。
- 次点は `app/runtime/tests/test_memory_formation.py` です。
- memory transcript と session timing summary は LLM に渡る日本語品質へ直接影響します。
- Frontend 側の最初の対象は `app/frontend/e2e/mcp-schedules-proactive.spec.ts` です。
- locator 件数が最も多く、`data-testid` 移行効果が大きいためです。

