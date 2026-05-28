import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { showToast } from '../components/Toast'
import type { SetupStatus } from '../types'

type Step = 'azure' | 'foundry' | 'persona' | 'voice'

interface AzureSubscription {
  id: string
  name: string
  is_default: boolean
  state: string
}

interface ProfileResponse {
  name?: string
  emoji?: string
  preferences?: { voice?: string; [k: string]: unknown }
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'azure', label: 'Azure' },
  { key: 'foundry', label: 'Foundry' },
  { key: 'persona', label: '人格' },
  { key: 'voice', label: '音声' },
]

const PERSONA_PRESETS = [
  { value: 'オクト', emoji: '🐙', desc: '既定の人格' },
  { value: '八雲', emoji: '🌙', desc: '思索的で穏やか' },
  { value: '雷神', emoji: '⚡', desc: '機敏で力強い' },
  { value: 'ポリ', emoji: '🤖', desc: '実直で器用' },
] as const

const EMOJI_PRESETS = ['🐙', '🦊', '⚡', '🤖', '🌟', '🌙', '🔮', '🎯'] as const

const VOICE_OPTIONS = [
  { id: 'nova', label: 'nova', desc: '落ち着いた女性声' },
  { id: 'alloy', label: 'alloy', desc: '中性的でニュートラル' },
  { id: 'echo', label: 'echo', desc: '低音の男性声' },
] as const

export default function SetupWizard() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('azure')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const manualStepRef = useRef(false)

  const [azureDevice, setAzureDevice] = useState<{ code: string; url: string } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const azureDeviceRef = useRef(false)

  // Subscription picker state
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([])
  const [selectedSub, setSelectedSub] = useState('')

  // Persona step state
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [personaPreset, setPersonaPreset] = useState<string>('オクト')
  const [personaCustom, setPersonaCustom] = useState('')
  const [personaEmoji, setPersonaEmoji] = useState('🐙')

  // Voice step state
  const [voice, setVoice] = useState<string>('nova')

  const azureReady = !!status?.azure?.logged_in && !status?.azure?.needs_subscription
  const foundryReady = !!status?.foundry?.deployed
  const personaReady = !!profile?.name && profile.name !== 'polyclaw'
  const voiceReady = !!profile?.preferences?.voice

  const refresh = useCallback(async () => {
    try {
      const s = await api<SetupStatus>('setup/status')
      setStatus(s)

      // Load subscriptions when logged in but no default sub
      if (s.azure?.logged_in && s.azure?.needs_subscription) {
        const subs = await api<AzureSubscription[]>('setup/azure/subscriptions')
        setSubscriptions(subs)
        if (subs.length === 1) setSelectedSub(subs[0].id)
      }

      // Load profile (for persona / voice steps)
      try {
        const p = await api<ProfileResponse>('profile')
        setProfile(p)
        if (p?.name && p.name !== 'polyclaw') {
          const preset = PERSONA_PRESETS.find(x => x.value === p.name)
          if (preset) {
            setPersonaPreset(p.name)
            setPersonaEmoji(p.emoji || preset.emoji)
          } else {
            setPersonaPreset('カスタム')
            setPersonaCustom(p.name)
            setPersonaEmoji(p.emoji || '🐙')
          }
        }
        if (p?.preferences?.voice) setVoice(p.preferences.voice)
      } catch { /* profile fetch optional */ }

      if (!manualStepRef.current && !azureDeviceRef.current) {
        const azDone = !!s.azure?.logged_in && !s.azure?.needs_subscription
        const fDone = azDone && !!s.foundry?.deployed
        if (azDone && currentStep === 'azure') setCurrentStep('foundry')
        else if (fDone && currentStep === 'foundry') setCurrentStep('persona')
      }
    } catch { /* ignore */ }
  }, [currentStep])

  useEffect(() => { refresh() }, [refresh])

  const handleAzureLogin = async (force?: boolean) => {
    setLoading(p => ({ ...p, azure: true }))
    azureDeviceRef.current = true
    try {
      if (force) await api('setup/azure/logout', { method: 'POST' }).catch(() => {})
      const r = await api<{ status: string; code?: string; url?: string; message?: string }>('setup/azure/login', { method: 'POST' })
      if (r.status === 'already_logged_in') {
        showToast('Azure にはすでにサインイン済みです', 'success')
        azureDeviceRef.current = false
        await refresh()
      } else if (r.status === 'needs_subscription') {
        azureDeviceRef.current = false
        await refresh()
      } else if (r.code && r.url) {
        setAzureDevice({ code: r.code, url: r.url })
        setCountdown(3)
        let t = 3
        const iv = setInterval(() => {
          t -= 1
          setCountdown(t)
          if (t <= 0) { clearInterval(iv); setCountdown(null); window.open(r.url!, '_blank') }
        }, 1000)
        for (let i = 0; i < 120; i++) {
          await new Promise(res => setTimeout(res, 3000))
          const check = await api<{ status: string }>('setup/azure/check')
          if (check.status === 'logged_in' || check.status === 'needs_subscription') {
            showToast('Azure 認証が完了しました', 'success')
            setAzureDevice(null)
            azureDeviceRef.current = false
            break
          }
        }
        await refresh()
      } else {
        azureDeviceRef.current = false
        showToast(r.message || 'Azure サインインを開始しました', 'info')
      }
    } catch (e: any) {
      azureDeviceRef.current = false
      showToast(e.message, 'error')
    }
    setLoading(p => ({ ...p, azure: false }))
  }

  const handleSetSubscription = async () => {
    if (!selectedSub) return
    setLoading(p => ({ ...p, subscription: true }))
    try {
      await api('setup/azure/subscription', {
        method: 'POST',
        body: JSON.stringify({ subscription_id: selectedSub }),
      })
      const sub = subscriptions.find(s => s.id === selectedSub)
      showToast(`サブスクリプションを設定しました: ${sub?.name || selectedSub}`, 'success')
      setSubscriptions([])
      await refresh()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, subscription: false }))
  }

  const handleFoundryDeploy = async () => {
    setLoading(p => ({ ...p, foundry: true }))
    try {
      const r = await api<{ status: string; foundry_endpoint?: string; deployed_models?: string[]; error?: string }>('setup/foundry/deploy', {
        method: 'POST',
        body: JSON.stringify({ resource_group: 'polyclaw-rg', location: 'eastus' }),
      })
      if (r.status === 'ok') {
        showToast(`Foundry をデプロイしました: ${r.deployed_models?.join(', ') || 'モデル準備完了'}`, 'success')
      } else {
        showToast(r.error || 'デプロイに失敗しました', 'error')
      }
      await refresh()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, foundry: false }))
  }

  const handleSavePersona = async () => {
    const finalName = personaPreset === 'カスタム' ? personaCustom.trim() : personaPreset
    if (!finalName) {
      showToast('名前を入力してください', 'error')
      return
    }
    setLoading(p => ({ ...p, persona: true }))
    try {
      await api('profile', {
        method: 'POST',
        body: JSON.stringify({ name: finalName, emoji: personaEmoji }),
      })
      showToast(`人格を保存しました: ${finalName}`, 'success')
      await refresh()
      manualStepRef.current = false
      setCurrentStep('voice')
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, persona: false }))
  }

  const handleSaveVoice = async () => {
    setLoading(p => ({ ...p, voice: true }))
    try {
      const prevPrefs = profile?.preferences || {}
      await api('profile', {
        method: 'POST',
        body: JSON.stringify({ preferences: { ...prevPrefs, voice } }),
      })
      showToast(`音声を保存しました: ${voice}`, 'success')
      await refresh()
    } catch (e: any) { showToast(e.message, 'error') }
    setLoading(p => ({ ...p, voice: false }))
  }

  const setupDone = azureReady && foundryReady && personaReady && voiceReady

  return (
    <div className="page page--setup">
      <div className="setup">
        <div className="setup__header">
          <img src="/logo.png" alt="polyclaw" className="setup__logo" />
          <p>初期セットアップを完了してください。Azure サインインと Foundry デプロイが必須です。人格と音声は使用前に選択できます。</p>
        </div>

        <div className="setup__steps">
          {STEPS.map((step, i) => {
            const done =
              step.key === 'azure'   ? azureReady :
              step.key === 'foundry' ? foundryReady :
              step.key === 'persona' ? personaReady :
                                       voiceReady
            return (
              <button
                key={step.key}
                data-testid={`wizard-step-${step.key}`}
                className={`setup__step ${currentStep === step.key ? 'setup__step--active' : ''} ${done ? 'setup__step--done' : ''}`}
                onClick={() => { manualStepRef.current = true; setCurrentStep(step.key) }}
              >
                <span className="setup__step-num">{done ? '\u2713' : i + 1}</span>
                <span className="setup__step-label">{step.label}</span>
              </button>
            )
          })}
        </div>

        <div className="setup__content card">
          {currentStep === 'azure' && (
            <div className="setup__panel">
              <h2>Azure</h2>
              <p>Azure にサインインして、クラウドリソース管理とインフラのプロビジョニングを有効化します。</p>

              {/* Device code flow in progress */}
              {azureDevice ? (
                <div className="setup__device-code">
                  <p>以下のコードをコピーして、リンク先でサインインしてください:</p>
                  <div className="setup__code-display">
                    <span className="setup__code-value">{azureDevice.code}</span>
                    <button className="btn btn--secondary btn--sm setup__copy-btn" onClick={() => { navigator.clipboard.writeText(azureDevice.code); showToast('コードをコピーしました', 'success') }}>コピー</button>
                  </div>
                  {countdown !== null ? (
                    <p className="text-muted mt-2">{countdown} 秒後にブラウザを開きます...</p>
                  ) : (
                    <>
                      <a href={azureDevice.url} target="_blank" rel="noopener" className="setup__code-link">{azureDevice.url}</a>
                      <p className="text-muted mt-2">認証を待機しています...</p>
                    </>
                  )}
                </div>

              /* Logged in but needs subscription selection */
              ) : status?.azure?.logged_in && status.azure.needs_subscription ? (
                <div className="setup__panel">
                  <span className="badge badge--ok">認証済み</span>
                  <p className="text-muted mt-1">既定のサブスクリプションが設定されていません。使用する Azure サブスクリプションを選択してください:</p>
                  {subscriptions.length > 0 ? (
                    <>
                      <div className="setup__sub-list">
                        {subscriptions.map(sub => (
                          <label key={sub.id} className="setup__sub-option">
                            <input
                              type="radio"
                              name="subscription"
                              value={sub.id}
                              checked={selectedSub === sub.id}
                              onChange={() => setSelectedSub(sub.id)}
                            />
                            <div className="setup__sub-info">
                              <span className="setup__sub-name">{sub.name}</span>
                              <span className="setup__sub-id">{sub.id}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button
                        className="btn btn--primary mt-2"
                        onClick={handleSetSubscription}
                        disabled={!selectedSub || loading.subscription}
                      >
                        {loading.subscription ? '設定中...' : 'このサブスクリプションを使用'}
                      </button>
                    </>
                  ) : (
                    <p className="text-muted">サブスクリプションを読み込み中...</p>
                  )}
                </div>

              /* Fully authenticated with subscription */
              ) : azureReady ? (
                <div className="setup__done">
                  <span className="badge badge--ok">認証済み</span>
                  {status?.azure?.subscription && <p className="text-muted">サブスクリプション: {status.azure.subscription}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn--secondary" onClick={() => { manualStepRef.current = false; setCurrentStep('foundry') }}>次へ</button>
                    <button className="btn btn--outline" onClick={() => handleAzureLogin(true)} disabled={loading.azure}>
                      {loading.azure ? '開始中...' : '再認証'}
                    </button>
                  </div>
                </div>

              /* Not logged in */
              ) : (
                <button className="btn btn--primary" data-testid="wizard-azure-signin" onClick={() => handleAzureLogin()} disabled={loading.azure}>
                  {loading.azure ? '開始中...' : 'Azure CLI でサインイン'}
                </button>
              )}
            </div>
          )}

          {currentStep === 'foundry' && (
            <div className="setup__panel">
              <h2>Microsoft Foundry</h2>
              <p>Azure サブスクリプションに AI モデル (gpt-4.1, gpt-5, gpt-5-mini) を Bicep でデプロイします。シークレット管理用の Key Vault も同時に作成されます。</p>
              {foundryReady ? (
                <div className="setup__done">
                  <span className="badge badge--ok">デプロイ済み</span>
                  <p className="text-muted">エンドポイント: {status?.foundry?.endpoint}</p>
                  {status?.foundry?.name && <p className="text-muted">リソース: {status.foundry.name}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn--primary" onClick={() => { manualStepRef.current = false; setCurrentStep('persona') }}>次へ (人格設定)</button>
                    <button className="btn btn--outline" onClick={handleFoundryDeploy} disabled={loading.foundry}>
                      {loading.foundry ? 'デプロイ中...' : '再デプロイ'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button className="btn btn--primary" data-testid="wizard-foundry-deploy" onClick={handleFoundryDeploy} disabled={loading.foundry}>
                    {loading.foundry ? 'インフラをデプロイ中...' : 'Foundry インフラをデプロイ'}
                  </button>
                  <p className="text-muted mt-2">AI Services リソースとモデルデプロイ、および Key Vault を作成します。Entra ID 認証を使用します (API キー不要)。</p>
                </div>
              )}
            </div>
          )}
          {currentStep === 'persona' && (
            <div className="setup__panel" data-testid="wizard-persona-panel">
              <h2>人格を選ぶ</h2>
              <p>エージェントの名前と絵文字を選択してください。チャットや通知でこの名前と絵文字が使用されます。後で「プロフィール」設定からいつでも変更できます。</p>

              <div className="setup__persona-list">
                {PERSONA_PRESETS.map(preset => (
                  <label key={preset.value} className={`setup__persona-card ${personaPreset === preset.value ? 'setup__persona-card--active' : ''}`}>
                    <input
                      type="radio"
                      name="persona"
                      value={preset.value}
                      checked={personaPreset === preset.value}
                      onChange={() => { setPersonaPreset(preset.value); setPersonaEmoji(preset.emoji) }}
                      data-testid={`persona-radio-${preset.value}`}
                    />
                    <span className="setup__persona-emoji">{preset.emoji}</span>
                    <span className="setup__persona-name">{preset.value}</span>
                    <span className="setup__persona-desc">{preset.desc}</span>
                  </label>
                ))}
                <label className={`setup__persona-card ${personaPreset === 'カスタム' ? 'setup__persona-card--active' : ''}`}>
                  <input
                    type="radio"
                    name="persona"
                    value="カスタム"
                    checked={personaPreset === 'カスタム'}
                    onChange={() => setPersonaPreset('カスタム')}
                    data-testid="persona-radio-custom"
                  />
                  <span className="setup__persona-emoji">✏️</span>
                  <span className="setup__persona-name">カスタム名</span>
                  <span className="setup__persona-desc">任意の名前を入力</span>
                </label>
              </div>

              {personaPreset === 'カスタム' && (
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="エージェントの名前を入力"
                  value={personaCustom}
                  onChange={e => setPersonaCustom(e.target.value)}
                  data-testid="persona-custom-input"
                />
              )}

              <h3 className="mt-3">絵文字</h3>
              <p className="text-muted">下のプリセットから選ぶか、お好みの絵文字を 1 文字入力してください。</p>
              <div className="setup__emoji-row">
                {EMOJI_PRESETS.map((em, idx) => (
                  <button
                    key={em}
                    type="button"
                    className={`setup__emoji-btn ${personaEmoji === em ? 'setup__emoji-btn--active' : ''}`}
                    onClick={() => setPersonaEmoji(em)}
                    data-testid={`persona-emoji-preset-${idx}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="input mt-2"
                style={{ maxWidth: 120 }}
                maxLength={2}
                placeholder="絵文字"
                value={personaEmoji}
                onChange={e => setPersonaEmoji(e.target.value)}
                data-testid="persona-emoji-input"
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn--primary"
                  onClick={handleSavePersona}
                  disabled={loading.persona}
                  data-testid="wizard-save-persona"
                >
                  {loading.persona ? '保存中...' : '保存して次へ'}
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => { manualStepRef.current = false; setCurrentStep('voice') }}
                >
                  スキップ
                </button>
              </div>
            </div>
          )}

          {currentStep === 'voice' && (
            <div className="setup__panel" data-testid="wizard-voice-panel">
              <h2>音声を選ぶ</h2>
              <p>音声通話 (Azure Communication Services) で使用する声を選択してください。後で「インフラ」設定から変更できます。</p>

              <div className="setup__voice-list">
                {VOICE_OPTIONS.map(opt => (
                  <label key={opt.id} className={`setup__voice-card ${voice === opt.id ? 'setup__voice-card--active' : ''}`}>
                    <input
                      type="radio"
                      name="voice"
                      value={opt.id}
                      checked={voice === opt.id}
                      onChange={() => setVoice(opt.id)}
                      data-testid={`voice-card-${opt.id}`}
                    />
                    <span className="setup__voice-name">{opt.label}</span>
                    <span className="setup__voice-desc">{opt.desc}</span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled
                      title="試聴機能は準備中です"
                    >
                      試聴 (準備中)
                    </button>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn--primary"
                  onClick={handleSaveVoice}
                  disabled={loading.voice}
                  data-testid="wizard-save-voice"
                >
                  {loading.voice ? '保存中...' : '保存'}
                </button>
                <button
                  className="btn btn--outline"
                  onClick={() => navigate('/chat')}
                >
                  チャットへ移動
                </button>
              </div>
            </div>
          )}
        </div>

        {setupDone && (
          <div className="setup__complete">
            <p>セットアップが完了しました。チャネル、Bot サービス、その他の詳細設定は<button className="btn btn--link" onClick={() => navigate('/infrastructure')}>「インフラ」</button>から行えます。</p>
            <button className="btn btn--primary btn--lg" onClick={() => navigate('/chat')} data-testid="wizard-start-chat">チャットを始める</button>
          </div>
        )}
      </div>
    </div>
  )
}
