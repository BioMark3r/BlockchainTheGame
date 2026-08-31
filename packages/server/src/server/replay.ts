import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { GameState, PlayerId } from '../../../../src/shared/types.js'
import type { ActionLogEntry } from './rooms.js'

const DATA_DIR = join(process.cwd(), 'packages/server/data')
const REPLAYS_DIR = join(DATA_DIR, 'replays')

export interface ReplayData {
  roomCode: string
  initialPlayerIds: [PlayerId, PlayerId]
  isCpuGame: boolean
  displayNames: Record<string, string>
  actionLog: ActionLogEntry[]
  finalState: GameState
  savedAt: string
}

export function saveReplay(data: ReplayData): void {
  try {
    if (!existsSync(REPLAYS_DIR)) mkdirSync(REPLAYS_DIR, { recursive: true })
    writeFileSync(join(REPLAYS_DIR, `${data.roomCode}.json`), JSON.stringify(data))
  } catch (e) {
    console.error('[Replay] Failed to save replay:', e)
  }
}

export function loadReplay(roomCode: string): ReplayData | null {
  const path = join(REPLAYS_DIR, `${roomCode}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ReplayData
  } catch {
    return null
  }
}
