import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Sidebar, { type ViewId } from './Sidebar'
import Topbar from './Topbar'
import ToastRail from '@/components/common/ToastRail'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import type { Lang } from '@/i18n'
import AlertsDrawer from '@/components/ui/AlertsDrawer'
import ExportModal, { type ExportCtx } from '@/components/ui/ExportModal'
import { FACTORIES, setFactoryId, type Factory } from '@/config/factories'
import lyImg from '@/assets/factories/LY.png'

// Pages
import DeviceMonitorPage, { type DeviceStatus, type PingStatus, type DeviceInfo } from '@/pages/DeviceMonitorPage'
import VisionReportPage from '@/pages/VisionReportPage'
import CustomerReportPage from '@/pages/CustomerReportPage'

// Subtle particles
function Particles() {
  const dots = useMemo(() => Array.from({ length: 28 }, _ => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 2, dur: 6 + Math.random() * 12,
    delay: -Math.random() * 8, op: 0.18 + Math.random() * 0.32,
  })), [])
  return (
    <svg style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.size / 8} fill={i % 3 === 0 ? '#8B5CF6' : '#00D9FF'} opacity={d.op}>
          <animate attributeName="cy" values={`${d.y};${(d.y + 6) % 100};${d.y}`} dur={`${d.dur}s`} begin={`${d.delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`${d.op};${d.op * 0.2};${d.op}`} dur={`${d.dur}s`} begin={`${d.delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

// ─── Root shell ───────────────────────────────────────────────────────────────
// Khung chứa toàn bộ ứng dụng: sidebar, topbar, nội dung trang, toast, drawer cảnh báo
// Quản lý trạng thái chuyển trang, ping thiết bị định kỳ, thông báo mất kết nối, và xuất báo cáo
export default function AppShell() {
  const dispatch = useAppDispatch()
  const [view, setView] = useState<ViewId>('device')
  const uploadBusyRef = useRef(false)
  const switchView = (v: ViewId) => {
    if (uploadBusyRef.current && !window.confirm('File đang được upload, rời trang sẽ hủy quá trình. Tiếp tục?')) return
    uploadBusyRef.current = false
    setView(v); setMobileSidebarOpen(false)
  }
  const [factory, setFactory] = useState<Factory>(
    () => FACTORIES.find(f => f.id === (localStorage.getItem('cb_factory') ?? 'lhg')) ?? FACTORIES[0]
  )
  const [lang, setLang] = useState<Lang>((localStorage.getItem('cb_lang') as Lang) ?? 'en')
  const [collapsed, setCollapsed] = useState(localStorage.getItem('cb_nav_collapsed') === '1')
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [exportCtx, setExportCtx] = useState<ExportCtx | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // JS fallback: auto-collapse sidebar on tablet/mobile, close overlay on larger screens
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      if (w < 1200) setCollapsed(true)
      if (w >= 768) setMobileSidebarOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Telemetry States
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [pinging, setPinging] = useState(false)
  const [loading, setLoading] = useState(true)
  const pingingRef = useRef(false)
  const ipsRef     = useRef<string[]>([])
  const prevStatusesRef = useRef<Map<string, PingStatus>>(new Map())


  const onlineCount = devices.filter(d => d.status === 'online').length


  const doPing = useCallback(async (ips: string[]) => {
    if (pingingRef.current || !ips.length) return
    pingingRef.current = true
    setPinging(true)
    try {
      const res = await fetch(`/api/vision/ping/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips }),
      })
      if (!res.ok) throw new Error()
      const results = await res.json() as Array<{ ip: string; alive: boolean; time: number }>
      const map = new Map(results.map(r => [r.ip, r]))
      
      setDevices(prev => prev.map(d => {
        const r = map.get(d.ip)
        if (!r) return d
        const newLatency = r.alive ? r.time : 0
        const prevHistory = d.latencyHistory || []
        const history = [...prevHistory, newLatency].slice(-15)
        const newStatus = r.alive ? 'online' : ('offline' as PingStatus)

        // Reactive live toast notifications
        const prevStatus = prevStatusesRef.current.get(d.ip)
        if (prevStatus && prevStatus !== 'pending' && prevStatus !== newStatus) {
          if (newStatus === 'offline') {
            dispatch(addToast({ type: 'warning', title: `Line ${d.line} disconnected`, message: `Heartbeat lost on IP ${d.ip}` }))
          } else if (newStatus === 'online') {
            dispatch(addToast({ type: 'success', title: `Line ${d.line} recovered`, message: `IP ${d.ip} online · ${newLatency}ms latency` }))
          }
        }
        prevStatusesRef.current.set(d.ip, newStatus)

        return { 
          ...d, 
          status: newStatus, 
          latency: newLatency,
          latencyHistory: history
        }
      }))
    } catch { /* ignore */ } finally {
      pingingRef.current = false
      setPinging(false)
    }
  }, [dispatch])

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && ipsRef.current.length) doPing(ipsRef.current)
    }, 30000)
    return () => clearInterval(id)
  }, [doPing])


  // Compute Alerts based on active telemetry states
  const alerts = useMemo(() => {
    const offlineDevices = devices.filter(d => d.status === 'offline')
    const offlineAlerts = offlineDevices.map(d => {
      const lastOnlineTime = d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString('vi-VN') : '00:00:00'
      return {
        sev: 'critical',
        t: lastOnlineTime,
        title: `Dây chuyền ${d.line} mất kết nối`,
        msg: `Mất tín hiệu kết nối (Heartbeat lost) trong giờ sản xuất. IP: ${d.ip}.`
      }
    })

    const slowDevices = devices.filter(d => d.status === 'online' && d.latency > 150)
    const warnAlerts = slowDevices.map(d => ({
      sev: 'warn',
      t: 'Đang hoạt động',
      title: `Dây chuyền ${d.line} kết nối chậm`,
      msg: `Độ trễ phản hồi Ping cao. IP: ${d.ip} đạt mức ${Math.round(d.latency)}ms.`
    }))

    return [...offlineAlerts, ...warnAlerts]
  }, [devices])

  const criticalCount = alerts.filter(a => a.sev === 'critical').length


  useEffect(() => { localStorage.setItem('cb_lang', lang) }, [lang])
  useEffect(() => { localStorage.setItem('cb_nav_collapsed', collapsed ? '1' : '0') }, [collapsed])

  useEffect(() => {
    document.title = 'LY Scan Platform'

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")

    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    link.type = 'image/png'
    link.href = lyImg
  }, [])

  useEffect(() => {
    localStorage.setItem('cb_factory', factory.id)
    setFactoryId(factory.id)
    setDevices([])
    ipsRef.current = []
    prevStatusesRef.current = new Map()
    setLoading(true)
    fetch(`/api/vision/devices?factory=${factory.id}`)
      .then(r => r.json())
      .then((data: DeviceInfo[]) => {
        const statuses = data.map(d => ({
          ...d,
          status: d.alwaysOnline ? ('online' as PingStatus) : ('pending' as PingStatus),
          latency: 0,
          latencyHistory: [],
        }))
        setDevices(statuses)
        const pingableIps = statuses.filter(d => !d.alwaysOnline && d.ip).map(d => d.ip)
        ipsRef.current = pingableIps
        statuses.forEach(s => prevStatusesRef.current.set(s.ip, s.status))
        doPing(pingableIps)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [factory, doPing])

  return (
    <>
      <div className="atmosphere" />
      <div className="grid-overlay" />
      <Particles />

      <div className={`shell${collapsed ? ' collapsed' : ''}${mobileSidebarOpen ? ' mobile-open' : ''}`}>
        <Sidebar
          view={view}
          setView={switchView}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          lang={lang}
          onlineCount={onlineCount}
          factory={factory}
          setFactory={setFactory}
          onMobileClose={mobileSidebarOpen ? () => setMobileSidebarOpen(false) : undefined}
        />

        <main className="main">
          <Topbar
            view={view}
            lang={lang}
            setLang={setLang}
            onOpenAlerts={() => setAlertsOpen(true)}
            alertCount={criticalCount}
            onlineCount={onlineCount}
            totalDevices={devices.length}
            onMenuClick={() => setMobileSidebarOpen(o => !o)}
          />

          <div className="content scroll">
            {view === 'device' && (
              <DeviceMonitorPage
                openExport={(tab: string) => {
                  const t = new Date().toISOString().slice(0,10)
                  setExportCtx({ tab, dateFrom: new Date(Date.now()-7*86400000).toISOString().slice(0,10), dateTo: t })
                }}
                devices={devices}
                doPing={doPing}
                pinging={pinging}
                loading={loading}
                lang={lang}
              />
            )}

            {view === 'vision' && (
              <VisionReportPage
                key={factory.id}
                factory={factory}
                openExport={(tab: string, filters: Omit<ExportCtx, 'tab'>) => setExportCtx({ tab, ...filters })}
                lang={lang}
              />
            )}

            {view === 'customer' && (
              <CustomerReportPage key={factory.id} lang={lang} onUploadBusy={b => { uploadBusyRef.current = b }} />
            )}
          </div>
        </main>
      </div>

      {mobileSidebarOpen && <div className="mobile-overlay" onClick={() => setMobileSidebarOpen(false)} />}
      <ToastRail />
      {alertsOpen  && <AlertsDrawer alerts={alerts} onClose={() => setAlertsOpen(false)} />}
      {exportCtx   && <ExportModal ctx={exportCtx} lang={lang} onClose={() => setExportCtx(null)} />}
    </>
  )
}