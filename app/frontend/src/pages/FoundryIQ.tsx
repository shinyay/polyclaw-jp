import { useState, useEffect } from 'react'
import { api } from '../api'
import { showToast } from '../components/Toast'
import type { FoundryIQConfig } from '../types'

export function FoundryIQContent() {
  const [config, setConfig] = useState<FoundryIQConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [docCount, setDocCount] = useState<string>('--')
  const [form, setForm] = useState({
    search_endpoint: '', search_api_key: '', index_name: 'polyclaw-memories',
    embedding_endpoint: '', embedding_api_key: '', embedding_model: 'text-embedding-3-large',
    embedding_dimensions: '3072', index_schedule: 'daily', enabled: false,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [indexing, setIndexing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const cfg = await api<FoundryIQConfig>('foundry-iq/config')
      setConfig(cfg)
      setForm({
        search_endpoint: cfg.search_endpoint || '',
        search_api_key: '',
        index_name: cfg.index_name || 'polyclaw-memories',
        embedding_endpoint: cfg.embedding_endpoint || '',
        embedding_api_key: '',
        embedding_model: cfg.embedding_model || 'text-embedding-3-large',
        embedding_dimensions: String(cfg.embedding_dimensions || 3072),
        index_schedule: cfg.index_schedule || 'daily',
        enabled: !!cfg.enabled,
      })
      try {
        const stats = await api<{ status: string; document_count?: number; index_missing?: boolean }>('foundry-iq/stats')
        setDocCount(stats.index_missing ? 'No index' : String(stats.document_count || 0))
      } catch { setDocCount('--') }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const saveConfig = async () => {
    const data: Record<string, unknown> = { ...form, embedding_dimensions: parseInt(form.embedding_dimensions) }
    if (!form.search_api_key) delete data.search_api_key
    if (!form.embedding_api_key) delete data.embedding_api_key
    try {
      await api('foundry-iq/config', { method: 'PUT', body: JSON.stringify(data) })
      await api('foundry-iq/ensure-index', { method: 'POST' })
      showToast('設定を保存し、インデックスを作成/更新しました', 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const runIndexing = async () => {
    setIndexing(true)
    try {
      const r = await api<{ status: string; indexed: number; total_files: number; total_chunks: number }>('foundry-iq/index', { method: 'POST' })
      showToast(`${r.total_files} 件のファイルから ${r.indexed} 件のドキュメントをインデックス化しました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
    setIndexing(false)
  }

  const searchMemories = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const r = await api<{ status: string; results: any[] }>('foundry-iq/search', {
        method: 'POST', body: JSON.stringify({ query: searchQuery, top: 5 }),
      })
      setSearchResults(r.results || [])
    } catch (e: any) { showToast(e.message, 'error') }
    setSearching(false)
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page__header">
        <h1>Foundry IQ</h1>
        <button className="btn btn--ghost btn--sm" onClick={load} data-testid="foundryiq-refresh-btn">更新</button>
      </div>

      <div className="stats-bar">
        <div className="stat"><span className="stat__value">{config?.enabled ? '有効' : '無効'}</span><span className="stat__label">状態</span></div>
        <div className="stat"><span className="stat__value">{docCount === 'No index' ? 'インデックスなし' : docCount}</span><span className="stat__label">ドキュメント数</span></div>
        <div className="stat"><span className="stat__value">{config?.index_schedule === 'daily' ? '毎日' : config?.index_schedule === 'hourly' ? '毎時' : config?.index_schedule === 'manual' ? '手動' : config?.index_schedule || '毎日'}</span><span className="stat__label">スケジュール</span></div>
        <div className="stat"><span className="stat__value">{config?.last_indexed_at ? new Date(config.last_indexed_at).toLocaleDateString('ja-JP') : '未実行'}</span><span className="stat__label">最終インデックス</span></div>
      </div>

      {config?.provisioned && (
        <div className="card">
          <h3>プロビジョニング済みリソース</h3>
          <div className="detail-grid">
            <div><strong>リソースグループ:</strong> {config.resource_group}</div>
            <div><strong>リージョン:</strong> {config.location}</div>
            <div><strong>Search サービス:</strong> {config.search_resource_name}</div>
            <div><strong>OpenAI アカウント:</strong> {config.openai_resource_name}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>設定</h3>
        <div className="form">
          <label className="form__check">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} data-testid="foundryiq-form-enabled" />
            Foundry IQ を有効化
          </label>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label">Search エンドポイント</label>
              <input className="input" value={form.search_endpoint} onChange={e => setForm(f => ({ ...f, search_endpoint: e.target.value }))} data-testid="foundryiq-form-search-endpoint" />
            </div>
            <div className="form__group">
              <label className="form__label">Search API キー</label>
              <input type="password" className="input" value={form.search_api_key} onChange={e => setForm(f => ({ ...f, search_api_key: e.target.value }))} placeholder={config?.search_api_key === '****' ? '(保存済み)' : ''} data-testid="foundryiq-form-search-key" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label">埋め込みエンドポイント</label>
              <input className="input" value={form.embedding_endpoint} onChange={e => setForm(f => ({ ...f, embedding_endpoint: e.target.value }))} data-testid="foundryiq-form-embed-endpoint" />
            </div>
            <div className="form__group">
              <label className="form__label">埋め込み API キー</label>
              <input type="password" className="input" value={form.embedding_api_key} onChange={e => setForm(f => ({ ...f, embedding_api_key: e.target.value }))} placeholder={config?.embedding_api_key === '****' ? '(保存済み)' : ''} data-testid="foundryiq-form-embed-key" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label">インデックス名</label>
              <input className="input" value={form.index_name} onChange={e => setForm(f => ({ ...f, index_name: e.target.value }))} data-testid="foundryiq-form-index-name" />
            </div>
            <div className="form__group">
              <label className="form__label">モデル</label>
              <input className="input" value={form.embedding_model} onChange={e => setForm(f => ({ ...f, embedding_model: e.target.value }))} data-testid="foundryiq-form-model" />
            </div>
            <div className="form__group">
              <label className="form__label">スケジュール</label>
              <select className="input" value={form.index_schedule} onChange={e => setForm(f => ({ ...f, index_schedule: e.target.value }))} data-testid="foundryiq-form-schedule">
                <option value="daily">毎日</option>
                <option value="hourly">毎時</option>
                <option value="manual">手動</option>
              </select>
            </div>
          </div>
          <div className="form__row">
            <button className="btn btn--primary" onClick={saveConfig} data-testid="foundryiq-save-btn">保存してインデックスを作成</button>
            <button className="btn btn--secondary" onClick={runIndexing} disabled={indexing} data-testid="foundryiq-index-btn">{indexing ? 'インデックス化中...' : 'インデックス化を実行'}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>メモリを検索</h3>
        <div className="search-bar">
          <input className="input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="メモリを検索..." onKeyDown={e => { if (e.key === 'Enter') searchMemories() }} data-testid="foundryiq-search-input" />
          <button className="btn btn--primary btn--sm" onClick={searchMemories} disabled={searching} data-testid="foundryiq-search-btn">{searching ? '検索中...' : '検索'}</button>
        </div>
        {searchResults && (
          <div className="mt-2">
            {searchResults.length === 0 && <p className="text-muted" data-testid="foundryiq-search-empty">結果が見つかりませんでした</p>}
            {searchResults.map((doc, i) => (
              <div key={i} className="card card--nested" data-testid={`foundryiq-search-result-${i}`}>
                <div className="card__header">
                  <strong>{doc.title}</strong>
                  <span className="text-muted text-sm">スコア: {(doc.reranker_score || doc.score || 0).toFixed(2)}</span>
                </div>
                <pre className="text-pre text-sm">{doc.content?.slice(0, 400)}{doc.content?.length > 400 ? '...' : ''}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default function FoundryIQ() {
  return <div className="page"><FoundryIQContent /></div>
}
