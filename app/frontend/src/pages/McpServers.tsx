import { useState, useEffect } from 'react'
import { api } from '../api'
import { showToast } from '../components/Toast'
import Breadcrumb from '../components/Breadcrumb'
import type { McpServer, McpRegistryEntry } from '../types'

export default function McpServers() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [registry, setRegistry] = useState<McpRegistryEntry[]>([])
  const [tab, setTab] = useState<'servers' | 'discover'>('servers')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editServer, setEditServer] = useState<McpServer | null>(null)
  const [regPage, setRegPage] = useState(1)
  const [regQuery, setRegQuery] = useState('')

  // Form state
  const [form, setForm] = useState({
    name: '', type: 'local' as 'local' | 'http' | 'sse',
    description: '', enabled: true,
    command: '', args: '', env: '', url: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await api<{ servers: McpServer[] }>('mcp/servers')
      setServers(r.servers || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  const loadRegistry = async (page = 1, query = '') => {
    try {
      let url = `mcp/registry?page=${page}`
      if (query) url += `&q=${encodeURIComponent(query)}`
      const r = await api<{ servers: McpRegistryEntry[] }>(url)
      setRegistry(r.servers || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'discover') loadRegistry(regPage, regQuery) }, [tab, regPage])

  const toggleServer = async (name: string, enabled: boolean) => {
    try {
      await api(`mcp/servers/${encodeURIComponent(name)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' })
      showToast(`サーバーを${enabled ? '有効化' : '無効化'}しました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const removeServer = async (name: string) => {
    if (!confirm(`MCP サーバー「${name}」を削除しますか？`)) return
    try {
      await api(`mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
      showToast('サーバーを削除しました', 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const openAdd = (prefill?: Partial<typeof form>) => {
    setEditServer(null)
    setForm({ name: '', type: 'local', description: '', enabled: true, command: '', args: '', env: '', url: '', ...prefill })
    setShowModal(true)
  }

  const openEdit = (srv: McpServer) => {
    setEditServer(srv)
    setForm({
      name: srv.name,
      type: srv.type === 'remote' ? 'http' : srv.type,
      description: srv.description || '',
      enabled: srv.enabled,
      command: srv.command || '',
      args: (srv.args || []).join('\n'),
      env: srv.env ? Object.entries(srv.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
      url: srv.url || '',
    })
    setShowModal(true)
  }

  const saveServer = async () => {
    const body: Record<string, unknown> = {
      name: form.name, type: form.type,
      description: form.description, enabled: form.enabled,
    }
    if (form.type === 'local') {
      body.command = form.command
      if (form.args.trim()) body.args = form.args.split('\n').map(l => l.trim()).filter(Boolean)
      if (form.env.trim()) {
        const env: Record<string, string> = {}
        form.env.split('\n').forEach(l => {
          const eq = l.indexOf('=')
          if (eq > 0) env[l.slice(0, eq)] = l.slice(eq + 1)
        })
        body.env = env
      }
    } else {
      body.url = form.url
    }

    try {
      if (editServer) {
        await api(`mcp/servers/${encodeURIComponent(editServer.name)}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('mcp/servers', { method: 'POST', body: JSON.stringify(body) })
      }
      showToast(editServer ? 'サーバーを更新しました' : 'サーバーを追加しました', 'success')
      setShowModal(false)
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const configuredNames = new Set(servers.map(s => s.name))

  return (
    <div className="page">
      <Breadcrumb current="MCP サーバー" parentPath="/customization" parentLabel="カスタマイズ" />
      <div className="page__header">
        <h1>MCP サーバー</h1>
        <div className="page__actions">
          <button className="btn btn--primary btn--sm" onClick={() => openAdd()} data-testid="mcp-add-btn">サーバーを追加</button>
          <button className="btn btn--ghost btn--sm" onClick={load} data-testid="mcp-refresh-btn">更新</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'servers' ? 'tab--active' : ''}`} onClick={() => setTab('servers')} data-testid="mcp-tab-servers">マイサーバー</button>
        <button className={`tab ${tab === 'discover' ? 'tab--active' : ''}`} onClick={() => setTab('discover')} data-testid="mcp-tab-discover">ディスカバー</button>
      </div>

      {tab === 'servers' && (
        <>
          {loading && <div className="spinner" />}
          {!loading && servers.length === 0 && <p className="text-muted" data-testid="mcp-empty-state">設定済みの MCP サーバーはありません</p>}
          <div className="list">
            {servers.map(srv => (
              <div key={srv.name} className={`list-item ${!srv.enabled ? 'list-item--disabled' : ''}`} data-testid={`mcp-server-${srv.name}`}>
                <span className={`status-indicator ${srv.enabled ? 'status-indicator--ok' : 'status-indicator--err'}`} />
                <div className="list-item__body">
                  <div className="list-item__top">
                    <strong>{srv.name}</strong>
                    <span className="badge">{srv.type}</span>
                    {srv.builtin && <span className="badge badge--muted">ビルトイン</span>}
                    {!srv.enabled && <span className="badge badge--err">無効</span>}
                  </div>
                  <div className="list-item__desc text-muted">
                    {srv.description || srv.url || `${srv.command || ''} ${(srv.args || []).join(' ')}`}
                  </div>
                </div>
                <div className="list-item__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleServer(srv.name, !srv.enabled)} data-testid={`mcp-toggle-${srv.name}`}>
                    {srv.enabled ? '無効化' : '有効化'}
                  </button>
                  {!srv.builtin && (
                    <>
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(srv)} data-testid={`mcp-edit-${srv.name}`}>編集</button>
                      <button className="btn btn--danger btn--sm" onClick={() => removeServer(srv.name)} data-testid={`mcp-remove-${srv.name}`}>削除</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'discover' && (
        <>
          <div className="search-bar">
            <input
              className="input"
              placeholder="MCP サーバーを検索..."
              value={regQuery}
              onChange={e => setRegQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setRegPage(1); loadRegistry(1, regQuery) } }}
              data-testid="mcp-discover-search"
            />
            <button className="btn btn--secondary btn--sm" onClick={() => { setRegPage(1); loadRegistry(1, regQuery) }} data-testid="mcp-discover-search-btn">検索</button>
          </div>
          <div className="grid grid--cards">
            {registry.map(srv => {
              const key = (srv.id || srv.full_name || srv.name || '').replace(/\//g, '-').toLowerCase()
              const added = configuredNames.has(key) || configuredNames.has(srv.name)
              return (
                <div key={srv.id || srv.name} className="card mcp-reg-card" data-testid={`mcp-reg-card-${key}`}>
                  <div className="mcp-reg-card__top">
                    {srv.avatar_url && <img src={srv.avatar_url} alt="" className="mcp-reg-card__avatar" />}
                    <div>
                      <strong>{srv.name}</strong>
                      {srv.stars > 0 && <span className="text-muted"> {srv.stars >= 1000 ? `${(srv.stars/1000).toFixed(1)}k` : srv.stars} スター</span>}
                      {srv.full_name && <div className="text-muted text-sm">{srv.full_name}</div>}
                    </div>
                  </div>
                  {srv.description && <p className="text-sm">{srv.description}</p>}
                  {srv.topics && srv.topics.length > 0 && (
                    <div className="tag-list">
                      {srv.topics.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                  <div className="mcp-reg-card__footer">
                    {srv.license && <span className="text-muted text-sm">{srv.license}</span>}
                    <div className="mcp-reg-card__actions">
                      {srv.url && <a href={srv.url} target="_blank" rel="noopener" className="btn btn--ghost btn--sm">開く</a>}
                      {added ? (
                        <span className="badge badge--ok">追加済み</span>
                      ) : (
                        <button className="btn btn--primary btn--sm" data-testid={`mcp-reg-add-${key}`} onClick={() => openAdd({
                          name: key, description: srv.description || '',
                          type: 'local', command: 'npx', args: `-y\n${srv.id || key}`,
                        })}>追加</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="pagination">
            <button className="btn btn--ghost btn--sm" disabled={regPage <= 1} onClick={() => setRegPage(p => p - 1)} data-testid="mcp-pagination-prev">前へ</button>
            <span data-testid="mcp-pagination-label">{regPage} ページ目</span>
            <button className="btn btn--ghost btn--sm" disabled={registry.length < 10} onClick={() => setRegPage(p => p + 1)} data-testid="mcp-pagination-next">次へ</button>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-testid="mcp-modal">
            <div className="modal__header">
              <h2>{editServer ? 'MCP サーバーを編集' : 'MCP サーバーを追加'}</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal__body">
              <div className="form">
                <div className="form__group">
                  <label className="form__label">名前</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!!editServer} data-testid="mcp-form-name" />
                </div>
                <div className="form__group">
                  <label className="form__label">種別</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof form.type }))} data-testid="mcp-form-type">
                    <option value="local">ローカル (stdio)</option>
                    <option value="http">HTTP (ストリーミング)</option>
                    <option value="sse">SSE</option>
                  </select>
                </div>
                <div className="form__group">
                  <label className="form__label">説明</label>
                  <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="mcp-form-description" />
                </div>
                {form.type === 'local' ? (
                  <>
                    <div className="form__group">
                      <label className="form__label">コマンド</label>
                      <input className="input" value={form.command} onChange={e => setForm(f => ({ ...f, command: e.target.value }))} placeholder="npx" data-testid="mcp-form-command" />
                    </div>
                    <div className="form__group">
                      <label className="form__label">引数 (1 行に 1 つ)</label>
                      <textarea className="input" rows={3} value={form.args} onChange={e => setForm(f => ({ ...f, args: e.target.value }))} data-testid="mcp-form-args" />
                    </div>
                    <div className="form__group">
                      <label className="form__label">環境変数 (1 行に KEY=VALUE)</label>
                      <textarea className="input" rows={3} value={form.env} onChange={e => setForm(f => ({ ...f, env: e.target.value }))} data-testid="mcp-form-env" />
                    </div>
                  </>
                ) : (
                  <div className="form__group">
                    <label className="form__label">URL</label>
                    <input className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." data-testid="mcp-form-url" />
                  </div>
                )}
                <label className="form__check">
                  <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} data-testid="mcp-form-enabled" />
                  有効
                </label>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)} data-testid="mcp-modal-cancel">キャンセル</button>
              <button className="btn btn--primary" onClick={saveServer} data-testid="mcp-modal-save">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
