import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '@/components/common/Icons'
import { KpiCard } from '@/components/common'
import {
  fetchCustomer, fetchCustomerStats, fetchCustomerDepNames,
  uploadCustomerFile, clearCustomerData,
  type CustomerRecord, type CustomerStats,
} from '@/services/customerApi'
import { translate, type Lang } from '@/i18n'

// ─── Feature toggles ──────────────────────────────────────────────────────────
const SHOW_IMPORT_PANEL = false   // đổi thành false để ẩn khu vực upload Excel

const PAGE_SIZE = 50

const today   = new Date().toISOString().slice(0, 10)


type TabId = 'good' | 'all' | 'bad'


// ─── Pager ────────────────────────────────────────────────────────────────────
function Pager({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void
}) {
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to   = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--border-hair)', fontSize: 12, gap: 8 }}>
      <span style={{ color: 'var(--t3)', fontSize: 11.5 }}>
        {from.toLocaleString()}–{to.toLocaleString()} / <span className="mono">{total.toLocaleString()}</span> records
      </span>
      <span className="ml-auto" />
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
  filters: { dateFrom: string; dateTo: string; line?: string; ry?: string }
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
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="glass" style={{ padding: 18 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: 44, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 8,
          animation: 'shimmer 1.4s ease-in-out infinite' }} />
      ))}
    </div>
  )
}

// ─── Customer table (no image column) ─────────────────────────────────────────
function CustomerTable({ records, pager }: { records: CustomerRecord[]; pager: React.ReactNode }) {
  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ maxHeight: 560, overflowY: 'auto' }} className="scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th>Date / Time</th><th>DEPT</th><th>RY</th>
              <th>Size</th><th>PO</th><th>Qty</th><th>UPC</th><th>RFID</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={String(r.id) + i}>
                <td className="mono dim" style={{ fontSize: 11.5 }}>{r.DateScan}</td>
                <td><span className="chip">{r.Line || '—'}</span></td>
                <td className="mono" style={{ fontWeight: 600 }}>{r.RY}</td>
                <td className="mono">{r.Size}</td>
                <td className="mono">{r.PO}</td>
                <td className="mono">{r.Qty}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{r.UPC}</td>
                <td className="mono" style={{ fontSize: 11 }}>{r.RFID || '—'}</td>
                <td>
                  {r.Status.toUpperCase() === 'GOOD' || !r.Status
                    ? <span className="badge good">● GOOD</span>
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(239,68,68,0.18)', color: '#FCA5A5',
                        border: '1px solid rgba(239,68,68,0.35)' }}>{r.Status}</span>}
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

// ─── Live badge ───────────────────────────────────────────────────────────────
function LiveBadge({ ts }: { ts: Date | null }) {
  return (
    <div className="row gap-2" style={{ fontSize: 11, color: 'var(--t2)' }}>
      <span className="live-pip">LIVE</span>
      {ts && <span className="mono" style={{ color: 'var(--t3)' }}>↻ {ts.toLocaleTimeString()}</span>}
    </div>
  )
}

// ─── Import panel ─────────────────────────────────────────────────────────────
function ImportPanel({ onImported, onCleared, onBusy, lang }: {
  onImported: (count: number) => void
  onCleared: () => void
  onBusy: (busy: boolean) => void
  lang: Lang
}) {
  const tr = (k: string) => translate(lang, k)
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [msg,   setMsg]   = useState('')
  const [pct,   setPct]   = useState(0)
  const [drag,  setDrag]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setState('error'); setMsg(tr('cust.invalidFile')); return
    }
    setState('uploading'); setPct(0); setMsg(''); onBusy(true)
    try {
      const result = await uploadCustomerFile(file, p => setPct(p))
      setState('done'); setPct(0); onBusy(false)
      setMsg(`✓ ${result.inserted.toLocaleString()} ${tr('cust.inserted')} · ${result.skipped.toLocaleString()} skipped`)
      onImported(result.inserted)
    } catch (e: any) {
      setState('error'); setPct(0); onBusy(false); setMsg(e.message || 'Error')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const doClear = async () => {
    if (!confirm(tr('cust.confirmClear'))) return
    try {
      await clearCustomerData()
      setState('idle'); setMsg('')
      onCleared()
    } catch (e: any) { setState('error'); setMsg(e.message) }
  }

  const busy  = state === 'uploading'
  const color = state === 'error' ? '#EF4444' : state === 'done' ? '#10B981' : 'var(--t2)'

  return (
    <div className="glass" style={{ padding: '14px 18px', marginBottom: 16,
      background: 'linear-gradient(90deg,rgba(0,217,255,0.05),rgba(139,92,246,0.04))',
      border: '1px solid rgba(0,217,255,0.18)' }}>
      <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{
            flex: 1, minWidth: 220, minHeight: 52,
            border: `1px dashed ${drag ? '#00D9FF' : 'rgba(0,217,255,0.35)'}`,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, cursor: busy ? 'wait' : 'pointer',
            background: drag ? 'rgba(0,217,255,0.07)' : 'transparent',
            transition: 'all 150ms', color: 'var(--t2)', fontSize: 13,
          }}>
          <Icon.export />
          <span>{tr('cust.dropHere')}</span>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
        </div>
        {msg && !busy && (
          <span style={{ fontSize: 12, color, alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>{msg}</span>
        )}
        <div className="row gap-2" style={{ alignSelf: 'center' }}>
          {state === 'error' && (
            <button className="btn sm" onClick={() => { setState('idle'); setMsg('') }}>Reset</button>
          )}
          <button className="btn sm" style={{ color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.4)' }}
            onClick={doClear}>{tr('cust.clearData')}</button>
        </div>
      </div>

      {/* Progress bar */}
      {busy && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11,
            color: 'var(--t3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
            <span>{pct < 100 ? tr('cust.uploading') : tr('cust.parsing')}</span>
            <span>{pct < 100 ? `${pct}%` : '…'}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            {pct < 100
              ? <div style={{ height: '100%', width: `${pct}%`,
                  background: 'linear-gradient(90deg,#00D9FF,#8B5CF6)',
                  borderRadius: 2, transition: 'width 150ms ease' }} />
              : <div style={{ height: '100%', width: '100%',
                  background: 'linear-gradient(90deg,#00D9FF,#8B5CF6,#00D9FF)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite' }} />}
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>
        {tr('cust.colHint')}
      </div>
    </div>
  )
}

// ─── ViewGood ─────────────────────────────────────────────────────────────────
function ViewGood({ filters, lang }: {
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; trigger: number }
  lang: Lang
}) {
  const tr = (k: string) => translate(lang, k)
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [ts,      setTs]      = useState<Date | null>(null)
  const [page,    setPage]    = useState(1)
  const mountedRef = useRef(false)
  const pageMountRef = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abort.current?.abort()
    abort.current = new AbortController()
    if (initial) setLoading(true)
    fetchCustomer({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined,
      ry: filters.ry || undefined, status: 'GOOD', page, pageSize: PAGE_SIZE }, abort.current.signal)
      .then(r => { setRecords(r.records); setTotal(r.total); setTs(new Date()); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); console.error(e) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, page])

  const fetchRef = useRef(doFetch); fetchRef.current = doFetch

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountRef.current) { pageMountRef.current = true; return }
    fetchRef.current(true)
  }, [page])

  useEffect(() => {
    fetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) fetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <>
      <div className="sec" style={{ marginTop: 8 }}>
        <div>
          <h2>{tr('vis.verified')}</h2>
          <div className="sub">{total.toLocaleString()} total · page {page}/{totalPages}</div>
        </div>
        <div className="row gap-2"><LiveBadge ts={ts} /></div>
      </div>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5' }}>⚠ {error}</div>
        : loading ? <TableSkeleton />
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <CustomerTable records={records}
            pager={<Pager page={page} totalPages={totalPages} total={total}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))} />} />}
    </>
  )
}

// ─── ViewBad ──────────────────────────────────────────────────────────────────
function ViewBad({ filters, lang }: {
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; trigger: number }
  lang: Lang
}) {
  const tr = (k: string) => translate(lang, k)
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [ts,      setTs]      = useState<Date | null>(null)
  const [page,    setPage]    = useState(1)
  const mountedRef = useRef(false)
  const pageMountRef = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abort.current?.abort()
    abort.current = new AbortController()
    if (initial) setLoading(true)
    fetchCustomer({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined,
      ry: filters.ry || undefined, status: 'NOTGOOD', page, pageSize: PAGE_SIZE }, abort.current.signal)
      .then(r => { setRecords(r.records); setTotal(r.total); setTs(new Date()); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); console.error(e) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, page])

  const fetchRef = useRef(doFetch); fetchRef.current = doFetch

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountRef.current) { pageMountRef.current = true; return }
    fetchRef.current(true)
  }, [page])

  useEffect(() => {
    fetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) fetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: '-40px -40px 0 -40px', zIndex: -1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(239,68,68,0.10), transparent 70%)' }} />

      <div className="sec" style={{ marginTop: 8 }}>
        <div>
          <h2>{tr('vis.invQueue')}</h2>
          <div className="sub">{total.toLocaleString()} total · page {page}/{totalPages}</div>
        </div>
        <div className="row gap-2"><LiveBadge ts={ts} /></div>
      </div>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5' }}>⚠ {error}</div>
        : loading ? <TableSkeleton />
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <CustomerTable records={records}
            pager={<Pager page={page} totalPages={totalPages} total={total}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))} />} />}
    </div>
  )
}

// ─── ViewAll ──────────────────────────────────────────────────────────────────
function ViewAll({ filters, stats, lang }: {
  filters: { dateFrom: string; dateTo: string; line: string; ry: string; trigger: number }
  stats: CustomerStats
  lang: Lang
}) {
  const tr = (k: string) => translate(lang, k)
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [ts,      setTs]      = useState<Date | null>(null)
  const [page,    setPage]    = useState(1)
  const mountedRef = useRef(false)
  const pageMountRef = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const doFetch = useCallback((initial = false) => {
    abort.current?.abort()
    abort.current = new AbortController()
    if (initial) setLoading(true)
    fetchCustomer({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, line: filters.line || undefined,
      ry: filters.ry || undefined, page, pageSize: PAGE_SIZE }, abort.current.signal)
      .then(r => { setRecords(r.records); setTotal(r.total); setTs(new Date()); setError(null) })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); console.error(e) } })
      .finally(() => { if (initial) setLoading(false) })
  }, [filters.dateFrom, filters.dateTo, filters.line, filters.ry, page])

  const fetchRef = useRef(doFetch); fetchRef.current = doFetch

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setPage(1)
  }, [filters.trigger])

  useEffect(() => {
    if (!pageMountRef.current) { pageMountRef.current = true; return }
    fetchRef.current(true)
  }, [page])

  useEffect(() => {
    fetchRef.current(true)
    const id = setInterval(() => { if (!document.hidden) fetchRef.current(false) }, 30000)
    return () => clearInterval(id)
  }, [filters.trigger])

  const all = stats.goodTotal + stats.badTotal
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <div className="kpi-grid">
        <KpiCard label={tr('vis.totalScans')}     value={all} />
        <KpiCard label={tr('vis.meetStandard')}   value={stats.goodTotal} accent="good" />
        <KpiCard label={tr('vis.defectDetected')} value={stats.badTotal}  accent="bad" />
        <KpiCard label={tr('vis.avgOutput')}
          value={all}
          fmt={() => all > 0 ? `${((stats.goodTotal / all) * 100).toFixed(1)}%` : '0%'}
        />
      </div>

      <div className="sec" style={{ marginTop: 8 }}>
        <div>
          <h2>{tr('vis.allRecords')}</h2>
          <div className="sub">{total.toLocaleString()} total · page {page}/{totalPages}</div>
        </div>
        <div className="row gap-2"><LiveBadge ts={ts} /></div>
      </div>
      {error
        ? <div className="glass" style={{ padding: 18, border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5' }}>⚠ {error}</div>
        : loading ? <TableSkeleton />
        : records.length === 0 ? <EmptyState filters={filters} lang={lang}/>
        : <CustomerTable records={records}
            pager={<Pager page={page} totalPages={totalPages} total={total}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))} />} />}
    </>
  )
}

// ─── CustomerReportPage (root) ────────────────────────────────────────────────
interface Props { lang: Lang; onUploadBusy?: (busy: boolean) => void }

// Trang báo cáo dữ liệu khách hàng: xem kết quả quét GOOD / NOT GOOD / Tất cả, có thể upload file Excel
// Lấy dữ liệu từ customerApi.ts, tự làm mới thống kê 60 giây, báo AppShell khi đang upload để chặn chuyển trang
export default function CustomerReportPage({ lang, onUploadBusy }: Props) {
  const tr = (k: string) => translate(lang, k)
  const [tab,      setTab]      = useState<TabId>('all')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)
  const [line,      setLine]     = useState('')
  const [ry,        setRy]       = useState('')
  const [lines,     setLines]    = useState<string[]>([])
  const [lineOpen,  setLineOpen] = useState(false)
  const [stats,     setStats]    = useState<CustomerStats>({ hourly: [], byLine: [], goodTotal: 0, badTotal: 0 })
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: today, dateTo: today, line: '', ry: '', trigger: 0 })
  const [importKey, setImportKey] = useState(0)

  // Load DepName suggestions from Customer_Shoebox
  useEffect(() => {
    fetchCustomerDepNames().then(setLines).catch(() => {})
  }, [importKey])

  // Fetch stats whenever applied filters or importKey changes
  useEffect(() => {
    fetchCustomerStats({ dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo,
      line: appliedFilters.line || undefined, ry: appliedFilters.ry || undefined })
      .then(setStats).catch(console.error)
    const id = setInterval(() => {
      if (!document.hidden)
        fetchCustomerStats({ dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo,
          line: appliedFilters.line || undefined, ry: appliedFilters.ry || undefined })
          .then(setStats).catch(() => {})
    }, 60000)
    return () => clearInterval(id)
  }, [appliedFilters, importKey])

  const dateInvalid = !!dateFrom && !!dateTo && dateFrom > dateTo
  const doSearch = () => {
    if (!dateInvalid)
      setAppliedFilters({ dateFrom, dateTo, line, ry, trigger: appliedFilters.trigger + 1 })
  }

  return (
    <>
      {SHOW_IMPORT_PANEL && (
        <ImportPanel
          onImported={() => { setImportKey(k => k + 1); setAppliedFilters(f => ({ ...f, trigger: f.trigger + 1 })) }}
          onCleared={() => { setImportKey(k => k + 1); setAppliedFilters(f => ({ ...f, trigger: f.trigger + 1 })) }}
          onBusy={b => onUploadBusy?.(b)}
          lang={lang}
        />
      )}

      {/* Search strip */}
      <div className="vision-search">
        <div className="vs-field">
          <label>{tr('c.date')}</label>
          <div className="vs-input vs-daterange" style={dateInvalid ? { borderColor: '#F87171', boxShadow: '0 0 0 2px rgba(248,113,113,0.25)' } : {}}>
            <Icon.calendar />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="vs-sep">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {dateInvalid && (
            <div style={{ color: '#FCA5A5', fontSize: 11.5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠ {tr('vis.dateError')}
            </div>
          )}
        </div>
        <div className="vs-field" style={{ position: 'relative' }}>
          <label>{tr('c.line')}</label>
          <div className="vs-input">
            <input
              type="text"
              value={line}
              onChange={e => { setLine(e.target.value); setLineOpen(true) }}
              onFocus={() => setLineOpen(true)}
              onBlur={() => setTimeout(() => setLineOpen(false), 150)}
              placeholder={`${tr('c.line')}…`}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              autoComplete="off"
            />
            {line && <button className="vs-clear" onClick={() => { setLine(''); setLineOpen(false) }}><Icon.x /></button>}
          </div>
          {lineOpen && (() => {
            const filtered = line.trim() === ''
              ? lines
              : lines.filter(l => l.toLowerCase().includes(line.toLowerCase()))
            return filtered.length > 0 ? (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                background: 'var(--bg-card, #0F172A)', border: '1px solid rgba(0,217,255,0.25)',
                borderRadius: 8, marginTop: 4, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {filtered.map(l => (
                  <div
                    key={l}
                    onMouseDown={() => { setLine(l); setLineOpen(false) }}
                    style={{
                      padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                      fontFamily: 'var(--font-mono)', color: 'var(--t1)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,217,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {l}
                  </div>
                ))}
              </div>
            ) : null
          })()}
        </div>
        <div className="vs-field grow">
          <label>RY</label>
          <div className="vs-input">
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' }}>
              <Icon.search />
            </span>
            <input type="text" value={ry} onChange={e => setRy(e.target.value)}
              placeholder={tr('c.enterRY')} style={{ paddingLeft: 32 }}
              onKeyDown={e => e.key === 'Enter' && doSearch()} />
            {ry && <button className="vs-clear" onClick={() => setRy('')}><Icon.x /></button>}
          </div>
        </div>
        <button className="btn vs-search-btn" onClick={doSearch} disabled={dateInvalid}>
          <Icon.search /> {tr('c.search')}
        </button>
      </div>

      {/* Tab bar */}
      <div className="vis-tab-row row" style={{ marginBottom: 18 }}>
        <div className="seg">
          <button className={tab === 'good' ? 'active good' : ''} onClick={() => setTab('good')}>
            {tr('vis.good')} {stats.goodTotal > 0 && <span style={{ opacity: 0.7, fontSize: 11 }}>({stats.goodTotal.toLocaleString()})</span>}
          </button>
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
            {tr('vis.all')}
          </button>
          <button className={tab === 'bad' ? 'active bad' : ''} onClick={() => setTab('bad')}>
            {tr('vis.bad')} {stats.badTotal > 0 && <span style={{ opacity: 0.7, fontSize: 11 }}>({stats.badTotal.toLocaleString()})</span>}
          </button>
        </div>
        <span className="ml-auto" />
        <span className="dim mono" style={{ fontSize: 11, alignSelf: 'center' }}>{dateFrom} → {dateTo}</span>
      </div>

      {tab === 'good' && <ViewGood filters={appliedFilters} lang={lang} />}
      {tab === 'all'  && <ViewAll  filters={appliedFilters} stats={stats} lang={lang} />}
      {tab === 'bad'  && <ViewBad  filters={appliedFilters} lang={lang} />}
    </>
  )
}
