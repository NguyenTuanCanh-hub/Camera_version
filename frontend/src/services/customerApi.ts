import { getApiBase, getFactoryId } from '@/config/factories'

export interface CustomerRecord {
  id: string | number
  DateScan: string
  Line: string   // mapped from DepName
  RY: string
  Size: string
  PO: string
  Qty: number
  UPC: string
  RFID: string
  Status: string // mapped from Result
}

export interface CustomerStats {
  hourly:    { hour: number; minute: number; goodCount: number; badCount: number }[]
  byLine:    { Line: string; count: number }[]
  goodTotal: number
  badTotal:  number
}

interface Filters {
  dateFrom: string
  dateTo:   string
  line?:    string
  ry?:      string
  status?:  string   // 'GOOD' | 'NOTGOOD' | ''
  page?:    number
  pageSize?: number
}

function buildQS(f: Filters) {
  const p = new URLSearchParams()
  p.set('dateFrom', f.dateFrom)
  p.set('dateTo',   f.dateTo)
  p.set('factory',  getFactoryId())
  if (f.line)     p.set('line',     f.line)
  if (f.ry)       p.set('ry',       f.ry)
  if (f.status)   p.set('status',   f.status)
  if (f.page)     p.set('page',     String(f.page))
  if (f.pageSize) p.set('pageSize', String(f.pageSize))
  return p.toString()
}

// Lấy danh sách bản ghi quét của khách hàng, có phân trang và lọc theo kết quả GOOD/NOTGOOD
// CustomerReportPage gọi khi chuyển tab hoặc thay đổi bộ lọc
async function throwWithBody(res: Response, label: string): Promise<never> {
  try {
    const body = await res.json()
    throw new Error(body?.error || `${label} ${res.status}`)
  } catch (e: any) {
    if (e.message && e.message !== `${label} ${res.status}`) throw e
    throw new Error(`${label} ${res.status}`)
  }
}

export async function fetchCustomer(filters: Filters, signal?: AbortSignal) {
  const res = await fetch(`${getApiBase()}/api/customer/?${buildQS(filters)}`, { signal })
  if (!res.ok) await throwWithBody(res, 'Customer API')
  return res.json() as Promise<{ records: CustomerRecord[]; total: number; page: number; pageSize: number }>
}

export async function fetchCustomerStats(filters: Pick<Filters, 'dateFrom' | 'dateTo' | 'line' | 'ry'>) {
  const res = await fetch(`${getApiBase()}/api/customer/stats?${buildQS(filters)}`)
  if (!res.ok) await throwWithBody(res, 'CustomerStats API')
  return res.json() as Promise<CustomerStats>
}

export async function fetchCustomerDepNames(): Promise<string[]> {
  const res = await fetch(`/api/customer/depnames?factory=${getFactoryId()}`)
  if (!res.ok) return []
  return res.json()
}

// Gửi mảng bản ghi khách hàng lên server để lưu vào DB (dùng khi import thủ công)
// Trả về số bản ghi đã chèn và số bị bỏ qua (trùng lặp)
export async function importCustomerRecords(records: Partial<CustomerRecord>[]) {
  const res = await fetch(`/api/customer/import?factory=${getFactoryId()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json() as Promise<{ inserted: number; skipped: number }>
}

// Upload file Excel/CSV lên server qua XHR để theo dõi tiến trình upload (%)
// ImportPanel dùng hàm này và hiển thị thanh tiến trình theo onProgress
export function uploadCustomerFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ inserted: number; skipped: number; total: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${getApiBase()}/api/customer/upload?factory=${getFactoryId()}`)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error)) }
        catch { reject(new Error(xhr.statusText)) }
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

// Xóa toàn bộ dữ liệu khách hàng trong DB (cần xác nhận trước khi gọi)
// ImportPanel gọi khi người dùng bấm nút "Xóa dữ liệu", trả về số bản ghi đã xóa
export async function clearCustomerData() {
  const res = await fetch(`/api/customer/clear?factory=${getFactoryId()}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Clear API ${res.status}`)
  return res.json() as Promise<{ deleted: number }>
}
