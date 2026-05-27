import type { Request, Response } from 'express'
import { getPool, sql } from '@/config/database'

// Lấy danh sách sản phẩm ĐẠT (GOOD) từ bảng Data_Shoebox_Detail, có phân trang + filter
// Luồng: GET /api/vision/good?dateFrom&dateTo&line&ry&deviceType&page&pageSize
//   → query đếm tổng (COUNT) + query lấy dữ liệu (OFFSET/FETCH) song song
//   → OUTER APPLY: ghép thêm RFID từ bảng RFID_Detail theo RY+Line trong vòng 60 giây
//   → trả { records[], total, page, pageSize }
export async function getGood(req: Request, res: Response) {
  try {
    const pool = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const ry         = (req.query.ry         as string) || ''
    const deviceType = (req.query.deviceType as string) || ''
    const page       = Math.max(1, parseInt((req.query.page as string) || '1'))
    const pageSize   = Math.min(10000, Math.max(1, parseInt((req.query.pageSize as string) || '200')))
    const offset     = (page - 1) * pageSize

    const req2 = pool.request()
      .input('dateFrom', sql.DateTime, new Date(dateFrom))
      .input('dateTo',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
      .input('offset',   sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)

    // Data_Shoebox_Detail.User_Serial_Key column contains SYSTEM / DEVICE / MobileApp directly
    let whereClause = `WHERE d.DateScan >= @dateFrom AND d.DateScan <= @dateTo`
    if (deviceType) {
      req2.input('deviceType', sql.NVarChar, deviceType)
      whereClause += ` AND RTRIM(d.User_Serial_Key) = @deviceType`
    }
    if (line) {
      req2.input('line', sql.NVarChar, line)
      whereClause += ` AND d.Line = @line`
    }
    if (ry) {
      req2.input('ry', sql.VarChar, `%${ry}%`)
      whereClause += ` AND d.RY LIKE @ry`
    }

    const countReq = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let countWhere = `WHERE d.DateScan >= @dateFrom2 AND d.DateScan <= @dateTo2`
    if (deviceType) {
      countReq.input('deviceType2', sql.NVarChar, deviceType)
      countWhere += ` AND RTRIM(d.User_Serial_Key) = @deviceType2`
    }
    if (line) {
      countReq.input('line2', sql.NVarChar, line)
      countWhere += ` AND d.Line = @line2`
    }
    if (ry) {
      countReq.input('ry2', sql.VarChar, `%${ry}%`)
      countWhere += ` AND d.RY LIKE @ry2`
    }
    const countResult = await countReq.query(
      `SELECT COUNT(*) AS total FROM Data_Shoebox_Detail d ${countWhere}`
    )

    const result = await req2.query(`
      SELECT
        d.Shoebox_Detail_Serial  AS id,
        d.ShoeImage,
        CONVERT(varchar(23), d.DateScan, 121) AS DateScan,
        d.Line,
        d.RY,
        d.Size,
        ISNULL(d.PO, '')         AS PO,
        d.Qty,
        d.UPC,
        d.IP4_Address,
        ISNULL(r.RFID, ISNULL(d.RFID, '')) AS RFID
      FROM Data_Shoebox_Detail d
      OUTER APPLY (
        SELECT TOP 1 r2.RFID
        FROM Data_Shoebox_RFID_Detail r2
        WHERE r2.RY   = d.RY
          AND r2.Line = d.Line
          AND ABS(DATEDIFF(second, d.DateScan, r2.DateScan)) <= 60
        ORDER BY ABS(DATEDIFF(second, d.DateScan, r2.DateScan))
      ) r
      ${whereClause}
      ORDER BY d.DateScan DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)

    res.json({ records: result.recordset, total: countResult.recordset[0].total, page, pageSize })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Thống kê sản phẩm GOOD: phân bố theo giờ + top 10 chuyền (không phân trang)
// Luồng: GET /api/vision/good/stats?dateFrom&dateTo&line&ry&deviceType
//   → 2 query song song: hourly (đếm theo giờ), byLine (top 10 chuyền)
//   → trả { hourly[], byLine[] } → Frontend dùng vẽ biểu đồ cột
export async function getGoodStats(req: Request, res: Response) {
  try {
    const pool       = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const deviceType = (req.query.deviceType as string) || ''
    const ry         = (req.query.ry         as string) || ''

    const hReq = pool.request()
      .input('dateFrom',  sql.DateTime, new Date(dateFrom))
      .input('dateTo',    sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let hWhere = `WHERE DateScan >= @dateFrom AND DateScan <= @dateTo`
    if (deviceType) { hReq.input('deviceType', sql.NVarChar, deviceType); hWhere += ` AND RTRIM(User_Serial_Key) = @deviceType` }
    if (line)       { hReq.input('line',       sql.NVarChar, line);       hWhere += ` AND Line = @line` }
    if (ry)         { hReq.input('ry',         sql.VarChar,  `%${ry}%`);  hWhere += ` AND RY LIKE @ry` }

    const lReq = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let lWhere = `WHERE DateScan >= @dateFrom2 AND DateScan <= @dateTo2`
    if (deviceType) { lReq.input('deviceType2', sql.NVarChar, deviceType); lWhere += ` AND RTRIM(User_Serial_Key) = @deviceType2` }
    if (line)       { lReq.input('line2',       sql.NVarChar, line);       lWhere += ` AND Line = @line2` }
    if (ry)         { lReq.input('ry2',         sql.VarChar,  `%${ry}%`);  lWhere += ` AND RY LIKE @ry2` }

    const [hourlyRes, lineRes] = await Promise.all([
      hReq.query(`SELECT DATEPART(HOUR, DateScan) AS hour, COUNT(*) AS count FROM Data_Shoebox_Detail ${hWhere} GROUP BY DATEPART(HOUR, DateScan) ORDER BY hour`),
      lReq.query(`SELECT TOP 10 Line, COUNT(*) AS count FROM Data_Shoebox_Detail ${lWhere} GROUP BY Line ORDER BY count DESC`),
    ])

    res.json({ hourly: hourlyRes.recordset, byLine: lineRes.recordset })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Lấy tất cả bản ghi GOOD + NOT GOOD gộp lại, có phân trang + filter
// Luồng: GET /api/vision/all?dateFrom&dateTo&line&ry&deviceType&page&pageSize
//   → UNION ALL: Data_Shoebox_Detail (GOOD) + Data_Shoebox_RFID_Detail (NOT GOOD)
//   → đếm tổng từ cả 2 bảng → lấy dữ liệu phân trang → sắp xếp mới nhất trước
//   → trả { records[], total, page, pageSize } với trường Result = 'GOOD'|'NOT GOOD'
export async function getAll(req: Request, res: Response) {
  try {
    const pool = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const ry         = (req.query.ry         as string) || ''
    const deviceType = (req.query.deviceType as string) || ''
    const page       = Math.max(1, parseInt((req.query.page as string) || '1'))
    const pageSize   = Math.min(10000, Math.max(1, parseInt((req.query.pageSize as string) || '200')))
    const offset     = (page - 1) * pageSize

    const req2 = pool.request()
      .input('dateFrom', sql.DateTime, new Date(dateFrom))
      .input('dateTo',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
      .input('offset',   sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)

    // Shared optional filters — same params used in both halves of UNION
    let gWhere = `d.DateScan >= @dateFrom AND d.DateScan <= @dateTo`
    let rWhere = `r.DateScan >= @dateFrom AND r.DateScan <= @dateTo AND r.Status = 'Not Good'`
    if (deviceType) {
      req2.input('deviceType', sql.NVarChar, deviceType)
      gWhere += ` AND RTRIM(d.User_Serial_Key) = @deviceType`
      rWhere += ` AND RTRIM(r.User_Serial_Key) = @deviceType`
    }
    if (line) {
      req2.input('line', sql.NVarChar, line)
      gWhere += ` AND d.Line = @line`
      rWhere += ` AND r.Line = @line`
    }
    if (ry) {
      req2.input('ry', sql.VarChar, `%${ry}%`)
      gWhere += ` AND d.RY LIKE @ry`
      rWhere += ` AND r.RY LIKE @ry`
    }

    const countReq = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let cgWhere = `d.DateScan >= @dateFrom2 AND d.DateScan <= @dateTo2`
    let crWhere = `r.DateScan >= @dateFrom2 AND r.DateScan <= @dateTo2 AND r.Status = 'Not Good'`
    if (deviceType) {
      countReq.input('deviceType2', sql.NVarChar, deviceType)
      cgWhere += ` AND RTRIM(d.User_Serial_Key) = @deviceType2`
      crWhere += ` AND RTRIM(r.User_Serial_Key) = @deviceType2`
    }
    if (line) {
      countReq.input('line2', sql.NVarChar, line)
      cgWhere += ` AND d.Line = @line2`
      crWhere += ` AND r.Line = @line2`
    }
    if (ry) {
      countReq.input('ry2', sql.VarChar, `%${ry}%`)
      cgWhere += ` AND d.RY LIKE @ry2`
      crWhere += ` AND r.RY LIKE @ry2`
    }

    const countResult = await countReq.query(`
      SELECT COUNT(*) AS total FROM (
        SELECT d.Shoebox_Detail_Serial AS id FROM Data_Shoebox_Detail d WHERE ${cgWhere}
        UNION ALL
        SELECT r.Shoebox_RFID_Detail   AS id FROM Data_Shoebox_RFID_Detail r WHERE ${crWhere}
      ) combined
    `)

    const result = await req2.query(`
      SELECT * FROM (
        SELECT
          d.Shoebox_Detail_Serial  AS id,
          d.ShoeImage,
          CONVERT(varchar(23), d.DateScan, 121) AS DateScan,
          d.Line,
          d.RY,
          d.Size,
          ISNULL(d.PO, '')                      AS PO,
          d.Qty,
          d.UPC,
          d.IP4_Address,
          ISNULL(d.RFID, '')                    AS RFID,
          'GOOD'                                AS Result,
          ''                                    AS Status
        FROM Data_Shoebox_Detail d
        WHERE ${gWhere}

        UNION ALL

        SELECT
          r.Shoebox_RFID_Detail    AS id,
          r.Image                  AS ShoeImage,
          CONVERT(varchar(23), r.DateScan, 121) AS DateScan,
          r.Line,
          r.RY,
          r.Size,
          ISNULL(r.PO, '')                      AS PO,
          r.Qty,
          r.UPC,
          r.IP4_Address,
          r.RFID,
          'NOT GOOD'                            AS Result,
          ISNULL(r.Status, '')                  AS Status
        FROM Data_Shoebox_RFID_Detail r
        WHERE ${rWhere}
      ) combined
      ORDER BY DateScan DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)

    res.json({ records: result.recordset, total: countResult.recordset[0].total, page, pageSize })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Thống kê tổng hợp GOOD + NOT GOOD: theo giờ (30 phút/nhóm) + top 10 chuyền
// Luồng: GET /api/vision/all/stats?dateFrom&dateTo&line&ry&deviceType
//   → 2 query song song:
//     · hourly: UNION goodCount (Detail) + badCount (RFID_Detail) → nhóm theo giờ:phút
//     · byLine: UNION 2 bảng → nhóm theo Line, top 10
//   → trả { hourly[{hour,minute,goodCount,badCount}], byLine[] }
//   → Frontend dùng vẽ biểu đồ GOOD vs BAD theo thời gian
export async function getAllStats(req: Request, res: Response) {
  try {
    const pool       = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const deviceType = (req.query.deviceType as string) || ''

    const ry         = (req.query.ry         as string) || ''

    const hReq = pool.request()
      .input('dateFrom',  sql.DateTime, new Date(dateFrom))
      .input('dateTo',    sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let gWhere = `d.DateScan >= @dateFrom AND d.DateScan <= @dateTo`
    let rWhere = `r.DateScan >= @dateFrom AND r.DateScan <= @dateTo AND r.Status = 'Not Good'`
    if (deviceType) { hReq.input('deviceType', sql.NVarChar, deviceType); gWhere += ` AND RTRIM(d.User_Serial_Key) = @deviceType`; rWhere += ` AND RTRIM(r.User_Serial_Key) = @deviceType` }
    if (line)       { hReq.input('line',       sql.NVarChar, line);       gWhere += ` AND d.Line = @line`;                         rWhere += ` AND r.Line = @line` }
    if (ry)         { hReq.input('ry',         sql.VarChar,  `%${ry}%`);  gWhere += ` AND d.RY LIKE @ry`;                          rWhere += ` AND r.RY LIKE @ry` }

    const lReq = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let lgWhere = `d.DateScan >= @dateFrom2 AND d.DateScan <= @dateTo2`
    let lrWhere = `r.DateScan >= @dateFrom2 AND r.DateScan <= @dateTo2 AND r.Status = 'Not Good'`
    if (deviceType) { lReq.input('deviceType2', sql.NVarChar, deviceType); lgWhere += ` AND RTRIM(d.User_Serial_Key) = @deviceType2`; lrWhere += ` AND RTRIM(r.User_Serial_Key) = @deviceType2` }
    if (line)       { lReq.input('line2',       sql.NVarChar, line);       lgWhere += ` AND d.Line = @line2`;                          lrWhere += ` AND r.Line = @line2` }
    if (ry)         { lReq.input('ry2',         sql.VarChar,  `%${ry}%`);  lgWhere += ` AND d.RY LIKE @ry2`;                           lrWhere += ` AND r.RY LIKE @ry2` }

    const [hourlyRes, lineRes] = await Promise.all([
      hReq.query(`
        SELECT hour, minute, SUM(goodCount) AS goodCount, SUM(badCount) AS badCount FROM (
          SELECT DATEPART(HOUR, DateScan) AS hour, (DATEPART(MINUTE, DateScan) / 30) * 30 AS minute, COUNT(*) AS goodCount, 0 AS badCount
          FROM Data_Shoebox_Detail d WHERE ${gWhere} GROUP BY DATEPART(HOUR, DateScan), (DATEPART(MINUTE, DateScan) / 30) * 30
          UNION ALL
          SELECT DATEPART(HOUR, DateScan) AS hour, (DATEPART(MINUTE, DateScan) / 30) * 30 AS minute, 0 AS goodCount, COUNT(*) AS badCount
          FROM Data_Shoebox_RFID_Detail r WHERE ${rWhere} GROUP BY DATEPART(HOUR, DateScan), (DATEPART(MINUTE, DateScan) / 30) * 30
        ) combined GROUP BY hour, minute ORDER BY hour, minute
      `),
      lReq.query(`
        SELECT TOP 10 Line, COUNT(*) AS count FROM (
          SELECT d.Line FROM Data_Shoebox_Detail d WHERE ${lgWhere}
          UNION ALL
          SELECT r.Line FROM Data_Shoebox_RFID_Detail r WHERE ${lrWhere}
        ) combined GROUP BY Line ORDER BY count DESC
      `),
    ])

    res.json({ hourly: hourlyRes.recordset, byLine: lineRes.recordset })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Thống kê riêng sản phẩm KHÔNG ĐẠT: theo giờ + top 10 chuyền
// Luồng: GET /api/vision/notgood/stats?dateFrom&dateTo&line&ry&deviceType
//   → chỉ query Data_Shoebox_RFID_Detail WHERE Status = 'Not Good'
//   → 2 query song song: hourly + byLine → trả { hourly[], byLine[] }
export async function getNotGoodStats(req: Request, res: Response) {
  try {
    const pool       = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const deviceType = (req.query.deviceType as string) || ''
    const ry         = (req.query.ry         as string) || ''

    const req2 = pool.request()
      .input('dateFrom', sql.DateTime, new Date(dateFrom))
      .input('dateTo',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let where = `WHERE r.DateScan >= @dateFrom AND r.DateScan <= @dateTo AND r.Status = 'Not Good'`
    if (deviceType) { req2.input('deviceType', sql.NVarChar, deviceType); where += ` AND RTRIM(r.User_Serial_Key) = @deviceType` }
    if (line)       { req2.input('line',       sql.NVarChar, line);       where += ` AND r.Line = @line` }
    if (ry)         { req2.input('ry',         sql.VarChar,  `%${ry}%`);  where += ` AND r.RY LIKE @ry` }

    const req3 = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let where2 = `WHERE r.DateScan >= @dateFrom2 AND r.DateScan <= @dateTo2 AND r.Status = 'Not Good'`
    if (deviceType) { req3.input('deviceType2', sql.NVarChar, deviceType); where2 += ` AND RTRIM(r.User_Serial_Key) = @deviceType2` }
    if (line)       { req3.input('line2',       sql.NVarChar, line);       where2 += ` AND r.Line = @line2` }
    if (ry)         { req3.input('ry2',         sql.VarChar,  `%${ry}%`);  where2 += ` AND r.RY LIKE @ry2` }

    const [hourlyRes, lineRes] = await Promise.all([
      req2.query(`SELECT DATEPART(HOUR, r.DateScan) AS hour, COUNT(*) AS count FROM Data_Shoebox_RFID_Detail r ${where} GROUP BY DATEPART(HOUR, r.DateScan) ORDER BY hour`),
      req3.query(`SELECT TOP 10 r.Line, COUNT(*) AS count FROM Data_Shoebox_RFID_Detail r ${where2} GROUP BY r.Line ORDER BY count DESC`),
    ])

    res.json({ hourly: hourlyRes.recordset, byLine: lineRes.recordset })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Lấy ảnh lỗi dạng binary (JPEG/PNG) từ cột Image (varbinary) trong DB, trả về trực tiếp
// Luồng: GET /api/vision/notgood/image/:id
//   → query lấy buffer ảnh theo Shoebox_RFID_Detail ID
//   → phát hiện loại ảnh qua magic bytes (0x89=PNG, còn lại=JPEG)
//   → trả binary với Content-Type phù hợp, cache 1 giờ
export async function getNotGoodImage(req: Request, res: Response) {
  try {
    const pool = await getPool()
    let id: string | undefined
    if (typeof req.params.id === 'string') {
      id = req.params.id.trim()
    } else if (Array.isArray(req.params.id)) {
      id = req.params.id[0]?.trim()
    }
    if (!id) { res.status(400).json({ error: 'Invalid id' }); return }

    const result = await pool.request()
      .input('id', sql.NChar, id)
      .query(`SELECT Image FROM Data_Shoebox_RFID_Detail WHERE RTRIM(Shoebox_RFID_Detail) = RTRIM(@id) AND Image IS NOT NULL`)

    if (!result.recordset.length || !result.recordset[0].Image) {
      res.status(404).end(); return
    }

    const buf: Buffer = result.recordset[0].Image
    // Detect PNG by magic bytes 0x89 0x50, otherwise assume JPEG
    const contentType = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}


// Lấy danh sách sản phẩm KHÔNG ĐẠT từ Data_Shoebox_RFID_Detail, có phân trang + filter
// Luồng: GET /api/vision/notgood?dateFrom&dateTo&line&ry&deviceType&page&pageSize
//   → WHERE Status = 'Not Good' + filter tuỳ chọn
//   → query đếm + query dữ liệu song song → mới nhất trước
//   → trả { records[], total, page, pageSize } kèm ảnh lỗi (dùng /notgood/image/:id để xem)
export async function getNotGood(req: Request, res: Response) {
  try {
    const pool = await getPool()
    const dateFrom   = (req.query.dateFrom   as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const dateTo     = (req.query.dateTo     as string) || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const line       = (req.query.line       as string) || ''
    const ry         = (req.query.ry         as string) || ''
    const deviceType = (req.query.deviceType as string) || ''
    const page       = Math.max(1, parseInt((req.query.page as string) || '1'))
    const pageSize   = Math.min(10000, Math.max(1, parseInt((req.query.pageSize as string) || '200')))
    const offset     = (page - 1) * pageSize

    const req2 = pool.request()
      .input('dateFrom', sql.DateTime, new Date(dateFrom))
      .input('dateTo',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
      .input('offset',   sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)

    // Data_Shoebox_RFID_Detail.User_Serial_Key column contains SYSTEM / DEVICE / MobileApp directly
    let whereClause = `WHERE r.DateScan >= @dateFrom AND r.DateScan <= @dateTo AND r.Status = 'Not Good'`
    if (deviceType) {
      req2.input('deviceType', sql.NVarChar, deviceType)
      whereClause += ` AND RTRIM(r.User_Serial_Key) = @deviceType`
    }
    if (line) {
      req2.input('line', sql.NVarChar, line)
      whereClause += ` AND r.Line = @line`
    }
    if (ry) {
      req2.input('ry', sql.VarChar, `%${ry}%`)
      whereClause += ` AND r.RY LIKE @ry`
    }

    const countReq = pool.request()
      .input('dateFrom2', sql.DateTime, new Date(dateFrom))
      .input('dateTo2',   sql.DateTime, new Date(dateTo + 'T23:59:59'))
    let countWhere = `WHERE r.DateScan >= @dateFrom2 AND r.DateScan <= @dateTo2 AND r.Status = 'Not Good'`
    if (deviceType) {
      countReq.input('deviceType2', sql.NVarChar, deviceType)
      countWhere += ` AND RTRIM(r.User_Serial_Key) = @deviceType2`
    }
    if (line) {
      countReq.input('line2', sql.NVarChar, line)
      countWhere += ` AND r.Line = @line2`
    }
    if (ry) {
      countReq.input('ry2', sql.VarChar, `%${ry}%`)
      countWhere += ` AND r.RY LIKE @ry2`
    }
    const countResult = await countReq.query(
      `SELECT COUNT(*) AS total FROM Data_Shoebox_RFID_Detail r ${countWhere}`
    )

    const result = await req2.query(`
      SELECT
        r.Shoebox_RFID_Detail    AS id,
        r.Image                  AS ShoeImage,
        CONVERT(varchar(23), r.DateScan, 121) AS DateScan,
        r.Line,
        r.RY,
        r.Size,
        ISNULL(r.PO, '')         AS PO,
        r.Qty,
        r.UPC,
        r.RFID,
        ISNULL(r.Status, '')     AS Status,
        r.IP4_Address,
        ISNULL(r.Size_RFID, '')    AS Size_RFID,
        ISNULL(r.PO_RFID, '')      AS PO_RFID,
        ISNULL(r.UPC_RFID, '')     AS UPC_RFID,
        ISNULL(r.Article_RFID, '') AS Article_RFID
      FROM Data_Shoebox_RFID_Detail r
      ${whereClause}
      ORDER BY r.DateScan DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)
    res.json({ records: result.recordset, total: countResult.recordset[0].total, page, pageSize })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Lấy lịch sử hoạt động của từng IP camera theo ngày (dùng để vẽ heatmap trên Device Monitor)
// Luồng: GET /api/vision/devices/activity?days=30 (tối đa 90 ngày)
//   → UNION cả 2 bảng → nhóm theo IP + ngày → đếm số lần quét mỗi ngày
//   → trả map { "172.16.x.x": [{date, count}] }
//   → Frontend dùng để hiển thị mức độ hoạt động của từng thiết bị theo thời gian
export async function getDeviceActivity(req: Request, res: Response) {
  try {
    const pool = await getPool()
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || '30')))
    const result = await pool.request()
      .input('days', sql.Int, days)
      .query(`
        SELECT IP4_Address, CAST(DateScan AS DATE) AS day, COUNT(*) AS cnt
        FROM (
          SELECT IP4_Address, DateScan FROM Data_Shoebox_Detail
          WHERE DateScan >= DATEADD(DAY, -@days, GETDATE())
            AND IP4_Address IS NOT NULL AND IP4_Address != ''
          UNION ALL
          SELECT IP4_Address, DateScan FROM Data_Shoebox_RFID_Detail
          WHERE DateScan >= DATEADD(DAY, -@days, GETDATE())
            AND IP4_Address IS NOT NULL AND IP4_Address != ''
            AND Status = 'Not Good'
        ) combined
        GROUP BY IP4_Address, CAST(DateScan AS DATE)
        ORDER BY IP4_Address, day
      `)
    const map: Record<string, { date: string; count: number }[]> = {}
    for (const row of result.recordset) {
      const ip = row.IP4_Address as string
      if (!map[ip]) map[ip] = []
      const d = row.day as Date
      map[ip].push({ date: d.toISOString().slice(0, 10), count: row.cnt as number })
    }
    res.json(map)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
