export interface Factory {
  id: 'lhg' | 'lyv' | 'lvl'
  code: string
  ip: string
  color: string
  glow: string
}

export const FACTORIES: Factory[] = [
  { id: 'lhg', code: 'LHG', ip: '192.168.30.1', color: '#00D9FF', glow: 'rgba(0,217,255,0.45)'   },
  { id: 'lyv', code: 'LYV', ip: '192.168.0.1',  color: '#A78BFA', glow: 'rgba(167,139,250,0.45)' },
  { id: 'lvl', code: 'LVL', ip: '192.168.60.9', color: '#F59E0B', glow: 'rgba(245,158,11,0.45)'  },
]

// Current selected factory — updated by AppShell when user switches.
// All API calls send ?factory=<id> to the backend so the right DB pool is used.
let _factoryId: string = 'lhg'

export const getFactoryId  = (): string => _factoryId
export const setFactoryId  = (id: string): void => { _factoryId = id }

// Kept for backward compat — always returns '' (single backend, factory routed server-side)
export const getApiBase = (): string => ''
export const setApiBase = (_base: string): void => { /* no-op: routing is now server-side */ }
