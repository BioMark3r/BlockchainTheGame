import type { GameState } from '@shared/types'
import type { LogEntry } from '../store/gameStore'

export interface PlayerStats {
  playerId: string
  blocksPublished: number
  creditsEarned: number
  validatorsPlayed: number
  cardSpecialsPlayed: number  // chain split, reorg, invalid tx, fork, reshuffle, redundancy
  discardsAndRedraws: number
}

export interface GameStats {
  players: PlayerStats[]
  totalBlocks: number
  totalTurns: number
}

const SPECIAL_ICONS = new Set(['🔱', '🔄', '❌', '⑂', '🔀', '⚡'])

export function computeGameStats(log: LogEntry[], finalState: GameState): GameStats {
  const statsMap = new Map<string, PlayerStats>()

  // Initialize a stat record for each player
  for (const p of finalState.players) {
    statsMap.set(p.id, {
      playerId: p.id,
      blocksPublished: 0,
      creditsEarned: p.credits,  // use authoritative final credits
      validatorsPlayed: 0,
      cardSpecialsPlayed: 0,
      discardsAndRedraws: 0,
    })
  }

  for (const entry of log) {
    if (!entry.playerId) continue
    const stat = statsMap.get(entry.playerId)
    if (!stat) continue

    if (entry.icon === '📦') {
      stat.blocksPublished++
    } else if (entry.icon === '🛡️') {
      stat.validatorsPlayed++
    } else if (SPECIAL_ICONS.has(entry.icon)) {
      stat.cardSpecialsPlayed++
    } else if (entry.icon === '🃏') {
      stat.discardsAndRedraws++
    }
  }

  const totalBlocks = finalState.chain.length
  const totalTurns = log.filter((e) => e.playerId !== null).length

  return {
    players: finalState.players.map((p) => statsMap.get(p.id)!),
    totalBlocks,
    totalTurns,
  }
}
