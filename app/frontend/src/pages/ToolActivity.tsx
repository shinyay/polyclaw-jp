import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api, getToken } from '../api'
import type { ApiResponse } from '../types'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ToolActivityEntry {
  id: string
  session_id: string
  tool: string
  call_id: string
  category: string
  arguments: string
  result: string
  status: string
  timestamp: number
  duration_ms: number | null
  flagged: boolean
  flag_reason: string
  risk_score: number
  risk_factors: string[]
  model: string
  interaction_type: string  // '' | hitl | aitl | pitl | filter | deny
}

interface ActivityListResponse extends ApiResponse {
  entries: ToolActivityEntry[]
  total: number
  offset: number
  limit: number
}

interface ActivitySummary extends ApiResponse {
  total: number
  flagged: number
  by_tool: Record<string, number>
  by_category: Record<string, number>
  by_status: Record<string, number>
  by_model: Record<string, number>
  sessions_with_activity: number
  avg_duration_ms: number
  max_duration_ms: number
  p95_duration_ms: number
  risk_high: number
  risk_medium: number
  risk_low: number
  by_interaction_type: Record<string, number>
}

interface TimelineBucket {
  timestamp: number
  total: number
  flagged: number
  sdk: number
  mcp: number
  custom: number
  skill: number
}

interface SessionBreakdown {
  session_id: string
  tool_count: number
  flagged_count: number
  max_risk: number
  categories: string[]
  unique_tools: number
  models: string[]
  first_activity: number
  last_activity: number
  total_duration_ms: number
}

type Tab = 'log' | 'sessions'
type GroupBy = 'none' | 'tool' | 'category' | 'session' | 'status' | 'model'
type SortField = 'timestamp' | 'tool' | 'risk_score' | 'duration_ms' | 'status' | 'model'
type SortDir = 'asc' | 'desc'

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ToolActivity() {
  const [tab, setTab] = useState<Tab>('log')
  const [entries, setEntries] = useState<ToolActivityEntry[]>([])
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [timeline, setTimeline] = useState<TimelineBucket[]>([])
  const [sessions, setSessions] = useState<SessionBreakdown[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filters
  const [filterTool, setFilterTool] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFlagged, setFilterFlagged] = useState(false)
  const [filterSession, setFilterSession] = useState('')
  const [filterTimeRange, setFilterTimeRange] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterInteractionType, setFilterInteractionType] = useState('')

  // Sorting
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupBy>('none')

  // Inspection
  const [selected, setSelected] = useState<ToolActivityEntry | null>(null)

  // Pagination
  const [offset, setOffset] = useState(0)
  const limit = 100

  const sinceTimestamp = useMemo(() => {
    if (!filterTimeRange) return 0
    const now = Date.now() / 1000
    const map: Record<string, number> = {
      '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000,
    }
    return now - (map[filterTimeRange] || 0)
  }, [filterTimeRange])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTool) params.set('tool', filterTool)
      if (filterCategory) params.set('category', filterCategory)
      if (filterStatus) params.set('status', filterStatus)
      if (filterFlagged) params.set('flagged', '1')
      if (filterSession) params.set('session_id', filterSession)
      if (filterModel) params.set('model', filterModel)
      if (filterInteractionType) params.set('interaction_type', filterInteractionType)
      if (sinceTimestamp > 0) params.set('since', String(sinceTimestamp))
      params.set('limit', String(limit))
      params.set('offset', String(offset))

      const qs = params.toString()
      const res = await api<ActivityListResponse>(`tool-activity${qs ? '?' + qs : ''}`)
      setEntries(res.entries || [])
      setTotal(res.total || 0)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [filterTool, filterCategory, filterStatus, filterFlagged, filterSession, filterModel, filterInteractionType, sinceTimestamp, offset])

  const loadSummary = useCallback(async () => {
    try {
      const res = await api<ActivitySummary>('tool-activity/summary')
      setSummary(res)
    } catch { /* ignore */ }
  }, [])

  const loadTimeline = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (sinceTimestamp > 0) params.set('since', String(sinceTimestamp))
      const qs = params.toString()
      const res = await api<{ buckets: TimelineBucket[] }>(`tool-activity/timeline${qs ? '?' + qs : ''}`)
      setTimeline(res.buckets || [])
    } catch { /* ignore */ }
  }, [sinceTimestamp])

  const loadSessions = useCallback(async () => {
    try {
      const res = await api<{ sessions: SessionBreakdown[] }>('tool-activity/sessions')
      setSessions(res.sessions || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadEntries()
    loadSummary()
    loadTimeline()
    loadSessions()
  }, [loadEntries, loadSummary, loadTimeline, loadSessions])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        loadEntries()
        loadSummary()
        loadTimeline()
      }, 10000)
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [autoRefresh, loadEntries, loadSummary, loadTimeline])

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      await api<ApiResponse>('tool-activity/import', { method: 'POST' })
      await Promise.all([loadEntries(), loadSummary(), loadTimeline(), loadSessions()])
    } catch { /* ignore */ }
    setImporting(false)
  }, [loadEntries, loadSummary, loadTimeline, loadSessions])

  const handleFlag = useCallback(async (entryId: string, reason: string) => {
    await api<ApiResponse>(`tool-activity/${entryId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    await Promise.all([loadEntries(), loadSummary()])
  }, [loadEntries, loadSummary])

  const handleUnflag = useCallback(async (entryId: string) => {
    await api<ApiResponse>(`tool-activity/${entryId}/unflag`, { method: 'POST' })
    await Promise.all([loadEntries(), loadSummary()])
  }, [loadEntries, loadSummary])

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterTool) params.set('tool', filterTool)
    if (filterCategory) params.set('category', filterCategory)
    if (filterStatus) params.set('status', filterStatus)
    if (filterModel) params.set('model', filterModel)
    if (filterInteractionType) params.set('interaction_type', filterInteractionType)
    if (filterFlagged) params.set('flagged', '1')
    const qs = params.toString()
    try {
      const headers: Record<string, string> = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/tool-activity/export${qs ? '?' + qs : ''}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tool-activity.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }, [filterTool, filterCategory, filterStatus, filterModel, filterInteractionType, filterFlagged])

  const sortedEntries = useMemo(() => {
    const sorted = [...entries]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'timestamp': cmp = a.timestamp - b.timestamp; break
        case 'tool': cmp = a.tool.localeCompare(b.tool); break
        case 'risk_score': cmp = a.risk_score - b.risk_score; break
        case 'duration_ms': cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'model': cmp = a.model.localeCompare(b.model); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [entries, sortField, sortDir])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const groups: Record<string, ToolActivityEntry[]> = {}
    for (const e of sortedEntries) {
      const key = groupBy === 'tool' ? e.tool
        : groupBy === 'category' ? e.category
        : groupBy === 'session' ? e.session_id.slice(0, 8)
        : groupBy === 'model' ? (e.model || '(unknown)')
        : e.status
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [sortedEntries, groupBy])

  const resetFilters = useCallback(() => {
    setFilterTool('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterFlagged(false)
    setFilterSession('')
    setFilterModel('')
    setFilterInteractionType('')
    setFilterTimeRange('')
    setOffset(0)
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField])

  const activeFilterCount = [filterTool, filterCategory, filterStatus, filterSession, filterModel, filterInteractionType, filterTimeRange]
    .filter(Boolean).length + (filterFlagged ? 1 : 0)

  return (
    <div className="page">
      <div className="page__header">
        <div className="ta__page-title-row">
          <div>
            <h1>ツールアクティビティ</h1>
            <p className="page__subtitle">
              ツール呼び出し、HITL/AITL/PITL 対話、MCP 呼び出し、各セッションのモデルアクティビティを監査・確認します。
            </p>
          </div>
          <div className="ta__page-actions">
            <label className="ta__auto-refresh" data-testid="ta-auto-refresh">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              <span className={`ta__auto-refresh-dot ${autoRefresh ? 'ta__auto-refresh-dot--active' : ''}`} />
              <span>ライブ</span>
            </label>
            <button className="btn btn--sm btn--outline ta__btn-export" onClick={handleExport} title="フィルター適用済みデータを CSV としてエクスポート" data-testid="ta-export-btn">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12l-4-4h2.5V3h3v5H12L8 12zm-5 2h10v1H3v-1z"/></svg>
              CSV エクスポート
            </button>
            <button className="btn btn--sm btn--outline" onClick={handleImport} disabled={importing} data-testid="ta-import-btn">
              {importing ? 'インポート中...' : '履歴をインポート'}
            </button>
          </div>
        </div>
      </div>

      {/* Risk + Summary Dashboard */}
      {summary && (
        <RiskDashboard
          summary={summary}
          onFilterCategory={c => { setFilterCategory(prev => prev === c ? '' : c); setOffset(0) }}
          onFilterFlagged={() => { setFilterFlagged(prev => !prev); setTab('log') }}
          onFilterDenied={() => { setFilterStatus(prev => prev === 'denied' ? '' : 'denied'); setOffset(0); setTab('log') }}
          onFilterModel={m => { setFilterModel(prev => prev === m ? '' : m); setOffset(0) }}
          activeCategory={filterCategory}
          activeModel={filterModel}
        />
      )}

      {/* Inline panels: Timeline + Categories & Models + Breakdown */}
      <div className="ta__panels-row ta__panels-row--3col">
        <TimelineCompact
          buckets={timeline}
          onFilterCategory={c => { setFilterCategory(prev => prev === c ? '' : c); setOffset(0); setTab('log') }}
          activeCategory={filterCategory}
        />
        {summary && (
          <CategoriesModelsPanel
            summary={summary}
            onFilterCategory={c => { setFilterCategory(prev => prev === c ? '' : c); setOffset(0); setTab('log') }}
            onFilterModel={m => { setFilterModel(prev => prev === m ? '' : m); setOffset(0); setTab('log') }}
            onFilterInteractionType={itl => { setFilterInteractionType(prev => prev === itl ? '' : itl); setOffset(0); setTab('log') }}
            activeCategory={filterCategory}
            activeModel={filterModel}
            activeInteractionType={filterInteractionType}
          />
        )}
        {summary && (
          <BreakdownCompact
            summary={summary}
            onFilterStatus={s => { setFilterStatus(prev => prev === s ? '' : s); setOffset(0); setTab('log') }}
            onFilterTool={t => { setFilterTool(prev => prev === t ? '' : t); setOffset(0); setTab('log') }}
            activeStatus={filterStatus}
            activeTool={filterTool}
          />
        )}
      </div>

      {/* Bottom tabs: Activity Log + Sessions */}
      <div className="ta__tabs">
        {(['log', 'sessions'] as Tab[]).map(t => (
          <button
            key={t}
            className={`ta__tab ${tab === t ? 'ta__tab--active' : ''}`}
            onClick={() => setTab(t)}
            data-testid={`ta-tab-${t}`}
          >
            {t === 'log' && 'アクティビティログ'}
            {t === 'sessions' && 'セッション'}
            {t === 'log' && total > 0 && <span className="ta__tab-badge">{total}</span>}
            {t === 'sessions' && sessions.length > 0 && <span className="ta__tab-badge">{sessions.length}</span>}
          </button>
        ))}
        {activeFilterCount > 0 && (
          <span className="ta__active-filters-badge" data-testid="ta-active-filters-badge">{activeFilterCount} 件のフィルター適用中</span>
        )}
      </div>

      {tab === 'log' && (
        <>
          <FilterBar
            filterTool={filterTool}
            filterCategory={filterCategory}
            filterStatus={filterStatus}
            filterFlagged={filterFlagged}
            filterSession={filterSession}
            filterModel={filterModel}
            filterInteractionType={filterInteractionType}
            filterTimeRange={filterTimeRange}
            groupBy={groupBy}
            onFilterTool={v => { setFilterTool(v); setOffset(0) }}
            onFilterCategory={v => { setFilterCategory(v); setOffset(0) }}
            onFilterStatus={v => { setFilterStatus(v); setOffset(0) }}
            onFilterFlagged={v => { setFilterFlagged(v); setOffset(0) }}
            onFilterSession={v => { setFilterSession(v); setOffset(0) }}
            onFilterModel={v => { setFilterModel(v); setOffset(0) }}
            onFilterInteractionType={v => { setFilterInteractionType(v); setOffset(0) }}
            onFilterTimeRange={v => { setFilterTimeRange(v); setOffset(0) }}
            onGroupBy={setGroupBy}
            onReset={resetFilters}
            availableModels={summary?.by_model ? Object.keys(summary.by_model) : []}
          />

          {loading ? (
            <LoadingSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState onImport={handleImport} />
          ) : grouped ? (
            <GroupedView groups={grouped} onSelect={setSelected} onFlag={handleFlag} onUnflag={handleUnflag} groupBy={groupBy} />
          ) : (
            <ActivityTable
              entries={sortedEntries}
              onSelect={setSelected}
              onFlag={handleFlag}
              onUnflag={handleUnflag}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}

          {total > limit && (
            <div className="ta__pagination">
              <button className="btn btn--sm btn--outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} data-testid="ta-pagination-prev">
                前へ
              </button>
              <span className="ta__pagination-info">
                <strong>{offset + 1}</strong>~<strong>{Math.min(offset + limit, total)}</strong> / 全 <strong>{total}</strong> 件
              </span>
              <button className="btn btn--sm btn--outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} data-testid="ta-pagination-next">
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'sessions' && (
        <SessionsView
          sessions={sessions}
          onDrillDown={sid => { setFilterSession(sid); setTab('log') }}
        />
      )}

      {selected && (
        <DetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onFlag={handleFlag}
          onUnflag={handleUnflag}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Risk Dashboard                                                     */
/* ------------------------------------------------------------------ */

function RiskDashboard({ summary, onFilterCategory, onFilterFlagged, onFilterDenied, onFilterModel, activeCategory, activeModel }: {
  summary: ActivitySummary
  onFilterCategory: (c: string) => void
  onFilterFlagged: () => void
  onFilterDenied: () => void
  onFilterModel: (m: string) => void
  activeCategory?: string
  activeModel?: string
}) {
  const deniedCount = summary.by_status?.denied ?? 0
  const riskTotal = summary.risk_high + summary.risk_medium + summary.risk_low
  const riskPct = (n: number) => riskTotal > 0 ? Math.round((n / riskTotal) * 100) : 0

  return (
    <div className="ta__dashboard">
      {/* Primary stats row + risk distribution */}
      <div className="ta__stats-row">
        <div className="card ta__stat-card">
          <div className="ta__stat-icon ta__stat-icon--total">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a2 2 0 00-2 2v8a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 1h4a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/></svg>
          </div>
          <div className="ta__stat-value">{summary.total.toLocaleString()}</div>
          <div className="ta__stat-label">総呼び出し数</div>
        </div>

        <button className={`card ta__stat-card ta__stat-card--clickable ${summary.flagged > 0 ? 'ta__stat-card--danger' : ''}`}
          onClick={onFilterFlagged} data-testid="ta-stat-flagged">
          <div className="ta__stat-icon ta__stat-icon--flagged">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 1v14h1V9h8l-2-4 2-4h-9z"/></svg>
          </div>
          <div className="ta__stat-value">{summary.flagged}</div>
          <div className="ta__stat-label">フラグ済み</div>
        </button>

        <button className={`card ta__stat-card ta__stat-card--clickable ${deniedCount > 0 ? 'ta__stat-card--warn' : ''}`}
          onClick={onFilterDenied} data-testid="ta-stat-denied">
          <div className="ta__stat-icon ta__stat-icon--denied">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.2a5.8 5.8 0 014.1 9.9L3.9 3.9A5.77 5.77 0 018 2.2zm0 11.6a5.8 5.8 0 01-4.1-9.9l8.2 8.2A5.77 5.77 0 018 13.8z"/></svg>
          </div>
          <div className="ta__stat-value">{deniedCount}</div>
          <div className="ta__stat-label">拒否</div>
        </button>

        <div className="card ta__stat-card">
          <div className="ta__stat-icon ta__stat-icon--sessions">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1a6 6 0 110 12A6 6 0 018 2zm-.5 2v5h4V8h-3V4h-1z"/></svg>
          </div>
          <div className="ta__stat-value">{summary.sessions_with_activity}</div>
          <div className="ta__stat-label">セッション</div>
        </div>

        <div className="card ta__stat-card">
          <div className="ta__stat-icon ta__stat-icon--speed">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a6 6 0 100 12A6 6 0 008 2zM1 8a7 7 0 1114 0A7 7 0 011 8zm7-3v3.5l2.5 1.5-.5.87L7 9V5h1z"/></svg>
          </div>
          <div className="ta__stat-value">{summary.avg_duration_ms > 0 ? formatDuration(summary.avg_duration_ms) : '--'}</div>
          <div className="ta__stat-label">平均実行時間</div>
        </div>

        <div className="card ta__stat-card">
          <div className="ta__stat-icon ta__stat-icon--p95">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM2 8a6 6 0 1112 0A6 6 0 012 8zm5.5-4v4.7l3.1 1.8-.5.9L6.5 9V4h1z"/></svg>
          </div>
          <div className="ta__stat-value">{summary.p95_duration_ms > 0 ? formatDuration(summary.p95_duration_ms) : '--'}</div>
          <div className="ta__stat-label">P95 実行時間</div>
        </div>

        {/* Risk distribution inline */}
        <div className="card ta__stat-card ta__stat-card--risk">
          <div className="ta__risk-inline-header">
            <span className="ta__risk-inline-title">リスク</span>
            <span className="ta__risk-inline-total">{riskTotal}</span>
          </div>
          <div className="ta__risk-bar ta__risk-bar--inline">
            {summary.risk_high > 0 && (
              <div className="ta__risk-bar-seg ta__risk-bar-seg--high"
                style={{ width: `${riskPct(summary.risk_high)}%` }}
                title={`高: ${summary.risk_high}`} />
            )}
            {summary.risk_medium > 0 && (
              <div className="ta__risk-bar-seg ta__risk-bar-seg--medium"
                style={{ width: `${riskPct(summary.risk_medium)}%` }}
                title={`中: ${summary.risk_medium}`} />
            )}
            {summary.risk_low > 0 && (
              <div className="ta__risk-bar-seg ta__risk-bar-seg--low"
                style={{ width: `${riskPct(summary.risk_low)}%` }}
                title={`低: ${summary.risk_low}`} />
            )}
            {riskTotal === 0 && <div className="ta__risk-bar-seg ta__risk-bar-seg--empty" style={{ width: '100%' }} />}
          </div>
          <div className="ta__risk-legend ta__risk-legend--inline">
            <span className="ta__risk-legend-item"><span className="ta__risk-dot ta__risk-dot--high" /> {summary.risk_high}</span>
            <span className="ta__risk-legend-item"><span className="ta__risk-dot ta__risk-dot--medium" /> {summary.risk_medium}</span>
            <span className="ta__risk-legend-item"><span className="ta__risk-dot ta__risk-dot--low" /> {summary.risk_low}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */

interface FilterBarProps {
  filterTool: string
  filterCategory: string
  filterStatus: string
  filterFlagged: boolean
  filterSession: string
  filterModel: string
  filterInteractionType: string
  filterTimeRange: string
  groupBy: GroupBy
  onFilterTool: (v: string) => void
  onFilterCategory: (v: string) => void
  onFilterStatus: (v: string) => void
  onFilterFlagged: (v: boolean) => void
  onFilterSession: (v: string) => void
  onFilterModel: (v: string) => void
  onFilterInteractionType: (v: string) => void
  onFilterTimeRange: (v: string) => void
  onGroupBy: (v: GroupBy) => void
  onReset: () => void
  availableModels: string[]
}

function FilterBar(p: FilterBarProps) {
  const hasFilters = p.filterTool || p.filterCategory || p.filterStatus || p.filterFlagged || p.filterSession || p.filterModel || p.filterInteractionType || p.filterTimeRange

  return (
    <div className="ta__filters">
      <div className="ta__filter-row">
        <div className="ta__search-wrap">
          <svg className="ta__search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04z"/>
          </svg>
          <input
            className="input ta__filter-input ta__filter-input--search"
            type="text"
            placeholder="ツール名で検索..."
            value={p.filterTool}
            onChange={e => p.onFilterTool(e.target.value)}
            data-testid="ta-filter-tool"
          />
        </div>
        <select className="input ta__filter-select" value={p.filterCategory} onChange={e => p.onFilterCategory(e.target.value)} data-testid="ta-filter-category">
          <option value="">すべてのカテゴリ</option>
          <option value="sdk">SDK</option>
          <option value="custom">Custom</option>
          <option value="mcp">MCP</option>
          <option value="skill">Skill</option>
        </select>
        <select className="input ta__filter-select" value={p.filterStatus} onChange={e => p.onFilterStatus(e.target.value)} data-testid="ta-filter-status">
          <option value="">すべての状態</option>
          <option value="started">開始</option>
          <option value="completed">完了</option>
          <option value="denied">拒否</option>
          <option value="error">エラー</option>
        </select>
        <select className="input ta__filter-select" value={p.filterTimeRange} onChange={e => p.onFilterTimeRange(e.target.value)} data-testid="ta-filter-time">
          <option value="">すべての期間</option>
          <option value="1h">過去 1 時間</option>
          <option value="6h">過去 6 時間</option>
          <option value="24h">過去 24 時間</option>
          <option value="7d">過去 7 日間</option>
          <option value="30d">過去 30 日間</option>
        </select>
        <select className="input ta__filter-select" value={p.filterModel} onChange={e => p.onFilterModel(e.target.value)} data-testid="ta-filter-model">
          <option value="">すべてのモデル</option>
          {p.availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="input ta__filter-select" value={p.filterInteractionType} onChange={e => p.onFilterInteractionType(e.target.value)} data-testid="ta-filter-interaction">
          <option value="">すべての対話タイプ</option>
          <option value="allow">自動許可</option>
          <option value="hitl">HITL</option>
          <option value="aitl">AITL</option>
          <option value="pitl">PITL (試験的)</option>
          <option value="filter">Prompt Shields</option>
          <option value="deny">拒否</option>
        </select>
      </div>
      <div className="ta__filter-row">
        <input
          className="input ta__filter-input"
          type="text"
          placeholder="セッション ID で絞り込み..."
          value={p.filterSession}
          onChange={e => p.onFilterSession(e.target.value)}
          data-testid="ta-filter-session"
        />
        <select className="input ta__filter-select" value={p.groupBy} onChange={e => p.onGroupBy(e.target.value as GroupBy)} data-testid="ta-group-by">
          <option value="none">グループ化なし</option>
          <option value="tool">ツールでグループ化</option>
          <option value="category">カテゴリでグループ化</option>
          <option value="session">セッションでグループ化</option>
          <option value="model">モデルでグループ化</option>
          <option value="status">状態でグループ化</option>
        </select>
        <label className="ta__flag-toggle">
          <input type="checkbox" checked={p.filterFlagged} onChange={e => p.onFilterFlagged(e.target.checked)} data-testid="ta-filter-flagged" />
          <span className="ta__flag-toggle-slider" />
          <span>フラグ済みのみ</span>
        </label>
        {hasFilters && (
          <button className="btn btn--sm btn--ghost ta__btn-clear" onClick={p.onReset} data-testid="ta-clear-filters-btn">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm2.646 4.354L8.707 7.293l1.94 1.94-1.061 1.06-1.94-1.94-1.94 1.94-1.06-1.06 1.94-1.94-1.94-1.94 1.06-1.06 1.94 1.94 1.94-1.94 1.06 1.06z"/></svg>
            フィルターをクリア
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Activity Table                                                     */
/* ------------------------------------------------------------------ */

function ActivityTable({ entries, onSelect, onFlag, onUnflag, sortField, sortDir, onSort }: {
  entries: ToolActivityEntry[]
  onSelect: (e: ToolActivityEntry) => void
  onFlag: (id: string, reason: string) => void
  onUnflag: (id: string) => void
  sortField: SortField
  sortDir: SortDir
  onSort: (f: SortField) => void
}) {
  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    return (
      <th className={`ta__th-sort ${active ? 'ta__th-sort--active' : ''}`} onClick={() => onSort(field)}>
        {children}
        <span className="ta__sort-arrow">{active ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
      </th>
    )
  }

  return (
    <div className="ta__table-wrap">
      <table className="ta__table">
        <thead>
          <tr>
            <SortHeader field="timestamp">時刻</SortHeader>
            <SortHeader field="tool">ツール</SortHeader>
            <th>カテゴリ</th>
            <SortHeader field="model">モデル</SortHeader>
            <SortHeader field="status">状態</SortHeader>
            <th>ITL</th>
            <SortHeader field="risk_score">リスク</SortHeader>
            <SortHeader field="duration_ms">実行時間</SortHeader>
            <th>セッション</th>
            <th className="ta__col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr
              key={e.id}
              className={`ta__row ${e.flagged ? 'ta__row--flagged' : ''} ${riskRowClass(e.risk_score)}`}
              onClick={() => onSelect(e)}
            >
              <td className="ta__cell-time">{formatTime(e.timestamp)}</td>
              <td className="ta__cell-tool"><code>{e.tool}</code></td>
              <td><span className={`ta__badge ta__badge--${e.category}`}>{categoryLabel(e.category)}</span></td>
              <td className="ta__cell-model">{e.model ? <code>{e.model}</code> : <span className="ta__muted">--</span>}</td>
              <td><span className={`ta__badge ta__badge--${statusVariant(e.status)}`}>{statusLabel(e.status)}</span></td>
              <td>{e.interaction_type ? <span className={`ta__badge ta__badge--itl ta__badge--itl-${e.interaction_type}`}>{interactionLabel(e.interaction_type)}</span> : <span className="ta__muted">--</span>}</td>
              <td className="ta__cell-risk"><RiskIndicator score={e.risk_score} /></td>
              <td className="ta__cell-duration">{e.duration_ms != null ? formatDuration(e.duration_ms) : '--'}</td>
              <td className="ta__cell-session" title={e.session_id}>{e.session_id.slice(0, 8)}</td>
              <td className="ta__col-actions" onClick={ev => ev.stopPropagation()}>
                {e.flagged ? (
                  <button className="ta__action-btn ta__action-btn--unflag" title="フラグを解除" onClick={() => onUnflag(e.id)} data-testid={`ta-unflag-${e.id}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 1v14h1V9h8l-2-4 2-4h-9z"/></svg>
                  </button>
                ) : (
                  <button className="ta__action-btn" title="不審としてフラグ" onClick={() => onFlag(e.id, '手動フラグ')} data-testid={`ta-flag-${e.id}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 1v14h1V9h8l-2-4 2-4h-9zM5 2v6h6.28l-1.5-3 1.5-3H5z"/></svg>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Risk Indicator                                                     */
/* ------------------------------------------------------------------ */

function RiskIndicator({ score }: { score: number }) {
  const level = riskLevel(score)
  return (
    <div className={`ta__risk-indicator ta__risk-indicator--${level}`} title={`リスクスコア: ${score}`}>
      <div className="ta__risk-ring">
        <svg viewBox="0 0 36 36" className="ta__risk-ring-svg">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.15" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${score * 0.9425} 94.25`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="ta__risk-ring-text">{score}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Timeline View                                                      */
/* ------------------------------------------------------------------ */

function TimelineView({ buckets }: { buckets: TimelineBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="ta__empty">
        <div className="ta__empty-icon">
          <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.3"><path d="M1 1v14h14V1H1zm1 1h12v12H2V2zm1 9h1v1H3v-1zm2-2h1v3H5V9zm2-3h1v6H7V6zm2 1h1v5H9V7zm2-4h1v9h-1V3z"/></svg>
        </div>
        <p>タイムラインデータはまだありません。</p>
        <p className="ta__empty-hint">ツール呼び出しが記録されるとここに表示されます。</p>
      </div>
    )
  }

  const maxTotal = Math.max(1, ...buckets.map(b => b.total))

  return (
    <div className="ta__timeline">
      <div className="card ta__timeline-card">
        <div className="ta__timeline-header">
          <h3>時系列アクティビティ</h3>
          <div className="ta__timeline-legend">
            <span className="ta__timeline-legend-item"><span className="ta__tl-dot ta__tl-dot--sdk" /> SDK</span>
            <span className="ta__timeline-legend-item"><span className="ta__tl-dot ta__tl-dot--mcp" /> MCP</span>
            <span className="ta__timeline-legend-item"><span className="ta__tl-dot ta__tl-dot--custom" /> Custom</span>
            <span className="ta__timeline-legend-item"><span className="ta__tl-dot ta__tl-dot--skill" /> Skill</span>
            <span className="ta__timeline-legend-item"><span className="ta__tl-dot ta__tl-dot--flagged" /> フラグ済み</span>
          </div>
        </div>
        <div className="ta__timeline-chart">
          <div className="ta__timeline-y-axis">
            <span>{maxTotal}</span>
            <span>{Math.round(maxTotal / 2)}</span>
            <span>0</span>
          </div>
          <div className="ta__timeline-bars">
            {buckets.map((b, i) => (
              <div key={i} className="ta__timeline-col" title={`${new Date(b.timestamp * 1000).toLocaleString()}\n合計: ${b.total}\nフラグ済み: ${b.flagged}`}>
                <div className="ta__timeline-stack" style={{ height: `${(b.total / maxTotal) * 100}%` }}>
                  {b.sdk > 0 && <div className="ta__tl-seg ta__tl-seg--sdk" style={{ flex: b.sdk }} />}
                  {b.mcp > 0 && <div className="ta__tl-seg ta__tl-seg--mcp" style={{ flex: b.mcp }} />}
                  {b.custom > 0 && <div className="ta__tl-seg ta__tl-seg--custom" style={{ flex: b.custom }} />}
                  {b.skill > 0 && <div className="ta__tl-seg ta__tl-seg--skill" style={{ flex: b.skill }} />}
                </div>
                {b.flagged > 0 && <div className="ta__tl-flag-dot" />}
                <span className="ta__timeline-label">{formatBucketLabel(b.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sessions View                                                      */
/* ------------------------------------------------------------------ */

function SessionsView({ sessions, onDrillDown }: {
  sessions: SessionBreakdown[]
  onDrillDown: (sessionId: string) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="ta__empty">
        <p>セッションデータはまだありません。</p>
        <p className="ta__empty-hint">ツールアクティビティが記録されるとここに表示されます。</p>
      </div>
    )
  }

  return (
    <div className="ta__sessions">
      <div className="ta__table-wrap">
        <table className="ta__table ta__sessions-table">
          <thead>
            <tr>
              <th>セッション</th>
              <th>使用ツール数</th>
              <th>総呼び出し数</th>
              <th>フラグ済み</th>
              <th>最大リスク</th>
              <th>カテゴリ</th>
              <th>モデル</th>
              <th>実行時間</th>
              <th>最終アクティビティ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.session_id} className={`ta__row ${s.flagged_count > 0 ? 'ta__row--flagged' : ''}`}>
                <td className="ta__cell-session" title={s.session_id}>
                  <code>{s.session_id.slice(0, 12)}</code>
                </td>
                <td className="ta__cell-tools-count">{s.unique_tools}</td>
                <td>{s.tool_count}</td>
                <td>{s.flagged_count > 0 ? <span className="ta__flagged-count">{s.flagged_count}</span> : '0'}</td>
                <td><RiskIndicator score={s.max_risk} /></td>
                <td>
                  <div className="ta__cat-chips">
                    {s.categories.map(c => (
                      <span key={c} className={`ta__badge ta__badge--${c} ta__badge--xs`}>{categoryLabel(c)}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="ta__cat-chips">
                    {s.models.map(m => (
                      <span key={m} className="ta__badge ta__badge--model ta__badge--xs">{m}</span>
                    ))}
                  </div>
                </td>
                <td className="ta__cell-duration">{formatDuration(s.total_duration_ms)}</td>
                <td className="ta__cell-time">{formatTime(s.last_activity)}</td>
                <td>
                  <button className="ta__action-btn" onClick={() => onDrillDown(s.session_id)} title="セッションアクティビティを表示" data-testid={`ta-session-view-${s.session_id}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Grouped View                                                       */
/* ------------------------------------------------------------------ */

function GroupedView({ groups, onSelect, onFlag, onUnflag, groupBy }: {
  groups: [string, ToolActivityEntry[]][]
  onSelect: (e: ToolActivityEntry) => void
  onFlag: (id: string, reason: string) => void
  onUnflag: (id: string) => void
  groupBy: GroupBy
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="ta__groups">
      {groups.map(([key, items]) => {
        const isOpen = expanded.has(key)
        const flaggedCount = items.filter(e => e.flagged).length
        const maxRisk = Math.max(0, ...items.map(e => e.risk_score))
        return (
          <div key={key} className={`ta__group ${flaggedCount > 0 ? 'ta__group--has-flagged' : ''}`}>
            <button className="ta__group-header" onClick={() => toggle(key)}>
              <span className={`ta__group-chevron ${isOpen ? 'ta__group-chevron--open' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </span>
              <span className="ta__group-title">{groupBy === 'category' ? categoryLabel(key) : groupBy === 'status' ? statusLabel(key) : key || '(未指定)'}</span>
              <span className="ta__group-count">{items.length} 件</span>
              {maxRisk > 0 && (
                <span className={`ta__group-risk ta__group-risk--${riskLevel(maxRisk)}`}>
                  リスク {maxRisk}
                </span>
              )}
              {flaggedCount > 0 && <span className="ta__group-flagged">{flaggedCount} 件フラグ済み</span>}
            </button>
            {isOpen && (
              <div className="ta__group-body">
                <ActivityTable
                  entries={items}
                  onSelect={onSelect}
                  onFlag={onFlag}
                  onUnflag={onUnflag}
                  sortField="timestamp"
                  sortDir="desc"
                  onSort={() => {}}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Breakdown View                                                     */
/* ------------------------------------------------------------------ */

function BreakdownView({ summary }: { summary: ActivitySummary }) {
  const toolEntries = Object.entries(summary.by_tool).sort((a, b) => b[1] - a[1])
  const maxCount = toolEntries.length > 0 ? toolEntries[0][1] : 1

  return (
    <div className="ta__breakdown">
      <div className="card ta__perf-card">
        <h3>パフォーマンス</h3>
        <div className="ta__perf-grid">
          <div className="ta__perf-item">
            <span className="ta__perf-val">{formatDuration(summary.avg_duration_ms)}</span>
            <span className="ta__perf-label">平均</span>
          </div>
          <div className="ta__perf-item">
            <span className="ta__perf-val">{formatDuration(summary.p95_duration_ms)}</span>
            <span className="ta__perf-label">P95</span>
          </div>
          <div className="ta__perf-item">
            <span className="ta__perf-val">{formatDuration(summary.max_duration_ms)}</span>
            <span className="ta__perf-label">最大</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>ツール使用分布</h3>
        {toolEntries.length === 0 ? (
          <p className="ta__empty-hint">ツールの使用記録はまだありません。</p>
        ) : (
          <div className="ta__bar-chart">
            {toolEntries.map(([name, count]) => (
              <div key={name} className="ta__bar-row">
                <span className="ta__bar-label"><code>{name}</code></span>
                <div className="ta__bar-track">
                  <div className="ta__bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="ta__bar-count">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ta__breakdown-grid">
        <div className="card">
          <h3>カテゴリ別</h3>
          <dl className="ta__dl">
            {Object.entries(summary.by_category).map(([k, v]) => (
              <div key={k} className="ta__dl-row">
                <dt><span className={`ta__badge ta__badge--${k}`}>{categoryLabel(k)}</span></dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="card">
          <h3>状態別</h3>
          <dl className="ta__dl">
            {Object.entries(summary.by_status).map(([k, v]) => (
              <div key={k} className="ta__dl-row">
                <dt><span className={`ta__badge ta__badge--${statusVariant(k)}`}>{statusLabel(k)}</span></dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="card">
          <h3>モデル別</h3>
          {Object.keys(summary.by_model).length === 0 ? (
            <p className="ta__empty-hint">モデルの記録はまだありません。</p>
          ) : (
            <dl className="ta__dl">
              {Object.entries(summary.by_model)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="ta__dl-row">
                    <dt><span className="ta__badge ta__badge--model">{k}</span></dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Categories & Models Panel (inline)                                 */
/* ------------------------------------------------------------------ */

function CategoriesModelsPanel({ summary, onFilterCategory, onFilterModel, onFilterInteractionType, activeCategory, activeModel, activeInteractionType }: {
  summary: ActivitySummary
  onFilterCategory: (c: string) => void
  onFilterModel: (m: string) => void
  onFilterInteractionType: (itl: string) => void
  activeCategory: string
  activeModel: string
  activeInteractionType: string
}) {
  const hasItl = Object.keys(summary.by_interaction_type || {}).length > 0
  return (
    <div className="card ta__panel-card">
      <h3 className="ta__panel-title" style={{ marginBottom: '10px' }}>カテゴリとモデル</h3>
      <div className="ta__chips-wrap ta__chips-wrap--compact">
        {Object.entries(summary.by_category).map(([cat, count]) => (
          <button
            key={cat}
            className={`ta__chip ta__chip--sm ta__chip--${cat} ${activeCategory === cat ? 'ta__chip--active' : ''}`}
            onClick={() => onFilterCategory(cat)}
          >
            <span className="ta__chip-label">{categoryLabel(cat)}</span>
            <span className="ta__chip-count">{count}</span>
          </button>
        ))}
        {Object.entries(summary.by_model)
          .sort((a, b) => b[1] - a[1])
          .map(([model, count]) => (
            <button
              key={model}
              className={`ta__chip ta__chip--sm ta__chip--model ${activeModel === model ? 'ta__chip--active' : ''}`}
              onClick={() => onFilterModel(model)}
            >
              <span className="ta__chip-label">{model}</span>
              <span className="ta__chip-count">{count}</span>
            </button>
          ))}
      </div>
      {hasItl && (
        <>
          <h3 className="ta__panel-title" style={{ marginTop: '12px', marginBottom: '8px' }}>対話タイプ</h3>
          <div className="ta__chips-wrap ta__chips-wrap--compact">
            {Object.entries(summary.by_interaction_type)
              .sort((a, b) => b[1] - a[1])
              .map(([itl, count]) => (
                <button
                  key={itl}
                  className={`ta__chip ta__chip--sm ta__chip--itl-${itl} ${activeInteractionType === itl ? 'ta__chip--active' : ''}`}
                  onClick={() => onFilterInteractionType(itl)}
                >
                  <span className="ta__chip-label">{interactionLabel(itl)}</span>
                  <span className="ta__chip-count">{count}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Timeline Compact (inline panel)                                    */
/* ------------------------------------------------------------------ */

function TimelineCompact({ buckets, onFilterCategory, activeCategory }: {
  buckets: TimelineBucket[]
  onFilterCategory: (c: string) => void
  activeCategory: string
}) {
  const cats: { key: string; label: string; cls: string }[] = [
    { key: 'sdk', label: 'SDK', cls: 'ta__tl-dot--sdk' },
    { key: 'mcp', label: 'MCP', cls: 'ta__tl-dot--mcp' },
    { key: 'custom', label: 'Custom', cls: 'ta__tl-dot--custom' },
    { key: 'skill', label: 'Skill', cls: 'ta__tl-dot--skill' },
  ]

  if (buckets.length === 0) {
    return (
      <div className="card ta__panel-card">
        <h3 className="ta__panel-title">時系列アクティビティ</h3>
        <p className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>タイムラインデータはまだありません。</p>
      </div>
    )
  }

  const maxTotal = Math.max(1, ...buckets.map(b => b.total))

  return (
    <div className="card ta__panel-card">
      <div className="ta__panel-header">
        <h3 className="ta__panel-title">時系列アクティビティ</h3>
        <div className="ta__timeline-legend ta__timeline-legend--compact">
          {cats.map(c => (
            <button
              key={c.key}
              className={`ta__timeline-legend-btn ${activeCategory === c.key ? 'ta__timeline-legend-btn--active' : ''}`}
              onClick={() => onFilterCategory(c.key)}
            >
              <span className={`ta__tl-dot ${c.cls}`} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ta__timeline-chart ta__timeline-chart--compact">
        <div className="ta__timeline-y-axis">
          <span>{maxTotal}</span>
          <span>{Math.round(maxTotal / 2)}</span>
          <span>0</span>
        </div>
        <div className="ta__timeline-bars">
          {buckets.map((b, i) => (
            <div key={i} className="ta__timeline-col" title={`${new Date(b.timestamp * 1000).toLocaleString()}\n合計: ${b.total}`}>
              {b.flagged > 0 && <div className="ta__tl-flag-dot" />}
              <div className="ta__timeline-stack" style={{ height: `${(b.total / maxTotal) * 100}%` }}>
                {b.sdk > 0 && <div className={`ta__tl-seg ta__tl-seg--sdk${activeCategory && activeCategory !== 'sdk' ? ' ta__tl-seg--dim' : ''}`} style={{ flex: b.sdk }} />}
                {b.mcp > 0 && <div className={`ta__tl-seg ta__tl-seg--mcp${activeCategory && activeCategory !== 'mcp' ? ' ta__tl-seg--dim' : ''}`} style={{ flex: b.mcp }} />}
                {b.custom > 0 && <div className={`ta__tl-seg ta__tl-seg--custom${activeCategory && activeCategory !== 'custom' ? ' ta__tl-seg--dim' : ''}`} style={{ flex: b.custom }} />}
                {b.skill > 0 && <div className={`ta__tl-seg ta__tl-seg--skill${activeCategory && activeCategory !== 'skill' ? ' ta__tl-seg--dim' : ''}`} style={{ flex: b.skill }} />}
              </div>
              <span className="ta__timeline-label">{formatBucketLabel(b.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Breakdown Compact (inline panel)                                   */
/* ------------------------------------------------------------------ */

function BreakdownCompact({ summary, onFilterStatus, onFilterTool, activeStatus, activeTool }: {
  summary: ActivitySummary
  onFilterStatus: (s: string) => void
  onFilterTool: (t: string) => void
  activeStatus: string
  activeTool: string
}) {
  const toolEntries = Object.entries(summary.by_tool).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxCount = toolEntries.length > 0 ? toolEntries[0][1] : 1

  return (
    <div className="card ta__panel-card">
      <h3 className="ta__panel-title" style={{ marginBottom: '12px' }}>内訳</h3>

      <div className="ta__bd-section">
        <div className="ta__bd-items">
          {Object.entries(summary.by_status).map(([k, v]) => (
            <button
              key={k}
              className={`ta__bd-item ta__bd-item--${statusVariant(k)} ${activeStatus === k ? 'ta__bd-item--active' : ''}`}
              onClick={() => onFilterStatus(k)}
            >
              <span>{statusLabel(k)}</span>
              <span className="ta__bd-count">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {toolEntries.length > 0 && (
        <div className="ta__bd-section">
          <span className="ta__bd-label">上位ツール</span>
          <div className="ta__bd-tools">
            {toolEntries.map(([name, count]) => (
              <button
                key={name}
                className={`ta__bd-tool ${activeTool === name ? 'ta__bd-tool--active' : ''}`}
                onClick={() => onFilterTool(name)}
              >
                <span className="ta__bd-tool-name"><code>{name}</code></span>
                <div className="ta__bd-tool-bar">
                  <div className="ta__bd-tool-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="ta__bd-count">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Modal                                                       */
/* ------------------------------------------------------------------ */

function DetailModal({ entry, onClose, onFlag, onUnflag }: {
  entry: ToolActivityEntry
  onClose: () => void
  onFlag: (id: string, reason: string) => void
  onUnflag: (id: string) => void
}) {
  const [flagReason, setFlagReason] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ta__detail" onClick={e => e.stopPropagation()} data-testid="ta-detail-modal">
        <div className="modal__header">
          <div className="ta__detail-title-row">
            <h2>ツール呼び出しの詳細</h2>
            {entry.risk_score > 0 && (
              <span className={`ta__detail-risk-badge ta__detail-risk-badge--${riskLevel(entry.risk_score)}`}>
                リスク {entry.risk_score}
              </span>
            )}
          </div>
          <button className="btn btn--ghost" onClick={onClose} data-testid="ta-detail-close-btn">&times;</button>
        </div>

        <div className="ta__detail-body">
          {/* Risk Assessment Section */}
          {(entry.risk_score > 0 || entry.risk_factors.length > 0) && (
            <div className={`ta__risk-assessment ta__risk-assessment--${riskLevel(entry.risk_score)}`}>
              <div className="ta__risk-assessment-header">
                <RiskIndicator score={entry.risk_score} />
                <div>
                  <div className="ta__risk-assessment-title">リスク評価</div>
                  <div className="ta__risk-assessment-level">{riskLabel(entry.risk_score)}</div>
                </div>
              </div>
              {entry.risk_factors.length > 0 && (
                <ul className="ta__risk-factors">
                  {entry.risk_factors.map((f, i) => (
                    <li key={i} className="ta__risk-factor">{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="ta__detail-meta">
            <MetaRow label="ツール" value={entry.tool} />
            <MetaRow label="モデル" value={entry.model || '--'} mono />
            <MetaRow label="カテゴリ" value={categoryLabel(entry.category)} badgeClass={`ta__badge--${entry.category}`} />
            <MetaRow label="状態" value={statusLabel(entry.status)} badgeClass={`ta__badge--${statusVariant(entry.status)}`} />
            {entry.interaction_type && <MetaRow label="対話タイプ" value={interactionLabel(entry.interaction_type)} badgeClass={`ta__badge--itl ta__badge--itl-${entry.interaction_type}`} />}
            <MetaRow label="呼び出し ID" value={entry.call_id || '--'} mono />
            <MetaRow label="セッション" value={entry.session_id} mono />
            <MetaRow label="タイムスタンプ" value={new Date(entry.timestamp * 1000).toLocaleString()} />
            <MetaRow label="実行時間" value={entry.duration_ms != null ? formatDuration(entry.duration_ms) : '--'} />
            {entry.flagged && <MetaRow label="フラグ理由" value={entry.flag_reason} flagged />}
          </div>

          <div className="ta__detail-section">
            <h3>引数</h3>
            <pre className="ta__code-block">{formatJson(entry.arguments)}</pre>
          </div>

          <div className="ta__detail-section">
            <h3>結果</h3>
            <pre className="ta__code-block">{formatJson(entry.result)}</pre>
          </div>

          <div className="ta__detail-actions">
            {entry.flagged ? (
              <button className="btn btn--sm btn--outline" onClick={() => { onUnflag(entry.id); onClose() }} data-testid="ta-detail-unflag-btn">
                フラグを解除
              </button>
            ) : (
              <div className="ta__flag-form-row">
                <input
                  className="input"
                  type="text"
                  placeholder="フラグ理由..."
                  value={flagReason}
                  onChange={e => setFlagReason(e.target.value)}
                  data-testid="ta-detail-flag-reason"
                />
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => { onFlag(entry.id, flagReason || '手動フラグ'); onClose() }}
                  data-testid="ta-detail-flag-btn"
                >
                  不審としてフラグ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function MetaRow({ label, value, flagged, mono, badgeClass }: {
  label: string; value: string; flagged?: boolean; mono?: boolean; badgeClass?: string
}) {
  return (
    <div className={`ta__meta-row ${flagged ? 'ta__meta-row--flagged' : ''}`}>
      <span className="ta__meta-label">{label}</span>
      {badgeClass ? (
        <span className={`ta__badge ${badgeClass}`}>{value}</span>
      ) : (
        <span className={`ta__meta-value ${mono ? 'ta__meta-value--mono' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="ta__skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ta__skeleton-row">
          <div className="ta__skeleton-cell ta__skeleton-cell--sm" />
          <div className="ta__skeleton-cell ta__skeleton-cell--md" />
          <div className="ta__skeleton-cell ta__skeleton-cell--sm" />
          <div className="ta__skeleton-cell ta__skeleton-cell--sm" />
          <div className="ta__skeleton-cell ta__skeleton-cell--xs" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="ta__empty" data-testid="ta-empty-state">
      <div className="ta__empty-icon">
        <svg width="64" height="64" viewBox="0 0 16 16" fill="currentColor" opacity="0.15">
          <path d="M6 2a2 2 0 00-2 2v8a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 1h4a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zm.5 2a.5.5 0 000 1h3a.5.5 0 000-1h-3zm0 2a.5.5 0 000 1h3a.5.5 0 000-1h-3zm0 2a.5.5 0 000 1h2a.5.5 0 000-1h-2z"/>
        </svg>
      </div>
      <p className="ta__empty-title">ツールアクティビティが見つかりません</p>
      <p className="ta__empty-hint">エージェントがアクションを実行するとここに表示されます。</p>
      <button className="btn btn--sm btn--outline ta__empty-btn" onClick={onImport} data-testid="ta-empty-import-btn">既存のセッションからインポート</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(ts: number): string {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString()
  }
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '--'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatBucketLabel(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatJson(raw: string): string {
  if (!raw) return '(なし)'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = { sdk: 'SDK', custom: 'Custom', mcp: 'MCP', skill: 'Skill' }
  return labels[cat] || cat
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    started: '開始',
    completed: '完了',
    denied: '拒否',
    error: 'エラー',
  }
  return labels[status] || status
}

function interactionLabel(itl: string): string {
  const labels: Record<string, string> = {
    hitl: 'HITL', aitl: 'AITL', pitl: 'PITL (試験的)',
    filter: 'Prompt Shields', deny: '拒否',
  }
  return labels[itl] || itl.toUpperCase()
}

function statusVariant(status: string): string {
  const map: Record<string, string> = { started: 'warn', completed: 'ok', denied: 'err', error: 'err' }
  return map[status] || 'default'
}

function riskLevel(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 70) return 'high'
  if (score >= 30) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

function riskLabel(score: number): string {
  if (score >= 70) return '高リスク'
  if (score >= 30) return '中リスク'
  if (score > 0) return '低リスク'
  return 'リスク検出なし'
}

function riskRowClass(score: number): string {
  if (score >= 70) return 'ta__row--risk-high'
  if (score >= 30) return 'ta__row--risk-medium'
  return ''
}
