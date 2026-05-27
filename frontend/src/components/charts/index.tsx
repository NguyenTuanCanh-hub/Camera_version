import { useState, useRef } from 'react'

// ─── Smooth bezier path helper ────────────────────────────────────────────────
function pathSmooth(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  const out = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    out.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }
  return out.join(' ')
}

// ─── Shared floating tooltip ──────────────────────────────────────────────────
function Tip({ x, y, flip = false, children }: { x: number; y: number; flip?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(${flip ? 'calc(-100% - 10px)' : '10px'}, -50%)`,
      background: 'rgba(8,14,30,0.97)',
      border: '1px solid rgba(0,217,255,0.25)',
      borderRadius: 7, padding: '7px 13px',
      fontSize: 13, fontFamily: 'var(--font-mono)',
      color: '#CBD5E1', whiteSpace: 'nowrap',
      pointerEvents: 'none', zIndex: 100,
      boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
    }}>{children}</div>
  )
}

// ─── Sparkline — bar micro-chart with avg line, peak marker, x-axis, tooltip ──
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: boolean
  glow?: boolean
  live?: boolean
}

export function Sparkline({ data, height = 64 }: SparklineProps) {
  const [hov, setHov] = useState<number | null>(null)
  if (!data?.length) return null

  const max   = Math.max(...data, 1)
  const avg   = data.reduce((s, v) => s + v, 0) / data.length
  const peak  = data.indexOf(max)
  const n     = data.length

  const AXIS_H = 14
  const BAR_H  = height - AXIS_H
  const step = Math.max(1, Math.round(n / 6))

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ position: 'relative', height: BAR_H }}>
        <div style={{
          position: 'absolute',
          bottom: `${Math.max(4, (avg / max) * 100)}%`,
          left: 0, right: 0, height: 1,
          borderTop: '1px dashed rgba(255,255,255,0.18)',
          pointerEvents: 'none', zIndex: 1,
        }}>
          <span style={{
            position: 'absolute', right: 0, top: -11,
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.25)', background: 'none',
          }}>avg</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 1 }}>
          {data.map((v, i) => {
            const pct    = Math.max(5, (v / max) * 100)
            const isHov  = hov === i
            const isPeak = i === peak
            const t      = i / Math.max(1, n - 1)
            const r      = Math.round(0 + 139 * t)
            const g      = Math.round(217 - (217 - 92) * t)
            const b      = Math.round(255 - (255 - 246) * t)
            return (
              <div key={i}
                style={{ flex: 1, height: pct + '%', position: 'relative', borderRadius: '2px 2px 0 0',
                  cursor: 'default', transition: 'background 120ms, box-shadow 120ms',
                  background: isHov ? '#67E8F9' : isPeak ? 'rgba(103,232,249,0.75)' : `rgba(${r},${g},${b},${0.28 + 0.6 * (v / max)})`,
                  boxShadow: isHov ? '0 0 10px rgba(103,232,249,0.75)' : isPeak ? '0 0 5px rgba(103,232,249,0.4)' : 'none',
                  zIndex: 2,
                }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              >
                {isPeak && (
                  <div style={{
                    position: 'absolute', top: -7, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#67E8F9',
                    boxShadow: '0 0 6px rgba(103,232,249,0.9)',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', height: AXIS_H, alignItems: 'flex-start', paddingTop: 2 }}>
        {data.map((_, i) => (
          <div key={i} style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4B5E75', textAlign: 'center' }}>
            {i % step === 0 ? `${i}h` : ''}
          </div>
        ))}
      </div>
      {hov !== null && (
        <div style={{
          position: 'absolute',
          bottom: AXIS_H + 8,
          left: `${Math.min(85, Math.max(15, ((hov + 0.5) / n) * 100))}%`,
          transform: hov / n > 0.7 ? 'translateX(-88%)' : hov / n < 0.15 ? 'translateX(-10%)' : 'translateX(-50%)',
          background: 'rgba(6,12,28,0.97)',
          border: '1px solid rgba(0,217,255,0.25)',
          borderRadius: 7, padding: '7px 12px',
          pointerEvents: 'none', zIndex: 50,
          boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
            {String(hov).padStart(2, '0')}:00
            {hov === peak && <span style={{ marginLeft: 8, color: '#F59E0B', fontSize: 11 }}>▲ cao nhất</span>}
          </div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F1F5F9' }}>
            {data[hov].toLocaleString()}
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 400, marginLeft: 5 }}>scans</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Area Chart — multi-series with hover crosshair + tooltip ─────────────────
interface AreaSeriesItem {
  label: string
  data: number[]
  color: string
  labels?: string[]
  dashed?: boolean
  thick?: boolean
}
interface AreaChartProps {
  series: AreaSeriesItem[]
  width?: number
  height?: number
  padding?: { t: number; r: number; b: number; l: number }
  showGrid?: boolean
  showAxis?: boolean
}

export function AreaChart({
  series, width = 900, height = 260,
  padding = { t: 16, r: 14, b: 28, l: 52 },
  showGrid = true, showAxis = true,
}: AreaChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hov, setHov] = useState<{ idx: number; x: number; y: number; flip: boolean } | null>(null)

  const innerW  = width - padding.l - padding.r
  const innerH  = height - padding.t - padding.b
  const n       = series[0]?.data.length || 0
  const stepX   = n > 1 ? innerW / (n - 1) : 0
  const allVals = series.flatMap(s => s.data)
  const max     = Math.max(...allVals, 1) * 1.1
  const yTicks  = 4
  const ticks   = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max / yTicks) * i))
  const xLabels = series[0]?.labels || []

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapRef.current || n < 2) return
    const rect = wrapRef.current.getBoundingClientRect()
    const relX  = e.clientX - rect.left
    const relY  = e.clientY - rect.top
    const svgX  = (relX / rect.width) * width
    const col   = Math.max(0, Math.min(n - 1, Math.round((svgX - padding.l) / stepX)))
    setHov({ idx: col, x: relX, y: relY, flip: relX / rect.width > 0.65 })
  }

  const crossX = hov != null ? padding.l + hov.idx * stepX : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`areaFill_${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {showGrid && ticks.map((t, i) => {
          const y = padding.t + innerH - (t / max) * innerH
          return <line key={i} x1={padding.l} x2={padding.l + innerW} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        })}
        {showAxis && xLabels.map((lbl, i) => {
          if (i % Math.max(1, Math.floor(n / 8)) !== 0 && i !== n - 1) return null
          return <text key={i} x={padding.l + i * stepX} y={height - 8} fontSize="17" fill="#64748B" textAnchor="middle" fontFamily="JetBrains Mono">{lbl}</text>
        })}
        {showAxis && ticks.map((t, i) => {
          const y = padding.t + innerH - (t / max) * innerH
          return <text key={i} x={padding.l - 8} y={y + 4} fontSize="17" fill="#64748B" textAnchor="end" fontFamily="JetBrains Mono">{t}</text>
        })}
        {series.map((s, i) => {
          const pts   = s.data.map((v, idx) => ({ x: padding.l + idx * stepX, y: padding.t + innerH - (v / max) * innerH }))
          const d     = pathSmooth(pts)
          const fillD = `${d} L ${pts[pts.length - 1].x} ${padding.t + innerH} L ${pts[0].x} ${padding.t + innerH} Z`
          return (
            <g key={i}>
              {!s.dashed && <path d={fillD} fill={`url(#areaFill_${i})`} />}
              <path d={d} fill="none" stroke={s.color}
                strokeWidth={s.thick ? '2.4' : '1.8'}
                strokeDasharray={s.dashed ? '4 4' : 'none'}
                strokeLinecap="round" />
              {!s.dashed && pts.length > 0 && (
                <>
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={s.color} opacity="0.5">
                    <animate attributeName="r" values="3.5;7;3.5" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={s.color} />
                </>
              )}
            </g>
          )
        })}
        {hov != null && crossX != null && (
          <>
            <line x1={crossX} y1={padding.t} x2={crossX} y2={padding.t + innerH}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
            {series.map((s, i) => {
              const cy = padding.t + innerH - (s.data[hov.idx] / max) * innerH
              return <circle key={i} cx={crossX} cy={cy} r={4.5} fill={s.color} stroke="rgba(8,14,30,0.85)" strokeWidth="2" />
            })}
          </>
        )}
      </svg>
      {hov != null && (
        <Tip x={hov.x} y={hov.y} flip={hov.flip}>
          <div style={{ fontWeight: 700, marginBottom: 5, color: '#64748B', fontSize: 12, letterSpacing: 0.5 }}>
            {xLabels[hov.idx] ?? `${String(hov.idx).padStart(2, '0')}h`}
          </div>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: i > 0 ? 3 : 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ color: '#94A3B8', fontSize: 12.5, flex: 1 }}>{s.label}</span>
              <span style={{ color: '#E2E8F0', fontWeight: 700, marginLeft: 12 }}>{s.data[hov.idx]}</span>
            </div>
          ))}
        </Tip>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: padding.l }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            <span style={{ width: 18, height: 2, background: s.dashed ? 'none' : s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : 'none', display: 'inline-block', borderRadius: 2 }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Donut — ring chart with hover detail ─────────────────────────────────────
interface DonutProps {
  value: number; total: number
  colorA?: string; colorB?: string
  label?: string; size?: number; strokeW?: number
}
export function Donut({ value, total, colorA = '#10B981', colorB = '#34D399', label = '', size = 200, strokeW = 18 }: DonutProps) {
  const [hov, setHov] = useState(false)
  const r   = (size - strokeW) / 2
  const c   = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ cursor: 'default', transition: 'filter 200ms', filter: hov ? 'drop-shadow(0 0 10px rgba(16,185,129,0.35))' : 'none' }}>
      <defs>
        <linearGradient id={`donut_${label}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={colorA} /><stop offset="100%" stopColor={colorB} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#donut_${label})`}
        strokeWidth={strokeW}
        strokeDasharray={`${c*pct} ${c}`} strokeDashoffset={0} strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 800ms cubic-bezier(.22,1,.36,1)' }} />
      {!hov ? (
        <>
          <text x={size/2} y={size/2-4} textAnchor="middle" fontSize="32" fontFamily="JetBrains Mono" fontWeight="700" fill="#FFFFFF">
            {total > 0 ? (value === total ? '100%' : `${(pct * 100).toFixed(pct * 100 > 99.9 ? 2 : 1)}%`) : '0%'}
          </text>
          <text x={size/2} y={size/2+18} textAnchor="middle" fontSize="13" fill="#94A3B8" fontWeight="600" letterSpacing="1.2">{label}</text>
        </>
      ) : (
        <>
          <text x={size/2} y={size/2-10} textAnchor="middle" fontSize="20" fontFamily="JetBrains Mono" fontWeight="700" fill={colorA}>{value.toLocaleString()}</text>
          <text x={size/2} y={size/2+10} textAnchor="middle" fontSize="12" fill="#64748B" fontFamily="JetBrains Mono">/ {total.toLocaleString()} total</text>
          <text x={size/2} y={size/2+26} textAnchor="middle" fontSize="12" fill="#475569" fontFamily="JetBrains Mono">{(total-value).toLocaleString()} not pass</text>
        </>
      )}
    </svg>
  )
}

// ─── RingChart — multi-segment donut ring ─────────────────────────────────────
interface RingSegment { label: string; value: number; color: string }

export function RingChart({ segments, size = 150, strokeW = 22 }: { segments: RingSegment[]; size?: number; strokeW?: number }) {
  const [hov, setHov] = useState<number | null>(null)
  const total = segments.reduce((s, d) => s + d.value, 0) || 1
  const r     = (size - strokeW) / 2
  const c     = 2 * Math.PI * r
  const GAP   = segments.length > 1 ? 3 : 0

  if (!segments.length) return null

  let cumDeg = -90

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: 'visible' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeW} />
          {segments.map((seg, i) => {
            const frac     = seg.value / total
            const dash     = Math.max(0, frac * c - GAP)
            const startDeg = cumDeg
            cumDeg        += frac * 360
            const isHov    = hov === i
            return (
              <circle key={i}
                cx={size/2} cy={size/2} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHov ? strokeW + 4 : strokeW}
                strokeDasharray={`${dash} ${c}`}
                transform={`rotate(${startDeg} ${size/2} ${size/2})`}
                style={{ transition: 'stroke-width 150ms', cursor: 'default',
                  filter: isHov ? `drop-shadow(0 0 6px ${seg.color})` : 'none' }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              />
            )
          })}
          {hov !== null ? (
            <>
              <text x={size/2} y={size/2 - 5} textAnchor="middle" fontSize="20" fontWeight="700"
                fill={segments[hov].color} fontFamily="JetBrains Mono">{segments[hov].value}</text>
              <text x={size/2} y={size/2 + 13} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="JetBrains Mono">
                {((segments[hov].value / total) * 100).toFixed(1)}%</text>
            </>
          ) : (
            <text x={size/2} y={size/2 + 6} textAnchor="middle" fontSize="17" fontWeight="700"
              fill="#CBD5E1" fontFamily="JetBrains Mono" dominantBaseline="middle">{total}</text>
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
        {segments.map((seg, i) => (
          <div key={i}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13,
              fontFamily: 'var(--font-mono)', cursor: 'default',
              opacity: hov !== null && hov !== i ? 0.3 : 1, transition: 'opacity 150ms' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0,
              boxShadow: hov === i ? `0 0 7px ${seg.color}` : 'none', transition: 'box-shadow 150ms' }} />
            <span style={{ flex: 1, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ color: '#94A3B8', fontWeight: 600 }}>{seg.value}</span>
            <span style={{ color: '#475569', minWidth: 36, textAlign: 'right' }}>{((seg.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
