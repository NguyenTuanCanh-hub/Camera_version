import { useState } from 'react'
import { Icon } from '@/components/common/Icons'
import CountUp from '@/components/common/CountUp'
import { LANGS, translate, type Lang } from '@/i18n'
import type { ViewId } from './Sidebar'

interface TopbarProps {
  view: ViewId
  lang: Lang
  setLang: (l: Lang) => void
  onOpenAlerts: () => void
  alertCount: number
  onlineCount: number
  totalDevices: number
  onMenuClick?: () => void
}

// Thanh tiêu đề trên cùng: hiển thị tên trang, số thiết bị online, số cảnh báo, nút đổi ngôn ngữ
// Nhận dữ liệu từ AppShell, gọi onOpenAlerts để mở drawer cảnh báo khi bấm chuông
export default function Topbar({
  view,
  lang,
  setLang,
  onOpenAlerts,
  alertCount,
  onlineCount,
  totalDevices,
  onMenuClick,
}: TopbarProps) {
  const [langOpen, setLangOpen] = useState(false)
  const tr = (k: string) => translate(lang, k)
  const curLang = LANGS.find(l => l.id === lang)!

  return (
    <header className="topbar">
      <button className="icon-btn hamburger-btn" onClick={onMenuClick} title="Menu">
        <Icon.menu />
      </button>

      <div className="title-block">
        <div className="title">{tr(`page.${view}.title`)}</div>
        <div className="subtitle">{tr(`page.${view}.sub`)}</div>
      </div>

      {view !== 'customer' && (
        <div className="health-strip">
          <div className="health-cell">
            <span className="k">{tr('top.devices')}</span>
            <span className={`v ${onlineCount === totalDevices && totalDevices > 0 ? 'good' : onlineCount > 0 ? 'warn' : 'bad'}`}>
              <CountUp value={onlineCount} fmt={n => `${Math.round(n)} / ${totalDevices}`} />
            </span>
          </div>

          <div className="health-cell">
            <span className="k">{tr('top.alerts')}</span>
            <span className={`v ${alertCount > 0 ? 'bad' : 'good'}`}>
              <CountUp value={alertCount} />
            </span>
          </div>
        </div>
      )}

      <div className="topbar-actions">
        {/* Language picker */}
        <div className="lang-picker-wrap">
          <button
            className="icon-btn lang-btn lang-btn--wide"
            onClick={() => setLangOpen(o => !o)}
          >
            <Icon.globe />
            <span className="mono lang-short">{curLang.short}</span>
            <Icon.chevD />
          </button>

          {langOpen && (
            <div className="lang-menu">
              {LANGS.map(l => (
                <button
                  key={l.id}
                  className={`lang-opt${l.id === lang ? ' active' : ''}`}
                  onClick={() => { setLang(l.id); setLangOpen(false) }}
                >
                  <span className="mono lang-opt-short">{l.short}</span>
                  <span className="lang-opt-label">{l.label}</span>
                  {l.id === lang && <Icon.check />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn" title={tr('top.alerts')} onClick={onOpenAlerts}>
          <Icon.bell />
          {alertCount > 0 && <span className="badge-dot" />}
        </button>
      </div>
    </header>
  )
}