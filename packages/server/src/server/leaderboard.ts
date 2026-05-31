import { createHash, randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const DATA_DIR = join(process.cwd(), 'packages/server/data')
const USERS_FILE = join(DATA_DIR, 'users.json')

interface UserRecord {
  username: string
  passwordHash: string
  salt: string
  token: string | null
  stats: { wins: number; losses: number; draws: number; gamesPlayed: number }
  createdAt: string
}

function loadUsers(): UserRecord[] {
  if (!existsSync(USERS_FILE)) return []
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf-8')) } catch { return [] }
}

function saveUsers(users: UserRecord[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex')
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function json(res: ServerResponse, status: number, data: unknown): void {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function getUserByToken(token: string): UserRecord | undefined {
  return loadUsers().find(u => u.token === token)
}

export async function handleLeaderboardRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? ''

  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res); res.writeHead(204); res.end(); return true
  }

  // POST /api/register
  if (req.method === 'POST' && url === '/api/register') {
    const body = await readBody(req) as { username?: string; password?: string }
    const { username, password } = body
    if (!username || !password || username.length < 2 || password.length < 4) {
      json(res, 400, { error: 'Username (min 2 chars) and password (min 4 chars) required' }); return true
    }
    const users = loadUsers()
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      json(res, 409, { error: 'Username already taken' }); return true
    }
    const salt = randomBytes(16).toString('hex')
    const token = generateToken()
    const newUser: UserRecord = {
      username,
      passwordHash: hashPassword(password, salt),
      salt,
      token,
      stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 },
      createdAt: new Date().toISOString(),
    }
    users.push(newUser)
    saveUsers(users)
    json(res, 201, { token, username })
    return true
  }

  // POST /api/login
  if (req.method === 'POST' && url === '/api/login') {
    const body = await readBody(req) as { username?: string; password?: string }
    const users = loadUsers()
    const user = users.find(u => u.username.toLowerCase() === (body.username ?? '').toLowerCase())
    if (!user || hashPassword(body.password ?? '', user.salt) !== user.passwordHash) {
      json(res, 401, { error: 'Invalid username or password' }); return true
    }
    user.token = generateToken()
    saveUsers(users)
    json(res, 200, { token: user.token, username: user.username, stats: user.stats })
    return true
  }

  // POST /api/record-result
  if (req.method === 'POST' && url === '/api/record-result') {
    const authHeader = req.headers['authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')
    const body = await readBody(req) as { result?: 'win' | 'loss' | 'draw' }
    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true }
    user.stats.gamesPlayed++
    if (body.result === 'win') user.stats.wins++
    else if (body.result === 'loss') user.stats.losses++
    else user.stats.draws++
    saveUsers(users)
    json(res, 200, { stats: user.stats })
    return true
  }

  // GET /api/leaderboard
  if (req.method === 'GET' && url === '/api/leaderboard') {
    const users = loadUsers()
    const board = users
      .filter(u => u.stats.gamesPlayed > 0)
      .map(u => ({ username: u.username, ...u.stats }))
      .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed)
      .slice(0, 20)
    json(res, 200, { leaderboard: board })
    return true
  }

  // GET /api/me
  if (req.method === 'GET' && url === '/api/me') {
    const authHeader = req.headers['authorization'] ?? ''
    const token = authHeader.replace('Bearer ', '')
    const user = getUserByToken(token)
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true }
    json(res, 200, { username: user.username, stats: user.stats })
    return true
  }

  return false // not a leaderboard route
}
