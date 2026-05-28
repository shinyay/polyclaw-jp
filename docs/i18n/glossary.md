# Polyclaw 日本語化 用語集

## はじめに
- この用語集は、polyclaw-jp の日本語 UI とドキュメントで訳語を統一するための基準です。
- 各用語は「英語、訳語、注釈、代替案」の 4 列形式で整理します。
- 用語の追加・変更は、実際の UI やコードでの使用箇所を確認したうえで PR で行ってください。
- 基本方針は「ユーザに見えるものは日本語、開発者しか見ないものは英語」です。

## 1. プロダクト固有

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| polyclaw | polyclaw | プロダクト名として維持します | Polyclaw |
| SOUL / SOUL.md | 魂（SOUL） | 人格定義ファイルは併記します | SOUL のまま |
| Octo | オクト | デフォルト人格名です。候補はオクト、八雲、雷神、ポリ、自由入力です | Octo のまま |
| BYOK | BYOK | Bring Your Own Key の略称として維持します | 自分のキーを使用 |
| Polyclaw CLI | Polyclaw CLI | コマンドライン製品名として維持します | Polyclaw コマンドライン |
| Polyclaw TUI | Polyclaw TUI | ターミナル UI 製品名として維持します | Polyclaw ターミナル UI |
| Admin | 管理 | ユーザー向け画面では日本語化します | Admin のまま |
| Runtime | ランタイム | 実行環境を指します | 実行時 |
| Combined mode | 統合モード | Admin と Runtime の同時実行を指します | 複合モード |
| Setup Wizard | セットアップウィザード | 初期設定ページ名として使います | 初期設定 |
| Customization | カスタマイズ | UI 設定ページ名として使います | 個別設定 |
| MCP Servers | MCP サーバー | サーバーは長音付きで統一します | MCP サーバ |
| Agent Identity | エージェント ID | 人格や表示名の設定を指します | エージェント識別情報 |
| Agent Profile | エージェントプロファイル | TopBar ドロップダウンの Profile リンク表記です | エージェント情報 |
| Infrastructure | インフラ | サイドバーや設定ページのナビ表記として短縮形を採用します | インフラストラクチャ |
| AI Model | AI モデル | モデル設定ページ名として使います | AI モデル設定 |
| Hardening | ハードニング | ガードレール / セキュリティ強化機能のナビ表記です | 防御強化 |
| Persona | 人格 | エージェントの名前と性格設定を指します | キャラクター |
| Voice | 音声 | Realtime Voice で使う TTS 声優を指します | ボイス |

## 2. エージェント技術

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Agent | エージェント | AI 実行主体を指します | 代理人 |
| Tool | ツール | エージェントが呼び出す機能です | 道具 |
| Skill | スキル | LLM 用語として浸透しています | 技能 |
| Plugin | プラグイン | 機能拡張パッケージを指します | 拡張機能 |
| Session | セッション | 会話や実行単位を指します | 実行回 |
| Sandbox | サンドボックス | 隔離実行環境を指します | 隔離環境 |
| Guardrails | ガードレール | 安全制御全般を指します | 安全制御 |
| HITL | 人手承認（HITL） | Human in the Loop の略です | 人間参加型 |
| AITL | AI 承認（AITL） | AI in the Loop の略です | AI 参加型 |
| PITL | 電話承認（PITL） | Phone in the Loop の略です | 電話参加型 |
| Approval | 承認 | 操作実行前の許可です | 許可 |
| Tool call | ツール呼び出し | 呼び出し要求を指します | ツールコール |
| Tool use | ツール実行 | 実際の使用や結果まで含めます | ツール利用 |
| System prompt | システムプロンプト | LLM の上位指示です | システム指示 |
| Bootstrap prompt | 起動プロンプト | 初期化時の追加指示です | ブートストラッププロンプト |
| Hook | フック | 処理前後に差し込む機構です | 差し込み処理 |
| Interceptor | インターセプター | 呼び出しを横取りして制御します | インターセプタ |
| Reasoning | 推論 | モデルの思考過程を指します | 推論処理 |
| One-shot | ワンショット | 1 回で完結する実行です | 単発実行 |
| Multi-turn | マルチターン | 複数往復の会話です | 複数ターン |
| Slash command | スラッシュコマンド | チャット入力欄で `/` で始まるコマンドです | スラッシュ命令 |
| Suggestion | 質問の例 | チャット空状態で提示するサジェストです | サジェスト |
| Allow | 許可 | HITL 承認の肯定アクションです | 認可 |
| Deny | 拒否 | HITL 承認の否定アクションです | 不許可 |

## 3. インフラ / クラウド

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Deployment | デプロイ | 配備作業を指します | 展開 |
| Tunnel | トンネル | 外部公開経路を指します | 通信トンネル |
| Cloudflare Tunnel | Cloudflare Tunnel | サービス名として維持します | Cloudflare トンネル |
| Foundry | Foundry | Azure AI Foundry 文脈の固有名詞です | Foundry のまま |
| Foundry IQ | Foundry IQ | ページ名と機能名として維持します | Foundry IQ のまま |
| Bicep | Bicep | IaC 言語名として維持します | Bicep のまま |
| ACA / Azure Container Apps | Azure Container Apps (ACA) | 初出は正式名と略称を併記します | ACA |
| Bot Service | Bot Service | Azure サービス名として維持します | ボットサービス |
| Key Vault | Key Vault | Azure サービス名として維持します | キーコンテナー |
| Service Principal | サービスプリンシパル | Azure 認証主体を指します | サービス主体 |
| Managed Identity | マネージド ID | Azure の公式訳に合わせます | 管理 ID |
| RBAC | RBAC | Role-Based Access Control の略です | ロールベースアクセス制御 |
| Role assignment | ロール割り当て | Azure 権限付与を指します | 役割割り当て |
| Role | ロール | Azure RBAC のロール名は英語維持、ラベルのみ翻訳します | 役割 |
| Scope | スコープ | RBAC 適用範囲を指します | 範囲 |
| Display Name | 表示名 | Azure リソースの表示用名称です | 表示用名前 |
| App ID | アプリ ID | Entra ID アプリケーション ID を指します | アプリケーション ID |
| Principal | プリンシパル | Azure 認証主体を指します | 主体 |
| Principal Type | プリンシパル種別 | サービスプリンシパル/マネージド ID の区別です | プリンシパル タイプ |
| Required Roles | 必要なロール | エージェントに必須の RBAC ロール群です | 必須ロール |
| Assigned | 割り当て済 | ロール状態のラベルです | 割当済み |
| Missing | 未割り当て | ロール状態のラベルです | 不足 |
| Resource Group | リソースグループ | Azure の管理単位です | リソース グループ |
| Subscription | サブスクリプション | Azure 課金・管理単位です | 契約 |
| Tenant | テナント | Entra ID の単位です | 組織 |
| Region / Location | リージョン | Azure UI の Location も統一します | 場所 |
| Endpoint | エンドポイント | 接続先 URL や API 先を指します | 接続先 |

## 4. チャネル / 通信

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Bot | ボット | 会話主体や Azure Bot を指します | Bot のまま |
| Channel | チャネル | Telegram などの接続先を指します | チャンネル |
| Webhook | Webhook | 技術用語として維持します | Webhook のまま |
| Realtime | Realtime / リアルタイム | 機能名は英語併記します | リアルタイムのみ |
| ACS / Communication Services | Azure Communication Services (ACS) | 初出は正式名と略称を併記します | ACS |
| WebSocket | WebSocket | プロトコル名として維持します | WebSocket のまま |
| Telegram | Telegram | サービス名として維持します | Telegram のまま |
| Conversation reference | 会話リファレンス | Bot Framework の参照情報です | 会話参照 |
| Message | メッセージ | 送受信する本文を指します | 送信内容 |
| Chat | チャット | 会話 UI やページ名に使います | 会話 |

## 5. データ / 永続化

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Memory | メモリ | LLM 文脈では「記憶」よりこちらを使います | 記憶 |
| Workspace | ワークスペース | 作業対象の領域を指します | 作業領域 |
| Profile | プロファイル | ユーザーや人格設定を指します | プロフィール |
| Activity | アクティビティ | やり取りの履歴や統計を指します | 活動 |
| Activity heatmap | アクティビティヒートマップ | 日別のやり取り数の濃淡表示です | ヒートマップ |
| Streak | 連続 | 連続稼働日数を指します | 連続日数 |
| Skill usage | スキル使用回数 | スキル別の呼び出し回数です | スキル利用数 |
| Emotional state | 感情状態 | 8 値固定です (平常/好奇心/集中/達成感/高揚/思索/警戒/困惑) | 気分 |
| Schedule | スケジュール | UI 名詞として使います | 予定 |
| Scheduled task | スケジュールタスク | 自動実行される予定タスクです | 予約タスク |
| Proactive | プロアクティブ | 先回り動作の機能名です | 能動的 |
| Proactive message | プロアクティブメッセージ | 自発的に送る通知です | 能動メッセージ |
| Session store | セッションストア | セッション永続化層です | セッション保存先 |
| Tool activity | ツールアクティビティ | ツール実行履歴を指します | ツール実行履歴 |
| State store | ステートストア | 状態保存層を指します | 状態ストア |
| Cron | cron | 表記は小文字のまま維持します | Cron |
| Persistent | 永続 | 再起動後も残る性質です | 持続 |
| Data directory | データディレクトリ | 永続ファイルの保存場所です | データフォルダー |

## 6. UI 共通

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Save | 保存 | ボタン動詞は名詞形で統一します | 保存する |
| Apply | 適用 | 設定反映に使います | 反映 |
| Cancel | キャンセル | 操作中止に使います | 取り消し |
| Close | 閉じる | ダイアログ終了に使います | クローズ |
| Delete | 削除 | 破壊的操作に使います | 消去 |
| Add | 追加 | 新しい項目の追加です | 加える |
| Edit | 編集 | 既存項目の変更開始です | 変更 |
| Update | 更新 | 既存項目の保存更新です | アップデート |
| Search | 検索 | キーワード検索に使います | 探す |
| Filter | 絞り込み | 条件で表示対象を絞ります | フィルター |
| Sort | 並べ替え | 表示順の変更です | ソート |
| Enable | 有効化 | 機能をオンにします | オンにする |
| Disable | 無効化 | 機能をオフにします | オフにする |
| Install | インストール | 追加導入に使います | 導入 |
| Uninstall | アンインストール | 導入済み項目の削除です | 削除 |
| Configure | 設定 | 詳細設定を開く操作です | 構成 |
| Reset | リセット | 初期状態に戻します | 初期化 |
| Continue | 続行 | 次の処理へ進みます | 続ける |
| Back | 戻る | 前の画面へ戻ります | 戻って |
| Next | 次へ | ウィザードの次段階です | 進む |
| New | 新規 | 新規作成の入口です | 新しい |
| Open | 開く | 既存項目を開きます | オープン |
| Send | 送信 | メッセージ送信に使います | 送る |
| Refresh | 更新 | データを再取得する操作です | 再読み込み |
| Skip | スキップ | 任意ステップを後回しにする操作です | 飛ばす |
| Preview | 試聴 | Voice などの音声プレビューで使います | プレビュー |
| Default | 既定 | 初期値/推奨を併記する場面に使います | デフォルト |
| Custom | カスタム | プリセット以外の自由入力を指します | 独自 |
| Emoji | 絵文字 | アイコン代わりの記号として使います | スタンプ |
| Empty session | 空のセッション | タイトル未設定のセッション表示です | 無題セッション |
| just now | たった今 | 1 分未満の相対時刻です | 今 |
| N minutes ago | N 分前 | 半角スペースを開けます | N 分前 |
| N hours ago | N 時間前 | 半角スペースを開けます | N 時間前 |
| N days ago | N 日前 | 半角スペースを開けます | N 日前 |
| N weeks ago | N 週間前 | 半角スペースを開けます | N 週間前 |

## 7. 状態

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Enabled / Disabled | 有効 / 無効 | 設定状態に使います | オン / オフ |
| Active / Inactive | アクティブ / 非アクティブ | 稼働状態に使います | 有効 / 無効 |
| Pending | 待機中 | 承認や処理待ちです | 保留中 |
| Running | 実行中 | 処理が進行中です | 稼働中 |
| Completed / Done | 完了 | 正常終了を指します | 済み |
| Failed / Error | 失敗 / エラー | Failed は結果、Error は状態です | 障害 |
| Success | 成功 | 成功結果に使います | 正常 |
| Idle | アイドル | 何も実行していない状態です | 待機 |
| Loading | 読み込み中 | UI のロード状態です | ロード中 |
| Available / Unavailable | 利用可能 / 利用不可 | 機能や接続先の可否です | 使用可能 / 使用不可 |
| Draft | 下書き | 未確定の設定や文面です | ドラフト |
| Unknown | 不明 | 状態を判定できない場合です | 未確認 |

## 8. セキュリティ / 認証

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Authentication | 認証 | 本人確認を指します | AuthN |
| Authorization | 認可 | 権限付与を指します | AuthZ |
| Token | トークン | 認証情報や交換用値です | 認証トークン |
| Secret | シークレット | 秘密情報を指します | 秘密値 |
| Lockdown mode | ロックダウンモード | 制限を強める動作モードです | 厳格モード |
| Whitelist | 許可リスト | 包摂的表現として採用します | ホワイトリスト |
| Content Safety | Content Safety | Azure サービス名として維持します | コンテンツ安全性 |
| Prompt Shield | Prompt Shield | Azure 機能名として維持します | プロンプト保護 |
| Preflight check | 事前チェック | 実行前の検証です | 事前確認 |
| Bearer | Bearer | HTTP 認証スキーム名として維持します | ベアラー |
| Sign in | サインイン | 認証画面の動詞ラベルです | ログイン |
| Re-authenticate | 再認証 | 再ログインを促す表現として使います | 再ログイン |
| Device code | デバイスコード | Azure CLI device-code フローで表示する短い認証コードです | デバイス認証コード |

## 訳語ブレを避けるための注意

- "Memory" は LLM 文脈では「メモリ」に統一します。一般文脈でも混在を避けるため、原則として「メモリ」を使います。
- "Schedule" は UI 名詞では「スケジュール」を使います。文章中で日程を指す場合のみ「予定」も許容します。
- 同じ概念に複数の訳語を使わないでください。例外が必要な場合は注釈に理由を書きます。
- ユーザに見えるラベル、ボタン、説明文は日本語にします。API 名、ファイル名、コード上の識別子は英語を維持します。

