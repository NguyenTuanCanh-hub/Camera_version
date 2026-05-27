import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface BarChartJSProps {
  labels: string[]
  values: number[]
  height?: number
  label?: string
  colors?: string[]
}

// Biểu đồ cột dùng Chart.js, hiển thị sản lượng theo giờ hoặc theo dây chuyền
// Nhận mảng labels và values từ trang báo cáo, tự tô màu gradient theo giá trị
export default function BarChartJS({ labels, values, height = 200, label = 'Value', colors }: BarChartJSProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const max = Math.max(...values, 1)
    const resolvedColors = colors ?? values.map(v => {
      const t = v / max
      const r = Math.round(139 * (1 - t))
      const g = Math.round(92 + 125 * t)
      const b = Math.round(246 + 9 * t)
      return `rgba(${r},${g},${b},${0.55 + 0.40 * t})`
    })

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          backgroundColor: resolvedColors,
          borderRadius: 5,
          maxBarThickness: 44,
          barPercentage: 0.78,
          categoryPercentage: 0.85,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c: any) => `${c.dataset.label}: ${Number(c.raw).toLocaleString()}` },
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748B', font: { size: 13, family: 'JetBrains Mono' }, maxRotation: 30 },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748B', font: { size: 13 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    } as any)

    return () => { chartRef.current?.destroy(); chartRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(values), JSON.stringify(colors)])

  if (!values.length) return (
    <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
      Không có dữ liệu
    </div>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  )
}
