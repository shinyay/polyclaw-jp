import { NavLink } from 'react-router-dom'
import type { SetupStatus } from '../types'

interface Props {
  status: SetupStatus | null
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { to: '/chat', icon: '💬', label: 'チャット' },
  { to: '/sessions', icon: '📋', label: 'セッション' },
  { to: '/skills', icon: '⚡', label: 'スキル' },
  { to: '/plugins', icon: '🧩', label: 'プラグイン' },
  { to: '/mcp', icon: '🔌', label: 'MCP サーバー' },
  { to: '/schedules', icon: '📅', label: 'スケジュール' },
  { to: '/profile', icon: '👤', label: 'プロファイル' },
  { to: '/messaging', icon: '✉️', label: 'AI モデル' },
  { to: '/infrastructure', icon: '🏗️', label: 'インフラ' },
  { to: '/guardrails', icon: '🛡️', label: 'ハードニング' },
  { to: '/tool-activity', icon: '🔍', label: 'ツールアクティビティ' },
]

export default function Sidebar({ status, collapsed, onToggle }: Props) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          title={collapsed ? '展開' : '折りたたみ'}
          data-testid="sidebar-toggle"
        >
          {collapsed ? '▸' : '◂'}
        </button>
        {!collapsed && (
          <div className="sidebar__brand">
            <img src="/static/logo.png" alt="Polyclaw" className="sidebar__logo" onError={e => (e.currentTarget.style.display = 'none')} />
            <span className="sidebar__title">Polyclaw</span>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
            title={item.label}
            data-testid={`sidebar-link-${item.to.slice(1)}`}
          >
            <span className="sidebar__icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && status && (
        <div className="sidebar__status">
          <StatusDot ok={status.azure?.logged_in} label="Azure" />
          <StatusDot ok={status.foundry?.deployed} label="Foundry" />
          <StatusDot ok={status.tunnel?.active} label="トンネル" />
          <StatusDot ok={status.bot_configured} label="ボット" />
        </div>
      )}
    </aside>
  )
}

function StatusDot({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="status-dot" title={`${label}: ${ok ? '正常' : '未設定'}`}>
      <span className={`status-dot__indicator ${ok ? 'status-dot__indicator--ok' : 'status-dot__indicator--err'}`} />
      <span className="status-dot__label">{label}</span>
    </div>
  )
}
