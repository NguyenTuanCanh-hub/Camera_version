import { getApiBase, getFactoryId } from '@/config/factories'

export interface GoodRecord {
  id: string
  ShoeImage: string | null
  DateScan: string
  Line: string
  RY: string
  Size: string
  PO: string
  Qty: number
  UPC: string
  IP4_Address: string
  RFID: string
}

export interface NotGoodRecord {
  id: string
  ShoeImage: string | null
  DateScan: string
  Line: string
  RY: string
  Size: string
  PO: string
  Qty: number
  UPC: string
  RFID: string
  Status: string
  IP4_Address: string
  Size_RFID: string
  PO_RFID: string
  UPC_RFID: string
  Article_RFID: string
}

export interface AllRecord {
  id: string
  ShoeImage: string | null
  DateScan: string
  Line: string
  RY: string
  Size: string
  PO: string
  Qty: number
  UPC: string
  IP4_Address: string
  RFID: string
  Result: string   // 'GOOD' | 'NOT GOOD'
  Status: string
}

export interface DeviceType {
  value: string   // DB value: SYSTEM | DEVICE | MobileApp
  label: string   // Display: WINDOWS TABLET | ANDROID TABLET | MobileApp
}

// Tạo URL ảnh giày từ địa chỉ IP của máy quét và tên file lưu trong DB
// Trả về null nếu IP hoặc tên file không hợp lệ, để UI hiển thị ảnh fallback
/** Build an <img> src URL from IP + filename stored in DB */
export function shoeImageUrl(ip: string | null | undefined, filename: unknown): string | null {
  if (!ip || ip === '0.0.0.0' || !filename) return null
  const clean = String(filename).trim()
  if (!clean || clean === 'null' || clean === 'undefined') return null
  return `http://${String(ip).trim()}/${clean}`
}

interface PagedResponse<T> {
  records: T[]
  total: number
  page: number
  pageSize: number
}

interface Filters {
  factory?: string
  dateFrom: string
  dateTo: string
  line?: string
  ry?: string
  deviceType?: string
  page?: number
  pageSize?: number
}

function buildQS(f: Filters) {
  const p = new URLSearchParams()
  p.set('factory', f.factory || getFactoryId())
  p.set('dateFrom', f.dateFrom)
  p.set('dateTo', f.dateTo)
  if (f.line)       p.set('line', f.line)
  if (f.ry)         p.set('ry', f.ry)
  if (f.deviceType) p.set('deviceType', f.deviceType)
  if (f.page)       p.set('page', String(f.page))
  if (f.pageSize)   p.set('pageSize', String(f.pageSize))
  return p.toString()
}

// Lấy danh sách bản ghi GOOD (quét đạt) từ server, có phân trang và bộ lọc
// VisionReportPage gọi hàm này khi mở tab GOOD hoặc khi bộ lọc thay đổi
export async function fetchGood(filters: Filters, signal?: AbortSignal): Promise<PagedResponse<GoodRecord>> {
  const res = await fetch(`${getApiBase()}/api/vision/good?${buildQS(filters)}`, { signal })
  if (!res.ok) throw new Error(`Good API error ${res.status}`)
  return res.json()
}

// Lấy toàn bộ bản ghi (cả GOOD lẫn NOT GOOD) từ server, có phân trang
// VisionReportPage dùng khi mở tab "Tất cả"
export async function fetchAll(filters: Filters, signal?: AbortSignal): Promise<PagedResponse<AllRecord>> {
  const res = await fetch(`${getApiBase()}/api/vision/all?${buildQS(filters)}`, { signal })
  if (!res.ok) throw new Error(`All API error ${res.status}`)
  return res.json()
}

// Lấy danh sách bản ghi lỗi (NOT GOOD) từ server, có phân trang và bộ lọc
// VisionReportPage dùng khi mở tab NOT GOOD
export async function fetchNotGood(filters: Filters, signal?: AbortSignal): Promise<PagedResponse<NotGoodRecord>> {
  const res = await fetch(`${getApiBase()}/api/vision/notgood?${buildQS(filters)}`, { signal })
  if (!res.ok) throw new Error(`NotGood API error ${res.status}`)
  return res.json()
}

export interface GoodStats {
  hourly: { hour: number; count: number }[]
  byLine: { Line: string; count: number }[]
}

export interface NotGoodStats {
  hourly: { hour: number; count: number }[]
  byLine: { Line: string; count: number }[]
}

// Lấy thống kê lỗi theo giờ và theo dây chuyền (dùng cho biểu đồ Pareto, sparkline)
// ViewBad trong VisionReportPage gọi khi bộ lọc thay đổi
export async function fetchNotGoodStats(filters: Pick<Filters, 'factory' | 'dateFrom' | 'dateTo' | 'line' | 'deviceType' | 'ry'>): Promise<NotGoodStats> {
  const res = await fetch(`${getApiBase()}/api/vision/notgood/stats?${buildQS(filters)}`)
  if (!res.ok) throw new Error(`NotGoodStats API error ${res.status}`)
  return res.json()
}

// Lấy thống kê bản ghi GOOD theo giờ và theo dây chuyền (dùng cho biểu đồ cột, sparkline)
// ViewGood trong VisionReportPage gọi khi bộ lọc thay đổi
export async function fetchGoodStats(filters: Pick<Filters, 'factory' | 'dateFrom' | 'dateTo' | 'line' | 'deviceType' | 'ry'>): Promise<GoodStats> {
  const res = await fetch(`${getApiBase()}/api/vision/good/stats?${buildQS(filters)}`)
  if (!res.ok) throw new Error(`GoodStats API error ${res.status}`)
  return res.json()
}

export interface AllStats {
  hourly: { hour: number; minute: number; goodCount: number; badCount: number }[]
  byLine: { Line: string; count: number }[]
}

// Lấy thống kê tổng hợp (GOOD + NOT GOOD) theo giờ và dây chuyền cho tab "Tất cả"
// ViewAll trong VisionReportPage dùng để vẽ biểu đồ AreaChart và bảng xếp hạng dây chuyền
export async function fetchAllStats(filters: Pick<Filters, 'factory' | 'dateFrom' | 'dateTo' | 'line' | 'deviceType' | 'ry'>): Promise<AllStats> {
  const res = await fetch(`${getApiBase()}/api/vision/all/stats?${buildQS(filters)}`)
  if (!res.ok) throw new Error(`AllStats API error ${res.status}`)
  return res.json()
}

// Lấy danh sách loại thiết bị quét (WINDOWS TABLET, ANDROID TABLET, MobileApp)
// Dùng để điền vào ô lọc "Loại thiết bị" trong thanh tìm kiếm VisionReportPage
export async function fetchDeviceTypes(factory?: string): Promise<DeviceType[]> {
  const res = await fetch(`/api/vision/device-types?factory=${factory || getFactoryId()}`)
  if (!res.ok) throw new Error(`DeviceTypes API error ${res.status}`)
  return res.json()
}

// Lấy danh sách tên dây chuyền sản xuất để gợi ý trong ô lọc "Line"
// VisionReportPage gọi một lần khi tải trang
export interface LineOption { value: string; label: string }

export async function fetchLines(factory?: string): Promise<LineOption[]> {
  const res = await fetch(`/api/vision/lines?factory=${factory || getFactoryId()}`)
  if (!res.ok) throw new Error(`Lines API error ${res.status}`)
  return res.json()
}

export interface DailyTarget {
  targetPerHour: number
  totalDailyTarget: number
  scgs: number
}

// Lấy target sản lượng mỗi tiếng theo kế hoạch ngày hôm nay
// Nếu có line: target riêng chuyền đó. Nếu không: tổng tất cả chuyền
export async function fetchDailyTarget(factory?: string, line?: string, date?: string): Promise<DailyTarget> {
  const p = new URLSearchParams()
  p.set('factory', factory || getFactoryId())
  if (line) p.set('line', line)
  if (date) p.set('date', date)
  const res = await fetch(`${getApiBase()}/api/vision/target?${p.toString()}`)
  if (!res.ok) throw new Error(`Target API error ${res.status}`)
  return res.json()
}