const SERVER_BASE = (() => {
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${proto}//${window.location.host}`
})()

export interface AuthUser {
  username: string
  token: string
  stats: { wins: number; losses: number; draws: number; gamesPlayed: number }
}

const TOKEN_KEY = 'btg_auth_token'
const USER_KEY = 'btg_auth_user'

export function saveAuth(user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, user.token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function loadAuth(): AuthUser | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const raw = localStorage.getItem(USER_KEY)
  if (!token || !raw) return null
  try { return JSON.parse(raw) as AuthUser } catch { return null }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export async function apiRegister(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${SERVER_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Registration failed')
  return { username: data.username, token: data.token, stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 } }
}

export async function apiLogin(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${SERVER_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Login failed')
  return { username: data.username, token: data.token, stats: data.stats }
}

export async function apiRecordResult(result: 'win' | 'loss' | 'draw'): Promise<void> {
  const token = getToken()
  if (!token) return
  await fetch(`${SERVER_BASE}/api/record-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ result }),
  })
}

export async function apiLeaderboard(): Promise<Array<{ username: string; wins: number; losses: number; draws: number; gamesPlayed: number }>> {
  const res = await fetch(`${SERVER_BASE}/api/leaderboard`)
  const data = await res.json()
  return data.leaderboard ?? []
}
