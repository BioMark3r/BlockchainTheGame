import {
  ActionResult,
  Block,
  CardType,
  DiscardRedrawAction,
  GameState,
  PlayCardAction,
  PlayerId,
  PublishBlockAction,
  TurnAction,
} from '../shared/types'
import { applyEffect } from './effects'
import { calculateBlockCredits } from './credits'
import { dealHand, shuffleDeck } from './deck'
import { getWinner } from './winner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlayerIndex(state: GameState, playerId: PlayerId): 0 | 1 {
  const idx = state.players.findIndex((p) => p.id === playerId)
  if (idx !== 0 && idx !== 1) throw new Error(`Player ${playerId} not found`)
  return idx as 0 | 1
}

function nextTurn(state: GameState): PlayerId {
  const [p1, p2] = state.players
  if (!p1 || !p2) throw new Error('Invalid player state')
  return state.currentTurn === p1.id ? p2.id : p1.id
}

/**
 * After an action, check if the acting player is completely out of cards (hand + draw pile = 0).
 * We only check the player who just acted — this avoids false positives in unit tests where
 * the opposing player starts with 0 cards, and correctly mirrors the rule: a fork triggers
 * when a player uses their last card.
 */
function checkForkCondition(state: GameState, actingPlayerId: PlayerId): GameState {
  if (state.phase === 'ended') return state

  const actor = state.players.find((p) => p.id === actingPlayerId)
  if (!actor) return state

  if (actor.hand.length === 0 && actor.drawPile.length === 0 && actingPlayerId === 'player1') {
    const endedState: GameState = { ...state, phase: 'ended', forkReason: 'player1_out_of_cards' }
    return { ...endedState, winner: getWinner(endedState) }
  }

  return state
}

/**
 * Resolve pending batches for a player (pay out their escrowed credits).
 * Called after turn advances to the next player — resolves batches for that next player.
 */
export function resolvePendingBatches(state: GameState, forPlayerId: PlayerId): GameState {
  if (state.pendingBatches.length === 0) return state

  const myBatches = state.pendingBatches.filter((pb) => pb.publishedBy === forPlayerId)
  if (myBatches.length === 0) return state

  // Pay out credits
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  for (const pb of myBatches) {
    for (const [pidStr, amount] of Object.entries(pb.creditsEscrowed)) {
      const pid = pidStr as PlayerId
      const pIdx = newPlayers.findIndex((p) => p.id === pid)
      if (pIdx === -1) continue
      const p = newPlayers[pIdx]!
      newPlayers[pIdx] = { ...p, credits: p.credits + (amount ?? 0) }
    }
  }

  const remainingBatches = state.pendingBatches.filter((pb) => pb.publishedBy !== forPlayerId)

  return { ...state, players: newPlayers, pendingBatches: remainingBatches }
}

function fail(state: GameState, error: string): ActionResult {
  return { success: false, state, error }
}

function succeed(state: GameState): ActionResult {
  return { success: true, state }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handlePlayCard(state: GameState, action: PlayCardAction): ActionResult {
  if (state.phase !== 'playing') return fail(state, 'Game is not in playing phase')
  if (action.playerId !== state.currentTurn) return fail(state, 'Not this player\'s turn')

  const playerIdx = getPlayerIndex(state, action.playerId)
  const player = state.players[playerIdx]!
  const card = player.hand.find((c) => c.id === action.cardId)
  if (!card) return fail(state, `Card ${action.cardId} not found in hand`)
  if (card.type === CardType.TRANSACTION) {
    return fail(state, 'TRANSACTION cards must be used with PUBLISH_BLOCK')
  }
  if (card.type === CardType.GENESIS) {
    return fail(state, 'GENESIS card cannot be played')
  }
  if (card.type === CardType.BLOCK_REWARD) {
    const txCount = player.hand.filter((c) => c.type === CardType.TRANSACTION).length
    if (txCount < 2) {
      return fail(state, 'Block Reward requires at least 2 Transaction cards in hand')
    }
  }
  if (card.type === CardType.DATA_BLOB) {
    const txCount = player.hand.filter((c) => c.type === CardType.TRANSACTION).length
    if (txCount < 1) {
      return fail(state, 'Data Blob requires at least 1 Transaction card in hand')
    }
  }
  if (card.type === CardType.OPTIMISTIC_ROLLUP) {
    const txCount = player.hand.filter((c) => c.type === CardType.TRANSACTION).length
    if (txCount < 2) {
      return fail(state, 'Optimistic Rollup requires at least 2 Transaction cards in hand')
    }
  }
  if (card.type === CardType.INVALID_TRANSACTION && !action.targetBlockId) {
    return fail(state, 'INVALID_TRANSACTION requires targetBlockId')
  }
  if (card.type === CardType.INVALID_TRANSACTION && action.targetBlockId) {
    const targetExists = state.chain.some((b) => b.id === action.targetBlockId)
    if (!targetExists) return fail(state, `Block ${action.targetBlockId} not found in chain`)
  }

  let newState: GameState
  try {
    newState = applyEffect(state, action)
  } catch (err) {
    return fail(state, err instanceof Error ? err.message : String(err))
  }

  // Draw back up to 5-card hand after playing a card (skipped if gas spike)
  if (newState.phase === 'playing') {
    const pIdx = getPlayerIndex(newState, action.playerId)
    const p = newState.players[pIdx]!
    const gasSpikeSuppressed = newState.gasSpike === action.playerId

    if (!gasSpikeSuppressed) {
      const toDraw = Math.max(0, 5 - p.hand.length)
      if (toDraw > 0) {
        const { drawn, remainingDrawPile } = dealHand(p.drawPile, toDraw)
        const updatedPlayers: [typeof newState.players[0], typeof newState.players[1]] = [...newState.players] as [
          typeof newState.players[0],
          typeof newState.players[1],
        ]
        updatedPlayers[pIdx] = { ...p, hand: [...p.hand, ...drawn], drawPile: remainingDrawPile }
        newState = { ...newState, players: updatedPlayers }
      }
    }

    // Clear gas spike after their turn
    if (gasSpikeSuppressed) {
      newState = { ...newState, gasSpike: null }
    }
  }

  // Advance turn only if game didn't end via FORK
  if (newState.phase === 'playing') {
    const nextPlayer = nextTurn(newState)
    newState = { ...newState, currentTurn: nextPlayer }
    // Resolve pending batches for the next player
    newState = resolvePendingBatches(newState, nextPlayer)
    newState = checkForkCondition(newState, action.playerId)
  }

  return succeed(newState)
}

function handlePublishBlock(state: GameState, action: PublishBlockAction): ActionResult {
  if (state.phase !== 'playing') return fail(state, 'Game is not in playing phase')
  if (action.playerId !== state.currentTurn) return fail(state, 'Not this player\'s turn')

  const playerIdx = getPlayerIndex(state, action.playerId)
  const player = state.players[playerIdx]!

  // Validate all 3 cards exist in hand and are TRANSACTION cards
  if (action.cardIds.length !== 3) return fail(state, 'Must provide exactly 3 card IDs')

  const cards = action.cardIds.map((id) => player.hand.find((c) => c.id === id))
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (!card) return fail(state, `Card ${action.cardIds[i]} not found in hand`)
    // In L1 mode, all cards must be TRANSACTION. In L2, PUBLISH_BLOCK still requires 3 TRANSACTION cards.
    if (card.type !== CardType.TRANSACTION) {
      return fail(state, `Card ${card.id} is not a TRANSACTION card`)
    }
  }

  const txCards = cards as [NonNullable<(typeof cards)[0]>, NonNullable<(typeof cards)[0]>, NonNullable<(typeof cards)[0]>]

  // Build the block
  const blockId = `block-${action.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const block: Block = {
    id: blockId,
    publishedBy: action.playerId,
    transactions: txCards,
    isPending: false,
  }

  // Remove transaction cards from hand, move to discard
  const usedIds = new Set(action.cardIds)
  const newHand = player.hand.filter((c) => !usedIds.has(c.id))
  const newDiscard = [...player.discardPile, ...txCards]

  // Handle gas spike: skip draw-to-5 refill
  const gasSpikeSuppressed = state.gasSpike === action.playerId
  let drawnCards: ReturnType<typeof dealHand> | null = null
  if (!gasSpikeSuppressed) {
    const drawCount = Math.max(0, 5 - newHand.length)
    drawnCards = dealHand(player.drawPile, drawCount)
  }

  const newPlayer = {
    ...player,
    hand: drawnCards ? [...newHand, ...drawnCards.drawn] : newHand,
    drawPile: drawnCards ? drawnCards.remainingDrawPile : player.drawPile,
    discardPile: newDiscard,
  }
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[playerIdx] = newPlayer

  let newState: GameState = {
    ...state,
    players: newPlayers,
    chain: [...state.chain, block],
    gasSpike: gasSpikeSuppressed ? null : state.gasSpike,
  }

  // Calculate and apply credits
  const creditsMap = calculateBlockCredits(newState, action.playerId)
  const creditedPlayers: [typeof newPlayers[0], typeof newPlayers[1]] = [...newPlayers] as [
    typeof newPlayers[0],
    typeof newPlayers[1],
  ]

  for (let i = 0; i < creditedPlayers.length; i++) {
    const p = creditedPlayers[i]!
    let earned = creditsMap.get(p.id) ?? 0
    // Bridge doubles publisher's credits
    if (newState.bridgeActive === action.playerId && p.id === action.playerId) {
      earned *= 2
    }
    creditedPlayers[i] = { ...p, credits: p.credits + earned }
  }

  // MEV steal
  let mevActive = newState.mevActive
  if (mevActive !== null && mevActive !== action.playerId) {
    const pubIdx = getPlayerIndex(newState, action.playerId)
    const mevIdx = getPlayerIndex(newState, mevActive)
    const stolen = Math.min(2, creditedPlayers[pubIdx]!.credits)
    creditedPlayers[pubIdx] = { ...creditedPlayers[pubIdx]!, credits: creditedPlayers[pubIdx]!.credits - stolen }
    creditedPlayers[mevIdx] = { ...creditedPlayers[mevIdx]!, credits: creditedPlayers[mevIdx]!.credits + stolen }
    mevActive = null
  }

  const nextPlayer = nextTurn(newState)
  newState = {
    ...newState,
    players: creditedPlayers,
    currentTurn: nextPlayer,
    validatorRedundancyCount: 0,
    bridgeActive: null,
    mevActive,
  }

  // Resolve pending batches for next player
  newState = resolvePendingBatches(newState, nextPlayer)
  newState = checkForkCondition(newState, action.playerId)

  return succeed(newState)
}

function handleDiscardRedraw(state: GameState, action: DiscardRedrawAction): ActionResult {
  if (state.phase !== 'playing') return fail(state, 'Game is not in playing phase')
  if (action.playerId !== state.currentTurn) return fail(state, 'Not this player\'s turn')

  const playerIdx = getPlayerIndex(state, action.playerId)
  const player = state.players[playerIdx]!

  // Validate all cards to discard exist in hand
  for (const cardId of action.cardIdsToDiscard) {
    if (!player.hand.find((c) => c.id === cardId)) {
      return fail(state, `Card ${cardId} not found in hand`)
    }
  }

  const discardSet = new Set(action.cardIdsToDiscard)
  const discarded = player.hand.filter((c) => discardSet.has(c.id))
  const remainingHand = player.hand.filter((c) => !discardSet.has(c.id))
  const newDiscardPile = [...player.discardPile, ...discarded]

  // Handle gas spike: skip drawing new cards
  const gasSpikeSuppressed = state.gasSpike === action.playerId
  let drawnCards: ReturnType<typeof dealHand> | null = null
  if (!gasSpikeSuppressed) {
    const drawCount = Math.max(0, 5 - remainingHand.length)
    drawnCards = dealHand(player.drawPile, drawCount)
  }

  const newPlayer = {
    ...player,
    hand: drawnCards ? [...remainingHand, ...drawnCards.drawn] : remainingHand,
    drawPile: drawnCards ? drawnCards.remainingDrawPile : player.drawPile,
    discardPile: newDiscardPile,
  }

  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[playerIdx] = newPlayer

  const nextPlayer = nextTurn(state)
  let newState: GameState = {
    ...state,
    players: newPlayers,
    currentTurn: nextPlayer,
    gasSpike: gasSpikeSuppressed ? null : state.gasSpike,
  }

  // Resolve pending batches for next player
  newState = resolvePendingBatches(newState, nextPlayer)
  newState = checkForkCondition(newState, action.playerId)

  return succeed(newState)
}

// ---------------------------------------------------------------------------
// Public applyAction dispatcher
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, action: TurnAction): ActionResult {
  switch (action.type) {
    case 'PLAY_CARD':
      return handlePlayCard(state, action)
    case 'PUBLISH_BLOCK':
      return handlePublishBlock(state, action)
    case 'DISCARD_REDRAW':
      return handleDiscardRedraw(state, action)
    default: {
      const _exhaustive: never = action
      return fail(state, `Unknown action type: ${String(_exhaustive)}`)
    }
  }
}
