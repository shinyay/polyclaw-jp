import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { IconPlus, IconClock } from './Icons'
import type { Session } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SessionsPanel({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    if (open) {
      api<Session[]>('sessions').then(setSessions).catch(() => {})
    }
  }, [open])

  const goSession = (id: string) => {
    navigate(`/chat?session=${id}`)
    onClose()
  }

  return (
    <aside className={`panel ${open ? '' : 'panel--hidden'}`}>
      <div className="panel__header">
        <span className="panel__title">最近のセッション</span>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => { navigate('/chat'); onClose() }}
          title="新規チャット"
        >
          <IconPlus width={14} height={14} />
        </button>
      </div>
      <div className="panel__list">
        {sessions.length === 0 && (
          <p style={{ padding: '16px', fontSize: 12, color: 'var(--text-3)' }}>セッションはまだありません</p>
        )}
        {sessions.map(s => (
          <button
            key={s.id}
            className="panel__item"
            onClick={() => goSession(s.id)}
          >
            <span className="panel__item-preview">
              {s.title || '空のセッション'}
            </span>
            <span className="panel__item-meta">
              <span>{s.model}</span>
              <span>{formatTime(s.created_at)}</span>
              <span>{s.message_count} 件</span>
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => { navigate('/sessions'); onClose() }}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <IconClock width={14} height={14} />
          <span>すべてのセッション</span>
        </button>
      </div>
    </aside>
  )
}

function formatTime(ts: number | string): string {
  try {
    const d = typeof ts === 'number'
      ? new Date(ts < 1e12 ? ts * 1000 : ts)
      : new Date(ts)
    if (isNaN(d.getTime())) return String(ts)
    const now = Date.now()
    const diffS = Math.floor((now - d.getTime()) / 1000)
    if (diffS < 60) return 'たった今'
    const diffM = Math.floor(diffS / 60)
    if (diffM < 60) return `${diffM} 分前`
    const diffH = Math.floor(diffM / 60)
    if (diffH < 24) return `${diffH} 時間前`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD} 日前`
    return d.toLocaleDateString()
  } catch { return String(ts) }
}
