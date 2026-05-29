import { useState } from 'react'
import { getApiBase, getFactoryId } from '@/config/factories'
import { useAppDispatch } from '@/app/hooks'
import { addToast } from '@/features/ui/uiSlice'
import { Icon } from '@/components/common/Icons'
import Modal from '@/components/ui/Modal'

export interface ExportCtx {
  tab: string
  dateFrom: string
  dateTo: string
  line?: string
  ry?: string
  device?: string
}

type ExportLang = 'vi' | 'en' | 'zh' | 'my'

const EXPORT_LANGS: { id: ExportLang; label: string }[] = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' },
  { id: 'zh', label: '中文' },
  { id: 'my', label: 'မြန်မာ' },
]

interface LangPack {
  reportTitle: string
  dataSheet: string
  statsSheet: string
  summarySection: string
  hourlySection: string
  lineSection: string
  totalRecords: string
  generatedAt: string
  hour: string
  count: string
  line: string
  goodLabel: string
  badLabel: string
  totalLabel: string
  cols: [string,string,string,string,string,string,string,string,string,string]
  modalTitle: string
  cancelBtn: string
  generateBtn: string
  langLabel: string
  dateRangeLabel: string
  formatLabel: string
  xlsxTitle: string
  sheetSummary: (data: string, stats: string) => string
  infoNote: (data: string, stats: string) => string
  lineFilterLabel: string
  ryFilterLabel: string
  generating: string
  exportSuccessTitle: string
  exportSuccessMsg: string
  exportFailedTitle: string
}

const L10N: Record<ExportLang, LangPack> = {
  vi: {
    reportTitle: 'Báo cáo hệ thống quét LYG',
    dataSheet: 'Dữ liệu',
    statsSheet: 'Thống kê',
    summarySection: 'Tổng hợp',
    hourlySection: 'Sản lượng theo giờ',
    lineSection: 'Theo dây chuyền',
    totalRecords: 'Tổng bản ghi',
    generatedAt: 'Thời gian xuất',
    hour: 'Giờ',
    count: 'Số lượng',
    line: 'Dây chuyền',
    goodLabel: 'ĐẠT',
    badLabel: 'KHÔNG ĐẠT',
    totalLabel: 'Tổng',
    cols: ['Ngày / Giờ','Dây chuyền','Mã sản phẩm','Cỡ giày','PO','Số lượng','UPC','RFID','Địa chỉ IP','Kết quả'],
    modalTitle: 'Xuất báo cáo',
    cancelBtn: 'Hủy',
    generateBtn: 'Tạo file',
    langLabel: 'Ngôn ngữ',
    dateRangeLabel: 'Khoảng dữ liệu',
    formatLabel: 'Định dạng',
    xlsxTitle: 'Excel · XLSX',
    sheetSummary: (data, stats) => `${data} + ${stats} · 2 sheets`,
    infoNote: (data, stats) => `Excel tạo nhiều sheet ${data} (mỗi sheet tối đa 10,000 bản ghi) + 1 sheet ${stats} (phân tích theo giờ & dây chuyền).`,
    lineFilterLabel: 'Dây chuyền',
    ryFilterLabel: 'RY',
    generating: 'Đang tạo XLSX…',
    exportSuccessTitle: 'Xuất hoàn tất',
    exportSuccessMsg: 'Xuất thành công · XLSX',
    exportFailedTitle: 'Xuất thất bại',
  },
  en: {
    reportTitle: 'LYG Scan Platform Report',
    dataSheet: 'Data',
    statsSheet: 'Statistics',
    summarySection: 'Summary',
    hourlySection: 'Hourly Breakdown',
    lineSection: 'Line Breakdown',
    totalRecords: 'Total Records',
    generatedAt: 'Generated At',
    hour: 'Hour',
    count: 'Count',
    line: 'Line',
    goodLabel: 'GOOD',
    badLabel: 'NOT GOOD',
    totalLabel: 'Total',
    cols: ['Date / Time','Line','Article (RY)','Size','PO','Qty','UPC','RFID','IP Address','Result'],
    modalTitle: 'Export Report',
    cancelBtn: 'Cancel',
    generateBtn: 'Generate',
    langLabel: 'Language',
    dateRangeLabel: 'Date range',
    formatLabel: 'Format',
    xlsxTitle: 'Excel · XLSX',
    sheetSummary: (data, stats) => `${data} + ${stats} · 2 sheets`,
    infoNote: (data, stats) => `Excel splits ${data} into sheets of 10,000 rows each + 1 ${stats} sheet for hourly and line breakdown.`,
    lineFilterLabel: 'Line',
    ryFilterLabel: 'RY',
    generating: 'Generating XLSX…',
    exportSuccessTitle: 'Export complete',
    exportSuccessMsg: 'Export successful · XLSX',
    exportFailedTitle: 'Export failed',
  },
  zh: {
    reportTitle: 'LYG 扫描平台报告',
    dataSheet: '数据',
    statsSheet: '统计',
    summarySection: '摘要',
    hourlySection: '每小时产量',
    lineSection: '按生产线统计',
    totalRecords: '记录总数',
    generatedAt: '生成时间',
    hour: '小时',
    count: '数量',
    line: '生产线',
    goodLabel: '合格',
    badLabel: '不合格',
    totalLabel: '总计',
    cols: ['日期/时间','生产线','商品编号','尺码','采购订单','数量','UPC','RFID','IP地址','结果'],
    modalTitle: '导出报告',
    cancelBtn: '取消',
    generateBtn: '生成',
    langLabel: '语言',
    dateRangeLabel: '数据范围',
    formatLabel: '格式',
    xlsxTitle: 'Excel · XLSX',
    sheetSummary: (data, stats) => `${data} + ${stats} · 2 个工作表`,
    infoNote: (data, stats) => `Excel 会将 ${data} 按每个工作表最多 10,000 条记录自动拆分，并额外创建 1 个 ${stats} 工作表，用于按小时和生产线分析。`,
    lineFilterLabel: '生产线',
    ryFilterLabel: 'RY',
    generating: '正在生成 XLSX…',
    exportSuccessTitle: '导出完成',
    exportSuccessMsg: '导出成功 · XLSX',
    exportFailedTitle: '导出失败',
  },
  my: {
    reportTitle: 'LYG စကင်ဖတ်မှတ်တမ်း',
    dataSheet: 'ဒေတာ',
    statsSheet: 'စာရင်းဇယား',
    summarySection: 'အကျဉ်းချုပ်',
    hourlySection: 'နာရီအလိုက် ထုတ်လုပ်မှု',
    lineSection: 'လိုင်းအလိုက်',
    totalRecords: 'မှတ်တမ်းစုစုပေါင်း',
    generatedAt: 'ထုတ်လုပ်ချိန်',
    hour: 'နာရီ',
    count: 'အရေအတွက်',
    line: 'လိုင်း',
    goodLabel: 'ကောင်းသည်',
    badLabel: 'ကောင်းမသည်',
    totalLabel: 'စုစုပေါင်း',
    cols: ['ရက်စွဲ / အချိန်','လိုင်း','ကုန်ပစ္စည်းကုဒ်','အရွယ်','PO','အရေအတွက်','UPC','RFID','IP လိပ်စာ','ရလဒ်'],
    modalTitle: 'အစီရင်ခံစာ ထုတ်ယူမည်',
    cancelBtn: 'မလုပ်တော့',
    generateBtn: 'ဖိုင်ထုတ်မည်',
    langLabel: 'ဘာသာစကား',
    dateRangeLabel: 'ရက်စွဲအပိုင်းအခြား',
    formatLabel: 'ဖော်မတ်',
    xlsxTitle: 'Excel · XLSX',
    sheetSummary: (data, stats) => `${data} + ${stats} · sheet ၂ ခု`,
    infoNote: (data, stats) => `Excel တွင် ${data} ကို sheet တစ်ခုလျှင် အများဆုံး ၁၀,၀၀၀ မှတ်တမ်းစီဖြင့် ခွဲထုတ်ပြီး ${stats} sheet ၁ ခုတွင် နာရီအလိုက်နှင့် လိုင်းအလိုက် ခွဲခြမ်းစိတ်ဖြာထားသည်။`,
    lineFilterLabel: 'လိုင်း',
    ryFilterLabel: 'RY',
    generating: 'XLSX ဖိုင် ထုတ်နေသည်…',
    exportSuccessTitle: 'Export ပြီးပါပြီ',
    exportSuccessMsg: 'XLSX ဖိုင် Export အောင်မြင်ပါသည်',
    exportFailedTitle: 'Export မအောင်မြင်ပါ',
  },
}

// Hộp thoại xuất báo cáo XLSX với 2 sheet: dữ liệu chi tiết + thống kê theo giờ/dây chuyền
// Nhận bộ lọc hiện tại (tab, ngày, line...) từ AppShell/VisionReportPage, cho chọn ngôn ngữ xuất (VI/EN/ZH/MY)
export default function ExportModal({
  ctx,
  onClose,
  lang: appLang = 'vi',
}: {
  ctx: ExportCtx
  onClose: () => void
  lang?: ExportLang
}) {
  const [lang, setLang] = useState<ExportLang>(appLang)
  const [progress, setProgress] = useState<number | null>(null)
  const dispatch = useAppDispatch()

  const lp = L10N[lang]

  const tabLabel: Record<string, string> = {
    good: lp.goodLabel,
    bad: lp.badLabel,
    all: lp.totalLabel,
  }

  const endpoint = ctx.tab === 'bad' ? 'notgood' : ctx.tab === 'good' ? 'good' : 'all'

  const exportXlsx = async () => {
    const { utils, writeFile } = await import('xlsx')
    const currentLp = L10N[lang]
    const SHEET_SIZE = 10000

    const base = new URLSearchParams({ dateFrom: ctx.dateFrom, dateTo: ctx.dateTo })
    base.set('factory', getFactoryId())
    if (ctx.line)   base.set('line', ctx.line)
    if (ctx.ry)     base.set('ry', ctx.ry)
    if (ctx.device) base.set('deviceType', ctx.device)

    setProgress(5)

    // Fetch stats + first page in parallel
    const firstP = new URLSearchParams(base)
    firstP.set('page', '1')
    firstP.set('pageSize', String(SHEET_SIZE))
    const [firstJson, statsJson] = await Promise.all([
      fetch(`${getApiBase()}/api/vision/${endpoint}?${firstP.toString()}`).then(r => r.json()),
      fetch(`${getApiBase()}/api/vision/${endpoint}/stats?${base.toString()}`).then(r => r.json()),
    ])

    const total: number = firstJson.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / SHEET_SIZE))
    const allRecords: any[] = [...(firstJson.records ?? [])]

    setProgress(10 + Math.round((1 / totalPages) * 75))

    // Fetch remaining pages sequentially
    for (let page = 2; page <= totalPages; page++) {
      const p = new URLSearchParams(base)
      p.set('page', String(page))
      p.set('pageSize', String(SHEET_SIZE))
      const res = await fetch(`${getApiBase()}/api/vision/${endpoint}?${p.toString()}`).then(r => r.json())
      allRecords.push(...(res.records ?? []))
      setProgress(10 + Math.round((page / totalPages) * 75))
    }

    const wb = utils.book_new()
    const sheetCount = Math.max(1, Math.ceil(allRecords.length / SHEET_SIZE))

    // One data sheet per 10,000 rows
    for (let s = 0; s < sheetCount; s++) {
      const chunk = allRecords.slice(s * SHEET_SIZE, (s + 1) * SHEET_SIZE)
      const dataAoa: any[][] = [currentLp.cols as unknown as any[]]
      chunk.forEach((r: any) => {
        dataAoa.push([
          r.DateScan    ?? '',
          r.Line        ?? '',
          r.RY          ?? '',
          r.Size        ?? '',
          r.PO          ?? '',
          r.Qty         ?? '',
          r.UPC         ?? '',
          r.RFID        ?? '',
          r.IP4_Address ?? '',
          r.Result      ?? (ctx.tab === 'bad' ? currentLp.badLabel : currentLp.goodLabel),
        ])
      })
      const ws = utils.aoa_to_sheet(dataAoa)
      ws['!cols'] = [{wch:22},{wch:14},{wch:16},{wch:8},{wch:14},{wch:6},{wch:16},{wch:28},{wch:16},{wch:10}]
      const sheetName = sheetCount > 1 ? `${currentLp.dataSheet} ${s + 1}` : currentLp.dataSheet
      utils.book_append_sheet(wb, ws, sheetName)
    }

    // Stats sheet
    const aoa: any[][] = [
      [currentLp.summarySection],
      [currentLp.totalRecords, allRecords.length],
      [currentLp.generatedAt,  new Date().toLocaleString()],
      [],
      [currentLp.hourlySection],
    ]

    if (ctx.tab === 'all' && statsJson.hourly) {
      aoa.push([currentLp.hour, currentLp.goodLabel, currentLp.badLabel, currentLp.totalLabel])
      statsJson.hourly.forEach((h: any) => {
        const t = (h.goodCount ?? 0) + (h.badCount ?? 0)
        aoa.push([`${h.hour}:${String(h.minute ?? 0).padStart(2,'0')}`, h.goodCount ?? 0, h.badCount ?? 0, t])
      })
    } else {
      aoa.push([currentLp.hour, currentLp.count])
      ;(statsJson.hourly ?? []).forEach((h: any) => aoa.push([`${h.hour}:00`, h.count]))
    }

    aoa.push([], [currentLp.lineSection], [currentLp.line, currentLp.count])
    ;(statsJson.byLine ?? []).forEach((l: any) => aoa.push([l.Line, l.count]))

    const ws2 = utils.aoa_to_sheet(aoa)
    ws2['!cols'] = [{wch:22},{wch:12},{wch:12},{wch:12}]
    utils.book_append_sheet(wb, ws2, currentLp.statsSheet)

    setProgress(95)
    writeFile(wb, `LYG_${tabLabel[ctx.tab] ?? 'Report'}_${ctx.dateFrom}_${ctx.dateTo}.xlsx`)
  }

  const fire = async () => {
    setProgress(0)
    try {
      await exportXlsx()
      setProgress(100)
      setTimeout(() => {
        onClose()
        dispatch(addToast({ type: 'success', message: lp.exportSuccessMsg, title: lp.exportSuccessTitle }))
      }, 400)
    } catch (err) {
      setProgress(null)
      dispatch(addToast({ type: 'error', message: String(err), title: lp.exportFailedTitle }))
    }
  }

  return (
    <Modal title={lp.modalTitle} onClose={onClose} width={580}
      footer={
        <>
          <span className="dim mono export-tab-label">{tabLabel[ctx.tab] ?? ctx.tab}</span>
          <span className="ml-auto" />
          <button className="btn" onClick={onClose}>{lp.cancelBtn}</button>
          <button className="btn primary export-generate-btn" onClick={fire}
            disabled={progress !== null && progress < 100}>
            <Icon.export /> {lp.generateBtn}
          </button>
        </>
      }
    >
      <div className="eyebrow">{lp.formatLabel}</div>
      <div className="export-format-box">
        <div className="export-format-title">{lp.xlsxTitle}</div>
        <div className="dim export-format-sub">
          {lp.sheetSummary(lp.dataSheet, lp.statsSheet)}
        </div>
      </div>

      <div className="eyebrow export-lang-label">{lp.langLabel}</div>
      <div className="export-lang-list">
        {EXPORT_LANGS.map(l => (
          <button key={l.id} onClick={() => setLang(l.id)}
            className={`export-lang-btn${lang === l.id ? ' selected' : ''}`}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="export-date-info mono">
        <span className="dim">{lp.dateRangeLabel}: </span>
        <strong className="export-date-val">{ctx.dateFrom}</strong>
        <span className="dim"> → </span>
        <strong className="export-date-val">{ctx.dateTo}</strong>
        {ctx.line && <><span className="dim"> · {lp.lineFilterLabel} </span><strong>{ctx.line}</strong></>}
        {ctx.ry && <><span className="dim"> · {lp.ryFilterLabel} </span><strong>{ctx.ry}</strong></>}
      </div>

      <div className="export-info-note">
        {lp.infoNote(lp.dataSheet, lp.statsSheet)}
      </div>

      {progress !== null && (
        <div className="export-progress-box">
          <div className="row">
            <span className="eyebrow gtext">{lp.generating}</span>
            <span className="ml-auto mono">{Math.round(progress)}%</span>
          </div>
          <div className="export-progress-track">
            <div style={{ width: progress + '%' }} className="export-progress-fill" />
          </div>
        </div>
      )}
    </Modal>
  )
}