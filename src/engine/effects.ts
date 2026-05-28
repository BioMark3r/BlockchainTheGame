import { CardType, GameState, PlayCardAction, PlayerId } from '../shared/types'
import { getWinner } from './winner'
import { shuffleDeck } from './deck'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getPlayerIndex(state: GameState, playerId: PlayerId): 0 | 1 {
  const idx = state.players.findIndex((p) => p.id === playerId)
  if (idx !== 0 && idx !== 1) throw new Error(`Player ${playerId} not found in game state`)
  return idx as 0 | 1
}

/** Return a new state with the acting card removed from the player's hand and moved to discard. */
function consumeCard(state: GameState, playerId: PlayerId, cardId: string): GameState {
  const idx = getPlayerIndex(state, playerId)
  const player = state.players[idx]!
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) throw new Error(`Card ${cardId} not found in ${playerId} hand`)

  const newPlayer = {
    ...player,
    hand: player.hand.filter((c) => c.id !== cardId),
    discardPile: [...player.discardPile, card],
  }

  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[idx] = newPlayer

  return { ...state, players: newPlayers }
}

// ---------------------------------------------------------------------------
// Effect functions (state in → state out, pure)
// ---------------------------------------------------------------------------

function applyValidator(state: GameState, action: PlayCardAction): GameState {
  const idx = getPlayerIndex(state, action.playerId)
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  const player = stateAfterConsume.players[idx]!

  // The card was moved to discard by consumeCard; move it from discard to validators instead
  const card = player.discardPile[player.discardPile.length - 1]!
  const newPlayer = {
    ...player,
    discardPile: player.discardPile.slice(0, -1),
    validators: [...player.validators, card],
  }

  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [
    ...stateAfterConsume.players,
  ] as [typeof state.players[0], typeof state.players[1]]
  newPlayers[idx] = newPlayer

  return { ...stateAfterConsume, players: newPlayers }
}

function applyReshuffle(state: GameState, action: PlayCardAction): GameState {
  // Card is always consumed (moved to discard) even when it's a no-op
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  const idx = getPlayerIndex(state, action.playerId)
  const player = stateAfterConsume.players[idx]!

  // No-op when discard pile is empty (the reshuffle card itself is now in discard,
  // but we should not reshuffle a single-card discard pile back — the intent is to
  // reshuffle previously discarded cards, so we check if discard had cards BEFORE consume)
  const originalPlayer = state.players[idx]!
  const hadCardsBeforeConsume = originalPlayer.discardPile.length > 0

  if (!hadCardsBeforeConsume) {
    // No-op: the card is consumed but nothing else changes
    return stateAfterConsume
  }

  // Shuffle all discard cards (except the reshuffle card just added) back into draw pile
  const reshuffleCard = player.discardPile[player.discardPile.length - 1]!
  const cardsToReshuffle = player.discardPile.slice(0, -1) // exclude the just-played reshuffle card
  const newDrawPile = shuffleDeck([...player.drawPile, ...cardsToReshuffle])

  const newPlayer = {
    ...player,
    drawPile: newDrawPile,
    discardPile: [reshuffleCard], // only the just-played reshuffle card remains in discard
  }

  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [
    ...stateAfterConsume.players,
  ] as [typeof state.players[0], typeof state.players[1]]
  newPlayers[idx] = newPlayer

  return { ...stateAfterConsume, players: newPlayers }
}

function applyChainSplit(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return {
    ...stateAfterConsume,
    chainSplit: { active: true, triggeredBy: action.playerId },
  }
}

function applyValidatorRedundancy(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return {
    ...stateAfterConsume,
    validatorRedundancyCount: stateAfterConsume.validatorRedundancyCount + 1,
  }
}

function applyInvalidTransaction(state: GameState, action: PlayCardAction): GameState {
  if (!action.targetBlockId) {
    throw new Error('INVALID_TRANSACTION requires targetBlockId')
  }
  const targetBlock = state.chain.find((b) => b.id === action.targetBlockId)
  if (!targetBlock) {
    throw new Error(`Block ${action.targetBlockId} not found in chain`)
  }

  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return {
    ...stateAfterConsume,
    chain: stateAfterConsume.chain.filter((b) => b.id !== action.targetBlockId),
  }
}

function applyChainReorg(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return {
    ...stateAfterConsume,
    chain: [], // all blocks removed; chainSplit state is preserved
  }
}

function applyFork(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  const endedState: GameState = {
    ...stateAfterConsume,
    phase: 'ended',
    forkReason: 'fork_card',
    winner: null,
  }
  return { ...endedState, winner: getWinner(endedState) }
}

// ---------------------------------------------------------------------------
// Dispatch map + public applyEffect
// ---------------------------------------------------------------------------

type EffectFn = (state: GameState, action: PlayCardAction) => GameState

const CARD_EFFECTS: Partial<Record<CardType, EffectFn>> = {
  [CardType.VALIDATOR]: applyValidator,
  [CardType.RESHUFFLE]: applyReshuffle,
  [CardType.CHAIN_SPLIT]: applyChainSplit,
  [CardType.VALIDATOR_REDUNDANCY]: applyValidatorRedundancy,
  [CardType.INVALID_TRANSACTION]: applyInvalidTransaction,
  [CardType.CHAIN_REORG]: applyChainReorg,
  [CardType.FORK]: applyFork,
}

export function applyEffect(state: GameState, action: PlayCardAction): GameState {
  const player = state.players.find((p) => p.id === action.playerId)
  if (!player) throw new Error(`Player ${action.playerId} not found`)

  const card = player.hand.find((c) => c.id === action.cardId)
  if (!card) throw new Error(`Card ${action.cardId} not found in ${action.playerId}'s hand`)

  if (card.type === CardType.TRANSACTION) {
    throw new Error('TRANSACTION cards are not played directly — use PUBLISH_BLOCK')
  }
  if (card.type === CardType.GENESIS) {
    throw new Error('GENESIS card cannot be played from hand')
  }

  const effectFn = CARD_EFFECTS[card.type]
  if (!effectFn) throw new Error(`No effect handler for card type ${card.type}`)

  return effectFn(state, action)
}
