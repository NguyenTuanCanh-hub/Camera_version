import { useState, useEffect } from 'react'
import { translate, type Lang } from '@/i18n'

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface DeviceInfo {
  ip: string
  line: string
  lastSeen: string
  alwaysOnline?: boolean
}

export type PingStatus = 'pending' | 'online' | 'offline'

export interface DeviceStatus extends DeviceInfo {
  status: PingStatus
  latency: number
  latencyHistory?: number[]
}

export interface DeviceMonitorProps {
  openExport?: (ctx: string) => void
  devices: DeviceStatus[]
  doPing: (ips: string[]) => Promise<void>
  pinging: boolean
  loading: boolean
  lang?: Lang
}

// ─── Scanlines overlay ────────────────────────────────────────────────────────
function Scanlines() {
  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'dm-scanlines'
    document.body.appendChild(el)
    return () => { document.body.removeChild(el) }
  }, [])
  return null
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ history, warn, offline }: { history: number[]; warn?: boolean; offline?: boolean }) {
  const cls = `dm-spark-line${offline ? ' offline' : warn ? ' warn' : ''}`
  if (history.length < 2) {
    return (
      <svg className="dm-spark" viewBox="0 0 100 22" preserveAspectRatio="none">
        <path className={cls} d="M0,11 L100,11"/>
      </svg>
    )
  }
  const w = 100, h = 22
  const max = Math.max(...history)
  const min = Math.min(...history)
  const range = Math.max(1, max - min)
  const d = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="dm-spark" viewBox="0 0 100 22" preserveAspectRatio="none">
      <path className={cls} d={d}/>
    </svg>
  )
}

// ─── AlertItemFull ────────────────────────────────────────────────────────────
function AlertItemFull({ device, lang }: { device: DeviceStatus; index: number; lang: Lang }) {
  const tr = (k: string) => translate(lang, k)
  return (
    <div className="dm-alert-item">
      <div className="dm-alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3 L22 21 L2 21 Z"/>
          <line x1="12" y1="10" x2="12" y2="15"/>
          <circle cx="12" cy="18" r="0.8" fill="currentColor"/>
        </svg>
      </div>
      <div className="dm-alert-body">
        <div className="dm-alert-name">
          {device.line} {tr('c.offline').toUpperCase()} <span className="dm-alert-tag">{tr('dm.crit')}</span>
        </div>
        <div className="dm-alert-sub">
          <span className="dm-alert-spin"/>
          {tr('dm.retry')}
        </div>
      </div>
    </div>
  )
}

// ─── RingGauge ────────────────────────────────────────────────────────────────
function RingGauge({ pct, online, total, lang }: { pct: number; online: number; total: number; lang: Lang }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="dm-ring-wrap">
      <div className="dm-ring-decor"/>
      <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="dmRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--dm-cyan)"/>
            <stop offset="100%" stopColor="var(--dm-mint)"/>
          </linearGradient>
        </defs>
        <g stroke="var(--dm-text-muted)" strokeWidth="0.5" opacity="0.5">
          <line x1="60" y1="6"   x2="60"  y2="12"/>
          <line x1="60" y1="108" x2="60"  y2="114"/>
          <line x1="6"  y1="60"  x2="12"  y2="60"/>
          <line x1="108" y1="60" x2="114" y2="60"/>
        </g>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--dm-panel-line)" strokeWidth="6"/>
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke="url(#dmRingGrad)"
          strokeWidth="6"
          strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 6px var(--dm-mint))' }}
        />
      </svg>
      <div className="dm-ring-center">
        <div className="dm-ring-pct">{pct}<span style={{ fontSize: 22 }}>%</span></div>
        <div className="dm-ring-sub">{online} / {total} {translate(lang, 'dm.online')}</div>
      </div>
    </div>
  )
}

// ─── HealthPanel ──────────────────────────────────────────────────────────────
function HealthPanel({ devices, lang }: { devices: DeviceStatus[]; lang: Lang }) {
  const tr = (k: string) => translate(lang, k)
  const online  = devices.filter(d => d.status === 'online').length
  const offline = devices.filter(d => d.status === 'offline').length
  const total   = devices.length
  const pct     = total > 0 ? Math.round((online / total) * 100) : 0
  const nominalLabel = pct >= 70 ? tr('dm.nominal') : pct >= 40 ? tr('dm.degraded') : tr('dm.critical')
  const nominalColor = pct >= 70 ? 'var(--dm-mint)' : pct >= 40 ? 'var(--dm-amber)' : 'var(--dm-danger)'
  const alerts  = devices.filter(d => d.status === 'offline')

  return (
    <div className="dm-health-grid">
      <div className="dm-panel dm-health-card">
        <span className="dm-corner-bracket tl"/>
        <span className="dm-corner-bracket tr"/>
        <span className="dm-corner-bracket bl"/>
        <span className="dm-corner-bracket br"/>
        <div className="dm-panel-header">
          <div className="dm-panel-title">
            {tr('c.health')}
          </div>
          <div className="dm-panel-title" style={{ color: nominalColor }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: nominalColor, boxShadow: `0 0 8px ${nominalColor}`, marginRight: 6,
            }}/>
            {nominalLabel}
          </div>
        </div>
        <div className="dm-health-top">
          <RingGauge pct={pct} online={online} total={total} lang={lang}/>
          <div className="dm-health-aside">
            <div className="dm-health-big">{String(total).padStart(2, '0')}</div>
            <div className="dm-health-lbl">{tr('dm.totalDevices')}</div>
            <div style={{
              marginTop: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--dm-text-dim)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              lineHeight: 1.6,
            }}>
            </div>
          </div>
        </div>
        <div className="dm-status-rows">
          <div className="dm-status-row">
            <span className="dm-dot"/>
            <span className="dm-row-label">{tr('c.online')}</span>
            <span className="dm-row-count">{online}</span>
          </div>
          <div className="dm-status-row danger">
            <span className="dm-dot danger"/>
            <span className="dm-row-label">{tr('c.offline')}</span>
            <span className="dm-row-count danger">{offline}</span>
          </div>
        </div>
      </div>

      <div className="dm-panel">
        <span className="dm-corner-bracket tl"/>
        <span className="dm-corner-bracket tr"/>
        <span className="dm-corner-bracket bl"/>
        <span className="dm-corner-bracket br"/>
        <div className="dm-panel-header">
          <div className="dm-panel-title">
            {tr('c.activeAlerts')}
          </div>
          {alerts.length > 0 && (
            <div className="dm-panel-badge">{alerts.length} {tr('dm.active')}</div>
          )}
        </div>
        <div className="dm-alerts-list">
          {alerts.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dm-mint)', letterSpacing: '0.14em' }}>
              ● {tr('dm.noAlerts')}
            </div>
          ) : (
            alerts.map((a, i) => <AlertItemFull key={a.ip} device={a} index={i} lang={lang}/>)
          )}
        </div>
      </div>
    </div>
  )
}

// ─── LiveTopology ─────────────────────────────────────────────────────────────
function LiveTopology({ devices, lang }: { devices: DeviceStatus[]; lang: Lang }) {
  const tr = (k: string) => translate(lang, k)
  const W = 920, H = 360, erpX = 760, erpY = 180

  const onlineMs = devices.filter(d => d.status === 'online' && d.latency > 0)
  const avgLatency = onlineMs.length > 0
    ? Math.round(onlineMs.reduce((s, d) => s + d.latency, 0) / onlineMs.length)
    : 0

  const sector = devices.length > 0
    ? 'SECTOR_' + devices[0].line.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()
    : 'SECTOR_NODE'

const hexPts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90)
    return `${(28 * Math.cos(a)).toFixed(1)},${(28 * Math.sin(a)).toFixed(1)}`
  }).join(' ')

  return (
    <div className="dm-panel dm-topology">
      <span className="dm-corner-bracket tl"/>
      <span className="dm-corner-bracket tr"/>
      <span className="dm-corner-bracket bl"/>
      <span className="dm-corner-bracket br"/>
      <div className="dm-panel-header" style={{ marginBottom: 0 }}>
        <div className="dm-panel-title">
          {tr('dm.topology')}
        </div>
        <div className="dm-panel-badge">{tr('c.live')}</div>
      </div>
      <div className="dm-topo-wrap">
        <span className="dm-tick tr">{tr('dm.scanRate')} {avgLatency > 0 ? `${avgLatency}ms` : '--'}</span>
        <span className="dm-tick bl">{sector}</span>
        <svg className="dm-topo-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="dmCentralGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="var(--dm-mint-bright)" stopOpacity="0.35"/>
              <stop offset="60%"  stopColor="var(--dm-mint)"        stopOpacity="0.05"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
          </defs>

          <circle cx={erpX} cy={erpY} r="120" fill="url(#dmCentralGlow)"/>

          <g opacity="0.4">
            <circle cx={erpX} cy={erpY} r="40" fill="none" stroke="var(--dm-mint)" strokeWidth="0.6" strokeDasharray="2 4"/>
            <circle cx={erpX} cy={erpY} r="62" fill="none" stroke="var(--dm-mint)" strokeWidth="0.5" strokeDasharray="2 6"/>
            <circle cx={erpX} cy={erpY} r="85" fill="none" stroke="var(--dm-mint)" strokeWidth="0.4" strokeDasharray="2 8"/>
          </g>

          <g className="dm-radar-sweep" style={{ transformOrigin: `${erpX}px ${erpY}px` }}>
            <path
              d={`M${erpX} ${erpY} L${erpX} ${erpY - 85} A85 85 0 0 1 ${(erpX + 72).toFixed(1)} ${(erpY - 42.5).toFixed(1)} Z`}
              fill="var(--dm-mint)" opacity="0.08"
            />
          </g>

          {/* Links */}
          {devices.map((d, i) => {
            const t = devices.length > 1 ? i / (devices.length - 1) : 0.5
            const x = 120 + t * 400
            const y = 180 + Math.sin((t - 0.5) * Math.PI * 1.5) * 120
            const isOnline = d.status === 'online'
            return (
              <path
                key={`l${d.ip}`}
                className={`dm-link ${isOnline ? 'online' : 'offline'}`}
                d={`M${x} ${y} Q${((x + erpX) / 2).toFixed(0)} ${(y - 40).toFixed(0)} ${erpX - 28} ${erpY}`}
              />
            )
          })}

          {/* Packets */}
          {devices.map((d, i) => {
            const t = devices.length > 1 ? i / (devices.length - 1) : 0.5
            const x = 120 + t * 400
            const y = 180 + Math.sin((t - 0.5) * Math.PI * 1.5) * 120
            const isOnline = d.status === 'online'
            const lastOctet = parseInt(d.ip.split('.').pop() ?? '0')
            return (
              <circle key={`p${d.ip}`} className={`dm-packet${!isOnline ? ' danger' : ''}`} r="2.5">
                <animateMotion
                  dur={`${(2.4 + (lastOctet % 10) * 0.1).toFixed(1)}s`}
                  repeatCount="indefinite"
                  begin={`${(i * 0.4).toFixed(1)}s`}
                  path={`M${x} ${y} Q${((x + erpX) / 2).toFixed(0)} ${(y - 40).toFixed(0)} ${erpX - 28} ${erpY}`}
                />
              </circle>
            )
          })}

          {/* Device nodes */}
          {devices.map((d, i) => {
            const t = devices.length > 1 ? i / (devices.length - 1) : 0.5
            const x = 120 + t * 400
            const y = 180 + Math.sin((t - 0.5) * Math.PI * 1.5) * 120
            const isOnline = d.status === 'online'
            const cls = isOnline ? 'online' : 'offline'
            return (
              <g key={d.ip} transform={`translate(${x} ${y})`}>
                <circle className={`dm-node-pulse ${cls}${i % 2 === 0 ? '' : ' delay'}`} r="20"/>
                <circle className={`dm-node-ring ${cls}`} r="20"/>
                <text className="dm-node-id" x="0" y="5" textAnchor="middle">{d.line.slice(-3)}</text>
                <text className={`dm-node-label ${cls}`} x="0" y="-30" textAnchor="middle">{d.line}</text>
                <text className={`dm-node-status ${cls}`} x="0" y="40" textAnchor="middle">● {d.status.toUpperCase()}</text>
              </g>
            )
          })}

          {/* ERP central node */}
          <g transform={`translate(${erpX} ${erpY})`}>
            <circle className="dm-node-pulse central" r="28"/>
            <circle className="dm-node-pulse central delay" r="28"/>
            <polygon className="dm-node-ring central" points={hexPts}/>
            <text className="dm-node-id" x="0" y="5" textAnchor="middle" style={{ fontSize: 13 }}>ERP</text>
            <text className="dm-node-label central" x="0" y="48" textAnchor="middle">{tr('dm.centralSync')}</text>
          </g>
        </svg>
      </div>
    </div>
  )
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(ta)
  ta.focus(); ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

// ─── DeviceCard ───────────────────────────────────────────────────────────────
function DeviceCard({ device }: { device: DeviceStatus }) {
  const isOnline  = device.status === 'online'
  const isOffline = device.status === 'offline'
  const isWarn    = isOnline && device.latency > 100
  const [copied, setCopied] = useState(false)

  const meterPct = isOffline ? 100 : Math.max(8, 100 - Math.min(95, device.latency || 0))
  const latClass = isOffline ? 'offline' : isWarn ? 'warn' : ''

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(device.ip).catch(() => fallbackCopy(device.ip))
    } else {
      fallbackCopy(device.ip)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`dm-device-card${isOffline ? ' offline' : ''}${isWarn ? ' warn' : ''}`}>
      <span className="dm-corner-bracket tl"/>
      <span className="dm-corner-bracket tr"/>
      <span className="dm-corner-bracket bl"/>
      <span className="dm-corner-bracket br"/>
      <div className="dm-cgrid"/>
      <div className="dm-cscan"/>

      <div className="dm-card-top">
        <div className={`dm-status-chip${isOffline ? ' offline' : ''}`}>
          <span className="dm-dot"/>
          {isOffline ? 'OFFLINE' : 'OPERATIONAL'}
        </div>
        <div className={`dm-info-chip${isWarn ? ' warn' : ''}${isOffline ? ' danger' : ''}`}>
          <span className="dm-d"/>
          {isOffline ? 'NO COMM' : 'LATENCY'}
        </div>
      </div>

      <h3 className="dm-device-name">{device.line}</h3>

      <div className="dm-meter">
        <span style={{ width: `${meterPct}%` }}/>
      </div>

      <div className="dm-card-bottom">
        <div>
          <div className="dm-ip-block">
            <span className="dm-lbl">IP:</span>{' '}
            <span className="dm-ip">{device.ip}</span>
            <button className="dm-copy-btn" onClick={handleCopy}>{copied ? 'OK' : 'COPY'}</button>
          </div>
          <Sparkline history={device.latencyHistory ?? []} warn={isWarn} offline={isOffline}/>
        </div>
        <div className={`dm-latency-num ${latClass}`}>
          {isOffline ? (
            <span style={{ letterSpacing: '0.3em' }}>— —</span>
          ) : (
            <>
              {device.latency > 0 ? Math.round(device.latency) : '—'}
              <span className="dm-unit">MS</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DeviceMonitorPage ────────────────────────────────────────────────────────
export default function DeviceMonitorPage({ devices, loading, lang = 'vi' }: DeviceMonitorProps) {
  const tr = (k: string) => translate(lang, k)
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')

  const visible =
    filter === 'all'     ? devices :
    filter === 'online'  ? devices.filter(d => d.status === 'online') :
    devices.filter(d => d.status === 'offline')

  const onlineCount  = devices.filter(d => d.status === 'online').length
  const offlineCount = devices.filter(d => d.status === 'offline').length

  if (loading) return <div className="dm-loading">Loading telemetry...</div>

  return (
    <div className="dm-page">
      <Scanlines/>

      {/* Main grid: topology + health */}
      <div className="dm-main-grid">
        <LiveTopology devices={devices} lang={lang}/>
        <HealthPanel devices={devices} lang={lang}/>
      </div>

      {/* Production lines section */}
      <div className="dm-prod-section">
        <div className="dm-prod-head">
          <div>
            <h2>{tr('c.lines')}</h2>
            <div className="dm-prod-sub">
              <span>{devices.length} LINES</span>
              <span style={{ color: 'var(--dm-text-muted)' }}>·</span>
              <span style={{ color: 'var(--dm-mint)' }}>LIVE TELEMETRY</span>
            </div>
          </div>
          <div className="dm-filter-group">
            {(['all', 'online', 'offline'] as const).map(f => (
              <button
                key={f}
                className={`dm-filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? tr('c.all') : f === 'online' ? tr('c.online') : tr('c.offline')}
                <span style={{ color: 'var(--dm-text-muted)', marginLeft: 6, fontSize: 9 }}>
                  {f === 'all'
                    ? `0${devices.length}`
                    : f === 'online'
                    ? `0${onlineCount}`
                    : `0${offlineCount}`}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="dm-prod-grid">
          {visible.map(d => <DeviceCard key={d.ip} device={d}/>)}
        </div>
      </div>

    </div>
  )
}
