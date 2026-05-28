import { applyAction } from '../../../../src/engine/index.js'
import type { GameState, PlayerId, TurnAction } from '../../../../src/shared/types.js'
import { CardType as CT } from '../../../../src/shared/types.js'
import type { Room } from './rooms.js'

// ---------------------------------------------------------------------------
// CPU action chooser
// ---------------------------------------------------------------------------

export function chooseAction(state: GameState, cpuPlayerId: PlayerId): TurnAction {
  const playerIdx = state.players.findIndex((p) => p.id === cpuPlayerId)
  if (playerIdx === -1) throw new Error(`CPU player ${cpuPlayerId} not found in state`)
  const myState = state.players[playerIdx]!
  const oppState = state.players[playerIdx === 0 ? 1 : 0]!
  const hand = myState.hand

  // --- Compute context ---
  const creditDiff = myState.credits - oppState.credits
  const myValidators = myState.validators.length
  const oppValidators = oppState.validators.length
  const txCards = hand.filter((c) => c.type === CT.TRANSACTION)
  // Rough turns left: cards remaining in draw pile + tx cards in hand (each publish costs 3)
  const turnsLeft = myState.drawPile.length + Math.floor(txCards.length / 3)

  // --- Card lookups ---
  const forkCard = hand.find((c) => c.type === CT.FORK)
  const validatorCard = hand.find((c) => c.type === CT.VALIDATOR)
  const vrCard = hand.find((c) => c.type === CT.VALIDATOR_REDUNDANCY)
  const csCard = hand.find((c) => c.type === CT.CHAIN_SPLIT)
  const itCard = hand.find((c) => c.type === CT.INVALID_TRANSACTION)
  const crCard = hand.find((c) => c.type === CT.CHAIN_REORG)
  const reshuffleCard = hand.find((c) => c.type === CT.RESHUFFLE)

  // 1. PUBLISH_BLOCK — highest priority when possible
  if (txCards.length >= 3) {
    return {
      type: 'PUBLISH_BLOCK',
      playerId: cpuPlayerId,
      cardIds: [txCards[0]!.id, txCards[1]!.id, txCards[2]!.id],
    }
  }

  // 2. FORK — play to lock in a winning lead
  if (forkCard && creditDiff >= 5 && turnsLeft <= 8) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: forkCard.id }
  }

  // 3. CHAIN_REORG — when opponent has built a large validator advantage
  if (crCard && oppValidators >= 5) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: crCard.id }
  }

  // 4. INVALID_TRANSACTION — target the OLDEST opponent block (first in chain)
  if (itCard) {
    const oldestOppBlock = state.chain.find((b) => b.publishedBy !== cpuPlayerId)
    if (oldestOppBlock) {
      return {
        type: 'PLAY_CARD',
        playerId: cpuPlayerId,
        cardId: itCard.id,
        targetBlockId: oldestOppBlock.id,
      }
    }
  }

  // 5. VALIDATOR — build up to keep pace with opponent (cap at 5 total, stay within +2 of opp)
  if (validatorCard && myValidators < oppValidators + 2 && myValidators < 5) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: validatorCard.id }
  }

  // 6. VALIDATOR_REDUNDANCY — only worth playing once validators are in place
  if (vrCard && myValidators >= 2) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: vrCard.id }
  }

  // 7. CHAIN_SPLIT — only if CPU has the validator advantage
  if (csCard && myValidators > oppValidators) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: csCard.id }
  }

  // 8. RESHUFFLE — when deck is empty or nearly empty and discard is large enough
  if (
    reshuffleCard &&
    myState.discardPile.length > 0 &&
    (myState.drawPile.length === 0 || (myState.drawPile.length <= 3 && myState.discardPile.length >= 5))
  ) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: reshuffleCard.id }
  }

  // 9. FORK — defensive: play to cut losses when significantly behind
  if (forkCard && creditDiff <= -8) {
    return { type: 'PLAY_CARD', playerId: cpuPlayerId, cardId: forkCard.id }
  }

  // 10. DISCARD_REDRAW fallback — discard everything except TRANSACTION cards
  const keepTypes = new Set<string>([CT.TRANSACTION])
  const toDiscard = hand.filter((c) => !keepTypes.has(c.type))
  if (toDiscard.length > 0) {
    return {
      type: 'DISCARD_REDRAW',
      playerId: cpuPlayerId,
      cardIdsToDiscard: toDiscard.map((c) => c.id),
    }
  }

  // All cards are TRANSACTION but fewer than 3 — keep 2, discard the rest to draw toward a set
  if (hand.length > 2) {
    const toDiscardTx = hand.slice(2)
    return {
      type: 'DISCARD_REDRAW',
      playerId: cpuPlayerId,
      cardIdsToDiscard: toDiscardTx.map((c) => c.id),
    }
  }

  // Only 1–2 TX cards — discard one to keep drawing
  const discardOne = hand[0]!
  return {
    type: 'DISCARD_REDRAW',
    playerId: cpuPlayerId,
    cardIdsToDiscard: [discardOne.id],
  }
}

// ---------------------------------------------------------------------------
// Trigger CPU turn (with fallback on engine rejection)
// ---------------------------------------------------------------------------

type BroadcastFn = (room: Room, state: GameState) => void

export function triggerCpuTurn(room: Room, broadcast: BroadcastFn): void {
  if (!room.gameState || room.gameState.phase !== 'playing') return

  const cpuPlayer = room.players.find((p) => p?.isCpu)
  if (!cpuPlayer) return
  const cpuPlayerId = cpuPlayer.playerId

  if (room.gameState.currentTurn !== cpuPlayerId) return

  const action = chooseAction(room.gameState, cpuPlayerId)
  const result = applyAction(room.gameState, action)

  if (result.success) {
    room.gameState = result.state
    broadcast(room, result.state)
  } else {
    // Engine rejected — should not happen, but attempt fallback DISCARD_REDRAW
    console.error(
      `[CPU] Engine rejected action for ${cpuPlayerId}:`,
      result.error,
      '— attempting fallback DISCARD_REDRAW',
    )

    const playerIdx = room.gameState.players.findIndex((p) => p.id === cpuPlayerId)
    const player = room.gameState.players[playerIdx]!
    const hand = player.hand

    let fallbackAction: TurnAction
    if (hand.length > 0) {
      fallbackAction = {
        type: 'DISCARD_REDRAW',
        playerId: cpuPlayerId,
        cardIdsToDiscard: [hand[0]!.id],
      }
    } else {
      // No cards at all — nothing we can do, log and bail
      console.error(`[CPU] ${cpuPlayerId} has no cards for fallback; skipping turn`)
      return
    }

    const fallbackResult = applyAction(room.gameState, fallbackAction)
    if (fallbackResult.success) {
      room.gameState = fallbackResult.state
      broadcast(room, fallbackResult.state)
    } else {
      console.error(`[CPU] Fallback DISCARD_REDRAW also rejected:`, fallbackResult.error)
      return
    }
  }

  // Schedule next CPU turn if the game is still playing and it's still CPU's turn
  // (normally shouldn't be, but guard for consecutive CPU moves e.g. after fork effects)
  const latestState = room.gameState
  if (latestState.phase === 'playing' && latestState.currentTurn === cpuPlayerId) {
    setTimeout(() => triggerCpuTurn(room, broadcast), 500)
  }
}
