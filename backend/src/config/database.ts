import sql from 'mssql'

// Server IPs per factory — read from env with fallbacks
const FACTORY_SERVERS: Record<string, string> = {
  lhg: process.env.DB_LHG_SERVER ?? process.env.DB_SERVER ?? '192.168.30.1',
  lyv: process.env.DB_LYV_SERVER ?? '192.168.0.1',
  lvl: process.env.DB_LVL_SERVER ?? '192.168.60.9',
}

function makeConfig(server: string): sql.config {
  return {
    server,
    port:     parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME || undefined,
    user:     process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    options: {
      encrypt:                process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort:       true,
    },
    requestTimeout: 120000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  }
}

const pools = new Map<string, sql.ConnectionPool>()

export async function getPoolFor(factoryId = 'lhg'): Promise<sql.ConnectionPool> {
  const key    = factoryId in FACTORY_SERVERS ? factoryId : 'lhg'
  const server = FACTORY_SERVERS[key]

  const existing = pools.get(key)
  if (existing?.connected) return existing
  if (existing) { try { await existing.close() } catch { /* ignore */ } pools.delete(key) }

  const pool = await new sql.ConnectionPool(makeConfig(server)).connect()
  pools.set(key, pool)
  console.log(`✅ [${key.toUpperCase()}] Connected to SQL Server: ${server}/${process.env.DB_NAME}`)
  return pool
}

// Backward-compat alias (LHG default)
export async function getPool(): Promise<sql.ConnectionPool> {
  return getPoolFor('lhg')
}

export async function closePool(): Promise<void> {
  for (const [key, pool] of pools) {
    try { await pool.close() } catch { /* ignore */ }
    pools.delete(key)
  }
}

export { sql }
