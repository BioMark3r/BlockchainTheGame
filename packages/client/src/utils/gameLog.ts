import type { GameState, PlayerId } from '@shared/types'
import { CardType } from '@shared/types'
import type { LogEntry } from '../store/gameStore'

function playerLabel(id: PlayerId, isCpu: boolean, names?: Record<string, string>): string {
  if (isCpu) return '🤖 CPU'
  if (names?.[id]) return names[id]!
  if (id === 'player1') return 'Player 1'
  if (id === 'player2') return 'Player 2'
  return id
}

let _seq = 0
function nextId(): string {
  return `log-${++_seq}`
}

/**
 * Compare two consecutive game states and return new log entries that describe
 * what changed. Called on every GAME_STATE message.
 */
export function deriveLogEntries(
  prev: GameState | null,
  next: GameState,
  _existingCount: number,
  playerNames?: Record<string, string>,
): LogEntry[] {
  if (!prev) {
    // Game just started
    const p1 = next.players[0]!
    return [
      {
        id: nextId(),
        icon: '🚀',
        text: `Game started — ${playerLabel(p1.id, p1.isCpu, playerNames)} goes first`,
        playerId: null,
        turn: 0,
      },
    ]
  }

  const entries: LogEntry[] = []

  // Helper: find player by id
  const prevP = (id: PlayerId) => prev.players.find((p) => p.id === id)
  const nextP = (id: PlayerId) => next.players.find((p) => p.id === id)

  // Who just acted? The turn CHANGED, so the actor is whoever had the turn before.
  // Exception: if phase ended, the actor is still whoever had the turn in prev.
  const actorId = prev.currentTurn

  const prevActor = prevP(actorId)
  const nextActor = nextP(actorId)
  if (!prevActor || !nextActor) return entries

  const label = playerLabel(actorId, prevActor.isCpu, playerNames)

  // 1. Chain grew → block published
  if (next.chain.length > prev.chain.length) {
    const newBlocks = next.chain.slice(prev.chain.length)
    for (const block of newBlocks) {
      // Detect Block Reward: its third transaction slot holds the Block Reward card
      const isBlockReward = block.transactions.some(t => t.type === CardType.BLOCK_REWARD)
      const creditsEarned: string[] = []
      for (const p of next.players) {
        const prevCredits = prevP(p.id)?.credits ?? 0
        const earned = p.credits - prevCredits
        if (earned > 0) {
          creditsEarned.push(`${playerLabel(p.id, p.isCpu, playerNames)} +${earned}`)
        }
      }
      const creditStr = creditsEarned.length > 0 ? ` (${creditsEarned.join(', ')})` : ''
      const blockType = isBlockReward ? '🪙 Block Reward — ' : ''
      entries.push({
        id: nextId(),
        icon: isBlockReward ? '🪙' : '📦',
        text: `${label} published block #${next.chain.length} ${blockType}${creditStr}`,
        playerId: actorId,
        turn: next.chain.length,
      })
    }
  }

  // 2. Chain shrank → reorg or invalid transaction
  if (next.chain.length < prev.chain.length) {
    const removed = prev.chain.length - next.chain.length
    if (removed > 1) {
      entries.push({
        id: nextId(),
        icon: '🔄',
        text: `${label} played Chain Reorg — ${removed} block${removed !== 1 ? 's' : ''} removed`,
        playerId: actorId,
        turn: next.chain.length,
      })
    } else {
      entries.push({
        id: nextId(),
        icon: '❌',
        text: `${label} played Invalid Transaction — block removed`,
        playerId: actorId,
        turn: next.chain.length,
      })
    }
  }

  // 3. Validator count increased
  const prevValidators = prevActor.validators.length
  const nextValidators = nextActor.validators.length
  if (nextValidators > prevValidators) {
    entries.push({
      id: nextId(),
      icon: '🛡️',
      text: `${label} played a Validator (now has ${nextValidators})`,
      playerId: actorId,
      turn: next.chain.length,
    })
  }

  // 4. Chain Split triggered
  if (!prev.chainSplit.active && next.chainSplit.active) {
    entries.push({
      id: nextId(),
      icon: '🔱',
      text: `${label} played Chain Split — solo credit mode active`,
      playerId: actorId,
      turn: next.chain.length,
    })
  }

  // 5. Validator Redundancy played
  if (next.validatorRedundancyCount > prev.validatorRedundancyCount) {
    const mult = Math.pow(2, next.validatorRedundancyCount)
    entries.push({
      id: nextId(),
      icon: '⚡',
      text: `${label} played Validator Redundancy — credits now ×${mult} per validator`,
      playerId: actorId,
      turn: next.chain.length,
    })
  }

  // 6. Discard pile grew but chain/validators unchanged → reshuffle or discard-redraw
  const prevDiscard = prevActor.discardPile.length
  const nextDiscard = nextActor.discardPile.length
  const prevDraw = prevActor.drawPile.length
  const nextDraw = nextActor.drawPile.length
  const chainUnchanged = next.chain.length === prev.chain.length
  const validatorsUnchanged = nextValidators === prevValidators
  const chainSplitUnchanged = next.chainSplit.active === prev.chainSplit.active
  const vrUnchanged = next.validatorRedundancyCount === prev.validatorRedundancyCount

  if (
    chainUnchanged && validatorsUnchanged && chainSplitUnchanged && vrUnchanged
  ) {
    // Draw pile grew → reshuffle happened
    if (nextDraw > prevDraw && nextDiscard < prevDiscard) {
      // Check if the opponent drew a card as a result (Reshuffle cost)
      const oppId = actorId === 'player1' ? 'player2' : 'player1'
      const prevOpp = prevP(oppId)
      const nextOpp = nextP(oppId)
      const oppDrewCard = prevOpp && nextOpp && nextOpp.hand.length > prevOpp.hand.length
      entries.push({
        id: nextId(),
        icon: '🔀',
        text: `${label} played Reshuffle — deck refilled${oppDrewCard ? ' (opponent draws 1)' : ''}`,
        playerId: actorId,
        turn: next.chain.length,
      })
    } else if (entries.length === 0) {
      // No other special event — must be a discard & redraw
      const discarded = nextDiscard - prevDiscard
      if (discarded > 0) {
        entries.push({
          id: nextId(),
          icon: '🃏',
          text: `${label} discarded ${discarded} card${discarded !== 1 ? 's' : ''} and drew`,
          playerId: actorId,
          turn: next.chain.length,
        })
      }
    }
  }

  // 7. Game ended
  if (prev.phase !== 'ended' && next.phase === 'ended') {
    const winnerPlayer = next.winner ? nextP(next.winner) : null
    const winnerLabel = winnerPlayer
      ? playerLabel(winnerPlayer.id, winnerPlayer.isCpu, playerNames)
      : 'Nobody'
    const reason =
      next.forkReason === 'fork_card'
        ? '⑂ Fork card played'
        : next.forkReason === 'player1_out_of_cards'
        ? '📭 Player 1 ran out of cards'
        : next.forkReason === 'player2_out_of_cards'
        ? '📭 Player 2 ran out of cards'
        : 'Game over'
    entries.push({
      id: nextId(),
      icon: '🏁',
      text: `Game ended — ${reason}. Winner: ${winnerLabel}`,
      playerId: next.winner,
      turn: next.chain.length,
    })
  }

  return entries
}
