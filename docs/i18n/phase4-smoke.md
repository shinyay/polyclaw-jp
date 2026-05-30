# Phase 4 TUI スモークテスト結果 (Smoke Test Results)

> **検証日**: 2026-05-30
> **検証者**: shinyay + GitHub Copilot CLI (claude-opus-4.7-xhigh)
> **対象ブランチ**: `main` (HEAD: `8b8ad87`)
> **対象 PR**: PR-4.0 〜 PR-4.5 (Phase 4 全 6 PRs)
> **環境**: Bun 1.x + @opentui/core 0.1.107 (Linux x86_64, locale ja_JP.UTF-8 想定)

---

## エグゼクティブサマリ

| 観点 | 結果 |
|---|---|
| TUI 文字列の日本語化 (inventory) | ✅ **PASS — 840/840 entries (100%)** |
| `bun test` (静的型 + ユニット) | ✅ **PASS — 103/103, 0 fail** |
| `bun run typecheck` (`tsc --noEmit`) | ⚠️ **WARN — 1 pre-existing error (`useAlternateScreen` / @opentui/core 0.1.107 breaking change)** |
| 英語 residue 静的監査 (UI 表示テキスト) | ⚠️ **3 leak 候補検出 — Phase 5 hotfix (PR-4.6) 推奨** |
| CJK 幅対応 (`utils/width.ts` 利用箇所) | ❌ **FAIL — `width.ts` は実装済だが `import` 件数 0 (どこからも使われていない)** |
| 文字列 truncate (`.slice(N)`) の CJK 半切れリスク | ⚠️ **4 site 検出 — `chat.ts` 2 + `headless/{setup,aca_setup}.ts` 2** |
| 実機 TUI 起動 / 主要画面遷移 | ⚠️ **PARTIAL — Step 0 + 1 + 2 実施、§4.4 に実機検証結果記録、Step 3 以降 deferred** |
| Setup wizard (headless) JA 文言検証 | ⚠️ **DEFERRED — Azure subscription + Container Apps 環境必要、user 任意** |
| **実機 CJK 幅崩れ検証** | 🔴 **FAIL — target picker ACA 行で実証 (§4.4 Step 2)、PR-5.0 critical hotfix 必須** |

**総合判定**:

- **翻訳作業の完了**: ✅ Phase 4 のスコープ (TUI 840 entries の JP 化) は **100% 達成**、9 commit に分割、CI 全 green
- **静的品質**: ✅ test 103/103 pass、typecheck pre-existing 1 のみ、新規 error 0
- **動作品質**: 🔴 **実機検証で CJK 幅崩れ実証** (§4.4 Step 2) — `target-picker` の ACA option で前フレーム残像 + truncate 半切れ発生
- **本番運用判定**: 🔴 **PR-5.0 hotfix 必須** — 実機 UX で日本語表示が破綻する箇所あり (Phase 4 翻訳作業自体は 100% 完了だが、`@opentui/core` が CJK 幅非対応で副作用)

---

## 1. Phase 4 翻訳完了状況

### 1.1 全 6 PR の達成状況

| PR | スコープ | inventory entries | files | commits | CI |
|---|---|---:|---:|---:|---|
| **PR-4.0** | CJK 幅 utility 新規 + glossary §16 + 66 noise approve | 66 | 1 src + 1 test + glossary + inventory | 1 | ✅ |
| **PR-4.1** | `index.ts` + `config/constants.ts` (TAB_LABELS / STARTUP_PHASES / STATUS_ITEMS / SHIMMER_COLORS) | 79 | 2 | 2 | ✅ |
| **PR-4.2** | `ui/{tui,app,target-picker,disclaimer}.ts` + `utils/containers.ts` | 193 | 5 | 2 | ✅ |
| **PR-4.3** | `screens/setup.ts` + `headless/{setup,aca_setup}.ts` + `deploy/{aca,docker,process}.ts` | 228 | 7 | 2 | ✅ |
| **PR-4.4** | `screens/{chat,sessions,dashboard,profile}.ts` (core 画面) | 96 | 4 | 2 | ✅ |
| **PR-4.5** | `screens/{mcp,proactive,scheduler,plugins,workspace,skills}.ts` + `api/client.ts` (secondary 画面) | 178 | 7 | 2 | ✅ |
| **合計** | **TUI layer 全体** | **840 / 840 (100%)** | **24 + 1 (test)** | **11** | **全 green** |

### 1.2 翻訳ポリシー (Phase 4 で確立、glossary §16 / phase 1-3 から継承)

1. **chat role label 統一** — `user:` → `あなた:`, `assistant:` → `🦉 ポリ:`, `system:` → `システム:`, `tool:` → `ツール:`
2. **section title pattern 保存** — ` Title ` (前後 1 スペース) の Box label
3. **status badge 翻訳** — `[on]`/`[off]` → `[有効]`/`[無効]`, `Yes`/`No` → `はい`/`いいえ`
4. **placeholder 翻訳** —
   - `(none)` → `(なし)`, `(empty)` → `(空)`, `(never)` → `(未実行)`, `(unknown)` → `(不明)`, `(any)` → `(任意)`, `(untitled)` → `(無題)`
5. **key binding 維持** — `e` / `d` / `x` (delete) などの 1 文字キーは英語維持、ヒント文のみ翻訳
6. **proper noun 維持** — Azure, MCP, OpenAI, Bot Framework, Container Apps, GitHub, Docker, cron 構文 (`0 9 * * *`), HTTP method, URL, file path
7. **emoji 維持** — 🦉 (mascot), ✅/❌/⚠️/🔵/🟢 などの記号
8. **ANSI escape 維持** — `\x1b[31m...\x1b[0m` (color) は wrap のみ、内容を翻訳
9. **error template** — `エラー: ${msg}` (translation of `Error: ${msg}`)

---

## 2. 静的監査結果

### 2.1 `bun test` (103/103 pass)

```
tests/api-client.test.ts       9 pass
tests/constants.test.ts       17 pass  (TAB_LABELS 等の JA 化値 verify)
tests/format.test.ts          14 pass
tests/mascot.test.ts          12 pass
tests/process.test.ts         11 pass
tests/theme.test.ts            8 pass
tests/types.test.ts           14 pass
tests/width.test.ts           18 pass  (CJK 幅実装の単体テストは PASS)
────────────────────────────────────────────
TOTAL                        103 pass / 0 fail
```

### 2.2 `bun run typecheck` (pre-existing 1 error)

```
src/ui/app.ts(94,7): error TS2353:
  Object literal may only specify known properties,
  and 'useAlternateScreen' does not exist in type 'CliRendererConfig'.
```

- **原因**: `@opentui/core` 0.1.79 → 0.1.107 への upgrade で `CliRendererConfig` 型から `useAlternateScreen` プロパティが削除された (upstream API breaking change)
- **影響**: 型エラーのみで runtime には到達しないため、TUI 起動・操作には影響なし (Bun は trans-pile 時に型を捨てる)
- **対応**: Phase 5 stabilization PR-5.x で `@opentui/core` の最新 API に追従する形で削除予定
- **Phase 4 への影響**: なし。Phase 4 開始前から存在する pre-existing error で、Phase 4 翻訳作業によって新規発生したものではない

### 2.3 英語 residue 静的監査 (UI 表示テキストの leak 検出)

ダブル/シングルクォート内の英語フレーズを正規表現で抽出し、HTTP method / proper noun / enum 値などを除外したあとに残った UI 表示候補:

| File:Line | leak fragment | 種別 | 推奨対応 |
|---|---|---|---|
| `ui/tui.ts:412` | `activityText = "Thinking"` | スピナー付き状態テキスト (画面表示) | 🔴 **要翻訳** → `"考え中"` |
| `ui/tui.ts:356` | `{ key: "ctr-admin", label: "Admin" }` `{ key: "ctr-runtime", label: "Runtime" }` | コンテナヘルスインジケータの画面表示ラベル (status row 上の `● Admin  ● Runtime`) | 🔴 **要翻訳** → `"管理"` / `"実行"` (用語要検討、`Admin/Runtime` のままでも本番運用上は可) |
| `config/constants.ts:85,91` | `{ key: "tunnel", label: "Tunnel" }` (STARTUP_PHASES / STATUS_ITEMS) | 起動フェーズ + ステータス bar 表示ラベル `● Tunnel` | 🟡 **議論候補** — Tunnel/Bot は dev jargon (Cloudflare Tunnel / Bot Framework) として英語維持も合理的 |
| `config/constants.ts:86,92` | `{ key: "bot", label: "Bot" }` | 同上 | 🟡 **議論候補** — 同上 |

**leak 判定根拠**:

- `ui/tui.ts:412` の `"Thinking"`: `updateModelActivity()` で `${SPINNER_FRAMES[thinkingFrame]} ${activityText}` として右上ステータスバーに表示される (`● Tunnel  │ gpt-4o  ⠋ Thinking` のような形)。同じ関数で `activeTools.length > 0` 時には tool 名を表示するが、tool 名は英語 (`web_search` 等) なのでこの位置のテキストはユーザーに見える日本語混在ステータスバー
- `ui/tui.ts:356` `"Admin"/"Runtime"`: `containerDots[ctr.key]` で `● Admin  ● Runtime` として表示
- `config/constants.ts` の `"Tunnel"/"Bot"`: PR-4.1 で `"ビルド"/"コンテナ"/"サーバー"` まで翻訳したが、`"Azure"/"Tunnel"/"Bot"` は proper noun 扱いで英語維持 — 一貫性議論の余地あり

**対応方針**: Phase 5 で **PR-5.0 (Phase 4 hotfix)** として 4 leak を判断 (翻訳 / 英語維持) → 同 PR で `width.ts` 配線 (§3) もまとめて修正。

### 2.4 CJK 幅対応 (`utils/width.ts`) の配線状況

| ファイル | 状態 | 詳細 |
|---|:---:|---|
| `app/tui/src/utils/width.ts` | ✅ 実装済 | 121 行、`charWidth` / `stringWidth` / `padToWidth` / `truncateByWidth` 4 関数 |
| `app/tui/tests/width.test.ts` | ✅ 18 テスト pass | 単体テストは網羅的 (ASCII / Hiragana / Kanji / Emoji / ANSI escape 混在) |
| **`import` 元の数** | ❌ **0 ファイル** | `grep -rn "utils/width" app/tui/src/` の結果、`width.ts` 自身を除いて 0 件 |

**問題**: PR-4.0 で CJK 幅 helper を **先行実装** したが、PR-4.1 〜 PR-4.5 の翻訳作業中に **どこからも import されていない**。つまり、テーブル整形 / progress bar / truncate などで日本語 (全角) 文字が混入したとき、`String.prototype.length` を使っている全コードパスで **半切れ・桁ズレ表示** が発生する可能性がある。

### 2.5 CJK 半切れリスクサイト (string truncate)

| File:Line | コード | リスク | 修正案 |
|---|---|---|---|
| `screens/chat.ts:189` | `args.length > 120 ? args.slice(0, 117) + "..."` | tool args に日本語が含まれると 全角 60+ で半切れ | `truncateByWidth(args, 120, "...")` |
| `screens/chat.ts:283` | `args.length > 60 ? args.slice(0, 57) + "..."` | 同上 | `truncateByWidth(args, 60, "...")` |
| `headless/setup.ts:226` | `text.slice(0, 100)` (debug log) | チャット疎通確認の応答に日本語が含まれると半切れ | `truncateByWidth(text, 100, "")` |
| `headless/aca_setup.ts:275` | `text.slice(0, 100)` | 同上 | 同上 |

**現状の影響**: chat screen での tool args 表示 (`web_search "日本語クエリ..."` 等) が UTF-8 byte 境界で切れる可能性。`String.prototype.slice` は UTF-16 code unit 単位で動くため、surrogate pair (絵文字 / SMP+ CJK) を半分に切る可能性も。

**🔴 実機実証 (2026-05-30 §4.4 Step 2)**: `target-picker` の ACA option で **前フレーム残像** + **truncate 半切れ** が同時発生することを実機で確認。`@opentui/core` の `TextRenderable` が文字列幅を `.length` (UTF-16 code unit 数) で計算しているため、日本語混在文字列の **再描画時に前のフレームの末尾文字が残る** + **長文 description が CJK 文字境界を無視して切れる** という二重の問題が発生。詳細は §4.4 Step 2 の結果参照。

### 2.6 静的監査 サマリ

```
英語 residue leak                      4 件 (Thinking, Admin, Runtime, Tunnel/Bot 検討)
CJK 幅 helper 未配線                    1 件 (width.ts import 0)
CJK 半切れリスクサイト                  4 件 (chat x2, headless setup x2)
────────────────────────────────────────
要 hotfix PR (PR-5.0)                  最大 9 site
ただし blocker は 0 件                  (新規バグなし、翻訳作業の達成度は 100%)
```

---

## 3. 翻訳辞書 / 用語整合性

### 3.1 chat role label の統一 (glossary §16)

| English | Japanese | 適用箇所 |
|---|---|---|
| `user:` | `あなた:` | `screens/chat.ts:152`, `screens/sessions.ts` |
| `assistant:` | `🦉 ポリ:` | 同上 |
| `system:` | `システム:` | 同上 |
| `tool:` | `ツール:` | 同上 |
| `[N tools: ...]` | `[N ツール: ...]` | `screens/sessions.ts:176` |

### 3.2 status badge 統一

| English | Japanese | ファイル |
|---|---|---|
| `[on]` / `[off]` | `[有効]` / `[無効]` | `mcp.ts`, `plugins.ts` |
| `Yes` / `No` | `はい` / `いいえ` | `mcp.ts`, `plugins.ts` (detail view) |
| `[Built-in]` | `[同梱]` | `plugins.ts` (detail) |
| `[needs setup]` | `[要セットアップ]` | `plugins.ts` (detail) |

### 3.3 placeholder 翻訳

| English | Japanese | 適用例 |
|---|---|---|
| `(none)` | `(なし)` | preferences |
| `(any)` | `(任意)` | preferences |
| `(empty)` | `(空)` | workspace preview |
| `(never)` | `(未実行)` | scheduler |
| `(unknown)` | `(不明)` | skills/plugins detail |
| `(untitled)` | `(無題)` | sessions |
| `(parent)` | `(親ディレクトリ)` | workspace |
| `Loading...` | `読み込み中...` | 6 SelectRenderable 初期値 |
| `directory` | `ディレクトリ` | workspace description tag |

### 3.4 cron / 時間表現

| English | Japanese | 注 |
|---|---|---|
| `(daily at 9am)` | `(毎日 9 時)` | cron expression placeholder |
| `${h.toFixed(1)} hours ago` | `${h.toFixed(1)}時間前` | proactive history |
| `Last sent:` | `最終送信:` | proactive |
| `Next:` | `次回:` / `予定日時:` | scheduler / proactive |

---

## 4. ⚠️ DEFERRED: 実機 TUI smoke (user 任意で実施)

静的監査では検出できない以下を実機で検証する手順を明記する。

### 4.1 検証対象

1. **TUI 起動 + ASCII art 表示**: フクロウ mascot ascii art が崩れず描画されるか (PR-4.0 で 66 entries noise approve した内容)
2. **タブ切り替え**: TAB_LABELS (`チャット` / `セッション` / `ダッシュボード` / `スキル` / `プラグイン` / `MCP` / `スケジューラー` / `プロアクティブ` / `プロフィール` / `ワークスペース` / `設定`) の表示 + Tab/Shift+Tab での遷移
3. **CJK 幅崩れ確認**: 各画面のテーブル / 罫線が日本語混在で崩れないか
4. **chat screen での tool args 表示**: 長い日本語入力に対する truncate が半切れしないか (§2.5 のリスク)
5. **status bar 表示**: `● Azure  ● Tunnel  ● Bot  │ target  │ model  ⠋ Thinking` の英語 leak (§2.3)
6. **setup wizard 文言**: headless setup 実行時の進捗 log + プロンプト文言が JA 化されているか

### 4.2 推奨実施手順 (10 min, 起動 → 主要画面 → 終了)

**前提**: Bun ≥1.x インストール済、Polyclaw リポジトリ clone 済、`bun install` 完了

#### 4.2.1 起動

```bash
cd /home/shinyay/work/github/polyclaw-jp/app/tui
export PATH=$HOME/.bun/bin:$PATH
bun run src/index.ts
```

**期待**:
- ASCII art (フクロウ) が崩れず表示
- 起動 progress bar の項目 `ビルド / コンテナ / サーバー / Azure / Tunnel / Bot` (Tunnel/Bot は §2.3 leak、要判断)
- 起動完了後、status bar に `● Azure  ● Tunnel  ● Bot  │ Local Process  │ gpt-4o-mini` のような表示

#### 4.2.2 タブ巡回 (Tab × 11)

`Tab` キー or `Shift+Tab` で全 11 タブを巡回し、以下を verify:

| タブ | 期待表示 | 確認項目 |
|---|---|---|
| チャット | 入力ボックス + 履歴エリア | role label `あなた:` / `🦉 ポリ:` 表示 |
| セッション | セッション一覧 select | `(無題)` 表記が出ているか (新規 session 直後) |
| ダッシュボード | サブセクション (応答 / 統計 / 通知) | section title 翻訳 |
| スキル | 一覧 select + 詳細 | `インストール済みスキルなし` 表示 (空時) |
| プラグイン | 一覧 + key binding hint `有効化: e / 無効化: d / 削除: x` | hint テキスト 2 箇所一貫 |
| MCP | サーバー一覧 + Action select | `[有効]` / `[無効]` badge |
| スケジューラー | タスク一覧 + cron form | placeholder `0 9 * * * (毎日 9 時)` |
| プロアクティブ | 設定 + 履歴 | 設定項目 `1日の上限` `避けるトピック` |
| プロフィール | 人格選択 | 人格名表示 |
| ワークスペース | ファイル browser | `.. (親ディレクトリ)` 表記 |
| 設定 | 設定 form | (PR-4.4 で翻訳済) |

#### 4.2.3 chat 画面での日本語入力 + tool 呼び出し (CJK 幅 spot check)

1. `チャット` タブで日本語メッセージを入力: 例 `「東京の今日の天気を教えて」`
2. 入力中の cursor 位置 + 表示崩れがないか
3. `Enter` で送信、`🦉 ポリ:` プレフィックスで応答が来るか
4. もし tool 呼び出しが発生したら、`[ツール] web_search ...` の表示で **117 文字超の日本語 args が半切れしないか** verify (§2.5 のリスク)

#### 4.2.4 status bar `Thinking` leak verify (§2.3)

1. chat 画面で長文タスクを投げる (例: `「日本の歴史を簡潔に教えて」`)
2. 応答待ちの間、status bar の右側に **`⠋ Thinking`** (英語) が出るか確認
3. **finding**: もし `Thinking` が表示されたら、PR-5.0 で `"考え中"` 等への翻訳が必要

#### 4.2.5 終了

`Ctrl+C` で TUI 終了、ターミナル復帰、ANSI escape leak (色設定が残る等) がないか確認。

### 4.3 Setup wizard 文言検証 (オプション、Azure 環境必要)

**前提**: `az login` 済、Azure subscription 利用可能

```bash
cd /home/shinyay/work/github/polyclaw-jp
export PATH=$HOME/.bun/bin:$PATH
cd app/tui && bun run src/index.ts headless setup
```

**期待**:
- プロンプト文言 (`利用可能な Azure サブスクリプションがありません` 等) が JA 化
- 進捗 log (`チャット疎通確認 OK: ...` 等) が JA 化
- エラー時に英語 leak がないか

### 4.4 実機検証結果 (2026-05-30 実施)

#### Step 0: `bun run src/index.ts help` (usage 表示)

**結果**: ✅ **PASS**

- 全 `console.log` 行が JA 化、英語 leak 0 件
- proper noun (`Bot Framework` / `Foundry` / `Azure` / `ACA`) は正しく英語維持
- `不明なコマンド: help` (translation of `Unknown command:`) JA 化確認
- `環境変数:` セクション、`ADMIN_PORT` 等の説明全 JA

**Pre-existing bug 検出**:
- `src/index.ts:46-48 と 49-51` で `aca-setup` / `aca-decommission` / `aca-restart` の 3 行が **重複表示** (upstream 初期コミットから存在、翻訳作業由来ではない)
- → Phase 5 で upstream にも fix PR を投げる候補

#### Step 1: Disclaimer 画面表示

**結果**: ✅ **EXCELLENT**

- `============================================================`
- `技術デモンストレーター — リスクに関する免責事項`
- 5 bullet (高自律エージェント / サンドボックス環境専用 / 損害発生の可能性 / 無保証 / サポート対象外) 全て自然な JA
- 入力プロンプト: `リスクに同意して続行するには accept と入力してください:`
- ASCII 罫線、ANSI color、自然な日本語 wrap、全て完璧
- 英語 leak: **0 件** (`accept` は意図的な command keyword)
- 文字化け: **0 件**

#### Step 2: Target Picker 画面表示 — 🔴 **CJK 幅崩れ実証**

**結果**: 🟡 **PARTIAL** (翻訳品質は good、CJK 幅崩れの実証 finding が決定的)

✅ **Good**:
- POLYCLAW ASCII ロゴ + フクロウ mascot: 完璧表示
- `デプロイターゲット` タイトル: JA 化
- `矢印キーで選択、Enter で確定、Ctrl+C で終了` ヒント: JA 完璧
- `▶ ローカル Docker  --  ローカルでビルドして実行 (デフォルト)`: 1 行目は崩れず
- `(account info) としてログイン中`: 自然な JA

🔴 **重大 finding — CJK 幅崩れの実証**:

ACA option 行の実機表示:
```
  Azure Container Apps 試験的)験的)  --  Azureに  ィ  デプロイ (...account info)
```

**期待表示** (ソースコードから):
```
  Azure Container Apps (試験的)  --  Azure にデプロイ (永続化、クラウドホスト)
```

**観察された 2 つの異常**:

| # | 観察事象 | 推定原因 |
|---|---|---|
| 1 | `(試験的)` が `試験的)験的)` と **重複** | 再描画時に前のフレームの末尾文字が残った。`@opentui/core` の `TextRenderable.content =` 再代入時に「これは N cell の text」と `.length` ベースで判定 → CJK 幅 2 cell の文字を 1 cell として扱い、右側 column が clear されず残骸が表示 |
| 2 | `Azure にデプロイ (永続化、クラウドホスト)` (24 全角 = 48 cell) が `Azureに  ィ  デプロイ` (15 半角 + 5 全角 = 25 cell) に **半分以下に切れて**、しかも `ィ` という意味不明な小カタカナだけ残った | 同様に `.length` ベースの幅計算で truncate された結果、CJK 境界を無視して内部の半端な文字列だけ表示 |

**根本原因**: 
- `app/tui/src/utils/width.ts` (PR-4.0 で実装した CJK 幅 helper) が **どこからも import されていない** (§2.4)
- `@opentui/core` の `TextRenderable` 描画レイヤーが CJK 幅を理解していない (upstream の限界)
- → 翻訳した日本語文字列を `TextRenderable.content` にそのまま渡すと、再描画時に **残像 + 半切れ** が発生

**修正方針 (PR-5.0)**:
1. `target-picker.ts:173-177` の `renderItem()` で、`padToWidth(text, MAX_WIDTH, 'left')` を使って文字列を「右端を空白で埋めて固定幅」にする → 再描画時の残像消去
2. `description` が長すぎる場合は `truncateByWidth(text, AVAIL_WIDTH, '…')` で安全に truncate → 半切れ防止
3. 同様の `TextRenderable.content` を動的更新している全箇所 (`chat.ts` / `sessions.ts` / `mcp.ts` 等の `Loading...` → 実コンテンツ置換、`scheduler.ts` の task 一覧更新、`proactive.ts` の history 更新など) で `width.ts` 配線

#### Step 3 以降: ⚠️ **DEFERRED**

Step 2 で重大 finding (CJK 幅崩れ実証) が確定したため、Step 3 (タブ巡回) / Step 4 (chat 日本語入力) / Step 5 (`Thinking` leak verify) は **PR-5.0 hotfix 適用後に再実施** することにする。今のままで Step 3 以降を続けても、同じ CJK 幅崩れが他画面でも発生する可能性が高く、検証成果が limited。

PR-5.0 hotfix 適用後に再 smoke することで、修正の有効性も同時に検証可能。

| 日時 | 実施者 | 検証項目 | 結果 | 備考 |
|---|---|---|:---:|---|
| 2026-05-30 | shinyay | 4.2.0 usage (`help`) | ✅ PASS | pre-existing aca-* 行 6 重複検出 |
| 2026-05-30 | shinyay | 4.2.1 Disclaimer 画面 | ✅ EXCELLENT | 5 bullet 全 JA、英語 leak 0 |
| 2026-05-30 | shinyay | 4.2.2 Target Picker 画面 | 🟡 PARTIAL | **CJK 幅崩れ実証** → PR-5.0 critical |
| (deferred) | — | 4.2.3 タブ巡回 (11 タブ) | — | PR-5.0 後に再実施 |
| (deferred) | — | 4.2.3 日本語入力 + tool args | — | PR-5.0 後に再実施 |
| (deferred) | — | 4.2.4 `Thinking` leak verify | — | PR-5.0 後に再実施 |
| (deferred) | — | 4.3 setup wizard 文言 | — | (任意、Azure 必要) |

---

## 5. Phase 5 backlog (PR-5.0 critical hotfix + 改善項目)

### 5.1 PR-5.0 critical hotfix (実機検証で必須化)

`docs/i18n/inventory.csv` の status は全 translated/approved 済だが、**実機 §4.4 Step 2 で CJK 幅崩れを実証**したため、以下を **必須対応**:

#### 5.1.1 🔴 CRITICAL: CJK 幅 helper 配線 (実機 finding に基づく)

`app/tui/src/utils/width.ts` の `padToWidth` / `truncateByWidth` / `stringWidth` を **動的に再描画される全 `TextRenderable.content` 更新箇所**に配線する。

| 優先度 | ファイル | 関数 | 修正 |
|:---:|---|---|---|
| 🔴 P0 | `ui/target-picker.ts:173-177` | `renderItem()` | `padToWidth(text, COLS, 'left')` で固定幅化 → 残像消去 |
| 🔴 P0 | `ui/target-picker.ts:83` | ACA option `description` | description が長すぎる場合 `truncateByWidth(text, AVAIL_W, '…')` |
| 🔴 P0 | `screens/chat.ts:189` | tool args display | `truncateByWidth(args, 120, '...')` |
| 🔴 P0 | `screens/chat.ts:283` | tool args display (short) | `truncateByWidth(args, 60, '...')` |
| 🟡 P1 | `headless/setup.ts:226` | 疎通確認 log | `truncateByWidth(text, 100, '')` |
| 🟡 P1 | `headless/aca_setup.ts:275` | 同上 | 同上 |
| 🟡 P1 | `screens/mcp.ts`, `scheduler.ts`, `proactive.ts`, `plugins.ts`, `workspace.ts`, `skills.ts` | SelectRenderable options 動的更新 (`Loading...` → 実 content) | 同じ残像問題が発生する可能性 → `padToWidth` で空白埋め |
| 🟢 P2 | `ui/tui.ts:549` | log level `padEnd(5)` | `padToWidth(level, 5, 'left')` |

**動作確認**: PR-5.0 適用後に再 smoke (§4.4 Step 3 以降を実施) して残像 + 半切れが解消したことを目視確認。

#### 5.1.2 🟡 leak 修正 (3-4 site, §2.3)

- `ui/tui.ts:412` `"Thinking"` → `"考え中"` (status bar leak、§4.4 Step 5 で deferred、PR-5.0 で同時修正)
- `ui/tui.ts:356` `"Admin"/"Runtime"` → 議論後翻訳 or 英語維持
- `config/constants.ts:85,86,91,92` `"Tunnel"/"Bot"` → 議論後翻訳 or 英語維持

#### 5.1.3 🟢 `@opentui/core` 0.1.107 API 追従

- `ui/app.ts:94` の `useAlternateScreen` プロパティ削除 (typecheck error 解消)

#### 5.1.4 ⭐ 推奨追加: `TextRenderable` ラッパー作成

長期的には、`@opentui/core` の `TextRenderable` を直接使うのではなく、**CJK 幅対応のラッパー** (例: `CjkTextRenderable`) を作って TUI 全体で統一すべき。
- `setContent(text: string, maxWidth?: number)` メソッドで自動 padToWidth + truncate
- これにより、新たに追加される画面で同じ問題が再発しない

Phase 5 PR-5.1 候補。

### 5.2 Collector blind spot back-fill (Phase 5 Wave 2)

Phase 1-3 のスモークテストで明らかになった collector の検出漏れ:

| Phase | 検出漏れ件数 | パターン |
|---|---:|---|
| Phase 1 | (未計測) | template / placeholder string |
| Phase 2 | (未計測) | JSX `{ }` 内 string literal |
| Phase 3 | 28 件 | 1 行 if-else 式 / `lines = [...]` パターン / multi-line raise |
| Phase 4 | (未計測) — Phase 5 で再 collect | TS template literal / SelectRenderable options |

**改修 task**: `scripts/collect_i18n_strings.sh` を改修し、検出漏れパターンを inventory.csv に back-fill (`status=approved`, `reviewer=PR-5.x`, `notes=blind spot retroactive`)。

### 5.3 残翻訳 (Phase 5 docs scope)

- README.md / CONTRIBUTING.md (本リポジトリ + upstream の差分)
- `docs/` (Hugo) sample-config / quickstart / etc.
- `pyproject.toml` version bump `v5.0.0` → `v6.0.0-jp.1`
- judge prompt (`aitl_reviewer` 等の system prompt) — 任意

---

## 6. Phase 5 への引き継ぎ事項

- **翻訳ポリシー** (§1.2) は Phase 5 docs にもそのまま適用
- **PR-5.0 hotfix** を docs 翻訳より先に実施することで、production-ready 状態を早期確保
- **`width.ts` 配線** は破壊的変更ゼロ (関数 signature 互換) なので、複数 PR に分けて段階適用可能
- **collector 改修** は Phase 5 Wave 2 で全 4 phase 分一括 back-fill 推奨
- **実機 smoke 手順 (§4)** は user 任意、未実施でも Phase 5 着手可能 — ただし PR-5.0 leak 判断のため 4.2.4 だけは実施推奨

---

## 7. 補足: 静的監査スクリプト

英語 residue 検出 (`§2.3`) と CJK 半切れリスク検出 (`§2.5`) は以下の shell コマンドで再現可能:

```bash
cd /home/shinyay/work/github/polyclaw-jp

# §2.3 英語 residue 候補抽出
for f in app/tui/src/screens/*.ts app/tui/src/ui/*.ts \
         app/tui/src/headless/*.ts app/tui/src/deploy/*.ts \
         app/tui/src/config/*.ts; do
  grep -nE '"[A-Z][a-zA-Z][a-zA-Z ]+[a-z][a-z][a-z]+(\.\.\.)?"' "$f" 2>/dev/null \
    | grep -vE '"(http|https|POST|GET|PUT|DELETE|application|Bearer|Content)"' \
    | grep -vE '"(local|stdio|http|chat|phone|tool|mcp|allow|deny|true|false)"' \
    | grep -vE 'data-testid|className|console\.log|throw new'
done

# §2.5 CJK 半切れリスクサイト
grep -rn "\.slice([0-9]" app/tui/src/ --include='*.ts' \
  | grep -E "args\.slice|message\.slice|text\.slice|content\.slice"

# §2.4 width.ts 配線数
grep -rn "utils/width\|from.*width" app/tui/src/ --include='*.ts' \
  | grep -v "utils/width.ts:"
```

---

**Phase 4 TUI i18n: 🎉 翻訳作業 COMPLETE (840/840) / 動作品質 ⚠️ PR-5.0 hotfix 推奨**
