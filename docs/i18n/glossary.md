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

## 9. プロアクティブ / スケジューラ (PR-2.6)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Proactive follow-up | プロアクティブ通信 | エージェントが自発的に行う送信です。「フォローアップ」を含めず短く表記します | 自発的フォローアップ |
| Followup / Follow-up | フォローアップ | 個別の送信を指す名詞です | 続報 |
| Memory Agent | メモリエージェント | プロアクティブ通信の素材になるメモリを生成するサブエージェントです | メモリ生成エージェント |
| Memory formation | メモリ生成 | 会話履歴をまとめて保存する処理を指します | メモリ作成 |
| Buffered turn | バッファ中のターン | 未処理の会話往復を指します | 未処理ターン |
| Idle timer | アイドルタイマー | 非活性検出のためのタイマーです | 非活性タイマー |
| Cron / cron expression | cron 設定 / cron 式 | 5 フィールド構文は技術ラベルとして英語維持です | スケジュール式 |
| Heatmap | ヒートマップ | 週間予定の濃淡表示を指します | カレンダーマップ |
| Pending | 保留中 | 送信予定だが未送信の状態を指します | 待機中 |
| Preferences | 設定 | プロアクティブ通信全体の好みを指します | 通信設定 |
| Min gap (hours) | 最小間隔 (時間) | プロアクティブ送信の間隔下限です | 最低待機時間 |
| Max daily | 1 日の最大送信数 | プロアクティブ送信の 1 日あたり上限です | 日次上限 |
| Preferred times | 送信を推奨する時間帯 | プロアクティブ送信を推奨する時間範囲です | 推奨送信時間 |
| Avoided topics | 避けるトピック | プロアクティブ通信で取り上げない話題のリストです | 除外トピック |

## 10. スキル / プラグイン (PR-2.5)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Skill | スキル | エージェントが利用する機能単位を指します | 機能 |
| Plugin | プラグイン | 複数スキルを束ねた配布単位を指します | 拡張機能 |
| Built-in | ビルトイン | polyclaw 同梱の意味です | 組み込み |
| Marketplace | マーケットプレイス | スキル配布カタログを指します | スキルストア |
| Agent-created | エージェント生成 | エージェント自身が作ったスキルです | 自動生成 |
| Recommended | おすすめ | キュレーション済みスキルです | 推奨 |
| Available | 未インストール | フィルタピル文脈です | インストール可能 |
| Featured | おすすめ | バナー文脈で利用します | 注目 |
| Installed | インストール済み | 状態バッジ / ボタン文言として共通です | 導入済み |
| GET (button) | 入手 | マーケットプレイスのインストール開始ボタンです | インストール |
| Loved | よく使う | 頻繁に利用されているスキル群を指します | お気に入り |
| Trending | トレンド | 活発に更新されているスキル群を指します | 注目 |
| Local | ローカル | ファイルから取り込んだスキルを指します | 自前 |
| Community | コミュニティ | 由来不明のコミュニティスキルです | 一般 |
| Source (plugin meta) | ソース | プラグインの提供元 (builtin / user 等) を指します | 提供元 |
| Version | バージョン | プラグインや依存のバージョン情報です | リリース |
| Author | 作者 | プラグイン作者を指します | 制作者 |
| Homepage | ホームページ | プラグイン公式サイトを指します | サイト |
| Setup required | セットアップが必要 | プラグインの初期設定未完を示すバッジです | 初期設定が必要 |
| Import ZIP | ZIP をインポート | ローカルプラグインの取り込みです | ZIP からインポート |
| Contribute | 貢献する | エージェント生成スキルを GitHub に貢献するボタンです | 共有 |
| Revision | リビジョン | スキルの編集回数を表します | 改版 |
| Use (count) | 利用 (回) | スキル使用回数を表します | 使用 |
| Included Skills | 同梱スキル | プラグインに含まれるスキル一覧の見出しです | 内包スキル |
| Copy & Open on GitHub | コピーして GitHub を開く | 貢献モーダルのアクションラベルです | クリップボードにコピーして GitHub を開く |

## 11. MCP (PR-2.7)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| MCP | MCP | Model Context Protocol の略称として維持します | モデルコンテキストプロトコル |
| MCP Servers (page) | MCP サーバー | 設定ページ名として使います (§1 既出) | MCP サーバ |
| My Servers (tab) | マイサーバー | 登録済みサーバー一覧タブです | 登録済み |
| Discover (tab) | ディスカバー | 公開レジストリ閲覧タブです | 探索 |
| Local (stdio) | ローカル (stdio) | stdin/stdout で接続するローカルプロセス型 | ローカル (標準入出力) |
| HTTP (Streamable) | HTTP (ストリーミング) | HTTP ストリーム接続型 | HTTP (ストリーマブル) |
| SSE | SSE | Server-Sent Events の略称として維持します | サーバー送信イベント |
| Command (MCP) | コマンド | 起動コマンドの入力欄です | 実行コマンド |
| Arguments (one per line) | 引数 (1 行に 1 つ) | コマンド引数の入力欄です | 引数 (各行に 1 個) |
| Environment (KEY=VALUE per line) | 環境変数 (1 行に KEY=VALUE) | 環境変数の入力欄です | 環境変数 (KEY=VALUE 形式) |
| Search MCP servers... | MCP サーバーを検索... | ディスカバータブの検索プレースホルダです | サーバー検索 |
| Page N | N ページ目 | ページネーション表記です | ページ N |
| Prev / Next | 前へ / 次へ | ページネーションボタンです (§6 既出) | 前 / 次 |
| Stars (registry) | スター | GitHub Stars 数を指します | スター数 |
| License (registry) | ライセンス | パッケージのライセンス表記です | 利用条件 |
| Open (registry) | 開く | レジストリ詳細を新タブで開きます | 表示 |
| Added (registry badge) | 追加済み | レジストリから登録済みであることを示します (§7 既出) | 登録済み |
| Topics (registry) | トピック | GitHub Topics タグを指します | タグ |
| No MCP servers configured | MCP サーバーは未登録です | 空状態メッセージです | MCP サーバー未登録 |
| built-in (server badge) | ビルトイン | 組み込みサーバー識別バッジです (§9 既出と整合) | 組み込み |
| disabled (server badge) | 無効 | 無効状態識別バッジです (§9 既出) | 停止 |

## 12. Environments + Foundry IQ + Workspace + Customization (PR-2.7 C2-C5)

### Environments

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Environments | 環境 | ページ名およびデプロイ環境一覧を指します | デプロイ環境 |
| Deployment ID | デプロイ ID | デプロイの一意識別子です | 識別子 |
| Kind | 種別 | デプロイ種別 (local / aca 等) を指します | 種類 |
| Status | 状態 | デプロイ状態 (§7 既出) | ステータス |
| active | 稼働中 | 内部値 `active` を表示用に変換 (内部値は維持) | アクティブ |
| destroyed | 破棄済み | 内部値 `destroyed` を表示用に変換 (内部値は維持) | 削除済み |
| Version | バージョン | デプロイバージョン (§5 既出) | バージョン番号 |
| Created | 作成日時 | 作成タイムスタンプを指します | 作成時刻 |
| Run Audit | 監査を実行 | リソース監査ボタンです | 監査開始 |
| No orphaned resources found | 孤立したリソースはありません | 監査成功時の表示 | 孤立リソースなし |
| Orphaned resources | 孤立リソース | 追跡対象から外れた Azure リソースを指します | 未追跡リソース |
| Tracked Resources | 追跡対象リソース | デプロイで管理しているリソースを指します | 管理リソース |
| Destroy | 破棄 | デプロイ破棄ボタンです | 削除 |
| No deployments registered | 登録済みデプロイはありません | 空状態メッセージです | デプロイ未登録 |

### Foundry IQ

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Foundry IQ | Foundry IQ | プロダクト固有名として維持します | Foundry IQ のまま |
| Configuration | 設定 | フォーム見出しです (§3 既出) | 構成 |
| Search Endpoint | Search エンドポイント | Azure AI Search のエンドポイント (Search は維持) | 検索エンドポイント |
| Search API Key | Search API キー | Azure AI Search の API キー | 検索 API キー |
| Embedding Endpoint | 埋め込みエンドポイント | Azure OpenAI Embeddings のエンドポイント | エンベディングエンドポイント |
| Embedding API Key | 埋め込み API キー | Azure OpenAI Embeddings の API キー | エンベディング API キー |
| Embedding Model | 埋め込みモデル | Embeddings モデル名 (例: text-embedding-3-large) | エンベディングモデル |
| Embedding Dimensions | 埋め込み次元数 | ベクトル次元数を指します | エンベディング次元 |
| Index Name | インデックス名 | Azure AI Search インデックス名 | 索引名 |
| Index Schedule | インデックススケジュール | 自動再インデックス頻度です | 索引スケジュール |
| daily / hourly / manual | 毎日 / 毎時 / 手動 | 内部値は維持、表示時に日本語変換 | 日次 / 時次 / マニュアル |
| Last Indexed | 最終インデックス | 最終インデックス実行タイムスタンプ | 前回インデックス |
| No index | インデックスなし | docCount 内部値 `No index` の表示変換 | 索引未作成 |
| Documents | ドキュメント数 | インデックス済みドキュメント数 | 文書数 |
| Provisioned Resources | プロビジョニング済みリソース | デプロイ済み Azure リソース表示 | 既存リソース |
| Resource Group | リソースグループ | Azure リソースグループ名 (固有名) | リソース グループ |
| Search Service (Foundry IQ) | Search サービス | Azure AI Search のリソース名 (Search は維持) | 検索サービス |
| OpenAI Account (Foundry IQ) | OpenAI アカウント | Azure OpenAI のリソース名 (OpenAI は維持) | OpenAI リソース |
| Run Indexing | インデックスを実行 | 手動インデックス実行ボタンです | 索引実行 |
| Save & Create Index | 保存してインデックス作成 | 設定保存 + ensure-index API 実行 | 保存して索引作成 |
| Search your memories... | メモリを検索... | 検索入力プレースホルダ | 記憶を検索... |
| No results | 結果なし | 検索結果ゼロ時の表示 | 該当なし |
| Enable Foundry IQ | Foundry IQ を有効化 | 有効化チェックボックス | Foundry IQ をオン |

### Workspace / Customization

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Workspace | ワークスペース | ページ名およびファイル一覧を指します | 作業領域 |
| Empty directory | 空のディレクトリです | 空のディレクトリ表示 | ディレクトリは空です |
| Binary file - cannot preview | バイナリファイルのため表示できません | バイナリファイルのプレビュー不可表示 | バイナリは表示不可 |
| SOUL | ソウル | Customization ページのカード見出し (§1 SOUL は併記、ここではカード短縮形) | 魂 |
| Skills (nav card) | スキル | Customization ページのカード見出し (§1 既出) | スキル一覧 |
| Plugins (nav card) | プラグイン | Customization ページのカード見出し (§1 既出) | プラグイン一覧 |
| MCP servers (nav card) | MCP サーバー | Customization ページのカード見出し (§1 既出) | MCP サーバ |



- "Memory" は LLM 文脈では「メモリ」に統一します。一般文脈でも混在を避けるため、原則として「メモリ」を使います。
- "Schedule" は UI 名詞では「スケジュール」を使います。文章中で日程を指す場合のみ「予定」も許容します。
- 同じ概念に複数の訳語を使わないでください。例外が必要な場合は注釈に理由を書きます。
- ユーザに見えるラベル、ボタン、説明文は日本語にします。API 名、ファイル名、コード上の識別子は英語を維持します。

## 13. Infrastructure (PR-2.9)

InfrastructureSettings.tsx は Azure / Bot / Monitoring / Memory / Voice の 5 つのサブシステムを Overview + Tabs 構成で扱います。固有名詞 (Azure リソース名、SKU 名、リージョン名) は基本的に英語を維持し、ユーザに見えるラベル/説明文/ボタン/ヒント/トーストを日本語化します。

### Overview / 共通

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Infrastructure | インフラ | ページ見出し / Tab グループ (短縮形優先) | インフラストラクチャ |
| Provisioned | プロビジョニング済み | リソースが Azure に作成済みの状態を示すバッジ | 構成済み |
| Active | アクティブ | リソースが起動・接続済みでデータも流れている状態 | 稼働中 |
| Configured | 構成済み | 接続情報を保存済み (Voice タブの状態バッジ) | 設定済み |
| Enabled (with no export) | 有効化済み (エクスポートなし) | OTel が enable=true だが export 先未設定の状態 | 有効 (送信なし) |
| Disabled | 無効 | 機能がオフ | オフ |
| Resource Group | リソースグループ | Azure 標準訳 (Microsoft Learn 準拠) | RG |
| Location | リージョン | Azure 標準訳 (region と location は実質同義のため統一) | ロケーション |
| Deploy New | 新規デプロイ | mode selector の左カード見出し | 新しくデプロイ |
| Connect Existing | 既存に接続 | mode selector の右カード見出し | 既存リソースに接続 |
| Decommission | 破棄 | リソース削除アクションのボタン | 削除 / 廃止 |
| Decommissioning... | 破棄中... | 上記のローディング表示 | 削除中... |
| Refresh | 更新 | リスト再取得ボタン | リフレッシュ |
| Scanning... | スキャン中... | サブスクリプション内のリソース検出中の表示 | 検索中... |

### Bot Service / Channels (Overview Tab)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Bot Service | Bot Service | Azure 製品名のため英語維持 | — |
| App Registration | アプリ登録 | Entra ID のアプリ登録を指します | App registration |
| Tenant | テナント | Azure 標準訳 | テナント ID |
| Telegram Bot Token | Telegram Bot トークン | 製品名 (Telegram, Bot) は維持、token のみ訳 | — |
| Channels | チャネル | Bot Framework の channel (Telegram, MS Teams 等) | — |

### Monitoring / Application Insights (Monitoring Tab)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| OpenTelemetry Monitoring | OpenTelemetry モニタリング | 製品名 OpenTelemetry は維持 | — |
| Application Insights | Application Insights | Azure 製品名のため英語維持 | App Insights |
| Log Analytics workspace | Log Analytics ワークスペース | Azure 標準訳 (workspace のみ訳) | — |
| Connection String | 接続文字列 | Azure 標準訳 | — |
| Validate connection string | 接続文字列を検証 | 接続文字列の検証ボタン | — |
| Validating... | 検証中... | 上記のローディング表示 | — |
| Sampling Ratio | サンプリング率 | 100% = 全トレース、5% = 20 件に 1 件 | サンプル率 |
| Live Metrics | ライブメトリクス | Application Insights の機能名 (Azure 標準訳) | — |
| Tracer Provider | トレーサープロバイダー | OTel SDK 用語 | Tracer プロバイダー |
| Open in Grafana | Grafana で開く | エージェントダッシュボード遷移ボタン | — |
| What Gets Collected | 収集される情報 | 説明見出し | 収集対象 |

### Memory / Foundry IQ (Memory Tab)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Memory / Foundry IQ | メモリ / Foundry IQ | タブ見出し (Foundry IQ は固有名詞のため英語維持) | — |
| Search Service | Search サービス | Azure AI Search の Service。Azure 公式表記 | 検索サービス |
| OpenAI Account | OpenAI アカウント | Azure OpenAI Service のアカウントリソース | — |
| Index schedule | インデックススケジュール | (§12 既出) | — |

### Voice / ACS / AOAI Realtime (Voice Tab)

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Voice Call Infrastructure | 音声通話インフラ | Voice タブ configured 状態の見出し | 音声インフラ |
| ACS | ACS | Azure Communication Services 略称 (英語維持) | — |
| Communication Services | Communication Services | Azure 製品名 (英語維持) | — |
| Azure OpenAI | Azure OpenAI | Azure 製品名 (英語維持) | — |
| ACS Resource | ACS リソース | Voice タブ resource grid のラベル | — |
| Realtime Deployment | Realtime デプロイ | gpt-realtime-mini 等の deployment | リアルタイムデプロイ |
| ACS Source Number | ACS 発信元番号 | AI が発信に使う ACS で購入済みの番号 | 発信元番号 |
| Your Phone Number | あなたの電話番号 | AI が発信を許可される唯一の番号 | ターゲット番号 |
| Source Phone | 発信元電話番号 | configured view の resource grid ラベル | — |
| Target Phone | 発信先電話番号 | configured view の resource grid ラベル | — |
| Phone Numbers | 電話番号 | Voice タブの phone number config セクション見出し | — |
| Select a purchased number... | 購入済み番号を選択... | dropdown placeholder | — |
| Manage Phone Numbers in Azure Portal | Azure ポータルで電話番号を管理 | 外部リンク | — |
| Realtime-capable model | realtime 対応モデル | gpt-realtime-mini, gpt-4o-realtime-preview 等 | — |
| Create a new ACS resource automatically | ACS リソースを自動で新規作成 | チェックボックスラベル | — |
| Connecting... | 接続中... | Connect ボタンのローディング表示 | — |
| Deploying... | デプロイ中... | Deploy ボタンのローディング表示 | — |
| Connect Resources | リソースに接続 | Connect Existing form の保存ボタン | — |
| Deploy Voice Infrastructure | 音声インフラをデプロイ | Deploy New form の保存ボタン | — |
| Save Phone Numbers | 電話番号を保存 | configured view の phone number 保存ボタン | — |

### 命名規約・例外

- Azure 製品名 (Application Insights / Log Analytics / Bot Service / Communication Services / OpenAI / Foundry IQ / Cloudflare Tunnel) は英語維持します。日本語化すると検索性と Azure 公式ドキュメントとの整合が損なわれるためです。
- リージョン名 (eastus, swedencentral, japaneast 等) は英語維持します。
- SKU 名 (Standard, Premium 等) は英語維持します。
- 「Active」と「Configured」と「Provisioned」は紛らわしいので明確に使い分けます:
  - **Active**: リソースが作成済み + 接続設定済み + データが実際に流れている (例: OTel エクスポート有効)
  - **Configured**: 設定情報が保存済み (Voice タブで使用)
  - **Provisioned**: Azure 上にリソースが作成済み (データフロー有無を問わない)
- 「破棄」と「削除」は使い分けます:
  - **破棄 (Decommission)**: リソースグループ単位での退役 (Azure リソース自体を削除)
  - **削除 (Delete)**: アプリ内設定や個別エントリの削除


## §14 ToolActivity (PR-2.8)

ツール呼び出しの監査ログビューア (`pages/ToolActivity.tsx`) で用いる用語。

### 状態・分類

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Tool Activity | ツールアクティビティ | ページ名 | — |
| Audit Log | 監査ログ | 副題 | — |
| Activity Log | アクティビティログ | tab 名 | — |
| Live | ライブ | 自動更新 ON 表示 | — |
| Tool Call | ツール呼び出し | エントリの単位 | — |
| Call ID | 呼び出し ID | DetailModal で表示 | — |
| Calls | 呼び出し数 | 統計ラベル | — |
| Total Calls | 総呼び出し数 | RiskDashboard ラベル | — |
| Flagged | フラグ済み | 状態 / 件数 / カウント | — |
| Denied | 拒否 | guardrails 拒否済み | §7 既出 |
| Sessions | セッション | 統計ラベル | §1 既出 |
| Tools Used | 使用ツール数 | SessionsView 列 | — |
| Max Risk | 最大リスク | SessionsView 列 | — |
| Last Activity | 最終アクティビティ | SessionsView 列 | — |

### 状態ラベル (statusLabel)

| 内部値 | 表示値 | 注釈 |
|---|---|---|
| `started` | 開始 | 実行中 (§7) と区別 (こちらは「開始イベントが記録された」状態) |
| `completed` | 完了 | §7 既出 |
| `denied` | 拒否 | guardrails 介入で拒否 |
| `error` | エラー | §7 既出 |

> [!NOTE]
> ToolActivity の「開始 (started)」は「処理開始時点で記録、完了未確認」を指します。Schedules / Memory Agent の「実行中 (Running)」は「現在進行中」を指します。両方の表示テキストは別物として扱います。

### リスク評価

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Risk | リスク | 共通プレフィックス | — |
| Risk Score | リスクスコア | RiskIndicator title | — |
| Risk Assessment | リスク評価 | DetailModal セクション見出し | — |
| Risk Factors | リスク要因 | (本文未表示・assessment 内のリスト見出し) | — |
| High Risk | 高リスク | score >= 70 | — |
| Medium Risk | 中リスク | score >= 30 | — |
| Low Risk | 低リスク | score > 0 | — |
| No Risk Detected | リスク検出なし | score == 0 | — |

### 実行時間・パフォーマンス

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Duration | 実行時間 | 単一エントリの実行時間 | — |
| Avg Duration | 平均実行時間 | 統計ラベル | — |
| P95 Duration | P95 実行時間 | 統計ラベル | — |
| Performance | パフォーマンス | BreakdownView セクション見出し | — |
| Average | 平均 | パフォーマンスカード | — |
| P95 | P95 | パフォーマンスカード (95 パーセンタイル、英語維持) | — |
| Max | 最大 | パフォーマンスカード | — |

### フィルター・グループ化

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Filter | フィルター | §11 既出 | — |
| Search tools... | ツール名で検索... | placeholder | — |
| All Categories | すべてのカテゴリ | dropdown | — |
| All Statuses | すべての状態 | dropdown | — |
| All Times | すべての期間 | dropdown | — |
| Last 1h / 6h / 24h / 7d / 30d | 1 時間 / 6 時間 / 24 時間 / 7 日間 / 30 日間 | dropdown options | — |
| All Models | すべてのモデル | dropdown | — |
| All Interactions | すべての対話タイプ | dropdown | — |
| Allow (auto) | 自動許可 | dropdown / interaction type | — |
| Filter by session ID... | セッション ID で絞り込み... | placeholder | — |
| No Grouping | グループ化なし | dropdown | — |
| Group by Tool / Category / Session / Model / Status | ツール別 / カテゴリ別 / セッション別 / モデル別 / 状態別 | dropdown options | — |
| Flagged only | フラグ済みのみ | checkbox | — |
| Clear Filters | フィルターをクリア | アクションボタン | — |
| N filter(s) active | N 件のフィルター適用中 | tabs バッジ | — |

### 表・分析

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Time | 時刻 | テーブルヘッダ | — |
| Tool | ツール | テーブルヘッダ / MetaRow ラベル | — |
| Category | カテゴリ | テーブルヘッダ / MetaRow ラベル | — |
| Model | モデル | テーブルヘッダ / MetaRow ラベル | — |
| Status | 状態 | テーブルヘッダ / MetaRow ラベル | — |
| ITL | ITL | テーブルヘッダ (略語のまま) | — |
| Session | セッション | テーブルヘッダ / MetaRow ラベル | — |
| Actions | 操作 | テーブルヘッダ | — |
| Tool Call Detail | ツール呼び出しの詳細 | DetailModal タイトル | — |
| Interaction | 対話 | MetaRow ラベル | — |
| Timestamp | タイムスタンプ | MetaRow ラベル | — |
| Arguments | 引数 | DetailModal セクション見出し | — |
| Result | 結果 | DetailModal セクション見出し | — |
| (none) | (なし) | formatJson 空表示 | — |

### グループ化・タイムライン・内訳

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Activity Over Time | 時系列アクティビティ | TimelineView 見出し | — |
| Tool Usage Distribution | ツール使用分布 | BreakdownView 見出し | — |
| No tool usage recorded yet | ツール使用の記録はまだありません | empty hint | — |
| Categories & Models | カテゴリとモデル | サイドパネル見出し | — |
| Interaction Types | 対話タイプ | サイドパネル見出し | — |
| Breakdown | 内訳 | BreakdownCompact 見出し | — |
| Top Tools | 上位ツール | BreakdownCompact セクションラベル | — |
| By Category | カテゴリ別 | BreakdownView セクション見出し | — |
| By Status | 状態別 | BreakdownView セクション見出し | — |
| By Model | モデル別 | BreakdownView セクション見出し | — |
| No model data recorded yet | モデルの記録はまだありません | empty hint | — |
| No timeline data yet | タイムラインデータはまだありません | empty hint | — |
| Total | 合計 | TimelineView tooltip | — |
| flagged | フラグ済み | tooltip / 列ラベル | §13 既出 |
| (empty) / no value | (未指定) | GroupedView の空グループキー | — |
| N call(s) | N 件 | GroupedView カウント | — |
| N flagged | N 件フラグ済み | GroupedView バッジ | — |

### アクション・状態

| 英語 | 訳語 | 注釈 | 代替案 |
|---|---|---|---|
| Export CSV | CSV エクスポート | ページヘッダボタン | — |
| Import from history | 履歴をインポート | ページヘッダボタン | — |
| Importing... | インポート中... | ローディング表示 | — |
| Import from existing sessions | 既存のセッションからインポート | EmptyState ボタン | — |
| Flag Suspicious | 不審としてフラグ | DetailModal / row action | — |
| Remove Flag | フラグを解除 | DetailModal / row action | — |
| Manually flagged | 手動フラグ | デフォルトフラグ理由 | — |
| Reason for flagging... | フラグ理由... | input placeholder | — |
| Flag Reason | フラグ理由 | MetaRow label | — |
| View session activity | セッションアクティビティを表示 | SessionsView アクション | — |
| Previous / Next | 前へ / 次へ | ページネーション | — |
| No tool activity found | ツールアクティビティが見つかりません | EmptyState タイトル | — |
| Tool calls will appear here as the agent executes actions. | エージェントがアクションを実行するとここに表示されます。 | EmptyState 説明 | — |

### 英語維持

| 用語 | 理由 |
|---|---|
| SDK / MCP / Custom / Skill | カテゴリ識別子。dropdown 内部値と表示値の両方を英語維持。Category dropdown / Categories panel / TimelineCompact legend で一貫して英語表示 |
| HITL / AITL / PITL / ITL | 業界用語の略語。「人間によるレビュー」等への直訳は冗長 |
| Prompt Shields | Azure 製品名 (Microsoft Content Safety 機能) |
| PITL (Experimental) → PITL (試験的) | 略語は英語維持、説明部分のみ JP 化 |

### 設計判断

- **内部状態値 vs 表示値の分離**: filter dropdown の `value=""` / `"sdk"` / `"hitl"` 等の **内部値は API consumer 互換のため英語維持**。`<option>` の表示テキストのみ JP 化。同様に status badge も内部キーを維持し、`statusLabel()` で JP 表示へマッピング (PR-2.7 で確立した規約を踏襲)。
- **状態ラベル統一**: `statusLabel()` ヘルパで表示時に JP 化。`badge`, `chip`, `table cell`, `MetaRow`, `DetailModal` のいずれも同一マッピングを使用するため、状態表記の揺れが発生しない。
- **PITL の試験的扱い**: 略語 PITL は「Person In The Loop」の意味。日本語化すると冗長 (「対人ループ介入 (試験的)」など) になるため、`PITL (試験的)` と注釈のみ JP 化。

