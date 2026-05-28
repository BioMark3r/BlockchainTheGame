import { GameState, PlayerId } from '../shared/types'

/**
 * Determine the winner based on credits.
 * Returns null if game is not ended or if it's a tie.
 */
export function getWinner(state: GameState): PlayerId | null {
  if (state.phase !== 'ended') return null
  const [p1, p2] = state.players
  if (!p1 || !p2) return null
  if (p1.credits > p2.credits) return p1.id
  if (p2.credits > p1.credits) return p2.id
  return null // tie
}
