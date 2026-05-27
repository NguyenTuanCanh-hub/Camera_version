import { FACTORIES, setFactoryId, type Factory } from '@/config/factories'

// Simplified map outlines (geographic-looking polygons, viewBox 0 0 100 75)
const MAP_SHAPES: Record<string, string> = {
  lhg: 'M18,28 L26,10 L50,5 L74,12 L82,34 L78,54 L60,66 L36,65 L14,52 L11,38 Z',
  lyv: 'M10,36 L18,14 L44,6 L74,12 L90,32 L84,56 L64,70 L32,70 L10,54 Z',
  lvl: 'M20,14 L52,6 L80,16 L88,42 L74,64 L44,74 L16,62 L8,38 L16,22 Z',
}
const MAP_DOTS: Record<string, [number, number]> = {
  lhg: [36, 28],
  lyv: [50, 36],
  lvl: [56, 34],
}

// Generated once at module level so they don't re-randomise on modal re-open
const STARS = Array.from({ length: 120 }, () => ({
  x: Math.random() * 100, y: Math.random() * 100,
  r: Math.random() * 0.7 + 0.2,
  op: Math.random() * 0.55 + 0.15,
}))

function FactoryCard({ f, active, onSelect }: { f: Factory; active: boolean; onSelect: () => void }) {
  const path = MAP_SHAPES[f.id]
  const [dx, dy] = MAP_DOTS[f.id]

  return (
    <button
      className={`fsel-card${active ? ' active' : ''}`}
      style={{ '--fc': f.color, '--fg': f.glow } as React.CSSProperties}
      onClick={onSelect}
    >
      {/* ── Holographic map ───────────────────────────── */}
      <div className="fsel-holo">
        {/* Floating map */}
        <svg className="fsel-map" viewBox="0 0 100 75">
          <defs>
            <radialGradient id={`mg-${f.id}`} cx="50%" cy="50%" r="52%">
              <stop offset="0%"   stopColor={f.color} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={f.color} stopOpacity="0"/>
            </radialGradient>
          </defs>
          {/* Grid */}
          <g stroke={f.color} strokeWidth="0.4" opacity="0.12">
            {[0,1,2,3,4,5,6].map(i => <line key={`v${i}`} x1={i*17} y1="0" x2={i*17} y2="75"/>)}
            {[0,1,2,3,4].map(i => <line key={`h${i}`} x1="0" y1={i*19} x2="100" y2={i*19}/>)}
          </g>
          {/* Map fill */}
          <path d={path} fill={`url(#mg-${f.id})`}/>
          {/* Map outline with glow */}
          <path d={path} fill="none" stroke={f.color} strokeWidth="1.6"
            style={{ filter: `drop-shadow(0 0 4px ${f.color}) drop-shadow(0 0 10px ${f.color})` }}/>
          {/* Location dot + rings */}
          <circle cx={dx} cy={dy} r="10" fill="none" stroke={f.color} strokeWidth="0.4" opacity="0.2"/>
          <circle cx={dx} cy={dy} r="5.5" fill="none" stroke={f.color} strokeWidth="0.7" opacity="0.45"/>
          <circle cx={dx} cy={dy} r="2.8" fill={f.color}
            style={{ filter: `drop-shadow(0 0 5px ${f.color}) drop-shadow(0 0 2px #fff)` }}/>
        </svg>

        {/* Projection beam (trapezoid gradient below map) */}
        <svg className="fsel-beam" viewBox="0 0 120 64" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`bm-${f.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={f.color} stopOpacity="0.28"/>
              <stop offset="100%" stopColor={f.color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polygon points="22,0 98,0 120,64 0,64" fill={`url(#bm-${f.id})`}/>
        </svg>
      </div>

      {/* ── Hexagonal pedestal ────────────────────────── */}
      <svg className="fsel-ped" viewBox="0 0 200 92">
        {/* Platform glow */}
        <ellipse cx="100" cy="28" rx="70" ry="20" fill={f.color} fillOpacity="0.14"
          style={{ filter: 'blur(6px)' }}/>
        {/* Top face */}
        <polygon points="58,8 142,8 170,28 142,48 58,48 30,28"
          fill="rgba(180,220,255,0.08)" stroke={f.color} strokeWidth="0.8"
          style={{ filter: `drop-shadow(0 0 3px ${f.color})` }}/>
        <polygon points="58,8 142,8 170,28 142,48 58,48 30,28"
          fill={f.color} fillOpacity="0.07"/>
        {/* Top front edge glow */}
        <line x1="58" y1="8" x2="142" y2="8" stroke={f.color} strokeWidth="1.8" opacity="0.9"
          style={{ filter: `drop-shadow(0 0 4px ${f.color})` }}/>
        {/* Left face */}
        <polygon points="30,28 58,48 58,78 30,58"
          fill="rgba(8,14,45,0.97)" stroke={f.color} strokeWidth="0.5" strokeOpacity="0.28"/>
        {/* Front face */}
        <polygon points="58,48 142,48 142,78 58,78"
          fill="rgba(10,18,52,0.97)" stroke={f.color} strokeWidth="0.5" strokeOpacity="0.28"/>
        {/* Right face */}
        <polygon points="142,48 170,28 170,58 142,78"
          fill="rgba(8,14,45,0.97)" stroke={f.color} strokeWidth="0.5" strokeOpacity="0.28"/>
        {/* Factory code — front face */}
        <text x="100" y="69" textAnchor="middle" fill={f.color}
          fontSize="14" fontWeight="bold" letterSpacing="5"
          fontFamily="'Courier New',monospace"
          style={{ filter: active ? `drop-shadow(0 0 8px ${f.color})` : 'none' }}>
          {f.code}
        </text>
        {/* Side labels */}
        <text x="44" y="66" textAnchor="middle" fill={f.color}
          fontSize="7" letterSpacing="2" fontFamily="'Courier New',monospace"
          opacity="0.6" transform="skewX(-22)">{f.code}</text>
        <text x="156" y="66" textAnchor="middle" fill={f.color}
          fontSize="7" letterSpacing="2" fontFamily="'Courier New',monospace"
          opacity="0.6" transform="skewX(22)">{f.code}</text>
      </svg>

      {/* IP address label */}
      <div className="fsel-ip">{f.ip}</div>

      {/* Active selection ring */}
      {active && <div className="fsel-ring"/>}
    </button>
  )
}

interface Props {
  factory: Factory
  setFactory: (f: Factory) => void
  onClose: () => void
}

export default function FactorySelectModal({ factory, setFactory, onClose }: Props) {
  return (
    <div className="fsel-overlay" onClick={onClose}>
      {/* Starfield */}
      <svg className="fsel-starfield" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r / 6} fill="white" opacity={s.op}/>
        ))}
      </svg>

      <div className="fsel-modal" onClick={e => e.stopPropagation()}>
        <button className="fsel-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="fsel-head">
          <div className="fsel-hline"/>
          <span className="fsel-title-txt">◆ SELECT FACTORY ◆</span>
          <div className="fsel-hline"/>
        </div>
        <div className="fsel-subtitle">MULTI-SITE PRODUCTION MONITORING SYSTEM</div>

        {/* Factory cards */}
        <div className="fsel-cards">
          {FACTORIES.map(f => (
            <FactoryCard
              key={f.id}
              f={f}
              active={f.id === factory.id}
              onSelect={() => { setFactoryId(f.id); setFactory(f); onClose() }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
