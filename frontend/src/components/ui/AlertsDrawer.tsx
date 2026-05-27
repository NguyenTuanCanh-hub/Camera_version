import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/common/Icons'

export interface AlertItem {
  sev: string
  t: string
  title: string
  msg: string
}

// Ngăn kéo cảnh báo trượt ra từ phải, liệt kê các thiết bị mất kết nối hoặc chậm
// Nhận danh sách alerts tính từ AppShell (dựa trên kết quả ping), cho phép lọc theo mức nghiêm trọng
export default function AlertsDrawer({ alerts, onClose }: { alerts: AlertItem[]; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warn'>('all')

  const visibleAlerts = useMemo(() => {
    if (filter === 'all') return alerts
    return alerts.filter(a => a.sev === filter)
  }, [alerts, filter])

  const criticalCount = alerts.filter(a => a.sev === 'critical').length
  const warnCount = alerts.filter(a => a.sev === 'warn').length

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" style={{ width: 380 }}>
        <div className="drawer-head">
          <div className="row">
            <Icon.bell />
            <span className="alert-drawer-title">Cảnh báo hệ thống</span>
            <span className="chip alert-drawer-count">{alerts.length}</span>
            <button className="icon-btn ml-auto" onClick={onClose}><Icon.x /></button>
          </div>
          <div className="row gap-2 alert-drawer-filters">
            <span className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')} style={{ cursor: 'pointer' }}>Tất cả</span>
            <span className={`chip${filter === 'critical' ? ' active' : ''}`} onClick={() => setFilter('critical')} style={{ cursor: 'pointer' }}>Nghiêm trọng ({criticalCount})</span>
            <span className={`chip${filter === 'warn' ? ' active' : ''}`} onClick={() => setFilter('warn')} style={{ cursor: 'pointer' }}>Cảnh báo ({warnCount})</span>
          </div>
        </div>
        <div className="drawer-body scroll alert-drawer-body">
          {visibleAlerts.length === 0 ? (
            <div className="alert-empty">
              KHÔNG CÓ CẢNH BÁO HOẠT ĐỘNG
            </div>
          ) : (
            visibleAlerts.map((a, i) => (
              <div key={i} className="alert-row">
                <div className="row">
                  <span className={`badge ${a.sev === 'critical' ? 'bad' : a.sev === 'warn' ? 'warn' : 'good'}`}>
                    {a.sev === 'critical' ? 'NGHIÊM TRỌNG' : a.sev === 'warn' ? 'CẢNH BÁO' : 'THÔNG TIN'}
                  </span>
                  <span className="ml-auto mono dim alert-time">{a.t}</span>
                </div>
                <div className="alert-title">{a.title}</div>
                <div className="dim alert-msg">{a.msg}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
