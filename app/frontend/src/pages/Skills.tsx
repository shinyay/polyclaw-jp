import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { showToast } from '../components/Toast'
import Breadcrumb from '../components/Breadcrumb'
import type { Skill, MarketplaceSkill, MarketplaceResponse } from '../types'

/* ── Origin helpers ─────────────────────────────────────────────────── */

const ORIGIN_LABEL: Record<string, string> = {
  'built-in':      'ビルトイン',
  'marketplace':   'マーケットプレイス',
  'plugin':        'プラグイン',
  'agent-created': 'エージェント生成',
}

const ORIGIN_TOOLTIP: Record<string, string> = {
  'built-in':      'polyclaw に同梱されているスキルです',
  'marketplace':   'スキルマーケットプレイスからインストール済み',
  'plugin':        'プラグインの一部としてインストール済み',
  'agent-created': 'エージェントが作成したスキルです',
}

function originClass(origin: string) {
  return `origin-badge origin-badge--${origin}`
}

/** Strip "|" or whitespace-only descriptions */
function cleanDesc(d?: string) {
  if (!d) return ''
  const t = d.trim()
  return t === '|' ? '' : t
}

/* ── Icon helpers (ported from old app.js) ──────────────────────────── */

const ICON_COLORS = ['icon-blue', 'icon-green', 'icon-purple', 'icon-orange', 'icon-red', 'icon-teal', 'icon-pink']

function skillIconColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length]
}

function skillInitial(name: string) {
  const clean = name.replace(/[\u{1F000}-\u{1FFFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]|\uFE0F/gu, '').trim()
  return clean.charAt(0).toUpperCase()
}

function skillSourceLabel(skill: MarketplaceSkill) {
  if (skill.origin === 'agent-created') return 'エージェント生成'
  if (skill.origin === 'built-in') return 'ビルトイン'
  if (skill.origin === 'plugin') return 'プラグイン'
  if (skill.origin === 'marketplace') return 'マーケットプレイス'
  if (skill.category === 'github-awesome') return 'GitHub Awesome'
  if (skill.category === 'anthropic') return 'Anthropic'
  if (skill.source) return skill.source
  if (skill.installed) return 'ローカル'
  return 'コミュニティ'
}

/* ── Filter types ───────────────────────────────────────────────────── */

type SkillFilter = 'all' | 'installed' | 'available' | 'recommended' | 'github-awesome' | 'anthropic'

const FILTER_LABELS: Record<SkillFilter, string> = {
  'all':            'すべて',
  'installed':      'インストール済み',
  'available':      '未インストール',
  'recommended':    'おすすめ',
  'github-awesome': 'GitHub Awesome',
  'anthropic':      'Anthropic',
}

/* ── Contribute modal types ─────────────────────────────────────────── */

interface ContributeFile {
  path: string
  content: string
  github_url: string
}

interface ContributeData {
  skill_name: string
  files: ContributeFile[]
}

/* ── Store Card sub-component ───────────────────────────────────────── */

function StoreCard({ skill, onInstall }: { skill: MarketplaceSkill; onInstall: (name: string) => void }) {
  const desc = cleanDesc(skill.description) || '説明はありません'
  const originColor = skill.origin ? `store-card-origin-${skill.origin}` : ''

  return (
    <div className={`store-card${skill.installed ? ' installed' : ''}`} data-testid={`store-card-${skill.name}`}>
      <div className="store-card-top">
        <div className={`store-card-icon ${skillIconColor(skill.name)}`}>
          {skillInitial(skill.name)}
        </div>
        <div className="store-card-info">
          <div className="store-card-name">{skill.name}</div>
          <div className={`store-card-source ${originColor}`}>{skillSourceLabel(skill)}</div>
        </div>
      </div>

      {skill.installed && (
        <span className="store-card-badge badge-installed">インストール済み</span>
      )}
      {!skill.installed && skill.recommended && (
        <span className="store-card-badge badge-recommended">おすすめ</span>
      )}

      <div className="store-card-desc">{desc}</div>

      <div className="store-card-footer">
        <div className="store-card-stats">
          {(skill.usage_count ?? 0) > 0 && (
            <span className="store-card-stat">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm0 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM6.5 5l5 3-5 3V5z"/></svg>
              {' '}{skill.usage_count}
            </span>
          )}
          {(skill.edit_count ?? 0) > 0 && (
            <span className="store-card-stat">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.1a.25.25 0 00-.064.108l-.563 1.97 1.971-.564a.25.25 0 00.108-.064l8.609-8.61a.25.25 0 000-.353l-1.097-1.097z"/></svg>
              {' '}{skill.edit_count}
            </span>
          )}
        </div>
        {skill.installed ? (
          <button className="store-card-btn btn-installed">インストール済み</button>
        ) : (
          <button className="store-card-btn btn-get" onClick={(e) => { e.stopPropagation(); onInstall(skill.name) }} data-testid={`store-card-install-${skill.name}`}>入手</button>
        )}
      </div>
    </div>
  )
}

/* ── Store Section sub-component ────────────────────────────────────── */

function StoreSection({ title, subtitle, skills, horizontal, onInstall }: {
  title: string
  subtitle: string
  skills: MarketplaceSkill[]
  horizontal: boolean
  onInstall: (name: string) => void
}) {
  if (!skills.length) return null
  return (
    <div className="store-section">
      <div className="store-section-header">
        <div className="store-section-title">{title}</div>
        <div className="store-section-subtitle">{subtitle}</div>
      </div>
      <div className={horizontal ? 'store-row' : 'store-grid'}>
        {skills.map(skill => <StoreCard key={skill.name} skill={skill} onInstall={onInstall} />)}
      </div>
    </div>
  )
}

/* ── Featured Banner sub-component ──────────────────────────────────── */

function FeaturedBanner({ skill, onInstall }: { skill: MarketplaceSkill | undefined; onInstall: (name: string) => void }) {
  if (!skill) return null
  const parts: string[] = []
  if ((skill.edit_count ?? 0) > 0) parts.push(`${skill.edit_count} リビジョン`)
  if ((skill.usage_count ?? 0) > 0) parts.push(`${skill.usage_count} 回利用`)
  parts.push(skillSourceLabel(skill))

  return (
    <div className="store-featured">
      <div className="store-featured-label">おすすめスキル</div>
      <div className="store-featured-name">{skill.name}</div>
      <div className="store-featured-desc">{cleanDesc(skill.description) || 'エージェントを強化するスキルです。'}</div>
      <div className="store-featured-row">
        <button className="store-featured-btn" onClick={() => onInstall(skill.name)}>入手</button>
        <span className="store-featured-meta">{parts.join('  \u00B7  ')}</span>
      </div>
    </div>
  )
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function Skills() {
  const [installed, setInstalled] = useState<Skill[]>([])
  const [marketplaceData, setMarketplaceData] = useState<MarketplaceResponse | null>(null)
  const [tab, setTab] = useState<'installed' | 'marketplace'>('installed')
  const [loading, setLoading] = useState(true)
  const [contributing, setContributing] = useState<string | null>(null)
  const [contributeData, setContributeData] = useState<ContributeData | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SkillFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        api<{ skills: Skill[] }>('skills'),
        api<MarketplaceResponse>('skills/marketplace'),
      ])
      setInstalled(r1.skills || [])
      setMarketplaceData(r2)
      if (r2.rate_limit_warning) {
        showToast(r2.rate_limit_warning, 'error')
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const installSkill = async (name: string) => {
    try {
      await api('skills/install', { method: 'POST', body: JSON.stringify({ name }) })
      showToast(`スキル「${name}」をインストールしました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const removeSkill = async (name: string) => {
    if (!confirm(`スキル「${name}」を削除しますか？`)) return
    try {
      await api(`skills/${name}`, { method: 'DELETE' })
      showToast(`スキルを削除しました`, 'success')
      load()
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const contributeSkill = async (name: string) => {
    setContributing(name)
    try {
      const r = await api<ContributeData & { status: string; message?: string }>(
        'skills/contribute',
        { method: 'POST', body: JSON.stringify({ skill_id: name }) },
      )
      if (r.status === 'ok') {
        setContributeData(r)
      } else {
        showToast(r.message || '貢献処理に失敗しました', 'error')
      }
    } catch (e: any) {
      showToast('貢献処理の準備に失敗しました: ' + e.message, 'error')
    }
    setContributing(null)
  }

  const copyAndOpen = async (content: string, url: string, btnEl: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(content)
      btnEl.textContent = 'コピー済み!'
      setTimeout(() => window.open(url, '_blank'), 300)
      setTimeout(() => { btnEl.textContent = 'コピーして GitHub を開く' }, 2000)
    } catch {
      showToast('クリップボードへのコピーに失敗しました', 'error')
    }
  }

  /* Compute filtered marketplace skills for search/filter mode */
  const isSearching = search || filter !== 'all'
  const filteredSkills = (() => {
    if (!marketplaceData) return []
    let items = marketplaceData.all || []
    if (filter === 'installed') items = items.filter(s => s.installed)
    else if (filter === 'available') items = items.filter(s => !s.installed)
    else if (filter === 'recommended') items = items.filter(s => s.recommended)
    else if (filter === 'github-awesome') items = items.filter(s => s.category === 'github-awesome')
    else if (filter === 'anthropic') items = items.filter(s => s.category === 'anthropic')
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
    }
    return items
  })()

  const featuredSkill = (marketplaceData?.recommended || []).find(s => !s.installed)

  return (
    <div className="page">
      <Breadcrumb current="スキル" parentPath="/customization" parentLabel="カスタマイズ" />
      <div className="page__header">
        <h1>スキル</h1>
        <button className="btn btn--ghost btn--sm" onClick={load} data-testid="skills-refresh-btn">更新</button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'installed' ? 'tab--active' : ''}`} onClick={() => setTab('installed')} data-testid="skills-tab-installed">
          インストール済み ({installed.filter(s => s.installed).length})
        </button>
        <button className={`tab ${tab === 'marketplace' ? 'tab--active' : ''}`} onClick={() => setTab('marketplace')} data-testid="skills-tab-marketplace">
          マーケットプレイス
        </button>
      </div>

      {loading && <div className="spinner" />}

      {/* ── Installed tab ────────────────────────────────────────────── */}
      {tab === 'installed' && !loading && (
        <div className="grid grid--cards">
          {installed.filter(s => s.installed).map(skill => {
            const origin = skill.origin || 'built-in'
            const desc = cleanDesc(skill.description)
            return (
              <div key={skill.name} className={`skill-card card skill-card--${origin}`} data-testid={`skill-card-${skill.name}`}>
                <div className="skill-card__header">
                  <span className="skill-card__verb badge badge--accent">/{skill.verb}</span>
                  <h3>{skill.name}</h3>
                  <span className={originClass(origin)} title={ORIGIN_TOOLTIP[origin] || ''}>
                    {ORIGIN_LABEL[origin] || origin}
                  </span>
                </div>
                {desc && <p className="skill-card__desc">{desc}</p>}
                <div className="skill-card__footer">
                  <span className="text-muted">{skill.source}</span>
                  <div className="skill-card__actions">
                    {origin === 'agent-created' && (
                      <button
                        className="btn btn--outline btn--sm"
                        disabled={contributing === skill.name}
                        onClick={() => contributeSkill(skill.name)}
                        data-testid={`skill-contribute-${skill.name}`}
                      >
                        {contributing === skill.name ? '読み込み中...' : '貢献する'}
                      </button>
                    )}
                    {!skill.builtin && (
                      <button className="btn btn--danger btn--sm" onClick={() => removeSkill(skill.name)} data-testid={`skill-remove-${skill.name}`}>削除</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {installed.filter(s => s.installed).length === 0 && <p className="text-muted" data-testid="skills-empty-state">インストール済みのスキルはありません</p>}
        </div>
      )}

      {/* ── Marketplace tab ──────────────────────────────────────────── */}
      {tab === 'marketplace' && !loading && marketplaceData && (
        <>
          {/* Search bar */}
          <div className="store-search">
            <span className="store-search-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z"/></svg>
            </span>
            <input
              type="text"
              placeholder="スキルを検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="skills-search-input"
            />
          </div>

          {/* Category pills */}
          <div className="store-pills">
            {(Object.keys(FILTER_LABELS) as SkillFilter[]).map(f => (
              <button
                key={f}
                className={`store-pill${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
                data-testid={`skills-filter-${f}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Filtered/search view */}
          {isSearching && (
            <>
              {filteredSkills.length === 0 && <p className="store-empty">条件に一致するスキルはありません。</p>}
              <div className="store-grid">
                {filteredSkills.map(skill => (
                  <StoreCard key={skill.name} skill={skill} onInstall={installSkill} />
                ))}
              </div>
            </>
          )}

          {/* Marketplace sections view (no search/filter active) */}
          {!isSearching && (
            <div className="store-marketplace">
              <FeaturedBanner skill={featuredSkill} onInstall={installSkill} />

              <StoreSection
                title="おすすめ"
                subtitle="エージェントを強化するキュレーション済みスキル"
                skills={marketplaceData.recommended || []}
                horizontal
                onInstall={installSkill}
              />

              <StoreSection
                title="よく使うスキル"
                subtitle="最も頻繁に使用されているスキル"
                skills={marketplaceData.loved || []}
                horizontal
                onInstall={installSkill}
              />

              <StoreSection
                title="トレンド"
                subtitle="最も活発に更新されているスキル"
                skills={marketplaceData.popular || []}
                horizontal
                onInstall={installSkill}
              />

              <StoreSection
                title="GitHub Awesome Copilot"
                subtitle="github/awesome-copilot からのコミュニティキュレーション"
                skills={marketplaceData.github_awesome || []}
                horizontal={false}
                onInstall={installSkill}
              />

              <StoreSection
                title="Anthropic スキル"
                subtitle="Anthropic 公式スキル"
                skills={marketplaceData.anthropic || []}
                horizontal={false}
                onInstall={installSkill}
              />

              {!(marketplaceData.recommended?.length || marketplaceData.loved?.length ||
                 marketplaceData.popular?.length || marketplaceData.github_awesome?.length ||
                 marketplaceData.anthropic?.length) && (
                <p className="store-empty">スキルが見つかりません。ネットワーク接続または Foundry エンドポイント設定を確認してください。</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Contribute modal ─────────────────────────────────────────── */}
      {contributeData && (
        <div className="modal-overlay" onClick={() => setContributeData(null)}>
          <div className="modal contribute-modal" onClick={e => e.stopPropagation()} data-testid="skill-contribute-modal">
            <div className="modal__header">
              <h2>貢献: {contributeData.skill_name}</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setContributeData(null)}>閉じる</button>
            </div>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              GitHub でリポジトリを Fork し、以下の各ファイルを作成してください。ファイルをクリックすると内容をコピーして GitHub を開きます。
            </p>
            {contributeData.files.map(file => (
              <div key={file.path} className="contribute-file">
                <div className="contribute-file__header">
                  <code className="contribute-file__path">{file.path}</code>
                  <button
                    className="btn btn--outline btn--sm"
                    onClick={e => copyAndOpen(file.content, file.github_url, e.currentTarget)}
                  >
                    コピーして GitHub を開く
                  </button>
                </div>
                <pre className="contribute-file__content"><code>{file.content}</code></pre>
              </div>
            ))}
            <div className="contribute-steps">
              <strong>手順:</strong><br />
              1. まだの場合は GitHub でリポジトリを Fork してください<br />
              2. 各ファイルの<em>「コピーして GitHub を開く」</em>をクリック<br />
              3. 内容を GitHub エディタに貼り付けてコミット<br />
              4. Fork から Pull Request を作成
            </div>
            <div className="modal__footer">
              <button className="btn btn--primary btn--sm" onClick={() => setContributeData(null)}>完了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
