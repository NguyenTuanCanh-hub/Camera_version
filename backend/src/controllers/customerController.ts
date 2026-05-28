import type { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { getPoolFor, sql } from '@/config/database'

const factory = (req: Request) => (req.query.factory as string) || 'lhg'

// SQL Server error 208 = "Invalid object name" (table does not exist)
function isTableMissing(err: any) {
  return err?.number === 208 || String(err?.message ?? '').includes('Invalid object name')
}

// Actual table: Customer_Shoebox
// Columns: ID, SCDate, DepName, RY, Size, QTY, PO, UPC, RFID, Result

// ─── Fuzzy column matcher (strips BOM, diacritics + normalises) ─────────────
const normKey = (s: string) =>
  s.replace(/^﻿/, '').trim().toLowerCase()
   .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics: NGÀY→ngay
   .replace(/đ/g, 'd')                                  // đ → d
   .replace(/[\s_\-/]/g, '')

function excelGet(raw: any, ...keys: string[]): string {
  for (const k of keys) {
    const nk = normKey(k)  // normalize the search key too so 'giờ'→'gio' matches "GIỜ"
    const match = Object.keys(raw).find(rk => normKey(rk).includes(nk))
    if (match !== undefined && raw[match] != null && raw[match] !== '')
      return String(raw[match]).trim()
  }
  return ''
}

// ─── Time generation (07:30–16:30, skip lunch 11:20–13:00, +5–10s/row) ──────
// Extract YYYY-MM-DD from any date string format, returns [year, month, day] or null
function parseYMD(raw: string): [number, number, number] | null {
  const s = String(raw ?? '').trim()
  if (!s) return null

  // 1. Check if Excel Serial Number (e.g. 46169)
  const num = Number(s)
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + num * 86400 * 1000)
    return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD (4-digit year first)
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?!\d)/)
  if (m) return [+m[1], +m[2], +m[3]]

  // 3. Try DD/MM/YYYY or MM/DD/YYYY or D/M/YYYY (4-digit year)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?!\d)/)
  if (m) {
    const [a, b, yr] = [+m[1], +m[2], +m[3]]
    if (a > 12)  return [yr, b, a]   // a must be day  → DD/MM/YYYY
    if (b > 12)  return [yr, a, b]   // b must be day  → MM/DD/YYYY
    return [yr, b, a]                // ambiguous → assume DD/MM/YYYY (VN format)
  }

  // 4. Try DD/MM/YY or MM/DD/YY or D/M/YY (2-digit year)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/)
  if (m) {
    const [a, b, y2] = [+m[1], +m[2], +m[3]]
    const yr = y2 >= 70 ? 1900 + y2 : 2000 + y2
    if (a > 12)  return [yr, b, a]
    if (b > 12)  return [yr, a, b]
    return [yr, b, a] // assume VN format
  }

  // 5. Fallback: try Javascript built-in parser (for formats like "27-May-2026")
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) {
    const date = new Date(parsed)
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  }

  return null
}

// Parse time string — supports HH:MM, HH:MM:SS, and AM/PM variants
// Examples: "8:30", "08:30:45", "8:30 AM", "1:30 PM", "12:00 AM" → 0:00, "12:30 PM" → 12:30
function parseTime(raw: string): { h: number; m: number; s: number } | null {
  const match = String(raw ?? '').trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!match) return null
  let h = +match[1], m = +match[2], s = +(match[3] ?? 0)
  const ampm = (match[4] ?? '').toLowerCase()
  if (ampm === 'am') {
    if (h === 12) h = 0          // 12:xx AM → 00:xx (midnight)
  } else if (ampm === 'pm') {
    if (h !== 12) h += 12        // 1:xx PM → 13:xx, 12:xx PM stays 12:xx
  }
  if (h > 23 || m > 59 || s > 59) return null
  return { h, m, s }
}

function generateTimestamps(rows: any[]): any[] {
  const LUNCH_S = 11 * 3600 + 20 * 60
  const LUNCH_E = 13 * 3600
  const DAY_S   =  7 * 3600 + 30 * 60
  const DAY_E   = 16 * 3600 + 30 * 60

  const result = rows.map(r => ({ ...r }))
  const todayKey = new Date().toISOString().slice(0, 10)

  // ── Case 1: row has explicit time column → combine date + time directly ──
  const randomIndices: number[] = []
  rows.forEach((r, i) => {
    if (r._rawTime) {
      const t = parseTime(String(r._rawTime))
      const ymd = parseYMD(String(r._rawDate ?? ''))
      if (t && ymd) {
        const [year, month, day] = ymd
        result[i].DateScan = new Date(Date.UTC(year, month - 1, day, t.h, t.m, t.s, 0))
      } else {
        result[i].DateScan = new Date()
      }
      delete result[i]._rawDate
      delete result[i]._rawTime
      delete result[i]._sheetName
    } else {
      randomIndices.push(i)
    }
  })

  // ── Case 2: no time column → generate random timestamps (existing logic) ──
  const groups = new Map<string, number[]>()
  randomIndices.forEach(i => {
    const r = rows[i]
    const ymd = parseYMD(String(r._rawDate ?? ''))
    const dateKey = ymd
      ? `${ymd[0]}-${String(ymd[1]).padStart(2,'0')}-${String(ymd[2]).padStart(2,'0')}`
      : todayKey
    const key = `${dateKey}||${String(r._sheetName ?? '')}||${String(r.Line ?? '')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i)
  })

  for (const [groupKey, indices] of groups) {
    const dateKey = groupKey.split('||')[0]
    const [year, month, day] = dateKey.split('-').map(Number)
    let secs = DAY_S + Math.floor(Math.random() * 300)

    for (const idx of indices) {
      if (secs >= LUNCH_S && secs < LUNCH_E) secs = LUNCH_E
      if (secs >= DAY_E) secs = DAY_E - 1

      const h  = Math.floor(secs / 3600)
      const m  = Math.floor((secs % 3600) / 60)
      const s  = secs % 60
      const ms = Math.floor(Math.random() * 1000)

      result[idx].DateScan = new Date(Date.UTC(year, month - 1, day, h, m, s, ms))
      delete result[idx]._rawDate
      delete result[idx]._rawTime
      delete result[idx]._sheetName
      secs += 2 + Math.floor(Math.random() * 2)
    }
  }
  return result
}

// ─── Map one Excel row → DB row ───────────────────────────────────────────────
// sheetName: used as DepName fallback when no DepName column exists in the sheet
function mapExcelRow(raw: any, sheetName = ''): any | null {
  const g = (...k: string[]) => excelGet(raw, ...k)
  const depName = g('depname','dep','dept','line','chuyen','chuyền','day','nguyen','to','nhom')
  const ry      = g('ry','article','masp','masanpham','code','barcode','style','model','ma')
  const rawDate = g('scdate','scdat','datescan','date','ngay','ngày','datetime','scandate','scanngay')
  const rawTime = g('scantime','thoigian','tgio','giờ','gio','time','hour','gio','gioquet')

  if (!ry && !rawDate && !depName && !sheetName) return null
  if (!ry && !rawDate && !depName) return null

  return {
    _rawDate:   rawDate,
    _rawTime:   rawTime || undefined,
    _sheetName: sheetName,
    Line:   depName || sheetName,   // fallback to sheet name (e.g. "G01", "G02")
    RY:     ry,
    Size:   g('size','co','cỡ','size','kichco','kichcỡ'),
    PO:     g('po','ponumber','order','donhang'),
    Qty:    Math.round(parseFloat(g('qty','quantity','soluong','sl','soluợng','count')) || 0),
    UPC:    g('upc','barcode','mabarcode','mavach'),
    RFID:   g('rfid','rfidcode','mathẻ','mathe'),
    Status: g('status','result','ketqua','kq','kếtquả'),
  }
}

// ─── Schema-aware binding: detect which columns are NUMERIC in the actual DB ──
async function detectNumericCols(pool: any): Promise<Set<string>> {
  try {
    const res = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Customer_Shoebox'`
    )
    const NUM = new Set(['int','bigint','smallint','tinyint','decimal','numeric','float','real','money','smallmoney'])
    return new Set<string>(
      res.recordset
        .filter((c: any) => NUM.has((c.DATA_TYPE ?? '').toLowerCase()))
        .map((c: any) => (c.COLUMN_NAME ?? '').toLowerCase())
    )
  } catch { return new Set() }
}

function bindCol(col: string, numCols: Set<string>, strSqlType: any, rawVal: any): { type: any; val: any } {
  if (numCols.has(col)) {
    const n = parseFloat(String(rawVal ?? ''))
    return { type: sql.Float, val: isNaN(n) ? null : n }
  }
  return { type: strSqlType, val: String(rawVal ?? '') }
}

// Upload file Excel (.xlsx) chứa dữ liệu quét Customer → parse tất cả sheet → insert vào DB
// Luồng: POST /api/customer/upload (form-data field "file")
//   → đọc buffer Excel (tất cả sheet)
//   → tìm hàng header thực (bỏ qua tiêu đề)
//   → mapExcelRow: chuẩn hoá từng dòng → { Line, RY, Size, PO, Qty, UPC, RFID, Status }
//   → generateTimestamps: tạo thời gian 07:30–16:30, bỏ giờ nghỉ 11:20–13:00
//   → MERGE 200 dòng/lần vào Customer_Shoebox, bỏ qua trùng lặp (SCDate+DepName+RY)
//   → trả { inserted, skipped, total }
export async function uploadCustomer(req: Request, res: Response) {
  try {
    const file = (req as any).file as { buffer: Buffer; originalname: string } | undefined
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return }

    const wb = XLSX.read(file.buffer, { type: 'buffer' })

    // KNOWN: normalized keywords to detect the real header row (skip title rows)
    const KNOWN = [
      'scdate','depname','ry','size','qty','upc','rfid','result','po',
      'datescan','dep','date','ngay','chuyen','article','masp','line',
      'soluong','gio','time','scantime','barcode','scan',
    ]

    // Parse every sheet and collect all rows
    const mapped: any[] = []
    const sheetStats: { sheet: string; rows: number; headerRow: number; parsed: number }[] = []

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][]
      if (!allRows.length) continue

      // Find real header row — search first 15 rows, pick first with >= 2 KNOWN matches
      let headerIdx = 0
      for (let i = 0; i < Math.min(15, allRows.length); i++) {
        const normed = allRows[i].map((c: any) => normKey(String(c ?? '')))
        const hits = KNOWN.filter(k => normed.some((n: string) => n.includes(k))).length
        if (hits >= 2) { headerIdx = i; break }
      }

      const headers = allRows[headerIdx].map((c: any) => String(c ?? '').trim())
      let parsedCount = 0
      allRows.slice(headerIdx + 1).forEach(row => {
        const obj: any = {}
        headers.forEach((h, idx) => { obj[h] = row[idx] ?? '' })
        const m = mapExcelRow(obj, sheetName)
        if (m) { mapped.push(m); parsedCount++ }
      })
      sheetStats.push({ sheet: sheetName, rows: allRows.length - headerIdx - 1, headerRow: headerIdx, parsed: parsedCount })
    }

    if (!mapped.length) {
      res.status(400).json({ error: 'No valid rows found across all sheets', sheets: sheetStats })
      return
    }

    const rows = generateTimestamps(mapped)

    const pool = await getPoolFor(factory(req))
    const numCols = await detectNumericCols(pool)
    const depOnCond = numCols.has('depname')
      ? `(t.DepName = s.DepName OR (t.DepName IS NULL AND s.DepName IS NULL))`
      : `ISNULL(CAST(t.DepName AS NVARCHAR(200)),'') = ISNULL(CAST(s.DepName AS NVARCHAR(200)),'')`
    const ryOnCond = numCols.has('ry')
      ? `(t.RY = s.RY OR (t.RY IS NULL AND s.RY IS NULL))`
      : `ISNULL(CAST(t.RY AS NVARCHAR(100)),'') = ISNULL(CAST(s.RY AS NVARCHAR(100)),'')`
    const BATCH = 200
    let totalInserted = 0
    let totalSkipped  = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const r = pool.request()

      const srcRows = batch.map((row: any, j: number) => {
        const k = i + j
        const ds  = row.DateScan instanceof Date ? row.DateScan : new Date()
        const ln  = bindCol('depname', numCols, sql.NVarChar(100), row.Line)
        const ry  = bindCol('ry',      numCols, sql.NVarChar(50),  row.RY)
        const sz  = bindCol('size',    numCols, sql.NVarChar(50),  row.Size)
        const po  = bindCol('po',      numCols, sql.NVarChar(100), row.PO)
        const upc = bindCol('upc',     numCols, sql.NVarChar(100), row.UPC)
        const rf  = bindCol('rfid',    numCols, sql.NVarChar(100), row.RFID)
        const st  = bindCol('result',  numCols, sql.NVarChar(100), row.Status)
        r.input(`ds${k}`,  sql.DateTime2(3), ds)
        r.input(`ln${k}`,  ln.type,  ln.val)
        r.input(`ry${k}`,  ry.type,  ry.val)
        r.input(`sz${k}`,  sz.type,  sz.val)
        r.input(`po${k}`,  po.type,  po.val)
        r.input(`qty${k}`, sql.Int,   row.Qty || 0)
        r.input(`upc${k}`, upc.type, upc.val)
        r.input(`rf${k}`,  rf.type,  rf.val)
        r.input(`st${k}`,  st.type,  st.val)
        return j === 0
          ? `SELECT @ds${k} AS SCDate,@ln${k} AS DepName,@ry${k} AS RY,@sz${k} AS Size,@po${k} AS PO,@qty${k} AS QTY,@upc${k} AS UPC,@rf${k} AS RFID,@st${k} AS Result`
          : `SELECT @ds${k},@ln${k},@ry${k},@sz${k},@po${k},@qty${k},@upc${k},@rf${k},@st${k}`
      })

      const result = await r.query(`
        DECLARE @out TABLE (act NCHAR(10));
        MERGE ${T} WITH (HOLDLOCK) AS t
        USING (${srcRows.join(' UNION ALL ')})
          AS s(SCDate,DepName,RY,Size,PO,QTY,UPC,RFID,Result)
        ON (
          t.SCDate = s.SCDate
          AND ${depOnCond}
          AND ${ryOnCond}
        )
        WHEN NOT MATCHED THEN
          INSERT (SCDate,DepName,RY,Size,PO,QTY,UPC,RFID,Result)
          VALUES (s.SCDate,s.DepName,s.RY,s.Size,s.PO,s.QTY,s.UPC,s.RFID,s.Result)
        OUTPUT $action INTO @out;
        SELECT COUNT(*) AS inserted FROM @out;
      `)

      const batchInserted = result.recordset[0]?.inserted ?? 0
      totalInserted += batchInserted
      totalSkipped  += batch.length - batchInserted
    }

    res.json({ inserted: totalInserted, skipped: totalSkipped, total: rows.length, parsed: mapped.length, sheets: sheetStats })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

const T = 'Customer_Shoebox'

function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getSearchDateRange(dateFrom: string, dateTo: string) {
  const todayKey = localDateKey()

  const safeDateFrom = dateFrom > todayKey ? todayKey : dateFrom
  const safeDateTo = dateTo > todayKey ? todayKey : dateTo

  const from = new Date(`${safeDateFrom}T00:00:00`)
  const to = new Date(`${safeDateTo}T23:59:59.997`)
  const isToToday = safeDateTo === todayKey

  return { from, to, isToToday }
}

function applyFilters(req2: any, dateFrom: string, dateTo: string, line: string, ry: string): string {
  const { from, to, isToToday } = getSearchDateRange(dateFrom, dateTo)

  req2.input('df', sql.DateTime2(3), from)

  let w = isToToday
    ? `WHERE SCDate >= @df AND SCDate <= SYSDATETIME()`
    : `WHERE SCDate >= @df AND SCDate <= @dt`

  if (!isToToday) {
    req2.input('dt', sql.DateTime2(3), to)
  }

  if (line) { req2.input('ln', sql.NVarChar, line);       w += ` AND DepName = @ln` }
  if (ry)   { req2.input('ry', sql.VarChar,  `%${ry}%`); w += ` AND RY LIKE @ry` }
  return w
}

// Lấy danh sách bản ghi Customer có phân trang, lọc theo ngày/chuyền/RY/status
// Luồng: GET /api/customer?dateFrom&dateTo&line&ry&status=GOOD|NOTGOOD&page&pageSize
//   → query đếm tổng (COUNT) + query lấy dữ liệu (OFFSET/FETCH) song song
//   → trả { records[], total, page, pageSize }
export async function getCustomer(req: Request, res: Response) {
  try {
    const pool      = await getPoolFor(factory(req))
    const dateFrom  = (req.query.dateFrom as string) || new Date(Date.now() - 7*86400000).toISOString().slice(0,10)
    const dateTo    = (req.query.dateTo   as string) || localDateKey()
    const line      = (req.query.line     as string) || ''
    const ry        = (req.query.ry       as string) || ''
    const status    = ((req.query.status  as string) || '').toUpperCase()
    const page      = Math.max(1, parseInt((req.query.page     as string) || '1'))
    const pageSize  = Math.min(10000, Math.max(1, parseInt((req.query.pageSize as string) || '50')))
    const offset    = (page - 1) * pageSize

    const dataReq = pool.request().input('off', sql.Int, offset).input('psz', sql.Int, pageSize)
    const cntReq  = pool.request()

    let dw = applyFilters(dataReq, dateFrom, dateTo, line, ry)
    let cw = applyFilters(cntReq,  dateFrom, dateTo, line, ry)

    if (status === 'GOOD') {
      dw += ` AND (UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) = 'GOOD')`
      cw += ` AND (UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) = 'GOOD')`
    } else if (status === 'NOTGOOD') {
      dw += ` AND UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'')) NOT IN ('GOOD','') AND Result IS NOT NULL`
      cw += ` AND UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'')) NOT IN ('GOOD','') AND Result IS NOT NULL`
    }

    const [cntRes, dataRes] = await Promise.all([
      cntReq.query(`SELECT COUNT(*) AS total FROM ${T} ${cw}`),
      dataReq.query(`
        SELECT
          ID                                                   AS id,
          CONVERT(varchar(23), SCDate, 121)                    AS DateScan,
          ISNULL(CAST(DepName AS NVARCHAR(200)),'')            AS Line,
          ISNULL(CAST(RY      AS NVARCHAR(100)),'')            AS RY,
          ISNULL(CAST(Size    AS NVARCHAR(50)) ,'')            AS Size,
          ISNULL(CAST(PO      AS NVARCHAR(100)),'')            AS PO,
          ISNULL(TRY_CAST(QTY AS BIGINT), 0)                   AS Qty,
          ISNULL(CAST(UPC     AS NVARCHAR(100)),'')            AS UPC,
          ISNULL(CAST(RFID    AS NVARCHAR(100)),'')            AS RFID,
          ISNULL(CAST(Result  AS NVARCHAR(100)),'')            AS Status
        FROM ${T} ${dw}
        ORDER BY SCDate DESC
        OFFSET @off ROWS FETCH NEXT @psz ROWS ONLY
      `),
    ])

    res.json({ records: dataRes.recordset, total: cntRes.recordset[0].total, page, pageSize })
  } catch (err: any) {
    console.error('[getCustomer]', err.number, err.message)
    if (isTableMissing(err)) return res.json({ records: [], total: 0, page: 1, pageSize: 50 })
    res.status(500).json({ error: err.message })
  }
}

// Lấy thống kê tổng hợp Customer: theo giờ, theo chuyền, tổng GOOD/BAD
// Luồng: GET /api/customer/stats?dateFrom&dateTo&line&ry
//   → 3 query song song: hourly (30 phút/nhóm), byLine (top 10), totals (tổng GOOD+BAD)
//   → trả { hourly[], byLine[], goodTotal, badTotal }
//   → Frontend dùng để vẽ biểu đồ và thẻ thống kê
export async function getCustomerStats(req: Request, res: Response) {
  try {
    const pool     = await getPoolFor(factory(req))
    const dateFrom = (req.query.dateFrom as string) || new Date(Date.now() - 7*86400000).toISOString().slice(0,10)
    const dateTo   = (req.query.dateTo   as string) || localDateKey()
    const line     = (req.query.line     as string) || ''
    const ry       = (req.query.ry       as string) || ''

    const hReq = pool.request()
    const lReq = pool.request()
    const sReq = pool.request()

    const hWhere = applyFilters(hReq, dateFrom, dateTo, line, ry)
    const lWhere = applyFilters(lReq, dateFrom, dateTo, line, ry)
    const sWhere = applyFilters(sReq, dateFrom, dateTo, line, ry)

    const [hourly, byLine, totals] = await Promise.all([
      hReq.query(`
        SELECT
          DATEPART(HOUR, SCDate) AS hour,
          (DATEPART(MINUTE, SCDate) / 30) * 30 AS minute,
          SUM(CASE WHEN UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) = 'GOOD' THEN 1 ELSE 0 END) AS goodCount,
          SUM(CASE WHEN UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) != 'GOOD' THEN 1 ELSE 0 END) AS badCount
        FROM ${T} ${hWhere}
        GROUP BY DATEPART(HOUR, SCDate), (DATEPART(MINUTE, SCDate) / 30) * 30
        ORDER BY hour, minute
      `),
      lReq.query(`
        SELECT TOP 10 CAST(DepName AS NVARCHAR(200)) AS Line, COUNT(*) AS count FROM ${T} ${lWhere}
        AND DepName IS NOT NULL AND CAST(DepName AS NVARCHAR(200)) != ''
        GROUP BY DepName ORDER BY count DESC
      `),
      sReq.query(`
        SELECT
          SUM(CASE WHEN UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) = 'GOOD' THEN 1 ELSE 0 END) AS goodTotal,
          SUM(CASE WHEN UPPER(ISNULL(CAST(Result AS NVARCHAR(100)),'GOOD')) != 'GOOD' THEN 1 ELSE 0 END) AS badTotal
        FROM ${T} ${sWhere}
      `),
    ])

    res.json({
      hourly:    hourly.recordset,
      byLine:    byLine.recordset,
      goodTotal: totals.recordset[0]?.goodTotal ?? 0,
      badTotal:  totals.recordset[0]?.badTotal  ?? 0,
    })
  } catch (err: any) {
    console.error('[getCustomerStats]', err.number, err.message)
    if (isTableMissing(err)) return res.json({ hourly: [], byLine: [], goodTotal: 0, badTotal: 0 })
    res.status(500).json({ error: err.message })
  }
}

// Import hàng loạt records JSON vào DB (dùng sau khi preview Excel)
// Luồng: POST /api/customer/import { records: [] }
//   → kiểm tra tối đa 50.000 dòng
//   → MERGE 200 dòng/lần, khoá trùng: SCDate + DepName + RY
//   → trả { inserted, skipped }
export async function importCustomer(req: Request, res: Response) {
  try {
    const pool    = await getPoolFor(factory(req))
    const records: any[] = req.body.records
    if (!Array.isArray(records) || !records.length) {
      res.status(400).json({ error: 'No records provided' }); return
    }
    if (records.length > 50000) {
      res.status(400).json({ error: 'Max 50,000 records per import' }); return
    }

    // 200 rows × 9 params = 1800 — stays under SQL Server's 2100-parameter limit
    const numCols = await detectNumericCols(pool)
    const depOnCond = numCols.has('depname')
      ? `(t.DepName = s.DepName OR (t.DepName IS NULL AND s.DepName IS NULL))`
      : `ISNULL(CAST(t.DepName AS NVARCHAR(200)),'') = ISNULL(CAST(s.DepName AS NVARCHAR(200)),'')`
    const ryOnCond = numCols.has('ry')
      ? `(t.RY = s.RY OR (t.RY IS NULL AND s.RY IS NULL))`
      : `ISNULL(CAST(t.RY AS NVARCHAR(100)),'') = ISNULL(CAST(s.RY AS NVARCHAR(100)),'')`
    const BATCH = 200
    let totalInserted = 0
    let totalSkipped  = 0

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const r = pool.request()

      const srcRows = batch.map((row, j) => {
        const k = i + j
        const ds  = row.DateScan instanceof Date ? row.DateScan
          : row.DateScan ? (() => { const ymd = parseYMD(String(row.DateScan)); return ymd ? new Date(Date.UTC(...ymd as [number,number,number])) : new Date() })()
          : new Date()
        const ln  = bindCol('depname', numCols, sql.NVarChar(100), row.Line)
        const ry  = bindCol('ry',      numCols, sql.NVarChar(50),  row.RY)
        const sz  = bindCol('size',    numCols, sql.NVarChar(50),  row.Size)
        const po  = bindCol('po',      numCols, sql.NVarChar(100), row.PO)
        const upc = bindCol('upc',     numCols, sql.NVarChar(100), row.UPC)
        const rf  = bindCol('rfid',    numCols, sql.NVarChar(100), row.RFID)
        const st  = bindCol('result',  numCols, sql.NVarChar(100), row.Status)
        r.input(`ds${k}`,  sql.DateTime2(3), ds)
        r.input(`ln${k}`,  ln.type,  ln.val)
        r.input(`ry${k}`,  ry.type,  ry.val)
        r.input(`sz${k}`,  sz.type,  sz.val)
        r.input(`po${k}`,  po.type,  po.val)
        r.input(`qty${k}`, sql.Int,   parseInt(row.Qty) || 0)
        r.input(`upc${k}`, upc.type, upc.val)
        r.input(`rf${k}`,  rf.type,  rf.val)
        r.input(`st${k}`,  st.type,  st.val)

        return j === 0
          ? `SELECT @ds${k} AS SCDate,@ln${k} AS DepName,@ry${k} AS RY,@sz${k} AS Size,@po${k} AS PO,@qty${k} AS QTY,@upc${k} AS UPC,@rf${k} AS RFID,@st${k} AS Result`
          : `SELECT @ds${k},@ln${k},@ry${k},@sz${k},@po${k},@qty${k},@upc${k},@rf${k},@st${k}`
      })

      const result = await r.query(`
        DECLARE @out TABLE (act NCHAR(10));
        MERGE ${T} WITH (HOLDLOCK) AS t
        USING (${srcRows.join(' UNION ALL ')})
          AS s(SCDate,DepName,RY,Size,PO,QTY,UPC,RFID,Result)
        ON (
          t.SCDate   = s.SCDate
          AND ${depOnCond}
          AND ${ryOnCond}
        )
        WHEN NOT MATCHED THEN
          INSERT (SCDate,DepName,RY,Size,PO,QTY,UPC,RFID,Result)
          VALUES (s.SCDate,s.DepName,s.RY,s.Size,s.PO,s.QTY,s.UPC,s.RFID,s.Result)
        OUTPUT $action INTO @out;
        SELECT COUNT(*) AS inserted FROM @out;
      `)

      const batchInserted = result.recordset[0]?.inserted ?? 0
      totalInserted += batchInserted
      totalSkipped  += batch.length - batchInserted
    }

    res.json({ inserted: totalInserted, skipped: totalSkipped })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Xoá toàn bộ dữ liệu trong bảng Customer_Shoebox (dùng khi cần reset)
// Luồng: DELETE /api/customer/clear → DELETE FROM Customer_Shoebox → trả { deleted: n }
export async function clearCustomer(req: Request, res: Response) {
  try {
    const pool = await getPoolFor(factory(req))
    const r    = await pool.request().query(`DELETE FROM ${T}`)
    res.json({ deleted: r.rowsAffected[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Lấy danh sách tên chuyền (DepName) duy nhất → dùng cho dropdown autocomplete filter
// Luồng: GET /api/customer/depnames → query DISTINCT DepName → trả string[]
export async function getCustomerDepNames(req: Request, res: Response) {
  try {
    const pool = await getPoolFor(factory(req))
    const r = await pool.request().query(
      `SELECT DISTINCT CAST(DepName AS NVARCHAR(200)) AS DepName FROM ${T} WHERE DepName IS NOT NULL AND CAST(DepName AS NVARCHAR(200)) <> '' ORDER BY CAST(DepName AS NVARCHAR(200))`
    )
    res.json(r.recordset.map((row: any) => String(row.DepName ?? '')))
  } catch (err: any) {
    if (isTableMissing(err)) return res.json([])
    res.status(500).json({ error: err.message })
  }
}