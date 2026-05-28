import type { GameState, PlayerId } from '@shared/types'
import type { LogEntry } from '../store/gameStore'

function playerLabel(id: PlayerId, isCpu: boolean): string {
  if (isCpu) return '🤖 CPU'
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
): LogEntry[] {
  if (!prev) {
    // Game just started
    const p1 = next.players[0]!
    return [
      {
        id: nextId(),
        icon: '🚀',
        text: `Game started — ${playerLabel(p1.id, p1.isCpu)} goes first`,
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

  const label = playerLabel(actorId, prevActor.isCpu)

  // 1. Chain grew → block published
  if (next.chain.length > prev.chain.length) {
    const newBlocks = next.chain.slice(prev.chain.length)
    for (const block of newBlocks) {
      const creditsEarned: string[] = []
      for (const p of next.players) {
        const prevCredits = prevP(p.id)?.credits ?? 0
        const earned = p.credits - prevCredits
        if (earned > 0) {
          creditsEarned.push(`${playerLabel(p.id, p.isCpu)} +${earned}`)
        }
      }
      const creditStr = creditsEarned.length > 0 ? ` (${creditsEarned.join(', ')})` : ''
      entries.push({
        id: nextId(),
        icon: '📦',
        text: `${label} published block #${next.chain.length}${creditStr}`,
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
        text: `${label} played Chain Reorg — all ${prev.chain.length} blocks removed`,
        playerId: actorId,
        turn: 0,
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
      entries.push({
        id: nextId(),
        icon: '🔀',
        text: `${label} played Reshuffle — deck refilled`,
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
      ? playerLabel(winnerPlayer.id, winnerPlayer.isCpu)
      : 'Nobody'
    const reason =
      next.forkReason === 'fork_card'
        ? '⑂ Fork card played'
        : next.forkReason === 'player1_out_of_cards'
        ? '📭 Player 1 ran out of cards'
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
