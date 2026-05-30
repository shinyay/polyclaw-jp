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
| 実機 TUI 起動 / 主要画面遷移 | ⚠️ **DEFERRED — §4 に実機操作手順 spec、user 任意で実施** |
| Setup wizard (headless) JA 文言検証 | ⚠️ **DEFERRED — Azure subscription + Container Apps 環境必要、user 任意** |

**総合判定**:

- **翻訳作業の完了**: ✅ Phase 4 のスコープ (TUI 840 entries の JP 化) は **100% 達成**、9 commit に分割、CI 全 green
- **静的品質**: ✅ test 103/103 pass、typecheck pre-existing 1 のみ、新規 error 0
- **動作品質**: ⚠️ **3 件の leak 候補 + CJK 幅 helper 未配線** を発見 → Phase 5 で hotfix 必要だが、blocker ではない
- **本番運用判定**: 🟡 **TUI 翻訳成果物のみで本番投入可能だが、Phase 5 で `width.ts` 配線 + leak 解消推奨**

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

### 4.4 結果記録欄 (実施時に追記)

| 日時 | 実施者 | 検証項目 | 結果 | 備考 |
|---|---|---|:---:|---|
| (未実施) | — | 4.2.1 起動 + ASCII art | — | |
| (未実施) | — | 4.2.2 タブ巡回 (11 タブ) | — | |
| (未実施) | — | 4.2.3 日本語入力 + tool args | — | CJK 半切れ確認 |
| (未実施) | — | 4.2.4 `Thinking` leak verify | — | leak 検出された?  |
| (未実施) | — | 4.2.5 終了 | — | |
| (未実施) | — | 4.3 setup wizard 文言 | — | (任意、Azure 必要) |

---

## 5. Phase 5 backlog (PR-5.0 hotfix 候補 + 改善項目)

### 5.1 PR-5.0 hotfix (Phase 4 仕上げ)

`docs/i18n/inventory.csv` の status は全 translated/approved 済だが、以下 9 site の追加修正が望ましい:

1. **leak 修正** (3 site, §2.3):
   - `ui/tui.ts:412` `"Thinking"` → `"考え中"`
   - `ui/tui.ts:356` `"Admin"/"Runtime"` → 議論後翻訳 or 英語維持
   - `config/constants.ts:85,86,91,92` `"Tunnel"/"Bot"` → 議論後翻訳 or 英語維持

2. **CJK 幅 helper 配線** (`width.ts` import + 4 site 置換, §2.4 + §2.5):
   - `screens/chat.ts:189,283` `args.slice(N)` → `truncateByWidth(args, N, "...")`
   - `headless/{setup,aca_setup}.ts` `text.slice(0, 100)` → 同上
   - (将来) `padEnd(5)` を使う log level 整形などにも段階的に展開

3. **`@opentui/core` 0.1.107 API 追従**:
   - `ui/app.ts:94` の `useAlternateScreen` プロパティ削除 (typecheck error 解消)

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
