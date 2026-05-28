import { useNavigate } from 'react-router-dom'
import { IconZap, IconPackage, IconServer, IconCalendar } from '../components/Icons'

const ITEMS = [
  { path: '/skills', label: 'スキル', desc: 'インストール済みスキルの管理とマーケットプレイスの閲覧を行います', Icon: IconZap },
  { path: '/plugins', label: 'プラグイン', desc: 'エージェントプラグインの有効化、無効化、取り込みを行います', Icon: IconPackage },
  { path: '/mcp', label: 'MCP サーバー', desc: 'Model Context Protocol サーバーを設定します', Icon: IconServer },
  { path: '/schedules', label: 'スケジュール', desc: '繰り返し実行される自動タスクを設定します', Icon: IconCalendar },
] as const

export default function Customization() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <div className="page__header">
        <h1>カスタマイズ</h1>
      </div>

      <div className="grid">
        {ITEMS.map(({ path, label, desc, Icon }) => (
          <button
            key={path}
            className="card"
            style={{ cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate(path)}
            data-testid={`customization-card-${path.slice(1)}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Icon width={20} height={20} style={{ color: 'var(--gold)' }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
            </div>
            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
