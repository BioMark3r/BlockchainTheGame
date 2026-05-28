import { GameState, PlayerId } from '../shared/types'

/**
 * Calculate credits earned by each player when a block is published.
 *
 * Rules:
 * - Each player earns: validators.length * 2^validatorRedundancyCount
 * - A player with 0 validators earns 0 credits regardless of multiplier
 * - If Chain Split is active, only the publisherId earns credits
 * - Both players are calculated independently (they can have different validator counts)
 */
export function calculateBlockCredits(
  state: GameState,
  publisherId: PlayerId
): Map<PlayerId, number> {
  const multiplier = Math.pow(2, state.validatorRedundancyCount)
  const result = new Map<PlayerId, number>()

  for (const player of state.players) {
    // Under chain split, only the publisher earns credits
    if (state.chainSplit.active && player.id !== publisherId) {
      result.set(player.id, 0)
      continue
    }
    result.set(player.id, player.validators.length * multiplier)
  }

  return result
}
