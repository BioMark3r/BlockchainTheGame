import type { PlayerId } from '@shared/types'

export function displayName(id: PlayerId, isCpu: boolean, names?: Record<string, string>): string {
  if (isCpu) return '🤖 CPU'
  if (names?.[id]) return names[id]!
  if (id === 'player1') return 'Player 1'
  if (id === 'player2') return 'Player 2'
  return id
}
