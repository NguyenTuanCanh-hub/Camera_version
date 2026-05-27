import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Donut, Sparkline, RingChart, AreaChart } from '@/components/charts'
import ParetoChartJS from '@/components/charts/ParetoChartJS'
import BarChartJS from '@/components/charts/BarChartJS'
import { Icon } from '@/components/common/Icons'
import { KpiCard, CountUp } from '@/components/common'
import ProductThumb from '@/components/common/ProductThumb'
import { fetchGood, fetchNotGood, fetchAll, fetchDeviceTypes, fetchLines, fetchGoodStats, fetchAllStats, fetchNotGoodStats, shoeImageUrl } from '@/services/visionApi'
import type { GoodRecord, NotGoodRecord, AllRecord, DeviceType, GoodStats, AllStats, NotGoodStats } from '@/services/visionApi'
import { translate, type Lang } from '@/i18n'

const PAGE_SIZE = 50

const DEFAULT_DEVICE_TYPES: DeviceType[] = [
  { value: '',          label: 'Tất cả thiết bị' },
  { value: 'SYSTEM',    label: 'WINDOWS TABLET' },
  { value: 'DEVICE',    label: 'ANDROID TABLET' },
  { value: 'MobileApp', label: 'MobileApp' },
]

interface ExportFilters { dateFrom: string; dateTo: string; line?: string; ry?: string; device?: string }
interface Props { openExport: (tab: string, filters: ExportFilters) => void; lang: Lang }

type TabId = 'good' | 'all' | 'bad'

const today = new Date().toISOString().slice(0, 10)


// ─── Utility components ───────────────────────────────────────────────────────
function Section({ title, sub, right, children }: {
  title: string; sub?: string; right?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <>
      <div className="sec">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right && <div className="row gap-2">{right}</div>}
      </div>
      {children}
    </>
  )
}
function Filter({ children }: { children: React.ReactNode }) { return <div className="filter-row">{children}</div> }

// ─── SearchStrip ──────────────────────────────────────────────────────────────
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' }}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

interface SearchStripProps {
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
  line: string; setLine: (v: string) => void
  lines: string[]
  ry: string; setRy: (v: string) => void
  device: string; setDevice: (v: string) => void
  deviceTypes: DeviceType[]
  onSearch: () => void
  lang: Lang
}
function SearchStrip({ dateFrom, dateTo, setDateFrom, setDateTo, line, setLine, lines, ry, setRy, device, setDevice, deviceTypes, onSearch, lang }: SearchStripProps) {
  const tr = (k: string) => translate(lang, k)
  const dateInvalid = !!dateFrom && !!dateTo && dateFrom > dateTo
  const baseDevices = deviceTypes.length > 0 ? deviceTypes : DEFAULT_DEVICE_TYPES
  const resolvedDevices = [
    { value: '', label: tr('vis.allDevices') },
    ...baseDevices.filter(d => d.value !== ''),
  ]
  const handleSearch = () => { if (!dateInvalid) onSearch() }
  return (
    <div className="vision-search" style={{ flexWrap: 'wrap' }}>
      <div className="vs-field">
        <label>{tr('c.date')}</label>
        <div className="vs-input vs-daterange" style={dateInvalid ? { borderColor: 'rgba(239,68,68,0.7)', boxShadow: '0 0 0 2px rgba(239,68,68,0.18)' } : {}}>
          <Icon.calendar/>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
          <span className="vs-sep">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
        </div>
        {dateInvalid && (
          <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}>
            ⚠ {tr('vis.dateError')}
          </div>
        )}
      </div>
      <div className="vs-field">
        <label>{tr('c.deviceType')}</label>
        <div className="vs-input">
          <select value={device} onChange={e => setDevice(e.target.value)}>
            {resolvedDevices.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <ChevronDown/>
        </div>
      </div>
      <div className="vs-field">
        <label>{tr('c.line')}</label>
        <div className="vs-input">
          <input
            type="text"
            list="vs-line-list"
            value={line}
            onChange={e => setLine(e.target.value)}
            placeholder={tr('c.line') + '…'}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {line && <button className="vs-clear" onClick={() => setLine('')}><Icon.x/></button>}
          <datalist id="vs-line-list">
            {lines.map(l => <option key={l} value={l}/>)}
          </datalist>
        </div>
      </div>
      <div className="vs-field grow">
        <label>RY</label>
        <div className="vs-input">
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' }}>
            <Icon.search/>
          </span>
          <input type="text" value={ry} onChange={e => setRy(e.target.value)}
                 placeholder={tr('c.enterRY')} style={{ paddingLeft: 32 }}
                 onKeyDown={e => e.key === 'Enter' && handleSearch()}/>
          {ry && <button className="vs-clear" onClick={() => setRy('')}><Icon.x/></button>}
        </div>
      </div>
      <button className="btn vs-search-btn" onClick={handleSearch} disabled={dateInvalid} title={dateInvalid ? tr('vis.dateError') : ''}>
        <Icon.search/> {tr('c.search')}
      </button>
    </div>
  )
}

// ─── Status badge for DB records ─────────────────────────────────────────────
function ResultBadge({ status }: { status: string }) {
  if (!status || status === 'GOOD') return <span className="badge good">● GOOD</span>
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
      padding: '3px 8px', borderRadius: 999,
      background: 'rgba(239,68,68,0.18)', color: '#FCA5A5',
      border: '1px solid rgba(239,68,68,0.35)',
    }}>{status}</span>
  )
}

// ─── Shoe image (real photo or SVG fallback) ──────────────────────────────────
function ShoeImg({ ip, filename, ry, large = false, dbImageId }: { ip?: string | null; filename?: string | null; ry: string; large?: boolean; dbImageId?: string | number | null }) {
  const [broken, setBroken] = useState(false)

  // NOT GOOD records: image stored as varbinary in DB → fetch via dedicated endpoint
  const cleanId = typeof dbImageId === 'string' ? dbImageId.trim() : dbImageId
  const url = !broken
    ? (cleanId ? `/api/vision/notgood/image/${encodeURIComponent(String(cleanId).trim())}` : shoeImageUrl(ip, filename))
    : null

  if (url) {
    return (
      <img
        src={url}
        alt={ry}
        onError={() => setBroken(true)}
        style={{
          width: large ? '100%' : 72,
          height: large ? 'auto' : 72,
          maxWidth: large ? 900 : 72,
          objectFit: 'contain',
          background: '#0a0e1a',
          borderRadius: 7,
          border: '1px solid var(--border-hair)',
          display: 'block',
        }}
      />
    )
  }
  if (large) {
    const hue = Array.from(ry || 'x').reduce((s, c) => s + c.charCodeAt(0), 0) % 360
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.55 }}>
        <svg viewBox="0 0 120 80" width={200} height={134}>
          <path d="M10 72 Q20 28 44 28 L80 28 Q100 44 100 72 L100 78 L10 78 Z" fill={`hsl(${hue} 55% 22%)`} opacity="0.9"/>
          <ellipse cx="60" cy="28" rx="36" ry="8" fill={`hsl(${hue} 65% 40%)`} opacity="0.7"/>
          <path d="M12 66 L102 66" stroke={`hsl(${hue} 55% 45%)`} strokeWidth="1.2" opacity="0.5"/>
          <path d="M30 50 Q50 38 70 48" stroke={`hsl(${hue} 65% 55%)`} strokeWidth="1" fill="none" opacity="0.4"/>
        </svg>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t3)', letterSpacing: '0.08em' }}>NO IMAGE</div>
      </div>
    )
  }
  return <ProductThumb ry={ry} size="sm"/>
}

// ─── Live badge ───────────────────────────────────────────────────────────────
function LiveBadge({ lastUpdated }: { lastUpdated: Date | null }) {
  return (
    <div className="row gap-2" style={{ fontSize: 11, color: 'var(--t2)' }}>
      <span className="live-pip">LIVE</span>
      {lastUpdated && (
        <span className="mono" style={{ color: 'var(--t3)' }}>
          ↻ {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}

// ─── Pager ────────────────────────────────────────────────────────────────────
function Pager({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number
  onPrev: () => void; onNext: () => void
}) {
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--border-hair)', fontSize: 12, gap: 8 }}>
      <span style={{ color: 'var(--t3)', fontSize: 11.5 }}>
        {from.toLocaleString()}–{to.toLocaleString()} / <span className="mono">{total.toLocaleString()}</span> records
      </span>
      <span className="ml-auto"/>
      <button className="btn sm" onClick={onPrev} disabled={page <= 1}>← Prev</button>
      <span className="mono" style={{ fontSize: 12, color: 'var(--t2)', minWidth: 64, textAlign: 'center' }}>
        {page} / {totalPages}
      </span>
      <button className="btn sm" onClick={onNext} disabled={page >= totalPages}>Next →</button>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ filters, lang }: {
  filters: { dateFrom: string; dateTo: string; line?: string; ry?: string; device?: string }
  lang: Lang
}) {
  const tr = (k: string) => translate(lang, k)
  return (
    <div className="glass" style={{ padding: '52px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg viewBox="0 0 48 48" width={48} height={48} fill="none" stroke="var(--t3)" strokeWidth="1.4">
        <circle cx="22" cy="22" r="14"/>
        <line x1="32" y1="32" x2="44" y2="44"/>
        <line x1="17" y1="22" x2="27" y2="22"/>
        <line x1="22" y1="17" x2="22" y2="27"/>
      </svg>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--t1)', letterSpacing: '0.01em' }}>
        {tr('vis.noDataTitle')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--t3)', maxWidth: 420, lineHeight: 1.6 }}>
        {tr('vis.noDataSub')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        <span className="chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {tr('c.date')}: {filters.dateFrom} → {filters.dateTo}
        </span>
        {filters.line && (
          <span className="chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {tr('c.line')}: {filters.line}
          </span>
        )}
        {filters.ry && (
          <span className="chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            RY: {filters.ry}
          </span>
        )}
        {filters.device && (
          <span className="chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {tr('vis.noDataDevice')}: {filters.device}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="glass" style={{ padding: 18 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: 44, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 8,
          animation: 'shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%' }}/>
      ))}
    </div>
  )
}

// ─── GOOD table ───────────────────────────────────────────────────────────────
function GoodTable({ records, onRowClick, pager }: { records: GoodRecord[]; onRowClick: (r: GoodRecord) => void; pager: React.ReactNode }) {
  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ maxHeight: 560, overflowY: 'auto' }} className="scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th>PIC</th><th>Date / Time</th><th>DEPT</th><th>RY</th>
              <th>Size</th><th>PO</th><th>Qty</th><th>UPC</th><th>RFID</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} onClick={() => onRowClick(r)} style={{ cursor: 'pointer' }}>
                <td><ShoeImg ip={r.IP4_Address} filename={r.ShoeImage} ry={r.RY}/></td>
                <td className="mono dim" style={{ fontSize: 11.5 }}>{r.DateScan}</td>
                <td><span className="chip">{r.Line}</span></td>
                <td className="mono" style={{ fontWeight: 600 }}>{r.RY}</td>
                <td className="mono">{r.Size}</td>
                <td className="mono">{r.PO}</td>
                <td className="mono">{r.Qty}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{r.UPC}</td>
                <td className="mono" style={{ fontSize: 11, color: !r.RFID ? 'var(--t3)' : undefined }}>{r.RFID || '—'}</td>
                <td><span className="badge good">● GOOD</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  )
}

// ─── NOT GOOD table ───────────────────────────────────────────────────────────
function NotGoodTable({ records, onRowClick, pager }: { records: NotGoodRecord[]; onRowClick: (r: NotGoodRecord) => void; pager: React.ReactNode }) {
  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ maxHeight: 560, overflowY: 'auto' }} className="scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th>PIC</th><th>Date / Time</th><th>DEPT</th><th>RY</th>
              <th>Size</th><th>PO</th><th>Qty</th><th>UPC</th><th>RFID</th><th>IP4 Address</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} onClick={() => onRowClick(r)} style={{ cursor: 'pointer' }}>
                <td><ShoeImg ip={r.IP4_Address} filename={r.ShoeImage} ry={r.RY} dbImageId={r.id}/></td>
                <td className="mono dim" style={{ fontSize: 11.5 }}>{r.DateScan}</td>
                <td><span className="chip">{r.Line}</span></td>
                <td className="mono" style={{ fontWeight: 600 }}>{r.RY}</td>
                <td className="mono">{r.Size}</td>
                <td className="mono">{r.PO}</td>
                <td className="mono">{r.Qty}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{r.UPC}</td>
                <td className="mono" style={{ fontSize: 11 }}>{r.RFID}</td>
                <td className="mono" style={{ fontSize: 11, color: '#67E8F9' }}>{r.IP4_Address || '—'}</td>
                <td><ResultBadge status={r.Status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  )
}

// ─── ViewGood ─────────────────────────────────────────────────────────────────
function ViewGood({ filters, onRowClick, lang }: {
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; device: string; trigger: number }
  onRowClick: (r: GoodRecord) => void
  lang: Lang
}) {
  const [records, setRecords]     = useState<GoodRecord[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage]           = useState(1)
  const [stats, setStats]         = useState<GoodStats>({ hourly: [], byLine: [] })
  const mountedG     = useRef(false)
  const pageMountedG = useRef(false)
  const abortGood    = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abortGood.current?.abort()
    abortGood.current = new AbortController()
    const signal = abortGood.current.signal
    if (initial) setLoading(true)
    fetchGood({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, ry: filters.ry || undefined, deviceType: filters.device || undefined, page, pageSize: PAGE_SIZE }, signal)
      .then(res => { setRecords(res.records); setTotal(res.total); setLastUpdated(new Date()); setError(null) })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, filters.device, page])

  const doFetchRef = useRef(doFetch)
  doFetchRef.current = doFetch

  useEffect(() => {
    if (!mountedG.current) { mountedG.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountedG.current) { pageMountedG.current = true; return }
    doFetchRef.current(true)
  }, [page])

  useEffect(() => {
    doFetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) doFetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  // Fetch full stats (all records, no pagination) on filter change
  useEffect(() => {
    fetchGoodStats({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, deviceType: filters.device || undefined, ry: filters.ry || undefined })
      .then(setStats).catch(() => {})
  }, [filters.trigger, filters.dateFrom, filters.dateTo, filters.line, filters.device])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Working hours 7h–21h from full stats
  const workingHourly = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const hour = i + 7
      return stats.hourly.find(h => h.hour === hour)?.count ?? 0
    })
  }, [stats.hourly])

  const workingLabels = Array.from({ length: 15 }, (_, i) => i === 0 ? '7h30' : `${i + 7}h`)
  const workingMax    = Math.max(...workingHourly, 1)
  const workingSum    = workingHourly.reduce((s, v) => s + v, 0)
  const workingAvg    = workingSum / 15
  const peakIdx       = workingHourly.indexOf(Math.max(...workingHourly))
  const activeHours   = workingHourly.filter(v => v > 0)
  const lowIdx        = workingHourly.indexOf(Math.min(...(activeHours.length ? activeHours : [0])))

  const hourColors = workingHourly.map((v, i) => {
    if (i === peakIdx && v > 0)                    return '#00D9FF'
    if (i === lowIdx  && v > 0 && v < workingAvg)  return 'rgba(139,92,246,0.45)'
    const t = v / workingMax
    const r = Math.round(139 * (1 - t))
    const g = Math.round(92  + 125 * t)
    const b = Math.round(246 + 9   * t)
    return `rgba(${r},${g},${b},${0.55 + 0.40 * t})`
  })

  const statsLines = stats.byLine.slice(0, 8)
  const bestLine   = stats.byLine[0]
  const pager      = <Pager page={page} totalPages={totalPages} total={total} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))}/>

  // Mini sparkline for KPI from stats
  const allHourly = useMemo(() => {
    const arr = Array<number>(24).fill(0)
    stats.hourly.forEach(h => { arr[h.hour] = h.count })
    return arr
  }, [stats.hourly])

  const tr = (k: string) => translate(lang, k)

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label={tr('vis.totalGood')} value={total} fmt={n => Math.round(n).toLocaleString()} accent="good"/>
        <div className="kpi">
          <div className="kpi-label">{tr('vis.bestLine')}</div>
          <div className="kpi-value grad-good">{bestLine ? bestLine.Line.slice(-4) : '—'}</div>
          {bestLine && <div className="kpi-foot"><span className="dim">{bestLine.count.toLocaleString()} scans</span></div>}
        </div>
        <div className="kpi">
          <div className="kpi-label">{tr('vis.peakHour')}</div>
          <div className="kpi-value grad-good">{workingHourly.some(v => v > 0) ? workingLabels[peakIdx] : '—'}</div>
          {workingHourly.some(v => v > 0) && <div className="kpi-foot"><span className="dim">{workingHourly[peakIdx].toLocaleString()} scans</span></div>}
        </div>
        <div className="kpi">
          <div className="kpi-label">{tr('vis.hourlyTrend')}</div>
          <div style={{ height: 72, marginTop: 4 }}><Sparkline data={allHourly} height={72}/></div>
        </div>
      </div>

      {/* Charts: hourly 7h-21h + line productivity */}
      <div className="vis-charts-2col">
        <div className="glass" style={{ padding: 16 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <div>
              <div className="eyebrow">{tr('vis.hourlyOutput')}</div>
              {workingHourly.some(v => v > 0) && (
                <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#00D9FF' }}>▲ {tr('vis.peak')}: {workingLabels[peakIdx]} · {workingHourly[peakIdx].toLocaleString()}</span>
                  <span style={{ color: '#8B5CF6' }}>▼ {tr('vis.low')}: {workingLabels[lowIdx]} · {workingHourly[lowIdx].toLocaleString()}</span>
                  <span style={{ color: 'var(--t3)' }}>{tr('vis.avg')}: {Math.round(workingAvg).toLocaleString()}/h</span>
                </div>
              )}
            </div>
            <span className="live-pip ml-auto">LIVE</span>
          </div>
          <BarChartJS labels={workingLabels} values={workingHourly} colors={hourColors} height={180} label="GOOD scans"/>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{tr('vis.lineThroughput')}</div>
          <BarChartJS
            labels={statsLines.map(d => d.Line.slice(-4))}
            values={statsLines.map(d => d.count)}
            height={180}
            label="Scans"
          />
        </div>
      </div>

      <Section title={tr('vis.verified')} sub={`${total.toLocaleString()} total · page ${page}/${totalPages}`} right={<LiveBadge lastUpdated={lastUpdated}/>}/>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5', fontSize: 13 }}>
            ⚠ {error}
            <button className="btn sm" style={{ marginLeft: 12 }} onClick={() => doFetch(true)}>{tr('vis.retry')}</button>
          </div>
        : loading ? <TableSkeleton/>
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <GoodTable records={records} onRowClick={onRowClick} pager={pager}/>}
    </>
  )
}

// ─── ViewBad ──────────────────────────────────────────────────────────────────
function ViewBad({ filters, onRowClick, lang }: {
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; device: string; trigger: number }
  onRowClick: (r: NotGoodRecord) => void
  lang: Lang
}) {
  const [records, setRecords] = useState<NotGoodRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [ngStats, setNgStats] = useState<NotGoodStats>({ hourly: [], byLine: [] })
  const mountedB = useRef(false)
  const pageMountedB = useRef(false)
  const abortBad = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abortBad.current?.abort()
    abortBad.current = new AbortController()
    const signal = abortBad.current.signal
    if (initial) setLoading(true)
    fetchNotGood({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, ry: filters.ry || undefined, deviceType: filters.device || undefined, page, pageSize: PAGE_SIZE }, signal)
      .then(res => { setRecords(res.records); setTotal(res.total); setLastUpdated(new Date()); setError(null) })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, filters.device, page])

  const doFetchRef = useRef(doFetch)
  doFetchRef.current = doFetch

  useEffect(() => {
    if (!mountedB.current) { mountedB.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountedB.current) { pageMountedB.current = true; return }
    doFetchRef.current(true)
  }, [page])

  useEffect(() => {
    doFetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) doFetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  useEffect(() => {
    fetchNotGoodStats({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, deviceType: filters.device || undefined, ry: filters.ry || undefined })
      .then(setNgStats).catch(() => {})
  }, [filters.trigger, filters.dateFrom, filters.dateTo, filters.line, filters.device])

  const lineErrors = useMemo(() =>
    ngStats.byLine
      .filter(d => d.Line != null && d.Line !== '')
      .map(d => ({ label: d.Line as string, value: d.count }))
  , [ngStats.byLine])

  const tr = (k: string) => translate(lang, k)

  const errorTypeData = useMemo(() => {
    const map: Record<string, number> = {}
    const add = (key: string) => { map[key] = (map[key] || 0) + 1 }
    records.forEach(r => {
      let found = false
      // Check each missing / mismatched field independently
      if (!r.RFID?.trim())  { add('err.missingRFID');  found = true }
      if (!r.RY?.trim())    { add('err.missingRY');     found = true }
      if (!r.Size?.trim())  { add('err.missingSize');   found = true }
      if (!r.PO?.trim())    { add('err.missingPO');     found = true }
      if (!r.UPC?.trim())   { add('err.missingUPC');    found = true }
      // Mismatch checks (only when RFID field exists)
      if (r.RFID?.trim() && r.Size_RFID?.trim() && r.Size?.trim() && r.Size.trim() !== r.Size_RFID.trim()) { add('err.wrongSize'); found = true }
      if (r.RFID?.trim() && r.PO_RFID?.trim()   && r.PO?.trim()   && r.PO.trim()   !== r.PO_RFID.trim())   { add('err.wrongPO');   found = true }
      if (r.RFID?.trim() && r.UPC_RFID?.trim()  && r.UPC?.trim()  && r.UPC.trim()  !== r.UPC_RFID.trim())  { add('err.wrongUPC');  found = true }
      if (r.RFID?.trim() && r.Article_RFID?.trim() && r.RY?.trim() && r.RY.trim() !== r.Article_RFID.trim()) { add('err.wrongArticle'); found = true }
      if (!found) add('err.other')
    })
    return Object.entries(map).map(([key, value]) => ({ key, label: tr(key), value })).sort((a, b) => b.value - a.value)
  }, [records, lang])

  const ipErrors = useMemo(() => {
    const map: Record<string, number> = {}
    records.forEach(r => { const ip = r.IP4_Address || 'Unknown'; map[ip] = (map[ip] || 0) + 1 })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [records])

  const hourlyErrors = useMemo(() => {
    const arr = Array<number>(24).fill(0)
    ngStats.hourly.forEach(h => { arr[h.hour] = h.count })
    return arr
  }, [ngStats.hourly])

  const ERROR_TYPE_COLORS: Record<string, string> = {
    'err.missingRFID':    '#EF4444',
    'err.missingRY':      '#F97316',
    'err.missingSize':    '#F59E0B',
    'err.missingPO':      '#EAB308',
    'err.missingUPC':     '#84CC16',
    'err.wrongSize':      '#8B5CF6',
    'err.wrongPO':        '#6366F1',
    'err.wrongUPC':       '#00D9FF',
    'err.wrongArticle':   '#10B981',
    'err.other':          '#64748B',
  }
  const paretoData  = lineErrors.map(d => ({ label: (d.label || '').slice(-5) || d.label, value: d.value }))
  const errorRing   = errorTypeData.map(d => ({
    label: d.label,
    value: d.value,
    color: ERROR_TYPE_COLORS[d.key] ?? '#64748B',
  }))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pager = <Pager page={page} totalPages={totalPages} total={total} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))}/>

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: '-40px -40px 0 -40px', zIndex: -1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(239,68,68,0.10), transparent 70%)',
      }}/>

      {/* ── Header banner ── */}
      <div className="glass" style={{
        padding: 14, marginBottom: 16,
        background: 'linear-gradient(90deg, rgba(239,68,68,0.10), rgba(245,158,11,0.04) 60%, rgba(255,255,255,0.02))',
        border: '1px solid rgba(239,68,68,0.30)',
      }}>
        <div className="vis-header-4col">
          {/* Total errors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', flexShrink: 0 }}>
              <Icon.alert/>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: '#FCA5A5', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>{tr('vis.totalErrors')}</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                <CountUp value={total}/>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{tr('vis.casesInPeriod')}</div>
            </div>
          </div>
          {/* Worst line */}
          <div style={{ padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{tr('vis.worstLine')}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#EF4444' }}>
              {lineErrors[0]?.label?.slice(-5) ?? '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
              {lineErrors[0]?.value ?? 0} {tr('vis.errorsInPage')}
            </div>
          </div>
          {/* Error type count */}
          <div style={{ padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{tr('vis.errorTypeCount')}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B', lineHeight: 1 }}>
              {errorTypeData.length || '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
              {errorTypeData.slice(0, 3).map(d => (
                <span key={d.label} style={{ color: ERROR_TYPE_COLORS[d.label] ?? '#64748B' }}>
                  {d.label} ({d.value})
                </span>
              ))}
            </div>
          </div>
          {/* Worst device */}
          <div style={{ padding: '0 0 0 16px' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{tr('vis.worstDevice')}</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#67E8F9', lineHeight: 1.2 }}>
              {ipErrors[0] ? ipErrors[0].label : '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 4 }}>
              {ipErrors[0] ? `${ipErrors[0].value} ${tr('vis.errorsInPage')}` : tr('vis.noData')}
            </div>
          </div>
        </div>
      </div>

      <div className="vis-charts-pareto">
        {/* Pareto — Line breakdown */}
        <div className="glass" style={{ padding: 16 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <div>
              <div className="eyebrow">{tr('vis.errByLine')}</div>
            </div>
            <span className="live-pip ml-auto">LIVE</span>
          </div>
          <ParetoChartJS data={paretoData} height={220}/>
        </div>

        {/* Right column: Error type breakdown + Hourly trend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="glass" style={{ padding: 16, flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{tr('vis.errorCause')}</div>
            {errorRing.length > 0
              ? <RingChart segments={errorRing} size={120} strokeW={20}/>
              : <div className="dim" style={{ fontSize: 13 }}>{tr('vis.noData')}</div>}
          </div>
          <div className="glass" style={{ padding: 16 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <div className="eyebrow">{tr('vis.hourlyErrTrend')}</div>
              {hourlyErrors.some(v => v > 0) && (
                <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>
                  {tr('vis.peak')} {hourlyErrors.indexOf(Math.max(...hourlyErrors))}h · {Math.max(...hourlyErrors)} {tr('vis.errors')}
                </span>
              )}
            </div>
            <Sparkline data={hourlyErrors} height={72}/>
          </div>
        </div>
      </div>

      <Section title={tr('vis.invQueue')} sub={`${total.toLocaleString()} total · page ${page}/${totalPages}`} right={<LiveBadge lastUpdated={lastUpdated}/>}/>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5', fontSize: 13 }}>
            ⚠ {error}
            <button className="btn sm" style={{ marginLeft: 12 }} onClick={() => doFetch(true)}>{tr('vis.retry')}</button>
          </div>
        : loading ? <TableSkeleton/>
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <NotGoodTable records={records} onRowClick={onRowClick} pager={pager}/>}
    </div>
  )
}

// ─── All Data table ───────────────────────────────────────────────────────────
function AllTable({ records, onRowClick, pager }: { records: AllRecord[]; onRowClick: (r: AllRecord) => void; pager: React.ReactNode }) {
  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ maxHeight: 560, overflowY: 'auto' }} className="scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th>PIC</th>
              <th>Date / Time</th>
              <th>DEPT</th>
              <th>RY</th>
              <th>Size</th>
              <th>PO</th>
              <th>Qty</th>
              <th>UPC</th>
              <th>RFID</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id + r.Result} onClick={() => onRowClick(r)} style={{ cursor: 'pointer' }}>
                <td><ShoeImg ip={r.IP4_Address} filename={r.ShoeImage} ry={r.RY}/></td>
                <td className="mono dim" style={{ fontSize: 11.5 }}>{r.DateScan}</td>
                <td><span className="chip">{r.Line}</span></td>
                <td className="mono" style={{ fontWeight: 600 }}>{r.RY}</td>
                <td className="mono">{r.Size}</td>
                <td className="mono">{r.PO}</td>
                <td className="mono">{r.Qty}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{r.UPC}</td>
                <td className="mono" style={{ fontSize: 11, color: !r.RFID ? 'var(--t3)' : undefined }}>{r.RFID || '—'}</td>
                <td>
                  {r.Result === 'GOOD'
                    ? <span className="badge good">● GOOD</span>
                    : <ResultBadge status={r.Status || 'NOT GOOD'}/>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  )
}

// ─── ViewAll — real data from both tables ─────────────────────────────────────
interface TimeInterval {
  hour: number
  minute: number
  label: string
}

const ALL_INTERVALS: TimeInterval[] = [
  { hour: 7, minute: 30, label: '7h30' },
  { hour: 8, minute: 0, label: '8h00' },
  { hour: 8, minute: 30, label: '8h30' },
  { hour: 9, minute: 0, label: '9h00' },
  { hour: 10, minute: 30, label: '10h30' },
  { hour: 11, minute: 0, label: '11h00' },
  { hour: 11, minute: 30, label: '11h30' },
  { hour: 12, minute: 0, label: '12h00' },
  { hour: 12, minute: 30, label: '12h30' },
  { hour: 13, minute: 0, label: '13h00' },
  { hour: 13, minute: 30, label: '13h30' },
  { hour: 14, minute: 0, label: '14h00' },
  { hour: 14, minute: 30, label: '14h30' },
  { hour: 15, minute: 0, label: '15h00' },
  { hour: 15, minute: 30, label: '15h30' },
  { hour: 16, minute: 30, label: '16h30' },
  { hour: 17, minute: 0, label: '17h00' },
  { hour: 17, minute: 30, label: '17h30' },
  { hour: 18, minute: 0, label: '18h00' },
  { hour: 18, minute: 30, label: '18h30' },
  { hour: 19, minute: 0, label: '19h00' },
  { hour: 19, minute: 30, label: '19h30' },
  { hour: 20, minute: 0, label: '20h00' },
  { hour: 20, minute: 30, label: '20h30' },
  { hour: 21, minute: 0, label: '21h00' }
]

const ALL_INTERVAL_LABELS = ALL_INTERVALS.map(i => i.label)

function ViewAll({ goodTotal, badTotal, filters, onRowClick, lang }: {
  goodTotal: number
  badTotal: number
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; device: string; trigger: number }
  onRowClick: (r: AllRecord) => void
  lang: Lang
}) {
  const [records, setRecords] = useState<AllRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [allStats, setAllStats] = useState<AllStats | null>(null)
  const [hovLine, setHovLine] = useState<number | null>(null)
  const mountedA = useRef(false)
  const pageMountedA = useRef(false)
  const abortAll = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abortAll.current?.abort()
    abortAll.current = new AbortController()
    const signal = abortAll.current.signal
    if (initial) setLoading(true)
    fetchAll({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, ry: filters.ry || undefined, deviceType: filters.device || undefined, page, pageSize: PAGE_SIZE }, signal)
      .then(res => { setRecords(res.records); setTotal(res.total); setLastUpdated(new Date()); setError(null) })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, filters.device, page])

  const doFetchRef = useRef(doFetch)
  doFetchRef.current = doFetch

  useEffect(() => {
    if (!mountedA.current) { mountedA.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountedA.current) { pageMountedA.current = true; return }
    doFetchRef.current(true)
  }, [page])

  useEffect(() => {
    doFetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) doFetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  useEffect(() => {
    fetchAllStats({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined, deviceType: filters.device || undefined, ry: filters.ry || undefined })
      .then(setAllStats).catch(console.error)
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.device, filters.trigger])

  const all = goodTotal + badTotal
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statsByLine = allStats?.byLine ?? []
  const maxLine = statsByLine[0]?.count ?? 1

  const workingHourly = useMemo(() => {
    if (!allStats) return { good: Array(ALL_INTERVALS.length).fill(0) as number[], bad: Array(ALL_INTERVALS.length).fill(0) as number[] }
    const hMap = new Map(allStats.hourly.map(h => [`${h.hour}:${h.minute}`, h]))
    return {
      good: ALL_INTERVALS.map(i => hMap.get(`${i.hour}:${i.minute}`)?.goodCount ?? 0),
      bad:  ALL_INTERVALS.map(i => hMap.get(`${i.hour}:${i.minute}`)?.badCount  ?? 0),
    }
  }, [allStats])

  const { avgHourly } = useMemo(() => {
    const d1 = new Date(filters.dateFrom)
    const d2 = new Date(filters.dateTo)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    const totalWorkingHours = diffDays * (ALL_INTERVALS.length / 2)
    return {
      avgHourly: Math.round(all / totalWorkingHours),
    }
  }, [all, goodTotal, badTotal, filters.dateFrom, filters.dateTo])

  const pager = <Pager page={page} totalPages={totalPages} total={total} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))}/>

  const tr = (k: string) => translate(lang, k)

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label={tr('vis.totalScans')} value={all}/>
        <KpiCard label={tr('vis.meetStandard')} value={goodTotal} accent="good"/>
        <KpiCard label={tr('vis.defectDetected')} value={badTotal} accent="bad"/>
        <KpiCard
          label={tr('vis.avgOutput')}
          value={avgHourly}
          fmt={n => n.toLocaleString() + ' ' + tr('vis.perHour')}
          accent="default"
          sub={`GOOD ${goodTotal.toLocaleString()} · NOT GOOD ${badTotal.toLocaleString()}`}
        />
      </div>

      <div className="vis-charts-3col">

        {/* ── Panel 1: Result Distribution ──────────────────────── */}
        <div className="glass" style={{ padding: '16px 18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 60% at 50% 35%, rgba(16,185,129,0.07) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative' }}>
            <div className="eyebrow" style={{ color:'#10B981', letterSpacing:'0.1em' }}>{tr('vis.resultDist')}</div>
            <span className="live-pip">LIVE</span>
          </div>
          <div style={{ display:'grid', placeItems:'center', marginTop:10, filter:'drop-shadow(0 6px 18px rgba(16,185,129,0.22))' }}>
            <Donut value={goodTotal} total={all || 1} colorA="#10B981" colorB="#34D399" label={tr('vis.pass')}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14, position:'relative' }}>
            {([
              { key:'vis.good' as const, val:goodTotal, color:'#10B981', glow:'rgba(16,185,129,0.55)',  gradA:'#059669', gradB:'#34D399' },
              { key:'vis.bad'  as const, val:badTotal,  color:'#EF4444', glow:'rgba(239,68,68,0.55)',   gradA:'#B91C1C', gradB:'#F87171' },
            ]).map(({ key, val, color, glow, gradA, gradB }) => (
              <div key={key}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, fontFamily:'var(--font-mono)', fontSize:12 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:color, boxShadow:`0 0 7px ${glow}`, flexShrink:0 }}/>
                  <span style={{ color:'#94A3B8', flex:1 }}>{tr(key)}</span>
                  <span style={{ color:'#E2E8F0', fontWeight:700 }}>{val.toLocaleString()}</span>
                  <span style={{ color:'#475569', fontSize:10.5, width:40, textAlign:'right' }}>
                    {all > 0 ? ((val/all)*100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${all > 0 ? (val/all)*100 : 0}%`, background:`linear-gradient(90deg,${gradA},${gradB})`, boxShadow:`0 0 8px ${glow}`, borderRadius:3, transition:'width 0.7s cubic-bezier(.22,1,.36,1)' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel 2: Scans Per Line ────────────────────────────── */}
        <div className="glass" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 50% 70% at 90% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, position:'relative' }}>
            <div>
              <div className="eyebrow" style={{ color:'#818CF8', letterSpacing:'0.1em' }}>{tr('vis.scansPerLine')}</div>
              <div style={{ fontSize:9, color:'#475569', fontFamily:'var(--font-mono)', marginTop:3, letterSpacing:'0.06em' }}>PRODUCTION OUTPUT · RANKED</div>
            </div>
            <span className="live-pip">LIVE</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, position:'relative' }}>
            {statsByLine.slice(0, 8).map((row, i) => {
              const pct = (row.count / maxLine) * 100
              const isHov = hovLine === i
              const t = i / Math.max(1, statsByLine.length - 1)
              const barColor = `linear-gradient(90deg, rgba(99,102,241,${0.6+0.4*(1-t)}), rgba(0,217,255,${0.7+0.3*(1-t)}))`
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:9 }}
                  onMouseEnter={() => setHovLine(i)} onMouseLeave={() => setHovLine(null)}>
                  <div style={{ width:36, fontSize:11, fontFamily:'var(--font-mono)', color: isHov ? '#E2E8F0' : '#64748B', textAlign:'right', flexShrink:0, transition:'color 120ms' }}>
                    {row.Line.slice(-4)}
                  </div>
                  <div style={{ flex:1, height:22, background:'rgba(255,255,255,0.04)', borderRadius:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:5,
                      boxShadow: isHov ? '0 0 14px rgba(0,217,255,0.45)' : 'none',
                      transition:'width 0.7s cubic-bezier(.22,1,.36,1), box-shadow 150ms' }}/>
                  </div>
                  <div style={{ width:32, fontSize:12, fontFamily:'var(--font-mono)', color: isHov ? '#00D9FF' : '#94A3B8', textAlign:'right', fontWeight:700, flexShrink:0, transition:'color 120ms' }}>
                    {row.count}
                  </div>
                </div>
              )
            })}
            {!statsByLine.length && (
              <div style={{ fontSize:12, color:'#475569', fontFamily:'var(--font-mono)', textAlign:'center', paddingTop:24 }}>{tr('vis.noData')}</div>
            )}
          </div>
        </div>

        {/* ── Panel 3: Hourly Trend ──────────────────────────────── */}
        <div className="glass" style={{ padding: '16px 18px 10px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 60% at 50% 10%, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, position:'relative' }}>
            <div>
              <div className="eyebrow" style={{ color:'#34D399', letterSpacing:'0.1em' }}>{tr('vis.hourlyTrend')}</div>
              <div style={{ fontSize:11, color:'#475569', fontFamily:'var(--font-mono)', marginTop:3, letterSpacing:'0.06em' }}>GOOD vs NOT GOOD · 7h30–21h</div>
            </div>
            <span className="live-pip">LIVE</span>
          </div>
          <div style={{ position:'relative' }}>
            <AreaChart
              series={[
                { label: tr('vis.good'), data: workingHourly.good, color:'#10B981', thick:true,  labels: ALL_INTERVAL_LABELS },
                { label: tr('vis.bad'),  data: workingHourly.bad,  color:'#F87171', thick:false, labels: ALL_INTERVAL_LABELS },
              ]}
              height={198}
            />
          </div>
        </div>
      </div>

      <Section title={tr('vis.allRecords')} sub={`${total.toLocaleString()} total · page ${page}/${totalPages}`} right={<LiveBadge lastUpdated={lastUpdated}/>}/>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5', fontSize: 13 }}>
            ⚠ {error}
            <button className="btn sm" style={{ marginLeft: 12 }} onClick={() => doFetch(true)}>{tr('vis.retry')}</button>
          </div>
        : loading ? <TableSkeleton/>
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <AllTable records={records} onRowClick={onRowClick} pager={pager}/>}
    </>
  )
}

// ─── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ row, kind, onClose }: {
  row: GoodRecord | NotGoodRecord | AllRecord; kind: 'good' | 'bad'; onClose: () => void
}) {
  const r = row as GoodRecord & NotGoodRecord & AllRecord
  const fields: [string, string][] = [
    ['Date / Time', r.DateScan],
    ['Line (DEPT)',  r.Line],
    ['RY',           r.RY],
    ['Size',         r.Size],
    ['PO',           r.PO],
    ['Qty',          String(r.Qty)],
    ['UPC',          r.UPC],
    ['RFID',         r.RFID || '—'],
    ...(kind === 'bad' ? [['IP4 Address', r.IP4_Address || '—'] as [string, string], ['Status', r.Status] as [string, string]] : []),
  ]
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(94vw, 1200px)' }}>
        <div className="row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-hair)' }}>
          {kind === 'good'
            ? <span className="badge good">● GOOD</span>
            : <span className="badge bad">▲ NOT GOOD</span>}
          <div style={{ marginLeft: 12 }}>
            <div className="mono" style={{ fontWeight: 600 }}>{r.RY}</div>
            <div className="dim mono" style={{ fontSize: 11.5 }}>{r.Line} · {r.DateScan}</div>
          </div>
          <button className="icon-btn ml-auto" onClick={onClose}><Icon.x/></button>
        </div>
        <div className="vis-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
          <div className="vis-detail-img" style={{ padding: 22, background: '#06091c', borderRight: '1px solid var(--border-hair)', display: 'grid', placeItems: 'center' }}>
            <ShoeImg ip={r.IP4_Address} filename={r.ShoeImage} ry={r.RY} large dbImageId={kind === 'bad' ? r.id : null}/>
          </div>
          <div style={{ padding: 22 }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <tbody>
                {fields.map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: '4px 0', color: 'var(--t3)', width: 110, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</td>
                    <td className="mono" style={{ padding: '4px 0' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── VisionReportPage (root) ─────────────────────────────────────────────────
// Trang báo cáo Camera Vision: xem kết quả quét GOOD / NOT GOOD / Tất cả theo bộ lọc ngày-line-RY
// Lấy dữ liệu từ visionApi.ts, tự làm mới 30 giây, gọi openExport khi người dùng bấm xuất XLSX
export default function VisionReportPage({ openExport, lang }: Props) {
  const tr = (k: string) => translate(lang, k)
  const [tab, setTab] = useState<TabId>('good')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [line, setLine] = useState('')
  const [ry, setRy] = useState('')
  const [device, setDevice] = useState('')
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: today, dateTo: today, line: '', ry: '', device: '', trigger: 0 })
  const [goodTotal, setGoodTotal] = useState(0)
  const [badTotal, setBadTotal] = useState(0)
  const [selectedGood, setSelectedGood] = useState<GoodRecord | null>(null)
  const [selectedBad, setSelectedBad] = useState<NotGoodRecord | null>(null)
  const [selectedAll, setSelectedAll] = useState<AllRecord | null>(null)

  useEffect(() => {
    fetchDeviceTypes()
      .then(types => setDeviceTypes([{ value: '', label: '' }, ...types]))
      .catch(console.error)
    fetchLines().then(setLines).catch(console.error)
  }, [])

  useEffect(() => {
    const fetchTotals = () => {
      if (document.hidden) return
      fetchGood({ dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo, line: appliedFilters.line || undefined, ry: appliedFilters.ry || undefined, deviceType: appliedFilters.device || undefined, pageSize: 1 })
        .then(r => setGoodTotal(r.total)).catch(() => {})
      fetchNotGood({ dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo, line: appliedFilters.line || undefined, ry: appliedFilters.ry || undefined, deviceType: appliedFilters.device || undefined, pageSize: 1 })
        .then(r => setBadTotal(r.total)).catch(() => {})
    }
    fetchTotals()
    const id = setInterval(fetchTotals, 60000)
    return () => clearInterval(id)
  }, [appliedFilters])

  return (
    <>
      <SearchStrip
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        line={line} setLine={setLine}
        lines={lines}
        ry={ry} setRy={setRy}
        device={device} setDevice={setDevice}
        deviceTypes={deviceTypes}
        onSearch={() => setAppliedFilters({ dateFrom, dateTo, line, ry, device, trigger: appliedFilters.trigger + 1 })}
        lang={lang}
      />

      <div className="vis-tab-row row" style={{ marginBottom: 18 }}>
        <div className="seg">
          <button className={tab === 'good' ? 'active good' : ''} onClick={() => setTab('good')}>
            {tr('vis.good')} {goodTotal > 0 && <span style={{ opacity: 0.7, fontSize: 11 }}>({goodTotal.toLocaleString()})</span>}
          </button>
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
            {tr('vis.all')}
          </button>
          <button className={tab === 'bad' ? 'active bad' : ''} onClick={() => setTab('bad')}>
            {tr('vis.bad')} {badTotal > 0 && <span style={{ opacity: 0.7, fontSize: 11 }}>({badTotal.toLocaleString()})</span>}
          </button>
        </div>
        <span className="ml-auto"/>
        <Filter>
          <span className="dim mono" style={{ fontSize: 11 }}>{dateFrom} → {dateTo}</span>
        </Filter>
        <button className="btn sm primary" onClick={() => openExport(tab, { dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo, line: appliedFilters.line || undefined, ry: appliedFilters.ry || undefined, device: appliedFilters.device || undefined })} style={{ marginLeft: 8 }}>
          <Icon.export/> {tr('c.export')}
        </button>
      </div>

      {tab === 'good' && <ViewGood filters={appliedFilters} onRowClick={setSelectedGood} lang={lang}/>}
      {tab === 'all'  && <ViewAll goodTotal={goodTotal} badTotal={badTotal} filters={appliedFilters} onRowClick={setSelectedAll} lang={lang}/>}
      {tab === 'bad'  && <ViewBad filters={appliedFilters} onRowClick={setSelectedBad} lang={lang}/>}

      {selectedGood && <DetailModal row={selectedGood} kind="good" onClose={() => setSelectedGood(null)}/>}
      {selectedBad  && <DetailModal row={selectedBad}  kind="bad"  onClose={() => setSelectedBad(null)}/>}
      {selectedAll  && <DetailModal row={selectedAll} kind={selectedAll.Result === 'GOOD' ? 'good' : 'bad'} onClose={() => setSelectedAll(null)}/>}
    </>
  )
}
