import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface BarChartJSProps {
  labels: string[]
  values: number[]
  height?: number
  label?: string
  colors?: string[]
  hoverLabels?: string[]
  targetLine?: number
  targetData?: (number | null)[]
  aboveLabel?: string
  belowLabel?: string
  noDataLabel?: string
}

export default function BarChartJS({
  labels, values, height = 200, label = 'Value',
  colors, hoverLabels, targetLine, targetData,
  aboveLabel = 'Above target', belowLabel = 'Below target', noDataLabel = 'No data',
}: BarChartJSProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // Nếu chart đã tồn tại, chỉ update data thay vì destroy + recreate
    if (chartRef.current) {
      const chart = chartRef.current
      chart.data.labels = labels
      chart.data.datasets[0].data = values
      const hasT = typeof targetLine === 'number' && targetLine > 0
      const max2 = Math.max(...values, 1)
      chart.data.datasets[0].backgroundColor = (colors ?? values.map(v => {
        if (v === 0) return 'rgba(255,255,255,0.04)'
        const t = v / max2
        const r = Math.round(139*(1-t)), g2 = Math.round(92+125*t), b = Math.round(246+9*t)
        return `rgba(${r},${g2},${b},${0.55+0.40*t})`
      })) as any
      if (hasT && chart.data.datasets.length > 1) {
        chart.data.datasets[1].data = targetData ?? Array(values.length).fill(targetLine)
      }
      chart.update('none')
      return
    }

    const hasTarget = typeof targetLine === 'number' && targetLine > 0

    // ── Plugin 1: gradient fill cho các cột ────────────────────────────────
    const gradientPlugin = {
      id: 'barGradient',
      beforeDatasetsDraw(chart: any) {
        if (!hasTarget) return
        const { ctx: c, chartArea, data } = chart
        if (!chartArea) return
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        g.addColorStop(0,   'rgba(56, 189, 248, 0.95)')
        g.addColorStop(0.5, 'rgba(59, 130, 246, 0.85)')
        g.addColorStop(1,   'rgba(99, 102, 241, 0.65)')
        data.datasets[0].backgroundColor = (data.datasets[0].data as number[]).map(
          (v: number) => v === 0 ? 'rgba(255,255,255,0.04)' : g
        )
      },
    }

    // ── Plugin 2: nhãn số trên đỉnh cột + nhãn target trên dot ─────────────
    const dataLabelsPlugin = {
      id: 'customLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx: c } = chart
        c.save()

        // Nhãn giá trị trên mỗi cột
        const barMeta = chart.getDatasetMeta(0)
        c.textAlign   = 'center'
        c.textBaseline = 'bottom'
        barMeta.data.forEach((bar: any, i: number) => {
          const v = chart.data.datasets[0].data[i] as number
          if (v === 0) return
          c.font      = `bold 12px "JetBrains Mono",monospace`
          c.fillStyle = '#F1F5F9'
          c.fillText(v.toLocaleString(), bar.x, bar.y - 5)
        })

        // Nhãn giá trị trên mỗi dot của đường target
        if (hasTarget && chart.data.datasets.length > 1) {
          const lineMeta = chart.getDatasetMeta(1)
          if (lineMeta?.visible) {
            c.font         = '9px "JetBrains Mono",monospace'
            c.fillStyle    = '#FCD34D'
            c.textBaseline = 'top'
            c.textAlign    = 'center'
            lineMeta.data.forEach((pt: any, i: number) => {
              if (i % 2 !== 0) return  // bỏ qua cột lẻ để tránh chồng chữ
              const tv = chart.data.datasets[1].data[i] as number
              if (tv) c.fillText(tv.toLocaleString(), pt.x, pt.y + 6)
            })
          }
        }

        c.restore()
      },
    }

    // ── Dataset: cột actual ─────────────────────────────────────────────────
    const max = Math.max(...values, 1)
    const defaultColors = values.map(v => {
      if (v === 0) return 'rgba(255,255,255,0.04)'
      const t = v / max
      const r = Math.round(139 * (1 - t))
      const g = Math.round(92 + 125 * t)
      const b = Math.round(246 + 9   * t)
      return `rgba(${r},${g},${b},${0.55 + 0.40 * t})`
    })

    const datasets: any[] = [{
      label: hasTarget ? `${label} (Actual)` : label,
      data: values,
      backgroundColor: hasTarget ? defaultColors : (colors ?? defaultColors),
      borderRadius: 6,
      maxBarThickness: 44,
      barPercentage: 0.82,
      categoryPercentage: 0.88,
      yAxisID: 'y',
    }]

    // ── Dataset: đường target ───────────────────────────────────────────────
    if (hasTarget) {
      datasets.push({
        type: 'line',
        label: 'Target/h',
        data: targetData ?? Array(values.length).fill(targetLine),
        spanGaps: false,
        borderColor: '#F59E0B',
        borderWidth: 2,
        pointRadius: 5,
        pointBackgroundColor: '#F59E0B',
        pointBorderColor: '#0F1535',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#FCD34D',
        fill: false,
        tension: 0,
        order: 0,
        yAxisID: 'y1',
      })
    }

    // ── Scales ──────────────────────────────────────────────────────────────
    const y1Max = hasTarget ? Math.ceil(targetLine! * 1.4 / 100) * 100 : undefined

    const scalesConfig: any = {
      x: {
        ticks: {
          color: '#CBD5E1',
          font: { size: 12, family: '"JetBrains Mono",monospace', weight: 'bold' },
          maxRotation: Math.max(...labels.map(l => l.length)) > 6 ? 45 : 0,
          minRotation: 0,
        },
        grid:   { color: 'rgba(255,255,255,0.025)' },
        border: { color: 'rgba(255,255,255,0.05)'  },
      },
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        ticks:  { color: '#CBD5E1', font: { size: 12, weight: 'bold' } },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'rgba(255,255,255,0.05)' },
        ...(hasTarget ? {
          title: {
            display: true,
            text: `${label} (Actual)`,
            color: '#00D9FF',
            font: { size: 10, family: '"JetBrains Mono",monospace' },
          },
        } : {}),
      },
    }

    if (hasTarget) {
      scalesConfig.y1 = {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        max: y1Max,
        ticks: {
          color: '#F59E0B',
          font: { size: 12, weight: 'bold' },
          stepSize: Math.round(y1Max! / 5 / 50) * 50,
        },
        grid:   { drawOnChartArea: false },
        border: { color: 'rgba(245,158,11,0.3)' },
        title: {
          display: true,
          text: 'Target/h',
          color: '#F59E0B',
          font: { size: 10, family: '"JetBrains Mono",monospace' },
        },
      }
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      plugins: [gradientPlugin, dataLabelsPlugin],
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: {
            display: hasTarget,
            position: 'top',
            align: 'center',
            labels: {
              color: '#94A3B8',
              font: { size: 11, family: '"JetBrains Mono",monospace' },
              boxWidth: 20,
              padding: 14,
            },
          },
          tooltip: {
            backgroundColor: '#0F1E3C',
            borderColor: 'rgba(99,102,241,0.50)',
            borderWidth: 1,
            titleColor: '#FCD34D',
            bodyColor: '#94D4FF',
            titleFont: { family: '"JetBrains Mono",monospace', size: 12, weight: 'bold' },
            bodyFont:  { family: '"JetBrains Mono",monospace', size: 12 },
            padding: 12,
            cornerRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
            callbacks: {
              title: (items: any[]) =>
                hoverLabels ? hoverLabels[items[0].dataIndex] : items[0].label,
              label: (c: any) => {
                const val = Number(c.raw)
                const rows = [`  ${c.dataset.label}: ${val.toLocaleString()}`]
                if (hasTarget && c.datasetIndex === 0) {
                  if (val === 0) {
                    rows.push(`  — ${noDataLabel}`)
                  } else {
                    const delta = val - targetLine!
                    rows.push(delta >= 0
                      ? `  ▲ +${delta.toLocaleString()} — ${aboveLabel}`
                      : `  ▼ ${Math.abs(delta).toLocaleString()} — ${belowLabel}`)
                  }
                }
                return rows
              },
            },
          },
        },
        scales: scalesConfig,
      },
    } as any)

    return () => { chartRef.current?.destroy(); chartRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(values), JSON.stringify(colors), targetLine])

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
