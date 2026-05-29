import { useState } from 'react'
import { Icon } from '@/components/common/Icons'
import type { Lang } from '@/i18n'
import { translate } from '@/i18n'
import type { Factory } from '@/config/factories'
import FactorySelectModal from './FactorySelectModal'

import lhgImg from '@/assets/factories/LHG.png'
import lyvImg from '@/assets/factories/LYV.png'
import lvlImg from '@/assets/factories/LVL.png'

const FACTORY_IMGS: Record<string, string> = {
  lhg: lhgImg,
  lyv: lyvImg,
  lvl: lvlImg,
}

// ─── Feature toggles ──────────────────────────────────────────────────────────
const SHOW_CAMERA_VISION   = true  // đổi thành false để ẩn mục Camera Vision
const SHOW_CUSTOMER_REPORT = false   // đổi thành false để ẩn mục Báo cáo khách hàng

export type ViewId = 'device' | 'vision' | 'customer'

const NAV_BASE: { id: ViewId; key: string; icon: () => JSX.Element; badge?: string }[] = [
  { id: 'device',   key: 'nav.device',   icon: Icon.device },
  { id: 'vision',   key: 'nav.vision',   icon: Icon.vision },
  { id: 'customer', key: 'nav.customer', icon: Icon.globe },
]
const NAV = NAV_BASE
  .filter(n => n.id !== 'vision'   || SHOW_CAMERA_VISION)
  .filter(n => n.id !== 'customer' || SHOW_CUSTOMER_REPORT)

interface SidebarProps {
  view: ViewId
  setView: (v: ViewId) => void
  collapsed: boolean
  setCollapsed: (c: boolean) => void
  lang: Lang
  onlineCount: number
  factory: Factory
  setFactory: (f: Factory) => void
  onMobileClose?: () => void
}

function FactorySwitcher({
  factory,
  setFactory,
}: {
  factory: Factory
  setFactory: (f: Factory) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="brand-factory-btn"
        onClick={() => setOpen(true)}
        title={`${factory.code} - Select Factory`}
      >
        <img
          src={FACTORY_IMGS[factory.id]}
          alt={factory.code}
          className="brand-factory-logo"
        />
      </button>

      {open && (
        <FactorySelectModal
          factory={factory}
          setFactory={setFactory}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// Thanh điều hướng bên trái với các mục: Giám sát thiết bị, Camera Vision, Khách hàng
// Nhận view hiện tại từ AppShell, gọi setView khi người dùng bấm để chuyển trang
export default function Sidebar({
  view,
  setView,
  collapsed,
  setCollapsed,
  lang,
  onlineCount,
  factory,
  setFactory,
  onMobileClose,
}: SidebarProps) {
  const tr = (k: string) => translate(lang, k)

  return (
    <aside className="sidebar">
      <div className="brand">
        <FactorySwitcher factory={factory} setFactory={setFactory} />
        <div className="brand-text">
          <div className="brand-name">
            {factory.code} Scan
            <br />
            Platform
          </div>
          <div className="brand-ver">INDUSTRIAL</div>
        </div>
        {onMobileClose
          ? <button className="nav-collapse-btn sidebar-close-btn" onClick={onMobileClose} title="Close"><Icon.x /></button>
          : <button className="nav-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>{Icon.collapse(!collapsed)}</button>
        }
      </div>

      <div className="nav-section-label">{tr('nav.operations')}</div>

      {NAV.map(n => {
        const NavIcon = n.icon
        return (
          <div
            key={n.id}
            className={`nav-item${view === n.id ? ' active' : ''}`}
            onClick={() => setView(n.id)}
            title={collapsed ? tr(n.key) : ''}
          >
            <NavIcon />
            <span>{tr(n.key)}</span>
            {n.badge && (
              <span className="nav-badge nav-badge--accent">
                {n.badge}
              </span>
            )}
          </div>
        )
      })}

      <div className="sidebar-footer">
        <div className="sys-status" data-tooltip={`${onlineCount} Online`}>
          <span className="dot" style={{ background: onlineCount > 0 ? '#10B981' : '#EF4444', boxShadow: onlineCount > 0 ? '0 0 8px #10B981' : 'none' }} />
          <span className="label sys-status-label">{onlineCount} Online</span>
          <span className="meta">v3.0</span>
        </div>
      </div>
    </aside>
  )
}