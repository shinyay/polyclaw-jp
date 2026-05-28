import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'
import { showToast } from '../components/Toast'
import { EnvironmentsContent } from './Environments'
import { WorkspaceContent } from './Workspace'
import { FoundryIQContent } from './FoundryIQ'
import type { SetupStatus } from '../types'

type Tab = 'overview' | 'environments' | 'voice' | 'memory' | 'workspace' | 'monitoring'

interface FoundryStatus {
  deployed: boolean
  foundry_endpoint: string
  foundry_name: string
  foundry_resource_group: string
  deployed_models: string[]
  key_vault_url: string
  key_vault_name: string
  content_safety_endpoint: string
  content_safety_name: string
  search_endpoint: string
  search_name: string
  embedding_aoai_endpoint: string
  embedding_aoai_name: string
  app_insights_name: string
  session_pool_name: string
  acs_name: string
  bot_name: string
  model: string
}

interface DeployConfig {
  deploy_key_vault: boolean
  deploy_acs: boolean
  deploy_content_safety: boolean
  deploy_search: boolean
  deploy_embedding_aoai: boolean
  deploy_monitoring: boolean
  deploy_session_pool: boolean
}

const RESOURCE_DEFS: { key: keyof DeployConfig; label: string; desc: string; tag?: string }[] = [
  { key: 'deploy_key_vault', label: 'Key Vault', desc: 'シークレット管理 (推奨)', tag: 'コア' },
  { key: 'deploy_content_safety', label: 'Content Safety', desc: 'Prompt Shields による注入検知', tag: '推奨' },
  { key: 'deploy_acs', label: 'Communication Services', desc: 'ACS + OpenAI Realtime による音声通話' },
  { key: 'deploy_search', label: 'AI Search', desc: 'Foundry IQ ナレッジ検索' },
  { key: 'deploy_embedding_aoai', label: 'Embedding Model', desc: 'Foundry IQ 用テキスト埋め込み' },
  { key: 'deploy_monitoring', label: 'Monitoring', desc: 'Application Insights + Log Analytics' },
  { key: 'deploy_session_pool', label: 'Session Pool', desc: 'サンドボックスコード実行 (実験的)' },
]

const DEFAULT_CONFIG: DeployConfig = {
  deploy_key_vault: true,
  deploy_acs: false,
  deploy_content_safety: false,
  deploy_search: false,
  deploy_embedding_aoai: false,
  deploy_monitoring: false,
  deploy_session_pool: false,
}

const _STEP_LABELS: Record<string, string> = {
  resource_group: 'リソースグループを作成',
  resolve_principal: 'ID を解決',
  ensure_runtime_sp: 'サービスプリンシパルをプロビジョニング',
  bicep_deploy: 'Azure リソースをデプロイ (Bicep)',
  extract_outputs: 'デプロイ出力を抽出',
  persist_env: '環境変数を保存',
  configure_content_safety: 'Content Safety を構成',
  configure_foundry_iq: 'Foundry IQ を構成',
  create_search_index: '検索インデックスを作成',
  configure_monitoring: 'モニタリングを構成',
  configure_session_pool: 'Session Pool を構成',
  configure_acs: 'Communication Services を構成',
  persist_state: 'デプロイ記録を保存',
  restart_runtime: 'エージェントコンテナを再起動',
}

function prettyStepName(raw: string): string {
  return _STEP_LABELS[raw] || raw.replace(/_/g, ' ')
}

export default function InfrastructureSettings() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [fStatus, setFStatus] = useState<FoundryStatus | null>(null)
  const [config, setConfig] = useState<DeployConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [deploySteps, setDeploySteps] = useState<{ step: string; status: string; detail?: string }[]>([])

  const loadAll = useCallback(async () => {
    try { setStatus(await api<SetupStatus>('setup/status')) } catch { /* ignore */ }
    try { setFStatus(await api<FoundryStatus>('setup/foundry/status')) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Sync toggle state from deployed resources
  useEffect(() => {
    if (!fStatus) return
    setConfig({
      deploy_key_vault: !!fStatus.key_vault_url,
      deploy_acs: !!fStatus.acs_name,
      deploy_content_safety: !!fStatus.content_safety_endpoint,
      deploy_search: !!fStatus.search_endpoint,
      deploy_embedding_aoai: !!fStatus.embedding_aoai_endpoint,
      deploy_monitoring: !!fStatus.app_insights_name,
      deploy_session_pool: !!fStatus.session_pool_name,
    })
  }, [fStatus])

  const handleDeploy = async () => {
    setLoading(p => ({ ...p, deploy: true }))
    setDeploySteps([])
    try {
      const rg = fStatus?.foundry_resource_group || 'polyclaw-rg'
      const configPayload = JSON.stringify({ resource_group: rg, ...config })
      const token = getToken()
      const params = new URLSearchParams()
      if (token) params.set('secret', token)
      params.set('config', configPayload)
      const url = `/api/setup/foundry/deploy/stream?${params.toString()}`

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(url)
        es.onmessage = (e) => {
          try {
            const step = JSON.parse(e.data)
            setDeploySteps(prev => [...prev, step])
          } catch { /* ignore parse errors */ }
        }
        es.addEventListener('done', (e) => {
          es.close()
          try {
            const data = JSON.parse((e as MessageEvent).data)
            if (data.status === 'ok') {
              showToast('インフラのデプロイに成功しました', 'success')
            } else {
              showToast(data.error || 'デプロイに失敗しました', 'error')
            }
          } catch { /* ignore */ }
          resolve()
        })
        es.onerror = () => {
          es.close()
          reject(new Error('デプロイストリームが切断されました'))
        }
      })
      await loadAll()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, deploy: false }))
  }

  const handleDecommission = async () => {
    if (!confirm('すべてのインフラを破棄しますか？ リソースグループと全 Azure リソースが削除されます。')) return
    setLoading(p => ({ ...p, decommission: true }))
    try {
      await api('setup/foundry/decommission', { method: 'POST' })
      showToast('破棄処理を開始しました', 'success')
      await loadAll()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, decommission: false }))
  }

  const restartContainer = async () => {
    if (!confirm('エージェントコンテナを再起動しますか？')) return
    setLoading(p => ({ ...p, restart: true }))
    try {
      const res = await api<{ message: string }>('setup/container/restart', { method: 'POST' })
      showToast(res.message || 'エージェントコンテナを再起動しました', 'success')
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, restart: false }))
  }

  const toggleConfig = (key: keyof DeployConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1>インフラ</h1>
        <div className="page__actions">
          <button className="btn btn--outline btn--sm" onClick={restartContainer} disabled={loading.restart} data-testid="infra-restart-btn">
            {loading.restart ? '再起動中...' : 'エージェントを再起動'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {([
          ['overview', '概要'],
          ['environments', '環境'],
          ['voice', '音声'],
          ['memory', 'メモリ / Foundry IQ'],
          ['workspace', 'ワークスペース'],
          ['monitoring', 'モニタリング'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={`tab ${tab === t ? 'tab--active' : ''}`} onClick={() => setTab(t)} data-testid={`infra-tab-${t}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Deployed Resources */}
          {fStatus?.deployed && (
            <div className="card">
              <h3>デプロイ済みリソース</h3>
              <p className="text-muted">リソースグループ: <strong>{fStatus.foundry_resource_group}</strong></p>
              <div className="infra__resource-grid">
                <ResourceCard
                  name="Foundry AI Services"
                  resource={fStatus.foundry_name}
                  detail={fStatus.foundry_endpoint}
                  extra={fStatus.deployed_models.length > 0 ? `モデル: ${fStatus.deployed_models.join(', ')}` : undefined}
                />
                {fStatus.key_vault_name && (
                  <ResourceCard name="Key Vault" resource={fStatus.key_vault_name} detail={fStatus.key_vault_url} />
                )}
                {fStatus.content_safety_name && (
                  <ResourceCard name="Content Safety" resource={fStatus.content_safety_name} detail={fStatus.content_safety_endpoint} />
                )}
                {fStatus.search_name && (
                  <ResourceCard name="AI Search" resource={fStatus.search_name} detail={fStatus.search_endpoint} />
                )}
                {fStatus.embedding_aoai_name && (
                  <ResourceCard name="Embedding Model" resource={fStatus.embedding_aoai_name} detail={fStatus.embedding_aoai_endpoint} />
                )}
                {fStatus.app_insights_name && (
                  <ResourceCard name="Application Insights" resource={fStatus.app_insights_name} />
                )}
                {fStatus.session_pool_name && (
                  <ResourceCard name="Session Pool" resource={fStatus.session_pool_name} />
                )}
                {fStatus.acs_name && (
                  <ResourceCard name="Communication Services" resource={fStatus.acs_name} />
                )}
                {fStatus.bot_name && (
                  <ResourceCard name="Bot Service" resource={fStatus.bot_name} />
                )}
              </div>
              {fStatus.model && (
                <p className="text-muted mt-1">アクティブモデル: <strong>{fStatus.model}</strong></p>
              )}
            </div>
          )}

          {/* Runtime Status */}
          <div className="card">
            <h3>ランタイム状態</h3>
            <div className="detail-grid">
              <div><strong>Azure:</strong> {status?.azure?.logged_in ? (status.azure.subscription || 'サインイン済み') : '未サインイン'}</div>
              <div><strong>Foundry:</strong> {fStatus?.deployed ? 'デプロイ済み' : '未デプロイ'}</div>
              <div><strong>トンネル:</strong> {status?.tunnel?.active ? <><span className="badge badge--ok badge--sm">稼働中</span> <code>{status.tunnel.url}</code></> : <span className="badge badge--muted badge--sm">停止中</span>}</div>
              <div><strong>Bot:</strong> {status?.bot_configured ? <span className="badge badge--ok badge--sm">構成済み</span> : <span className="badge badge--muted badge--sm">未構成</span>}</div>
            </div>
          </div>

          {/* Resource Configuration */}
          {status?.azure?.logged_in && (
            <div className="card">
              <h3>{fStatus?.deployed ? 'リソースを更新' : 'リソースをデプロイ'}</h3>
              <p className="text-muted">{fStatus?.deployed ? 'デプロイに追加する' : 'デプロイする'} Azure リソースを選択してください。Foundry AI Services は常に含まれます。</p>
              <div className="infra__toggle-grid">
                {RESOURCE_DEFS.map(r => (
                  <label key={r.key} className="infra__toggle-row">
                    <input
                      type="checkbox"
                      checked={config[r.key]}
                      onChange={() => toggleConfig(r.key)}
                      data-testid={`infra-toggle-${r.key}`}
                    />
                    <div className="infra__toggle-info">
                      <span className="infra__toggle-name">
                        {r.label}
                        {r.tag && <span className="badge badge--accent badge--sm ml-1">{r.tag}</span>}
                      </span>
                      <span className="infra__toggle-desc">{r.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="form__actions mt-2">
                <button className="btn btn--primary" onClick={handleDeploy} disabled={loading.deploy} data-testid="infra-deploy-btn">
                  {loading.deploy ? 'デプロイ中...' : fStatus?.deployed ? 'デプロイを更新' : 'インフラをデプロイ'}
                </button>
                {fStatus?.deployed && (
                  <button className="btn btn--danger" onClick={handleDecommission} disabled={loading.decommission} data-testid="infra-decommission-btn">
                    {loading.decommission ? '破棄中...' : 'すべて破棄'}
                  </button>
                )}
              </div>
              {deploySteps.length > 0 && (
                <div className="infra__steps mt-2">
                  {deploySteps.map((s, i) => (
                    <div key={i} className={`infra__step infra__step--${s.status}`}>
                      <span className="infra__step-icon">{s.status === 'ok' ? '\u2713' : s.status === 'failed' ? '\u2717' : '\u2022'}</span>
                      <span>{prettyStepName(s.step)}</span>
                      {s.detail && <span className="text-muted ml-1">{s.detail}</span>}
                    </div>
                  ))}
                  {loading.deploy && (
                    <div className="infra__step infra__step--pending">
                      <span className="infra__step-icon spinner--inline" />
                      <span className="text-muted">処理中...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!status?.azure?.logged_in && (
            <div className="card">
              <h3>Azure へのサインインが必要です</h3>
              <p className="text-muted">インフラをデプロイ・管理するには Azure にサインインしてください。</p>
              <button className="btn btn--primary btn--sm" onClick={() => navigate('/setup')}>セットアップウィザードを開く</button>
            </div>
          )}

          {/* Channels + Bot Configuration */}
          {fStatus?.deployed && (
            <ChannelsCard status={status} onReload={loadAll} />
          )}
        </>
      )}

      {tab === 'environments' && <EnvironmentsContent />}
      {tab === 'voice' && <VoiceTab status={status} onReload={loadAll} />}
      {tab === 'memory' && <MemoryTab azureLoggedIn={!!status?.azure?.logged_in} />}
      {tab === 'workspace' && <WorkspaceContent />}
      {tab === 'monitoring' && <MonitoringTab />}
    </div>
  )
}

function ResourceCard({ name, resource, detail, extra }: { name: string; resource: string; detail?: string; extra?: string }) {
  return (
    <div className="infra__resource-card">
      <div className="infra__resource-name">{name}</div>
      <div className="infra__resource-id">{resource}</div>
      {detail && <div className="infra__resource-detail"><code>{detail}</code></div>}
      {extra && <div className="infra__resource-extra text-muted">{extra}</div>}
    </div>
  )
}

function ChannelsCard({ status, onReload }: { status: SetupStatus | null; onReload: () => void }) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [showTgForm, setShowTgForm] = useState(false)

  const handleSaveTelegram = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(p => ({ ...p, telegram: true }))
    const fd = new FormData(e.currentTarget)
    const token = (fd.get('telegram_token') as string || '').trim()
    const whitelist = (fd.get('telegram_whitelist') as string || '').trim()
    try {
      await api('setup/channels/telegram/config', {
        method: 'POST',
        body: JSON.stringify({ token, whitelist }),
      })
      showToast('Telegram の構成を保存しました', 'success')
      setShowTgForm(false)
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, telegram: false }))
  }

  const handleDeployBot = async () => {
    setLoading(p => ({ ...p, bot: true }))
    try {
      await api('setup/infra/deploy', { method: 'POST' })
      showToast('Bot のデプロイに成功しました', 'success')
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, bot: false }))
  }

  const channels = [
    {
      id: 'web',
      name: 'Web チャット',
      icon: '\uD83C\uDF10',
      desc: 'ブラウザに組み込まれたチャットインターフェース',
      status: 'always' as const,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: '\u2708\uFE0F',
      desc: 'Telegram bot 経由のチャット',
      status: status?.telegram_configured ? 'connected' as const : 'available' as const,
    },
    {
      id: 'voice',
      name: '音声通話',
      icon: '\uD83D\uDCDE',
      desc: 'ACS + OpenAI Realtime による電話通話',
      status: status?.voice_call_configured ? 'connected' as const : 'available' as const,
    },
  ]

  return (
    <div className="card">
      <h3>チャネル</h3>
      <p className="text-muted">利用可能な通信チャネル。Web チャットは常に動作し、その他は追加のセットアップが必要です。</p>

      <div className="channels__grid">
        {channels.map(ch => (
          <div key={ch.id} className={`channels__item channels__item--${ch.status}`}>
            <div className="channels__icon">{ch.icon}</div>
            <div className="channels__info">
              <div className="channels__name">
                {ch.name}
                {ch.status === 'always' && <span className="badge badge--ok badge--sm ml-1">稼働中</span>}
                {ch.status === 'connected' && <span className="badge badge--ok badge--sm ml-1">接続済み</span>}
              </div>
              <div className="channels__desc text-muted">{ch.desc}</div>
            </div>
            {ch.id === 'telegram' && ch.status !== 'connected' && (
              <button className="btn btn--secondary btn--sm" onClick={() => setShowTgForm(!showTgForm)} data-testid="channels-telegram-configure-btn">構成</button>
            )}
          </div>
        ))}
      </div>

      {showTgForm && (
        <div className="channels__config-panel mt-2">
          <h4>Telegram 構成</h4>
          <form onSubmit={handleSaveTelegram}>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label">Bot トークン</label>
                <input name="telegram_token" type="password" className="input" placeholder="@BotFather で取得" data-testid="channels-telegram-token" />
              </div>
              <div className="form__group">
                <label className="form__label">許可するユーザー ID</label>
                <input name="telegram_whitelist" className="input" placeholder="カンマ区切り (空欄で全許可)" data-testid="channels-telegram-whitelist" />
              </div>
            </div>
            <div className="form__actions">
              <button type="submit" className="btn btn--primary btn--sm" disabled={loading.telegram} data-testid="channels-telegram-save-btn">
                {loading.telegram ? '保存中...' : '保存'}
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setShowTgForm(false)}>キャンセル</button>
            </div>
          </form>
        </div>
      )}

      {/* Bot Service */}
      <div className="channels__bot-bar mt-2">
        <div className="channels__bot-info">
          <strong>Bot Service</strong>
          <span className="text-muted ml-1">-- Telegram と Teams 用の Cloudflare トンネル</span>
        </div>
        <div className="channels__bot-actions">
          {status?.bot_deployed ? (
            <span className="badge badge--ok">デプロイ済み</span>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={handleDeployBot} disabled={loading.bot} data-testid="channels-bot-deploy-btn">
              {loading.bot ? 'デプロイ中...' : 'Bot Service をデプロイ'}
            </button>
          )}
          {status?.tunnel?.active && status.tunnel.url && (
            <>
              <span className="badge badge--ok badge--sm">トンネル稼働中</span>
              <code style={{ fontSize: 12 }}>{status.tunnel.url}</code>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


function StatusBadge({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`badge ${ok ? 'badge--ok' : 'badge--err'}`} title={label}>
      {label}
    </span>
  )
}

interface MonitoringConfig {
  enabled: boolean
  sampling_ratio: number
  enable_live_metrics: boolean
  connection_string_set: boolean
  connection_string_masked: string
  provisioned: boolean
  otel_active?: boolean
  otel_status?: { active?: boolean; tracer_provider?: string }
  app_insights_name?: string
  portal_url?: string
  workspace_name?: string
  resource_group?: string
  location?: string
  grafana_dashboard_url?: string
}

interface FoundryIQConfig {
  configured: boolean
  provisioned?: boolean
  search_endpoint?: string
  search_resource_name?: string
  embedding_name?: string
  embedding_endpoint?: string
  openai_resource_name?: string
  resource_group?: string
  location?: string
}

// ---------------------------------------------------------------------------
// Monitoring Tab -- OpenTelemetry / Application Insights configuration
// ---------------------------------------------------------------------------

type MonitoringMode = 'deploy' | 'connect'

/** Map Azure region prefixes to country flag emoji. */
const AZURE_REGION_FLAGS: Record<string, string> = {
  eastus: '\u{1F1FA}\u{1F1F8}',
  eastus2: '\u{1F1FA}\u{1F1F8}',
  westus: '\u{1F1FA}\u{1F1F8}',
  westus2: '\u{1F1FA}\u{1F1F8}',
  westus3: '\u{1F1FA}\u{1F1F8}',
  centralus: '\u{1F1FA}\u{1F1F8}',
  northcentralus: '\u{1F1FA}\u{1F1F8}',
  southcentralus: '\u{1F1FA}\u{1F1F8}',
  westcentralus: '\u{1F1FA}\u{1F1F8}',
  canadacentral: '\u{1F1E8}\u{1F1E6}',
  canadaeast: '\u{1F1E8}\u{1F1E6}',
  brazilsouth: '\u{1F1E7}\u{1F1F7}',
  northeurope: '\u{1F1EE}\u{1F1EA}',
  westeurope: '\u{1F1F3}\u{1F1F1}',
  uksouth: '\u{1F1EC}\u{1F1E7}',
  ukwest: '\u{1F1EC}\u{1F1E7}',
  francecentral: '\u{1F1EB}\u{1F1F7}',
  francesouth: '\u{1F1EB}\u{1F1F7}',
  germanywestcentral: '\u{1F1E9}\u{1F1EA}',
  switzerlandnorth: '\u{1F1E8}\u{1F1ED}',
  switzerlandwest: '\u{1F1E8}\u{1F1ED}',
  norwayeast: '\u{1F1F3}\u{1F1F4}',
  norwaywest: '\u{1F1F3}\u{1F1F4}',
  swedencentral: '\u{1F1F8}\u{1F1EA}',
  polandcentral: '\u{1F1F5}\u{1F1F1}',
  italynorth: '\u{1F1EE}\u{1F1F9}',
  spaincentral: '\u{1F1EA}\u{1F1F8}',
  eastasia: '\u{1F1ED}\u{1F1F0}',
  southeastasia: '\u{1F1F8}\u{1F1EC}',
  japaneast: '\u{1F1EF}\u{1F1F5}',
  japanwest: '\u{1F1EF}\u{1F1F5}',
  koreacentral: '\u{1F1F0}\u{1F1F7}',
  koreasouth: '\u{1F1F0}\u{1F1F7}',
  australiaeast: '\u{1F1E6}\u{1F1FA}',
  australiasoutheast: '\u{1F1E6}\u{1F1FA}',
  australiacentral: '\u{1F1E6}\u{1F1FA}',
  centralindia: '\u{1F1EE}\u{1F1F3}',
  southindia: '\u{1F1EE}\u{1F1F3}',
  westindia: '\u{1F1EE}\u{1F1F3}',
  southafricanorth: '\u{1F1FF}\u{1F1E6}',
  southafricawest: '\u{1F1FF}\u{1F1E6}',
  uaenorth: '\u{1F1E6}\u{1F1EA}',
  uaecentral: '\u{1F1E6}\u{1F1EA}',
  qatarcentral: '\u{1F1F6}\u{1F1E6}',
  israelcentral: '\u{1F1EE}\u{1F1F1}',
  mexicocentral: '\u{1F1F2}\u{1F1FD}',
  newzealandnorth: '\u{1F1F3}\u{1F1FF}',
}

/** Friendly display names for Azure regions. */
const AZURE_REGION_LABELS: Record<string, string> = {
  eastus: 'East US',
  eastus2: 'East US 2',
  westus: 'West US',
  westus2: 'West US 2',
  westus3: 'West US 3',
  centralus: 'Central US',
  northcentralus: 'North Central US',
  southcentralus: 'South Central US',
  westcentralus: 'West Central US',
  canadacentral: 'Canada Central',
  canadaeast: 'Canada East',
  brazilsouth: 'Brazil South',
  northeurope: 'North Europe',
  westeurope: 'West Europe',
  uksouth: 'UK South',
  ukwest: 'UK West',
  francecentral: 'France Central',
  francesouth: 'France South',
  germanywestcentral: 'Germany West Central',
  switzerlandnorth: 'Switzerland North',
  switzerlandwest: 'Switzerland West',
  norwayeast: 'Norway East',
  norwaywest: 'Norway West',
  swedencentral: 'Sweden Central',
  polandcentral: 'Poland Central',
  italynorth: 'Italy North',
  spaincentral: 'Spain Central',
  eastasia: 'East Asia',
  southeastasia: 'Southeast Asia',
  japaneast: 'Japan East',
  japanwest: 'Japan West',
  koreacentral: 'Korea Central',
  koreasouth: 'Korea South',
  australiaeast: 'Australia East',
  australiasoutheast: 'Australia Southeast',
  australiacentral: 'Australia Central',
  centralindia: 'Central India',
  southindia: 'South India',
  westindia: 'West India',
  southafricanorth: 'South Africa North',
  southafricawest: 'South Africa West',
  uaenorth: 'UAE North',
  uaecentral: 'UAE Central',
  qatarcentral: 'Qatar Central',
  israelcentral: 'Israel Central',
  mexicocentral: 'Mexico Central',
  newzealandnorth: 'New Zealand North',
}

function getRegionFlag(location: string): string {
  const key = location.toLowerCase().replace(/[\s-_]/g, '')
  return AZURE_REGION_FLAGS[key] || '\u{1F30D}'
}

function getRegionLabel(location: string): string {
  const key = location.toLowerCase().replace(/[\s-_]/g, '')
  return AZURE_REGION_LABELS[key] || location
}

interface ProvisionStepResult {
  step: string
  status: string
  detail: string
}

function PipelineFlow({ active }: { active: boolean }) {
  const nodeClass = active ? 'mon__pipeline-node mon__pipeline-node--active' : 'mon__pipeline-node'
  const arrow = (
    <span className="mon__pipeline-arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </span>
  )
  return (
    <div className="mon__pipeline">
      <span className={nodeClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
        エージェントランタイム
      </span>
      {arrow}
      <span className={nodeClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="M9 9h6v6"/></svg>
        OTel Distro
      </span>
      {arrow}
      <span className={nodeClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/></svg>
        App Insights
      </span>
      {arrow}
      <span className={nodeClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Log Analytics
      </span>
    </div>
  )
}

function TelemetryFeatureCards() {
  return (
    <div className="mon__features">
      <div className="mon__feature-card">
        <div className="mon__feature-icon mon__feature-icon--traces">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div className="mon__feature-text">
          <h5>トレース</h5>
          <p>HTTP リクエスト、外部呼び出し、Azure SDK 操作</p>
        </div>
      </div>
      <div className="mon__feature-card">
        <div className="mon__feature-icon mon__feature-icon--metrics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        </div>
        <div className="mon__feature-text">
          <h5>メトリクス</h5>
          <p>リクエスト所要時間、件数、エラー率、パフォーマンスカウンター</p>
        </div>
      </div>
      <div className="mon__feature-card">
        <div className="mon__feature-icon mon__feature-icon--logs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
        </div>
        <div className="mon__feature-text">
          <h5>ログ</h5>
          <p>Python logging (WARNING 以上)、スタックトレース付き例外</p>
        </div>
      </div>
      <div className="mon__feature-card">
        <div className="mon__feature-icon mon__feature-icon--deps">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/></svg>
        </div>
        <div className="mon__feature-text">
          <h5>依存関係</h5>
          <p>Azure サービス、外部 API、データベースを自動でトラッキング</p>
        </div>
      </div>
      <div className="mon__feature-card">
        <div className="mon__feature-icon mon__feature-icon--live">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div className="mon__feature-text">
          <h5>ライブメトリクス</h5>
          <p>リアルタイムのリクエスト率、失敗率、パフォーマンスデータ</p>
        </div>
      </div>
    </div>
  )
}

function DeployArchPreview() {
  const arrow = (
    <span className="mon__arch-connector">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </span>
  )
  return (
    <div className="mon__arch-preview">
      <div className="mon__arch-step">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>リソースグループ</span>
      </div>
      {arrow}
      <div className="mon__arch-step">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        <span>Log Analytics ワークスペース</span>
      </div>
      {arrow}
      <div className="mon__arch-step">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <span>Application Insights</span>
      </div>
      {arrow}
      <div className="mon__arch-step">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="M9 9h6v6"/></svg>
        <span>OTel 自動計装</span>
      </div>
    </div>
  )
}

function ProvisionSteps({ steps }: { steps: ProvisionStepResult[] }) {
  if (!steps.length) return null
  const labels: Record<string, string> = {
    cli_extension: 'CLI 拡張機能をインストール',
    resource_group: 'リソースグループ',
    create_workspace: 'Log Analytics ワークスペース',
    create_app_insights: 'Application Insights',
    save_config: '構成を保存',
    otel_bootstrap: 'OTel エクスポートを有効化',
  }
  return (
    <div className="mon__steps">
      {steps.map((s, i) => (
        <div key={i} className="mon__step">
          <span className={`mon__step-icon mon__step-icon--${s.status === 'ok' ? 'ok' : 'fail'}`}>
            {s.status === 'ok' ? '\u2713' : '\u2717'}
          </span>
          <span className="mon__step-label">{labels[s.step] || s.step}</span>
          <span className="mon__step-detail">{s.detail}</span>
        </div>
      ))}
    </div>
  )
}

function MonitoringTab() {
  const [config, setConfig] = useState<MonitoringConfig | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<MonitoringMode>('deploy')

  // Connect-existing state
  const [connectionString, setConnectionString] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [samplingRatio, setSamplingRatio] = useState(1.0)
  const [enableLiveMetrics, setEnableLiveMetrics] = useState(false)
  const [testResult, setTestResult] = useState<{ status: string; message: string; instrumentation_key?: string; ingestion_endpoint?: string } | null>(null)

  // Deploy-new state
  const [deployLocation, setDeployLocation] = useState('eastus')
  const [deployRg, setDeployRg] = useState('polyclaw-monitoring-rg')
  const [provisionSteps, setProvisionSteps] = useState<ProvisionStepResult[]>([])

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api<MonitoringConfig>('monitoring/config')
      setConfig(cfg)
      setEnabled(cfg.enabled)
      setSamplingRatio(cfg.sampling_ratio)
      setEnableLiveMetrics(cfg.enable_live_metrics)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSave = async () => {
    setLoading(p => ({ ...p, save: true }))
    try {
      const body: Record<string, unknown> = {
        enabled,
        sampling_ratio: samplingRatio,
        enable_live_metrics: enableLiveMetrics,
      }
      if (connectionString) {
        body.connection_string = connectionString
      }
      const res = await api<{ status: string; message: string }>('monitoring/config', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      showToast(res.message, res.status === 'ok' ? 'success' : 'error')
      setConnectionString('')
      await loadConfig()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
    setLoading(p => ({ ...p, save: false }))
  }

  const handleTest = async () => {
    const cs = connectionString || ''
    if (!cs) {
      showToast('検証する接続文字列を入力してください', 'error')
      return
    }
    setLoading(p => ({ ...p, test: true }))
    setTestResult(null)
    try {
      const res = await api<{ status: string; message: string; instrumentation_key?: string; ingestion_endpoint?: string }>('monitoring/test', {
        method: 'POST',
        body: JSON.stringify({ connection_string: cs }),
      })
      setTestResult(res)
    } catch (e: unknown) {
      setTestResult({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
    setLoading(p => ({ ...p, test: false }))
  }

  const handleProvision = async () => {
    setLoading(p => ({ ...p, deploy: true }))
    setProvisionSteps([])
    try {
      const res = await api<{ status: string; message: string; steps?: ProvisionStepResult[] }>('monitoring/provision', {
        method: 'POST',
        body: JSON.stringify({ location: deployLocation, resource_group: deployRg }),
      })
      if (res.steps) setProvisionSteps(res.steps)
      showToast(res.message, res.status === 'ok' ? 'success' : 'error')
      await loadConfig()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
    setLoading(p => ({ ...p, deploy: false }))
  }

  const handleDecommission = async () => {
    if (!confirm('Application Insights を破棄しますか？ App Insights リソースと Log Analytics ワークスペースが削除され、テレメトリのエクスポートが停止します。')) return
    setLoading(p => ({ ...p, decommission: true }))
    try {
      const res = await api<{ status: string; message: string }>('monitoring/provision', {
        method: 'DELETE',
      })
      showToast(res.message, res.status === 'ok' ? 'success' : 'error')
      await loadConfig()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
    setLoading(p => ({ ...p, decommission: false }))
  }

  if (!config) return <div className="spinner" />

  const otelActive = config.otel_status?.active

  // -- Already provisioned or configured view --
  if (config.provisioned || config.connection_string_set) {
    return (
      <div className="voice">
        {/* Status card */}
        <div className="voice__status-card">
          <div className="voice__status-header">
            <h3>OpenTelemetry モニタリング</h3>
            <span className={`badge ${otelActive ? 'badge--ok' : config.enabled ? 'badge--warn' : 'badge--muted'}`}>
              {otelActive ? 'アクティブ' : config.enabled ? '有効化済み (エクスポートなし)' : '無効'}
            </span>
            {config.provisioned && <span className="badge badge--ok">プロビジョニング済み</span>}
          </div>

          <PipelineFlow active={!!otelActive} />

          <div className="mon__info-grid" style={{ marginTop: 14 }}>
            {/* Status */}
            <div className="mon__info-card">
              <div className="mon__info-icon">
                <span className={`status-dot__indicator ${otelActive ? 'status-dot__indicator--ok' : 'status-dot__indicator--err'}`} style={{ width: 10, height: 10 }} />
              </div>
              <div className="mon__info-body">
                <label>状態</label>
                <span>{otelActive ? 'テレメトリをエクスポート中' : 'エクスポートなし'}</span>
              </div>
            </div>

            {/* App Insights */}
            {config.app_insights_name && (
              <div className="mon__info-card">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>App Insights</label>
                  {config.portal_url ? (
                    <a href={config.portal_url} target="_blank" rel="noopener noreferrer" className="mon__info-link">
                      {config.app_insights_name}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  ) : (
                    <span>{config.app_insights_name}</span>
                  )}
                </div>
              </div>
            )}

            {/* Log Analytics */}
            {config.workspace_name && (
              <div className="mon__info-card">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>Log Analytics ワークスペース</label>
                  <span>{config.workspace_name}</span>
                </div>
              </div>
            )}

            {/* Resource Group */}
            {config.resource_group && (
              <div className="mon__info-card">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>リソースグループ</label>
                  <span>{config.resource_group}</span>
                </div>
              </div>
            )}

            {/* Location with flag */}
            {config.location && (
              <div className="mon__info-card">
                <div className="mon__info-icon mon__info-icon--flag">
                  {getRegionFlag(config.location)}
                </div>
                <div className="mon__info-body">
                  <label>リージョン</label>
                  <span>{getRegionLabel(config.location)}</span>
                </div>
              </div>
            )}

            {/* Connection String -- masked */}
            {config.connection_string_set && (
              <div className="mon__info-card mon__info-card--wide">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>接続文字列</label>
                  <span className="mon__secret-value">{config.connection_string_masked}</span>
                </div>
              </div>
            )}

            {/* Tracer Provider */}
            {otelActive && config.otel_status?.tracer_provider && (
              <div className="mon__info-card">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>トレーサープロバイダー</label>
                  <span>{config.otel_status.tracer_provider}</span>
                </div>
              </div>
            )}

            {/* Grafana Agent Dashboard */}
            {config.grafana_dashboard_url && (
              <div className="mon__info-card mon__info-card--wide mon__info-card--action">
                <div className="mon__info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                </div>
                <div className="mon__info-body">
                  <label>エージェントダッシュボード</label>
                  <span>パフォーマンス、トークン、コスト、エラー、トレースの集約</span>
                </div>
                <a
                  href={config.grafana_dashboard_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary btn--sm"
                >
                  Grafana で開く
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Configuration panel */}
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>構成</h4>
              <p className="text-muted">モニタリング設定を調整します。変更は即座に反映されます。</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <div className="form">
              <label className="form__check">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} data-testid="monitoring-enabled-toggle" />
                OpenTelemetry モニタリングを有効化
              </label>

              {!config.provisioned && (
                <div className="form__group">
                  <label className="form__label">Application Insights 接続文字列</label>
                  <input
                    className="input"
                    value={connectionString}
                    onChange={e => setConnectionString(e.target.value)}
                    placeholder={config.connection_string_set ? '(構成済み -- 新しい値を入力すると置換)' : 'InstrumentationKey=...;IngestionEndpoint=...'}
                    type="password"
                    data-testid="monitoring-connection-string"
                  />
                  <span className="form__hint">
                    Azure ポータルの Application Insights リソース &gt; 概要 &gt; 接続文字列から取得できます。
                  </span>
                </div>
              )}

              {connectionString && (
                <div style={{ marginBottom: 12 }}>
                  <button className="btn btn--outline btn--sm" onClick={handleTest} disabled={loading.test} data-testid="monitoring-validate-btn">
                    {loading.test ? '検証中...' : '接続文字列を検証'}
                  </button>
                  {testResult && (
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${testResult.status === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                        {testResult.message}
                      </span>
                      {testResult.instrumentation_key && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          キー: {testResult.instrumentation_key} | エンドポイント: {testResult.ingestion_endpoint}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="form__group">
                <label className="form__label">サンプリング率</label>
                <div className="mon__sampling-value">
                  {(samplingRatio * 100).toFixed(0)}<small>% のトレースをエクスポート</small>
                </div>
                <div className="mon__sampling-bar">
                  <div className="mon__sampling-fill" style={{ width: `${samplingRatio * 100}%` }} />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={samplingRatio}
                  onChange={e => setSamplingRatio(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: 4 }}
                  data-testid="monitoring-sampling-ratio"
                />
                <span className="form__hint">
                  100% = 全トレース、5% = 20 件に 1 件。低い値はコストとノイズを抑えます。メトリクスとログは影響を受けません。
                </span>
              </div>

              <label className="form__check">
                <input type="checkbox" checked={enableLiveMetrics} onChange={e => setEnableLiveMetrics(e.target.checked)} data-testid="monitoring-live-metrics-toggle" />
                ライブメトリクスを有効化 (Azure ポータルのリアルタイムダッシュボード)
              </label>

              <div className="form__actions">
                <button className="btn btn--primary" onClick={handleSave} disabled={loading.save} data-testid="monitoring-save-btn">
                  {loading.save ? '保存中...' : '構成を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* What gets collected */}
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>収集される情報</h4>
              <p className="text-muted">Azure Monitor OpenTelemetry Distro が以下のシグナルを自動計装します。</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <TelemetryFeatureCards />
          </div>
        </div>

        {/* Decommission (only for provisioned resources) */}
        {config.provisioned && (
          <div className="voice__danger-strip">
            <p>Application Insights と Log Analytics リソースを削除し、テレメトリのエクスポートを停止します。</p>
            <button className="btn btn--danger btn--sm" onClick={handleDecommission} disabled={loading.decommission} data-testid="monitoring-decommission-btn">
              {loading.decommission ? '破棄中...' : '破棄'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // -- Not provisioned: setup view with deploy/connect mode --
  return (
    <div className="voice">
      {/* Mode selector bar */}
      <div className="voice__mode-bar">
        <button
          className={`voice__mode-btn${mode === 'deploy' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => setMode('deploy')}
          data-testid="monitoring-mode-deploy"
        >
          <div className="voice__mode-icon voice__mode-icon--new">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
          </div>
          <div>
            <h4>新規デプロイ</h4>
            <p>Application Insights と Log Analytics ワークスペースをプロビジョニング</p>
          </div>
        </button>
        <button
          className={`voice__mode-btn${mode === 'connect' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => setMode('connect')}
          data-testid="monitoring-mode-connect"
        >
          <div className="voice__mode-icon voice__mode-icon--link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div>
            <h4>既存に接続</h4>
            <p>既存の Application Insights リソースの接続文字列を入力</p>
          </div>
        </button>
      </div>

      {/* Deploy new */}
      {mode === 'deploy' && (
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>Application Insights を新規デプロイ</h4>
              <p className="text-muted">モニタリングスタック全体を 1 ステップでプロビジョニングします。ランタイムは自動的に計装され、テレメトリのエクスポートを開始します。</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <DeployArchPreview />
            <div className="form">
              <div className="form__row">
                <div className="form__group">
                  <label className="form__label">リソースグループ</label>
                  <input className="input" value={deployRg} onChange={e => setDeployRg(e.target.value)} data-testid="monitoring-deploy-rg" />
                </div>
                <div className="form__group">
                  <label className="form__label">リージョン</label>
                  <input className="input" value={deployLocation} onChange={e => setDeployLocation(e.target.value)} data-testid="monitoring-deploy-location" />
                  <span className="form__hint">Azure リージョン (例: eastus, westeurope, swedencentral)。</span>
                </div>
              </div>
              <div className="form__actions">
                <button className="btn btn--primary" onClick={handleProvision} disabled={loading.deploy} data-testid="monitoring-provision-btn">
                  {loading.deploy ? 'プロビジョニング中...' : 'Application Insights をデプロイ'}
                </button>
              </div>
              <ProvisionSteps steps={provisionSteps} />
            </div>
          </div>
        </div>
      )}

      {/* Connect existing */}
      {mode === 'connect' && (
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>既存の Application Insights に接続</h4>
              <p className="text-muted">Azure ポータルにある既存の Application Insights リソースの接続文字列を入力してください。</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <div className="form">
              <label className="form__check">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} data-testid="monitoring-connect-enabled-toggle" />
                OpenTelemetry モニタリングを有効化
              </label>

              <div className="form__group">
                <label className="form__label">Application Insights 接続文字列</label>
                <input
                  className="input"
                  value={connectionString}
                  onChange={e => setConnectionString(e.target.value)}
                  placeholder="InstrumentationKey=...;IngestionEndpoint=..."
                  type="password"
                  data-testid="monitoring-connect-connection-string"
                />
                <span className="form__hint">
                  Azure ポータルの Application Insights リソース &gt; 概要 &gt; 接続文字列から取得できます。
                </span>
              </div>

              {connectionString && (
                <div style={{ marginBottom: 12 }}>
                  <button className="btn btn--outline btn--sm" onClick={handleTest} disabled={loading.test} data-testid="monitoring-connect-validate-btn">
                    {loading.test ? '検証中...' : '接続文字列を検証'}
                  </button>
                  {testResult && (
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${testResult.status === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                        {testResult.message}
                      </span>
                      {testResult.instrumentation_key && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          キー: {testResult.instrumentation_key} | エンドポイント: {testResult.ingestion_endpoint}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="form__group">
                <label className="form__label">サンプリング率</label>
                <div className="mon__sampling-value">
                  {(samplingRatio * 100).toFixed(0)}<small>% のトレースをエクスポート</small>
                </div>
                <div className="mon__sampling-bar">
                  <div className="mon__sampling-fill" style={{ width: `${samplingRatio * 100}%` }} />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={samplingRatio}
                  onChange={e => setSamplingRatio(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: 4 }}
                  data-testid="monitoring-connect-sampling-ratio"
                />
                <span className="form__hint">
                  100% = 全トレース、5% = 20 件に 1 件。低い値はコストとノイズを抑えます。メトリクスとログは影響を受けません。
                </span>
              </div>

              <label className="form__check">
                <input type="checkbox" checked={enableLiveMetrics} onChange={e => setEnableLiveMetrics(e.target.checked)} data-testid="monitoring-connect-live-metrics-toggle" />
                ライブメトリクスを有効化 (Azure ポータルのリアルタイムダッシュボード)
              </label>

              <div className="form__actions">
                <button className="btn btn--primary" onClick={handleSave} disabled={loading.save} data-testid="monitoring-connect-save-btn">
                  {loading.save ? '保存中...' : '構成を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry overview (always visible) */}
      <div className="voice__panel">
        <div className="voice__panel-header">
          <div>
            <h4>収集される情報</h4>
            <p className="text-muted">Azure Monitor OpenTelemetry Distro が以下のシグナルを自動計装します。</p>
          </div>
        </div>
        <div className="voice__panel-body">
          <TelemetryFeatureCards />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Memory / Foundry IQ Tab -- deploy new or connect existing resources
// ---------------------------------------------------------------------------

type MemoryMode = 'deploy' | 'connect'

function MemoryTab({ azureLoggedIn }: { azureLoggedIn: boolean }) {
  const [config, setConfig] = useState<FoundryIQConfig | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<MemoryMode>('deploy')
  const [deployLocation, setDeployLocation] = useState('eastus')
  const [deployRg, setDeployRg] = useState('polyclaw-foundryiq-rg')

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api<FoundryIQConfig>('foundry-iq/config')
      setConfig(cfg)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleProvision = async () => {
    setLoading(p => ({ ...p, deploy: true }))
    try {
      await api('foundry-iq/provision', {
        method: 'POST',
        body: JSON.stringify({ location: deployLocation, resource_group: deployRg }),
      })
      showToast('Foundry IQ resources provisioned', 'success')
      await loadConfig()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, deploy: false }))
  }

  const handleDecommission = async () => {
    if (!confirm('Decommission Foundry IQ? This will remove search and OpenAI resources.')) return
    setLoading(p => ({ ...p, decommission: true }))
    try {
      await api('foundry-iq/provision', { method: 'DELETE' })
      showToast('Foundry IQ resources removed', 'success')
      setConfig(null)
      await loadConfig()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, decommission: false }))
  }

  if (!config) return <div className="spinner" />

  // -- Already provisioned or configured --
  if (config.provisioned) {
    return (
      <div className="voice">
        <div className="voice__status-card">
          <div className="voice__status-header">
            <h3>Memory / Foundry IQ</h3>
            <span className="badge badge--ok">Provisioned</span>
          </div>
          <div className="voice__resource-grid">
            {config.search_resource_name && (
              <div className="voice__resource-item">
                <label>Search Service</label>
                <span>{config.search_resource_name}</span>
              </div>
            )}
            {config.openai_resource_name && (
              <div className="voice__resource-item">
                <label>OpenAI Account</label>
                <span>{config.openai_resource_name}</span>
              </div>
            )}
            {config.resource_group && (
              <div className="voice__resource-item">
                <label>Resource Group</label>
                <span>{config.resource_group}</span>
              </div>
            )}
            {config.location && (
              <div className="voice__resource-item">
                <label>Location</label>
                <span>{config.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Inline the full configuration + search UI */}
        <FoundryIQContent />

        {/* Decommission */}
        <div className="voice__danger-strip">
          <p>Remove all Foundry IQ Azure resources and clear configuration.</p>
          <button className="btn btn--danger btn--sm" onClick={handleDecommission} disabled={loading.decommission}>
            {loading.decommission ? 'Decommissioning...' : 'Decommission'}
          </button>
        </div>
      </div>
    )
  }

  // -- Not provisioned: setup view --
  return (
    <div className="voice">
      {/* Mode selector bar */}
      <div className="voice__mode-bar">
        <button
          className={`voice__mode-btn${mode === 'deploy' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => setMode('deploy')}
        >
          <div className="voice__mode-icon voice__mode-icon--new">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
          </div>
          <div>
            <h4>Deploy New</h4>
            <p>Provision Azure AI Search + OpenAI for memory indexing</p>
          </div>
        </button>
        <button
          className={`voice__mode-btn${mode === 'connect' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => setMode('connect')}
        >
          <div className="voice__mode-icon voice__mode-icon--link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div>
            <h4>Connect Existing</h4>
            <p>Provide endpoints for existing search and embedding resources</p>
          </div>
        </button>
      </div>

      {/* Deploy new */}
      {mode === 'deploy' && (
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>Deploy New Foundry IQ Resources</h4>
              <p className="text-muted">Creates a resource group with Azure AI Search (Basic) and Azure OpenAI with a text-embedding-3-large deployment.</p>
            </div>
          </div>
          <div className="voice__panel-body">
            {!azureLoggedIn ? (
              <p className="text-muted">Sign in to Azure first (Overview tab) to provision resources.</p>
            ) : (
              <div className="form">
                <div className="form__row">
                  <div className="form__group">
                    <label className="form__label">Resource Group</label>
                    <input className="input" value={deployRg} onChange={e => setDeployRg(e.target.value)} />
                  </div>
                  <div className="form__group">
                    <label className="form__label">Location</label>
                    <input className="input" value={deployLocation} onChange={e => setDeployLocation(e.target.value)} />
                    <span className="form__hint">Must support Azure OpenAI embeddings (e.g. eastus, swedencentral).</span>
                  </div>
                </div>
                <div className="form__actions">
                  <button className="btn btn--primary" onClick={handleProvision} disabled={loading.deploy}>
                    {loading.deploy ? 'Provisioning...' : 'Deploy Foundry IQ'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect existing */}
      {mode === 'connect' && <FoundryIQContent />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Voice Tab -- deploy new or connect to existing ACS + AOAI resources
// ---------------------------------------------------------------------------

interface AzureResource { name: string; resource_group: string; location: string }
interface AoaiDeployment { deployment_name: string; model_name: string; model_version: string; is_realtime?: boolean }
interface VoiceConfig {
  acs_resource_name?: string
  acs_connection_string?: string
  acs_source_number?: string
  voice_target_number?: string
  azure_openai_resource_name?: string
  azure_openai_endpoint?: string
  azure_openai_realtime_deployment?: string
  voice_resource_group?: string
  resource_group?: string
  location?: string
  portal_phone_url?: string
}

type VoiceMode = 'deploy' | 'connect'

function VoiceTab({ status, onReload }: { status: SetupStatus | null; onReload: () => void }) {
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<VoiceMode>('connect')

  // Connect-existing state
  const [aoaiList, setAoaiList] = useState<AzureResource[]>([])
  const [acsList, setAcsList] = useState<AzureResource[]>([])
  const [aoaiDeployments, setAoaiDeployments] = useState<AoaiDeployment[]>([])
  const [selectedAoai, setSelectedAoai] = useState<AzureResource | null>(null)
  const [selectedAoaiDep, setSelectedAoaiDep] = useState('')
  const [selectedAcs, setSelectedAcs] = useState<AzureResource | null>(null)
  const [skipAcs, setSkipAcs] = useState(false)
  const [acsPhones, setAcsPhones] = useState<string[]>([])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [connectTargetPhone, setConnectTargetPhone] = useState('')

  // Deploy-new state
  const [deployLocation, setDeployLocation] = useState('swedencentral')
  const [deployRg, setDeployRg] = useState('polyclaw-voice-rg')

  // Phone config state
  const [sourcePhone, setSourcePhone] = useState('')
  const [targetPhone, setTargetPhone] = useState('')
  const [configuredPhones, setConfiguredPhones] = useState<string[]>([])

  const loadConfig = useCallback(async () => {
    try {
      const vc = await api<VoiceConfig>('setup/voice/config')
      setVoiceConfig(vc)
      if (vc.acs_source_number) setSourcePhone(vc.acs_source_number)
      if (vc.voice_target_number) setTargetPhone(vc.voice_target_number)
      // Load purchased phones for the configured ACS resource
      if (vc.acs_resource_name) {
        const rg = vc.voice_resource_group || vc.resource_group || ''
        if (rg) {
          try {
            const phones = await api<{ phone_number: string }[]>(
              `setup/voice/acs/phones?name=${encodeURIComponent(vc.acs_resource_name)}&resource_group=${encodeURIComponent(rg)}`
            )
            setConfiguredPhones(phones.map(p => p.phone_number))
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const discoverResources = async () => {
    setLoading(p => ({ ...p, discover: true }))
    try {
      const [aoai, acs] = await Promise.all([
        api<AzureResource[]>('setup/voice/aoai/list'),
        api<AzureResource[]>('setup/voice/acs/list'),
      ])
      setAoaiList(aoai)
      setAcsList(acs)
      if (aoai.length > 0 && !selectedAoai) {
        setSelectedAoai(aoai[0])
        loadDeployments(aoai[0])
      }
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, discover: false }))
  }

  const loadDeployments = async (resource: AzureResource) => {
    setAoaiDeployments([])
    setSelectedAoaiDep('')
    try {
      const deps = await api<AoaiDeployment[]>(
        `setup/voice/aoai/deployments?name=${encodeURIComponent(resource.name)}&resource_group=${encodeURIComponent(resource.resource_group)}`
      )
      setAoaiDeployments(deps)
      const realtime = deps.find(d => {
        const n = d.model_name || ''
        return n.includes('realtime')
      })
      if (realtime) setSelectedAoaiDep(realtime.deployment_name)
      else if (deps.length > 0) setSelectedAoaiDep(deps[0].deployment_name)
    } catch { /* ignore */ }
  }

  const handleSelectAoai = (idx: number) => {
    const resource = aoaiList[idx]
    setSelectedAoai(resource)
    loadDeployments(resource)
  }

  const loadAcsPhones = async (resource: AzureResource) => {
    setAcsPhones([])
    try {
      const phones = await api<{ phone_number: string }[]>(
        `setup/voice/acs/phones?name=${encodeURIComponent(resource.name)}&resource_group=${encodeURIComponent(resource.resource_group)}`
      )
      setAcsPhones(phones.map(p => p.phone_number))
      if (phones.length > 0 && !phoneNumber) setPhoneNumber(phones[0].phone_number)
    } catch { /* ignore */ }
  }

  const handleSelectAcs = (idx: number) => {
    const resource = acsList[idx]
    setSelectedAcs(resource)
    if (resource) loadAcsPhones(resource)
    else { setAcsPhones([]); setPhoneNumber('') }
  }

  const handleConnectExisting = async () => {
    if (!selectedAoai) { showToast('Select an Azure OpenAI resource', 'error'); return }
    if (!selectedAoaiDep) { showToast('Select a deployment', 'error'); return }
    setLoading(p => ({ ...p, connect: true }))
    try {
      const body: Record<string, string> = {
        aoai_name: selectedAoai.name,
        aoai_resource_group: selectedAoai.resource_group,
        aoai_deployment: selectedAoaiDep,
      }
      if (!skipAcs && selectedAcs) {
        body.acs_name = selectedAcs.name
        body.acs_resource_group = selectedAcs.resource_group
      }
      if (phoneNumber) body.phone_number = phoneNumber
      if (connectTargetPhone) body.target_number = connectTargetPhone
      await api('setup/voice/connect', { method: 'POST', body: JSON.stringify(body) })
      showToast('Connected to existing resources', 'success')
      await loadConfig()
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, connect: false }))
  }

  const handleDeployNew = async () => {
    setLoading(p => ({ ...p, deploy: true }))
    try {
      await api('setup/voice/deploy', {
        method: 'POST',
        body: JSON.stringify({ location: deployLocation, voice_resource_group: deployRg }),
      })
      showToast('Voice infrastructure deployed', 'success')
      await loadConfig()
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, deploy: false }))
  }

  const handleSavePhone = async () => {
    setLoading(p => ({ ...p, phone: true }))
    try {
      const body: Record<string, string> = {}
      if (sourcePhone) body.phone_number = sourcePhone
      if (targetPhone) body.target_number = targetPhone
      await api('setup/voice/phone', { method: 'POST', body: JSON.stringify(body) })
      showToast('Phone number(s) saved', 'success')
      await loadConfig()
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, phone: false }))
  }

  const handleDecommission = async () => {
    if (!confirm('Decommission voice infrastructure? This will remove ACS and AOAI resources.')) return
    setLoading(p => ({ ...p, decommission: true }))
    try {
      await api('setup/voice/decommission', { method: 'POST' })
      showToast('Voice infrastructure decommissioned', 'success')
      setVoiceConfig(null)
      onReload()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, decommission: false }))
  }

  const configured = !!voiceConfig?.acs_resource_name || status?.voice_call_configured

  // -- Already configured view --
  if (configured && voiceConfig) {
    return (
      <div className="voice">
        <div className="voice__status-card">
          <div className="voice__status-header">
            <h3>Voice Call Infrastructure</h3>
            <span className="badge badge--ok">Configured</span>
          </div>

          <div className="voice__resource-grid">
            {voiceConfig.acs_resource_name && (
              <div className="voice__resource-item">
                <label>ACS Resource</label>
                <span>{voiceConfig.acs_resource_name}</span>
              </div>
            )}
            {voiceConfig.azure_openai_resource_name && (
              <div className="voice__resource-item">
                <label>Azure OpenAI</label>
                <span>{voiceConfig.azure_openai_resource_name}</span>
              </div>
            )}
            {voiceConfig.azure_openai_realtime_deployment && (
              <div className="voice__resource-item">
                <label>Deployment</label>
                <span>{voiceConfig.azure_openai_realtime_deployment}</span>
              </div>
            )}
            {(voiceConfig.voice_resource_group || voiceConfig.resource_group) && (
              <div className="voice__resource-item">
                <label>Resource Group</label>
                <span>{voiceConfig.voice_resource_group || voiceConfig.resource_group}</span>
              </div>
            )}
            {voiceConfig.location && (
              <div className="voice__resource-item">
                <label>Location</label>
                <span>{voiceConfig.location}</span>
              </div>
            )}
            {voiceConfig.acs_source_number && (
              <div className="voice__resource-item">
                <label>Source Phone</label>
                <span>{voiceConfig.acs_source_number}</span>
              </div>
            )}
            {voiceConfig.voice_target_number && (
              <div className="voice__resource-item">
                <label>Target Phone</label>
                <span>{voiceConfig.voice_target_number}</span>
              </div>
            )}
          </div>

          {voiceConfig.portal_phone_url && (
            <a href={voiceConfig.portal_phone_url} target="_blank" rel="noopener" className="btn btn--outline btn--sm">
              Manage Phone Numbers in Azure Portal
            </a>
          )}
        </div>

        {/* Phone number config */}
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>Phone Numbers</h4>
              <p className="text-muted">ACS source number and your phone number (the only number the AI is allowed to call).</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <div className="form">
              <div className="form__row">
                <div className="form__group">
                  <label className="form__label">ACS Source Number</label>
                  {configuredPhones.length > 0 ? (
                    <select className="input" value={sourcePhone} onChange={e => setSourcePhone(e.target.value)}>
                      <option value="">Select a purchased number...</option>
                      {configuredPhones.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input" value={sourcePhone} onChange={e => setSourcePhone(e.target.value)} placeholder="+14155551234" />
                  )}
                  <span className="form__hint">The phone number purchased in ACS that the AI calls from.</span>
                </div>
                <div className="form__group">
                  <label className="form__label">Your Phone Number</label>
                  <input className="input" value={targetPhone} onChange={e => setTargetPhone(e.target.value)} placeholder="+41781234567" />
                  <span className="form__hint">Your personal number. The AI is only allowed to call this number.</span>
                </div>
              </div>
              <div className="form__actions">
                <button className="btn btn--primary btn--sm" onClick={handleSavePhone} disabled={loading.phone || (!sourcePhone && !targetPhone)}>
                  {loading.phone ? 'Saving...' : 'Save Phone Numbers'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Decommission */}
        <div className="voice__danger-strip">
          <p>Remove voice infrastructure and clear all configuration.</p>
          <button className="btn btn--danger btn--sm" onClick={handleDecommission} disabled={loading.decommission}>
            {loading.decommission ? 'Decommissioning...' : 'Decommission'}
          </button>
        </div>
      </div>
    )
  }

  // -- Not configured: setup view --
  return (
    <div className="voice">
      {/* Mode selector bar */}
      <div className="voice__mode-bar">
        <button
          className={`voice__mode-btn${mode === 'connect' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => { setMode('connect'); discoverResources() }}
        >
          <div className="voice__mode-icon voice__mode-icon--link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div>
            <h4>Connect Existing</h4>
            <p>Link to resources already in your subscription</p>
          </div>
        </button>
        <button
          className={`voice__mode-btn${mode === 'deploy' ? ' voice__mode-btn--active' : ''}`}
          onClick={() => setMode('deploy')}
        >
          <div className="voice__mode-icon voice__mode-icon--new">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
          </div>
          <div>
            <h4>Deploy New</h4>
            <p>Provision new ACS + Azure OpenAI resources</p>
          </div>
        </button>
      </div>

      {/* Connect existing form */}
      {mode === 'connect' && (
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>Connect to Existing Resources</h4>
              <p className="text-muted">Select Azure OpenAI and optionally ACS resources from your subscription.</p>
            </div>
            <button className="btn btn--outline btn--sm" onClick={discoverResources} disabled={loading.discover}>
              {loading.discover ? 'Scanning...' : 'Refresh'}
            </button>
          </div>
          <div className="voice__panel-body">
            <div className="form">
              <div className="voice__section-label">Azure OpenAI</div>

              <div className="form__group">
                <label className="form__label">Resource</label>
                {aoaiList.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    {loading.discover ? 'Scanning subscription...' : 'No Azure OpenAI resources found. Click Refresh or use Deploy New.'}
                  </p>
                ) : (
                  <select
                    className="input"
                    value={selectedAoai ? aoaiList.indexOf(selectedAoai) : ''}
                    onChange={e => handleSelectAoai(Number(e.target.value))}
                  >
                    {aoaiList.map((r, i) => (
                      <option key={r.name} value={i}>{r.name} ({r.resource_group} / {r.location})</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedAoai && (
                <div className="form__group">
                  <label className="form__label">Realtime Deployment</label>
                  {aoaiDeployments.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: 13 }}>No deployments found. Deploy a realtime model (e.g. gpt-realtime-mini) first.</p>
                  ) : (
                    <select
                      className="input"
                      value={selectedAoaiDep}
                      onChange={e => setSelectedAoaiDep(e.target.value)}
                    >
                      {aoaiDeployments.map(d => (
                        <option key={d.deployment_name} value={d.deployment_name}>
                          {d.deployment_name} ({d.model_name} {d.model_version})
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="form__hint">Requires a realtime-capable model (gpt-realtime-mini, gpt-4o-realtime-preview).</span>
                </div>
              )}

              <div className="voice__section-label">Communication Services</div>

              <div className="form__group">
                <label className="form__check">
                  <input type="checkbox" checked={skipAcs} onChange={e => { setSkipAcs(e.target.checked); if (e.target.checked) setSelectedAcs(null) }} />
                  Create a new ACS resource automatically
                </label>
                {!skipAcs && (
                  acsList.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: 13 }}>No ACS resources found. Enable the checkbox above to create one.</p>
                  ) : (
                    <select
                      className="input"
                      value={selectedAcs ? acsList.indexOf(selectedAcs) : ''}
                      onChange={e => handleSelectAcs(Number(e.target.value))}
                    >
                      <option value="">Select an ACS resource...</option>
                      {acsList.map((r, i) => (
                        <option key={r.name} value={i}>{r.name} ({r.resource_group})</option>
                      ))}
                    </select>
                  )
                )}
              </div>

              <div className="voice__section-label">Phone Numbers</div>

              <div className="form__group">
                <label className="form__label">ACS Source Number</label>
                {acsPhones.length > 0 ? (
                  <select className="input" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}>
                    <option value="">Select a purchased number...</option>
                    {acsPhones.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+14155551234" />
                )}
                <span className="form__hint">{selectedAcs && acsPhones.length === 0 ? 'No purchased numbers found on this ACS resource. You can add one later.' : 'The number the AI calls from. Can be configured later.'}</span>
              </div>

              <div className="form__group">
                <label className="form__label">Your Phone Number</label>
                <input className="input" value={connectTargetPhone} onChange={e => setConnectTargetPhone(e.target.value)} placeholder="+41781234567" />
                <span className="form__hint">Your personal number. The AI is only allowed to call this number.</span>
              </div>

              <div className="form__actions">
                <button
                  className="btn btn--primary"
                  onClick={handleConnectExisting}
                  disabled={loading.connect || !selectedAoai || !selectedAoaiDep}
                >
                  {loading.connect ? 'Connecting...' : 'Connect Resources'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deploy new form */}
      {mode === 'deploy' && (
        <div className="voice__panel">
          <div className="voice__panel-header">
            <div>
              <h4>Deploy New Voice Infrastructure</h4>
              <p className="text-muted">Creates a resource group with ACS and Azure OpenAI (gpt-realtime-mini).</p>
            </div>
          </div>
          <div className="voice__panel-body">
            <div className="form">
              <div className="form__row">
                <div className="form__group">
                  <label className="form__label">Resource Group</label>
                  <input className="input" value={deployRg} onChange={e => setDeployRg(e.target.value)} />
                </div>
                <div className="form__group">
                  <label className="form__label">Location</label>
                  <input className="input" value={deployLocation} onChange={e => setDeployLocation(e.target.value)} />
                  <span className="form__hint">Must support Azure OpenAI realtime models (e.g. swedencentral, eastus2).</span>
                </div>
              </div>
              <div className="form__actions">
                <button className="btn btn--primary" onClick={handleDeployNew} disabled={loading.deploy}>
                  {loading.deploy ? 'Deploying...' : 'Deploy Voice Infrastructure'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

