import type { Request } from 'express'

export interface AuthPayload {
  userId: number
  email: string
  role: string
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}
