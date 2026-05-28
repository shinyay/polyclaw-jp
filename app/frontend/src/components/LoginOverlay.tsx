import { useState } from 'react'

interface Props {
  onLogin: (secret: string) => void
}

export default function LoginOverlay({ onLogin }: Props) {
  const [secret, setSecret] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (secret.trim()) onLogin(secret.trim())
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <img src="/logo.png" alt="polyclaw" className="login-card__logo" />
        <p className="login-card__subtitle">続行するには管理者シークレットを入力してください</p>
        <form onSubmit={handleSubmit} className="login-card__form">
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="管理者シークレット"
            className="input"
            autoFocus
            data-testid="login-input-secret"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!secret.trim()}
            data-testid="login-button-submit"
          >
            サインイン
          </button>
        </form>
      </div>
    </div>
  )
}
