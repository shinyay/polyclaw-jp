import { useState, useEffect } from 'react'

const DISCLAIMER_KEY = 'polyclaw_disclaimer_accepted'

export default function Disclaimer({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISCLAIMER_KEY)) onAccept()
  }, [onAccept])

  const accept = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1')
    onAccept()
  }

  return (
    <div className="disclaimer-overlay">
      <div className="disclaimer-card">
        <div className="disclaimer-card__icon-wrap">
          <svg className="disclaimer-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 className="disclaimer-card__title">技術デモンストレーター — リスクに関する免責事項</h2>
        <div className="disclaimer-card__body">
          <p><strong>本ソフトウェアは技術デモンストレーターであり、継続利用や本番運用を想定していません。</strong></p>
          <ul>
            <li><strong>高自律エージェント。</strong> 本システムは高い自律性と昇格された権限レベルで AI エージェントを展開します。事前確認なしに、コード実行・クラウドリソースの作成と削除・メッセージ送信・API アクセス・コードプッシュなど、重大な意思決定をユーザーに代わって行えます。</li>
            <li><strong>サンドボックス環境専用。</strong> サンドボックス用 Azure サブスクリプションと使い捨て GitHub アカウントに対してのみ実行してください。</li>
            <li><strong>損害発生の可能性。</strong> エージェントはリソースの削除、意図しないメッセージ送信、コードプッシュ、クラウド費用の発生、API クォータの枯渇、認証情報の漏洩など、破壊的または取り消し不可能な操作を行う可能性があります。</li>
            <li><strong>無保証。</strong> MIT ライセンスの下で「現状有姿」で提供され、いかなる保証もありません。</li>
          </ul>
        </div>
        <div className="disclaimer-card__footer">
          <label className="disclaimer-card__check">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
            <span>リスクを認識し、本ソフトウェアの使用と影響について全責任を負うことに同意します</span>
          </label>
          <button className="btn btn--primary disclaimer-card__btn" disabled={!checked} onClick={accept}>
            同意して続行
          </button>
        </div>
      </div>
    </div>
  )
}
