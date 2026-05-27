
import app from './app'
import { getPool, closePool } from './config/database'
import { env } from './config/env'
async function bootstrap() {
  try {
    await getPool()

    const server = app.listen(env.port, () => {
      console.log(`🚀 Server running on http://localhost:${env.port}`)
      console.log(`📋 Environment: ${env.nodeEnv}`)
    })

    const shutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...')
      server.close(async () => {
        await closePool()
        process.exit(0)
      })
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

bootstrap()
