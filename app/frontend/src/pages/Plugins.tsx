import { useState, useEffect } from 'react'
import { api, apiFormData } from '../api'
import { showToast } from '../components/Toast'
import Breadcrumb from '../components/Breadcrumb'
import type { Plugin } from '../types'

export default function Plugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api<{ plugins: Plugin[] }>('plugins')
      setPlugins(r.plugins || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePlugin = async (p: Plugin) => {
    const action = p.enabled ? 'disable' : 'enable'
    try {
      await api(`plugins/${p.id}/${action}`, { method: 'POST' })
      const verb = p.enabled ? '無効化' : '有効化'
      showToast(`プラグイン ${p.name} を${verb}しました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const removePlugin = async (p: Plugin) => {
    if (!confirm(`プラグイン「${p.name}」を削除しますか？`)) return
    try {
      await api(`plugins/${p.id}`, { method: 'DELETE' })
      showToast('プラグインを削除しました', 'success')
      setSelectedPlugin(null)
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const importPlugin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await apiFormData<{ status: string; plugin: { name: string } }>('plugins/import', fd)
      showToast(`プラグイン「${r.plugin.name}」をインポートしました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
    e.target.value = ''
  }


  return (
    <div className="page">
      <Breadcrumb current="プラグイン" parentPath="/customization" parentLabel="カスタマイズ" />
      <div className="page__header">
        <h1>プラグイン</h1>
        <div className="page__actions">
          <label className="btn btn--secondary btn--sm" data-testid="plugins-import-btn">
            ZIP をインポート
            <input type="file" accept=".zip" hidden onChange={importPlugin} data-testid="plugins-import-input" />
          </label>
          <button className="btn btn--ghost btn--sm" onClick={load} data-testid="plugins-refresh-btn">更新</button>
        </div>
      </div>

      {loading && <div className="spinner" />}

      <div className="grid grid--cards">
        {plugins.map(p => (
          <div key={p.id} className={`plugin-card card ${p.enabled ? 'plugin-card--enabled' : ''}`} data-testid={`plugin-card-${p.id}`}>
            <div className="plugin-card__header">
              <div>
                <h3>{p.name}</h3>
                <span className="text-muted">v{p.version}</span>
              </div>
            </div>
            <p className="plugin-card__desc">{p.description}</p>
            <div className="plugin-card__meta">
              <span>{p.skill_count} 個のスキル</span>
              <span>{p.source}</span>
              {p.author && <span>作者: {p.author}</span>}
            </div>
            {p.enabled && p.setup_skill && !p.setup_completed && (
              <div className="plugin-card__setup-badge">セットアップが必要</div>
            )}
            <div className="plugin-card__actions">
              <button
                className={`btn btn--sm ${p.enabled ? 'btn--secondary' : 'btn--primary'}`}
                onClick={() => togglePlugin(p)}
                data-testid={`plugin-toggle-${p.id}`}
              >
                {p.enabled ? '無効化' : '有効化'}
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelectedPlugin(p)} data-testid={`plugin-details-${p.id}`}>詳細</button>
            </div>
          </div>
        ))}
        {!loading && plugins.length === 0 && <p className="text-muted" data-testid="plugins-empty-state">プラグインは見つかりません</p>}
      </div>

      {/* Detail Modal */}
      {selectedPlugin && (
        <div className="modal-overlay" onClick={() => setSelectedPlugin(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} data-testid="plugin-detail-modal">
            <div className="modal__header">
              <h2>{selectedPlugin.name}</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelectedPlugin(null)}>&times;</button>
            </div>
            <div className="modal__body">
              <p>{selectedPlugin.description}</p>
              <div className="detail-grid">
                <div><strong>バージョン:</strong> {selectedPlugin.version}</div>
                <div><strong>ソース:</strong> {selectedPlugin.source}</div>
                <div><strong>スキル数:</strong> {selectedPlugin.skill_count}</div>
                {selectedPlugin.author && <div><strong>作者:</strong> {selectedPlugin.author}</div>}
                {selectedPlugin.homepage && <div><strong>ホームページ:</strong> <a href={selectedPlugin.homepage} target="_blank" rel="noopener">{selectedPlugin.homepage}</a></div>}
              </div>
              {selectedPlugin.skills && selectedPlugin.skills.length > 0 && (
                <div>
                  <h4>同梱スキル</h4>
                  <ul>{selectedPlugin.skills.map(s => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className={`btn ${selectedPlugin.enabled ? 'btn--danger' : 'btn--primary'}`} onClick={() => { togglePlugin(selectedPlugin); setSelectedPlugin(null) }} data-testid="plugin-modal-toggle">
                {selectedPlugin.enabled ? '無効化' : '有効化'}
              </button>
              {selectedPlugin.source === 'user' && (
                <button className="btn btn--danger" onClick={() => { removePlugin(selectedPlugin); }} data-testid="plugin-modal-remove">削除</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
