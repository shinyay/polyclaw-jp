import { useState, useEffect } from 'react'
import { api } from '../api'
import { showToast } from '../components/Toast'
import type { Deployment } from '../types'

export function EnvironmentsContent() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Deployment | null>(null)
  const [auditResults, setAuditResults] = useState<any>(null)
  const [auditing, setAuditing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api<Deployment[]>('environments')
      setDeployments(Array.isArray(r) ? r : (r as any).deployments || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadDetail = async (id: string) => {
    setSelectedId(id)
    try {
      const d = await api<Deployment>(`environments/${id}`)
      setDetail(d)
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const destroyDeployment = async () => {
    if (!selectedId || !confirm(`デプロイメント ${selectedId} を破棄しますか？関連する Azure リソースグループはすべて削除されます。`)) return
    try {
      await api(`environments/${selectedId}`, { method: 'DELETE' })
      showToast('デプロイメントを破棄しました', 'success')
      setSelectedId(null)
      setDetail(null)
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const runAudit = async () => {
    setAuditing(true)
    try {
      const r = await api<any>('environments/audit', { method: 'POST' })
      setAuditResults(r)
    } catch (e: any) { showToast(e.message, 'error') }
    setAuditing(false)
  }

  return (
    <>
      <div className="page__header">
        <h1>環境</h1>
        <div className="page__actions">
          <button className="btn btn--secondary btn--sm" onClick={runAudit} disabled={auditing} data-testid="environments-audit-btn">
            {auditing ? '監査中...' : '監査を実行'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={load} data-testid="environments-refresh-btn">更新</button>
        </div>
      </div>

      {loading && <div className="spinner" />}

      {!loading && deployments.length === 0 && (
        <p className="text-muted" data-testid="environments-empty-state">登録済みのデプロイメントはありません。インフラをプロビジョニングすると自動的に追跡されます。</p>
      )}

      {deployments.filter(d => d.resource_count > 0).length > 0 && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>デプロイ ID</th>
                <th>タグ</th>
                <th>種別</th>
                <th>状態</th>
                <th>リソース数</th>
                <th>更新日時</th>
              </tr>
            </thead>
            <tbody>
              {deployments.filter(d => d.resource_count > 0).map(d => (
                <tr key={d.deploy_id} className={selectedId === d.deploy_id ? 'table__row--selected' : ''} onClick={() => loadDetail(d.deploy_id)} style={{ cursor: 'pointer' }} data-testid={`environment-row-${d.deploy_id}`}>
                  <td><code>{d.deploy_id}</code></td>
                  <td><code>{d.tag}</code></td>
                  <td>{d.kind}</td>
                  <td><span className={`badge ${d.status === 'active' ? 'badge--ok' : d.status === 'destroyed' ? 'badge--err' : 'badge--muted'}`}>{d.status === 'active' ? '稼働中' : d.status === 'destroyed' ? '破棄済み' : d.status}</span></td>
                  <td>{d.resource_count}</td>
                  <td>{d.updated_at?.slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && selectedId && (
        <div className="card mt-2">
          <div className="card__header">
            <h3>デプロイメント {selectedId}</h3>
            <button className="btn btn--danger btn--sm" onClick={destroyDeployment} data-testid="environments-destroy-btn">破棄</button>
          </div>
          <div className="detail-grid">
            <div><strong>タグ:</strong> <code>{detail.tag}</code></div>
            <div><strong>種別:</strong> {detail.kind}</div>
            <div><strong>状態:</strong> {detail.status}</div>
            <div><strong>作成日時:</strong> {detail.created_at?.slice(0, 19)}</div>
            <div><strong>リソースグループ:</strong> {(detail.resource_groups || []).join(', ') || '-'}</div>
          </div>
          {detail.resources && detail.resources.length > 0 && (
            <>
              <h4 className="mt-2">リソース</h4>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>種別</th><th>名前</th><th>リソースグループ</th><th>用途</th></tr></thead>
                  <tbody>
                    {detail.resources.map((r, i) => (
                      <tr key={i}>
                        <td>{r.resource_type}</td>
                        <td><code>{r.resource_name}</code></td>
                        <td>{r.resource_group}</td>
                        <td>{r.purpose || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {auditResults && (
        <div className="card mt-2" data-testid="environments-audit-results">
          <h3>監査結果</h3>
          <div className="detail-grid">
            <div><strong>追跡中のリソース:</strong> {auditResults.tracked_resources?.length || 0}</div>
            <div><strong>孤立したリソース:</strong> {auditResults.orphaned_resources?.length || 0}</div>
            <div><strong>孤立したリソースグループ:</strong> {auditResults.orphaned_groups?.length || 0}</div>
          </div>
          {(!auditResults.orphaned_groups?.length && !auditResults.orphaned_resources?.length) && (
            <p className="text-ok mt-1">孤立したリソースはありません。</p>
          )}
          {auditResults.orphaned_groups?.length > 0 && (
            <>
              <h4 className="mt-2 text-err">孤立したリソースグループ</h4>
              <div className="list">
                {auditResults.orphaned_groups.map((g: any) => (
                  <div key={g.name} className="list-item">
                    <div className="list-item__body">
                      <strong>{g.name}</strong> <span className="text-muted">({g.location})</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default function Environments() {
  return <div className="page"><EnvironmentsContent /></div>
}
