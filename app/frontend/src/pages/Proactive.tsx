import { useState, useEffect } from 'react'
import { api } from '../api'
import { showToast } from '../components/Toast'
import type { ProactiveState } from '../types'

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '未実行'
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 0) return 'たった今'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins} 分前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 時間 ${mins % 60} 分前`
  const days = Math.floor(hrs / 24)
  return `${days} 日前`
}

export function ProactiveContent() {
  const [state, setState] = useState<ProactiveState | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState({ minGap: 4, maxDaily: 3, preferredTimes: '', avoidedTopics: '' })
  const [forming, setForming] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await api<ProactiveState>('proactive')
      setState(s)
      if (s.preferences) {
        setPrefs({
          minGap: s.preferences.min_gap_hours ?? 4,
          maxDaily: s.preferences.max_daily ?? 3,
          preferredTimes: s.preferences.preferred_times || '',
          avoidedTopics: (s.preferences.avoided_topics || []).join(', '),
        })
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const forceMemory = async () => {
    setForming(true)
    try {
      const res = await api<{ status: string; message?: string }>('proactive/memory/form', { method: 'POST' })
      if (res.status === 'ok') showToast('メモリ生成が完了しました', 'success')
      else showToast(res.message || res.status, 'error')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
    setForming(false)
  }

  const toggleEnabled = async () => {
    try {
      await api('proactive/enabled', {
        method: 'PUT', body: JSON.stringify({ enabled: !state?.enabled }),
      })
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const cancelPending = async () => {
    try {
      await api('proactive/pending', { method: 'DELETE' })
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const savePrefs = async () => {
    try {
      await api('proactive/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          min_gap_hours: prefs.minGap,
          max_daily: prefs.maxDaily,
          preferred_times: prefs.preferredTimes,
          avoided_topics: prefs.avoidedTopics.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      showToast('設定を保存しました', 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  if (loading) return <div className="spinner" />
  if (!state) return <p className="text-muted">読み込みに失敗しました</p>

  return (
    <>
      <div className="page__header">
        <h1>プロアクティブ通信</h1>
        <button className="btn btn--ghost btn--sm" onClick={load} data-testid="proactive-refresh-btn">更新</button>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat__value">{state.messages_sent_today ?? 0}</span>
          <span className="stat__label">本日の送信数</span>
        </div>
        <div className="stat">
          <span className="stat__value">{state.hours_since_last_sent != null ? `${state.hours_since_last_sent.toFixed(1)} 時間前` : '未実行'}</span>
          <span className="stat__label">最終送信</span>
        </div>
        <div className="stat">
          <span className="stat__value">{state.conversation_refs ?? 0}</span>
          <span className="stat__label">チャネル数</span>
        </div>
      </div>

      {state.memory && (
        <div className="card">
          <h3>メモリエージェント</h3>
          <div className="stats-bar">
            <div className="stat">
              <span className="stat__value">{state.memory.forming_now ? '実行中' : '待機中'}</span>
              <span className="stat__label">状態</span>
            </div>
            <div className="stat">
              <span className="stat__value">{timeAgo(state.memory.last_formed_at)}</span>
              <span className="stat__label">最終実行</span>
            </div>
            <div className="stat">
              <span className="stat__value">{state.memory.formation_count}</span>
              <span className="stat__label">累計実行回数</span>
            </div>
            <div className="stat">
              <span className="stat__value">{state.memory.buffered_turns}</span>
              <span className="stat__label">バッファ中のターン数</span>
            </div>
          </div>
          <div style={{marginTop: 12, display: 'flex', alignItems: 'center', gap: 12}}>
            <button
              className="btn btn--primary btn--sm"
              onClick={forceMemory}
              disabled={forming || state.memory.forming_now || state.memory.buffered_turns === 0}
              data-testid="proactive-force-memory-btn"
            >
              {forming || state.memory.forming_now ? '生成中...' : '今すぐメモリを生成'}
            </button>
            {state.memory.buffered_turns === 0 && (
              <span className="text-muted text-sm">処理対象のターンがありません</span>
            )}
          </div>
          {state.memory.timer_active && (
            <p className="text-muted text-sm" style={{marginTop: 8}}>
              アイドルタイマー有効: {state.memory.idle_minutes} 分の非活性でメモリを生成します
            </p>
          )}
          {state.memory.last_error && (
            <p className="text-danger text-sm" style={{marginTop: 8}}>
              直前のエラー: {state.memory.last_error}
            </p>
          )}
          {state.memory.last_proactive_scheduled && (
            <p className="text-sm" style={{marginTop: 8, color: 'var(--gold)'}}>
              直前の実行でプロアクティブ通信が予約されました
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="card__row">
          <label className="form__check">
            <input type="checkbox" checked={state.enabled} onChange={toggleEnabled} data-testid="proactive-enabled-toggle" />
            プロアクティブ通信を有効にする
          </label>
        </div>
      </div>

      {state.pending && (
        <div className="card">
          <h3>保留中のフォローアップ</h3>
          <p><strong>送信予定日時:</strong> {new Date(state.pending.deliver_at).toLocaleString('ja-JP')}</p>
          <p><strong>メッセージ:</strong> {state.pending.message}</p>
          {state.pending.context && <p className="text-muted">{state.pending.context}</p>}
          <button className="btn btn--danger btn--sm" onClick={cancelPending} data-testid="proactive-cancel-pending-btn">キャンセル</button>
        </div>
      )}

      <div className="card">
        <h3>設定</h3>
        <div className="form">
          <div className="form__row">
            <div className="form__group">
              <label className="form__label">最小間隔 (時間)</label>
              <input type="number" className="input" value={prefs.minGap} onChange={e => setPrefs(p => ({ ...p, minGap: +e.target.value }))} data-testid="proactive-prefs-min-gap" />
            </div>
            <div className="form__group">
              <label className="form__label">1 日の最大送信数</label>
              <input type="number" className="input" value={prefs.maxDaily} onChange={e => setPrefs(p => ({ ...p, maxDaily: +e.target.value }))} data-testid="proactive-prefs-max-daily" />
            </div>
          </div>
          <div className="form__group">
            <label className="form__label">送信を推奨する時間帯</label>
            <input className="input" value={prefs.preferredTimes} onChange={e => setPrefs(p => ({ ...p, preferredTimes: e.target.value }))} placeholder="例: 9:00-12:00, 14:00-17:00" data-testid="proactive-prefs-preferred-times" />
          </div>
          <div className="form__group">
            <label className="form__label">避けるトピック (カンマ区切り)</label>
            <input className="input" value={prefs.avoidedTopics} onChange={e => setPrefs(p => ({ ...p, avoidedTopics: e.target.value }))} data-testid="proactive-prefs-avoided" />
          </div>
          <button className="btn btn--primary btn--sm" onClick={savePrefs} data-testid="proactive-save-prefs-btn">設定を保存</button>
        </div>
      </div>

      {state.history && state.history.length > 0 && (
        <div className="card">
          <h3>履歴</h3>
          <div className="list">
            {[...state.history].reverse().map((h, i) => (
              <div key={i} className="list-item">
                <div className="list-item__body">
                  <div className="list-item__top">
                    <span className="text-muted">{new Date(h.delivered_at).toLocaleString('ja-JP')}</span>
                    {h.reaction && <span className="badge">{h.reaction}</span>}
                  </div>
                  <div className="list-item__desc">{h.message}</div>
                  {h.context && <div className="text-muted text-sm">{h.context}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Proactive() {
  return <div className="page"><ProactiveContent /></div>
}
