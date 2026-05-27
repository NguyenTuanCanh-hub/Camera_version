import 'dotenv/config'

export const env = {
  port: parseInt(process.env.PORT ?? '5000'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: process.env.NODE_ENV !== 'production',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'fallback-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
}
