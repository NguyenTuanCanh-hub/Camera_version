import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface ParetoChartJSProps {
  data: { label: string; value: number }[]
  height?: number
}

// Biểu đồ Pareto (cột sắp xếp giảm dần) thể hiện dây chuyền có nhiều lỗi nhất
// Nhận mảng {label, value} từ ViewBad, sắp xếp và vẽ bằng Chart.js
export default function ParetoChartJS({ data, height = 240 }: ParetoChartJSProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const sorted = [...data].sort((a, b) => b.value - a.value)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.label),
        datasets: [
          {
            type: 'bar',
            label: 'Số lỗi',
            data: sorted.map(d => d.value),
            backgroundColor: '#D85A30',
            borderRadius: 4,
            maxBarThickness: 60,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            yAxisID: 'y',
          } as any,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const label = ctx.dataset.label ?? ''
                const val = ctx.parsed.y
                return ctx.datasetIndex === 1 ? `${label}: ${val}%` : `${label}: ${val}`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#888780',
              font: { size: 13 },
              autoSkip: false,
              maxRotation: 30,
            },
            grid: { color: 'rgba(136,135,128,0.15)' },
          },
          y: {
            title: {
              display: true,
              text: 'Số lỗi',
              color: '#888780',
              font: { size: 13 },
            },
            ticks: { color: '#888780', font: { size: 13 } },
            grid: { color: 'rgba(136,135,128,0.15)' },
            beginAtZero: true,
          },
        },
      },
    } as any)

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sorted)])

  if (!data.length) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
        Không có dữ liệu lỗi
      </div>
    )
  }

  return (
    <div>

      {/* Canvas wrapper */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Pareto chart top nguyên nhân lỗi theo dây chuyền"
        >
          Biểu đồ Pareto thể hiện dây chuyền có nhiều lỗi nhất theo nguyên lý 80/20.
        </canvas>
      </div>
    </div>
  )
}
