import type { Request, Response } from 'express'
import { getPool } from '@/config/database'
import ping from 'ping'

const DISPLAY: Record<string, string> = {
  SYSTEM: 'WINDOWS TABLET',
  DEVICE: 'ANDROID TABLET',
  MobileApp: 'MobileApp',
}

// Lấy danh sách loại camera (SYSTEM / DEVICE / MobileApp) từ DB → trả về label hiển thị
// Luồng: GET /api/vision/device-types → query DB → trả mảng { value, label }
export async function getDeviceTypes(_req: Request, res: Response) {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT DISTINCT RTRIM(User_Serial_Key) AS type
      FROM Data_Shoebox_Detail
      WHERE User_Serial_Key IS NOT NULL AND RTRIM(User_Serial_Key) <> ''
      ORDER BY RTRIM(User_Serial_Key)
    `)
    const types = result.recordset.map((r: { type: string }) => ({
      value: r.type,
      label: DISPLAY[r.type] ?? r.type,
    }))
    res.json(types)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Lấy danh sách tên chuyền (Line) duy nhất từ DB → dùng cho dropdown filter
// Luồng: GET /api/vision/lines → query DB → trả mảng string[]
export async function getLines(_req: Request, res: Response) {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT DISTINCT Line
      FROM Data_Shoebox_Detail
      WHERE Line IS NOT NULL AND Line <> ''
      ORDER BY Line
    `)
    res.json(result.recordset.map((r: { Line: string }) => r.Line))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// Trả danh sách thiết bị cố định (IP + tên chuyền) để frontend biết cần ping IP nào
// Luồng: GET /api/vision/devices → trả mảng { ip, line, lastSeen } tĩnh
// Nếu cần thêm/bớt chuyền → sửa mảng devices bên dưới
export async function getDevices(req: Request, res: Response) {
  try {
    const factory = String(req.query.factory ?? 'lhg')

    const lhgDevices = [
      { ip: '172.16.36.214', line: 'LHGG4G01', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.194', line: 'LHGG4G02', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.215', line: 'LHGG4G03', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.216', line: 'LHGG4G05', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.217', line: 'LHGG4G06', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.218', line: 'LHGG4G07', lastSeen: new Date().toISOString() },
      { ip: '172.16.36.219', line: 'LHGG4G08', lastSeen: new Date().toISOString() },
    ]

    const lvlDevices = [
      { ip: '192.168.164.113', line: 'LVL', lastSeen: new Date().toISOString() },
    ]

    const lyvDevices = [
      { ip: '192.168.0.1', line: 'LYV', alwaysOnline: true, lastSeen: new Date().toISOString() },
    ]

    if (factory === 'lvl') return res.json(lvlDevices)
    if (factory === 'lyv') return res.json(lyvDevices)
res.json(lhgDevices)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
// Ping nhiều IP cùng lúc (song song), trả kết quả alive/latency cho từng IP
// Luồng: POST /api/vision/ping/batch { ips: [] }
//   → Promise.all ping từng IP (timeout 2s)
//   → trả mảng { ip, alive, time }
//   → Frontend cập nhật trạng thái online/offline + latency history trên UI
export async function pingBatch(req: Request, res: Response) {
  try {
    const { ips } = req.body as { ips: string[] }
    if (!Array.isArray(ips) || !ips.length) return res.status(400).json({ error: 'ips[] required' })
    const targets = ips.slice(0, 64)
    const results = await Promise.all(
      targets.map(async (ip) => {
        try {
          const r = await ping.promise.probe(ip, { timeout: 2 })
          return { ip, alive: r.alive, time: (r.time as unknown) === 'unknown' ? 0 : Number(r.time) }
        } catch {
          return { ip, alive: false, time: 0 }
        }
      })
    )
    res.json(results)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}