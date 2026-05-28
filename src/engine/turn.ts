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
 * After every action, check if player1 is completely out of cards (hand + draw pile = 0).
 * Only player1 running out triggers a fork — player2 does not.
 */
function checkForkCondition(state: GameState): GameState {
  if (state.phase === 'ended') return state

  const player1 = state.players[0]
  if (!player1) return state

  if (player1.hand.length === 0 && player1.drawPile.length === 0) {
    const endedState: GameState = { ...state, phase: 'ended', forkReason: 'player1_out_of_cards' }
    return { ...endedState, winner: getWinner(endedState) }
  }

  return state
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

  // Draw back up to 5-card hand after playing a card
  if (newState.phase === 'playing') {
    const pIdx = getPlayerIndex(newState, action.playerId)
    const p = newState.players[pIdx]!
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

  // Advance turn only if game didn't end via FORK
  if (newState.phase === 'playing') {
    newState = { ...newState, currentTurn: nextTurn(newState) }
    newState = checkForkCondition(newState)
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
  }

  // Remove transaction cards from hand, move to discard
  const usedIds = new Set(action.cardIds)
  const newHand = player.hand.filter((c) => !usedIds.has(c.id))
  const newDiscard = [...player.discardPile, ...txCards]

  // Draw back up to 5-card hand after publishing
  const drawCount = Math.max(0, 5 - newHand.length)
  const { drawn, remainingDrawPile } = dealHand(player.drawPile, drawCount)
  const newPlayer = {
    ...player,
    hand: [...newHand, ...drawn],
    drawPile: remainingDrawPile,
    discardPile: newDiscard,
  }
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[playerIdx] = newPlayer

  let newState: GameState = { ...state, players: newPlayers, chain: [...state.chain, block] }

  // Calculate and apply credits
  const creditsMap = calculateBlockCredits(newState, action.playerId)
  const creditedPlayers: [typeof newPlayers[0], typeof newPlayers[1]] = [...newPlayers] as [
    typeof newPlayers[0],
    typeof newPlayers[1],
  ]
  for (let i = 0; i < creditedPlayers.length; i++) {
    const p = creditedPlayers[i]!
    const earned = creditsMap.get(p.id) ?? 0
    creditedPlayers[i] = { ...p, credits: p.credits + earned }
  }

  newState = { ...newState, players: creditedPlayers, currentTurn: nextTurn(newState) }
  newState = checkForkCondition(newState)

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

  // Draw back up to 5-card hand after discarding
  const drawCount = Math.max(0, 5 - remainingHand.length)
  const { drawn, remainingDrawPile } = dealHand(player.drawPile, drawCount)

  const newPlayer = {
    ...player,
    hand: [...remainingHand, ...drawn],
    drawPile: remainingDrawPile,
    discardPile: newDiscardPile,
  }

  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[playerIdx] = newPlayer

  let newState: GameState = {
    ...state,
    players: newPlayers,
    currentTurn: nextTurn(state),
  }
  newState = checkForkCondition(newState)

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
