import CountUp from './CountUp'

interface KpiCardProps {
  label: string
  value: number
  fmt?: (n: number) => string
  accent?: 'default' | 'good' | 'bad'
  sub?: string
}

// Ô chỉ số KPI: hiển thị tiêu đề, giá trị số (có hiệu ứng đếm), và chú thích phụ
// Dùng ở VisionReportPage và CustomerReportPage để tóm tắt tổng GOOD/BAD/trung bình
export default function KpiCard({ label, value, fmt, accent = 'default', sub }: KpiCardProps) {
  const valClass = accent === 'good' ? 'kpi-value grad-good' : accent === 'bad' ? 'kpi-value grad-bad' : 'kpi-value grad'
  return (
    <div className={`kpi${accent !== 'default' ? ' ' + accent : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className={valClass}>
        <CountUp value={value} fmt={fmt} />
      </div>
      {sub && <div className="kpi-foot"><span className="dim">{sub}</span></div>}
    </div>
  )
}
