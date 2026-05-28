# `data-testid` 規約

> **位置づけ**: Phase 2 (Frontend 日本語化) の基盤整備 (PR-2.0) の一部として、
> 日本語化により頻発する E2E ロケータ破壊を防ぐために導入する。

---

## 1. 採用理由

Phase 2 では Frontend ユーザー可視文字列 794 件を順次日本語化する。`Playwright` の既存
E2E (8 spec) は `getByRole({ name: ... })` や `getByText(...)` のように
**表示文字列に依存するロケータ** を多用しており、文言を 1 文字でも変えるたびに
spec が壊れる。

`data-testid` をテスト用の安定したフックとして導入し、E2E は表示文言ではなく
testid を中心に書く方針へ転換する。これにより、

- 翻訳 PR が `playwright test` を壊さない
- ロケータが意図 (= 何の要素か) を直接表現する
- CSS class や `getByRole` と用途が分離される

を実現する。

---

## 2. 命名規約

### 2.1 基本形

```
<scope>-<element>[-<modifier>]
```

- `<scope>` — その要素が属する画面 or 共通コンポーネント名 (例: `sidebar`, `topbar`,
  `login`, `chat`, `setup`, `guardrails`)
- `<element>` — 要素の意味的な役割 (例: `link`, `button`, `input`, `toggle`, `error`)
- `<modifier>` — 任意。同一 element 内で個別に識別する必要があれば追加
  (例: ナビリンクのページ名 `sidebar-link-chat`, `sidebar-link-sessions`)

### 2.2 文字種

- **すべて小文字の kebab-case**
- 半角英数とハイフン (`-`) のみ。日本語・空白・大文字・アンダースコアは不可
- 動的に生成する場合は、ソースの値もそのまま使う (例: ルート `/tool-activity`
  → `sidebar-link-tool-activity`)

### 2.3 良い例 / 悪い例

| ✅ 良い例 | ❌ 悪い例 | 理由 |
|---|---|---|
| `chat-input` | `chatInput` | camelCase は禁止 |
| `chat-send-button` | `send_btn` | snake_case 禁止・略語禁止 |
| `sidebar-link-sessions` | `sidebar-link-2` | インデックス参照は脆い |
| `login-button-submit` | `login-btn` | element の役割を明示 |
| `toast-error` | `toast-赤` | 半角英のみ |

---

## 3. 付与優先度

すべての要素に testid を付ける必要はない。次の優先度で付与する。

| 優先度 | 対象 | 例 |
|---|---|---|
| **必須** | 操作要素 (button / input / link / form) | サイドバーリンク、送信ボタン、入力欄 |
| **必須** | E2E が assertion したい状態表示 (toast, error message, badge) | `login-error`, `toast-success` |
| **推奨** | モーダル / ダイアログ / ドロップダウン本体 | `topbar-dropdown` |
| **任意** | レイアウト要素 (header / aside / nav) | 既存 `.sidebar` class で十分 |
| **不要** | 純粋な装飾要素 (icon-only, spacer, divider) | アイコン単体は付けない |

---

## 4. 用途の分離

`data-testid` は **テスト専用** とする。

- **テスト** ✅: `page.locator('[data-testid="login-button-submit"]')` で参照する
- **CSS hooking** ❌: スタイルは `className` で当てる。`[data-testid="..."]` を
  CSS セレクタにしない
- **アプリケーションロジック** ❌: JS 側で `document.querySelector` しない。
  React の ref や state で扱う

これにより、デザイン変更や状態管理リファクタが testid を壊さない。

---

## 5. E2E spec での使い方

### 5.1 推奨ロケータ

```ts
// ✅ Good: testid 中心
await page.locator('[data-testid="login-input-secret"]').fill('my-secret')
await page.locator('[data-testid="login-button-submit"]').click()

// ✅ Good: 表示文言に依存しないロール参照
await expect(page.getByRole('navigation')).toBeVisible()

// ❌ Bad: 表示文言依存 (日本語化で壊れる)
await page.getByPlaceholder('Admin secret').fill('my-secret')
await page.getByRole('button', { name: 'Sign In' }).click()
await expect(page.getByText('Technology Demonstrator')).toBeVisible()
```

### 5.2 移行戦略

- **PR-2.0** (本 PR): 主要 3 コンポーネント (Sidebar / TopBar / LoginOverlay) に
  testid を付与。`auth.spec.ts` に testid ベースの新 assertion を **追記** する
  (既存 assertion は残し、共存可能であることを示す)
- **PR-2.1 以降**: 翻訳対象のコンポーネントに testid を順次追加し、対応する
  spec を testid ベースへ移行
- **PR-2.11** (Phase 2 仕上げ): 表示文言依存の古い locator をすべて排除

---

## 6. PR-2.0 で付与した testid 一覧

参考実装。後続 PR ではここを起点に拡張する。

### 6.1 `Sidebar.tsx`

| testid | 要素 |
|---|---|
| `sidebar-toggle` | サイドバーの折りたたみ/展開ボタン |
| `sidebar-link-chat` | Chat へのナビリンク |
| `sidebar-link-sessions` | Sessions へのナビリンク |
| `sidebar-link-skills` | Skills へのナビリンク |
| `sidebar-link-plugins` | Plugins へのナビリンク |
| `sidebar-link-mcp` | MCP Servers へのナビリンク |
| `sidebar-link-schedules` | Schedules へのナビリンク |
| `sidebar-link-profile` | Profile へのナビリンク |
| `sidebar-link-messaging` | AI Model へのナビリンク |
| `sidebar-link-infrastructure` | Infrastructure へのナビリンク |
| `sidebar-link-guardrails` | Hardening へのナビリンク |
| `sidebar-link-tool-activity` | Tool Activity へのナビリンク |

動的に `data-testid={\`sidebar-link-${item.to.slice(1)}\`}` で生成する。

### 6.2 `TopBar.tsx`

| testid | 要素 |
|---|---|
| `topbar-toggle-panel` | セッションパネル開閉ボタン |
| `topbar-agent-trigger` | エージェントメニュー開閉ボタン |

### 6.3 `LoginOverlay.tsx`

| testid | 要素 |
|---|---|
| `login-input-secret` | 管理シークレット入力欄 |
| `login-button-submit` | サインインボタン |

---

## 7. レビュー時のチェックポイント

新規 PR をレビューする際に確認する項目:

- [ ] 操作要素 (button/input/link) に testid が付いているか
- [ ] testid 名が本ドキュメントの命名規約 (§2) に従っているか
- [ ] 同じ画面内で testid が重複していないか
- [ ] CSS セレクタとして `[data-testid="..."]` を使っていないか (§4 違反)
- [ ] 表示文言依存の Playwright ロケータが新規追加されていないか
- [ ] 既存の表示文言依存 locator を testid 版で **置き換え** ているか
      (新規追加のみで残置していないか)
