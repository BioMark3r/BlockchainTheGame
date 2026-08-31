import { Block, CardType, Card, GameState, PlayCardAction, PlayerId, PendingBatch } from '../shared/types'
import { getWinner } from './winner'
import { dealHand, shuffleDeck } from './deck'
import { calculateBlockCredits } from './credits'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getPlayerIndex(state: GameState, playerId: PlayerId): 0 | 1 {
  const idx = state.players.findIndex((p) => p.id === playerId)
  if (idx !== 0 && idx !== 1) throw new Error(`Player ${playerId} not found in game state`)
  return idx as 0 | 1
}

function getOpponentId(state: GameState, playerId: PlayerId): PlayerId {
  const opp = state.players.find((p) => p.id !== playerId)
  if (!opp) throw new Error(`Opponent not found for ${playerId}`)
  return opp.id
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

// SEQUENCER is identical to VALIDATOR
const applySequencer = applyValidator

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

  // Opponent draws 1 card as a cost of the reshuffle
  const oppIdx = idx === 0 ? 1 : 0
  const opp = newPlayers[oppIdx]!
  if (opp.drawPile.length > 0) {
    const { drawn: oppDrawn, remainingDrawPile: oppRemaining } = dealHand(opp.drawPile, 1)
    newPlayers[oppIdx] = { ...opp, hand: [...opp.hand, ...oppDrawn], drawPile: oppRemaining }
  }

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
  // Cap at 1 — not stackable. Playing a second VR while one is already active is a no-op
  // for the count (the card is still consumed). Resets to 0 automatically after the next block.
  return {
    ...stateAfterConsume,
    validatorRedundancyCount: stateAfterConsume.validatorRedundancyCount === 0 ? 1 : stateAfterConsume.validatorRedundancyCount,
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
    chain: stateAfterConsume.chain.slice(0, Math.max(0, stateAfterConsume.chain.length - 3)), // remove last 3 blocks; chainSplit state is preserved
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

// HARD_FORK is identical to FORK
const applyHardFork = applyFork

function applyBlockReward(state: GameState, action: PlayCardAction): GameState {
  const idx = getPlayerIndex(state, action.playerId)
  const player = state.players[idx]!

  // Use the 2 first Transaction cards found in hand (auto-selected)
  const txCards = player.hand
    .filter((c) => c.type === CardType.TRANSACTION)
    .slice(0, 2) as [Card, Card]

  // Build the block (Block Reward card + 2 TX cards)
  const blockId = `block-${action.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // Remove the Block Reward card and the 2 TX cards from hand; move to discard
  const usedIds = new Set([action.cardId, txCards[0]!.id, txCards[1]!.id])
  const newHand = player.hand.filter((c) => !usedIds.has(c.id))
  const blockCard = player.hand.find((c) => c.id === action.cardId)!
  const consumedCards = [blockCard, ...txCards]
  const newDiscard = [...player.discardPile, ...consumedCards]

  const newPlayer = { ...player, hand: newHand, discardPile: newDiscard }
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[idx] = newPlayer

  // Create the block — Block Reward card occupies the third transaction slot
  const block: Block = {
    id: blockId,
    publishedBy: action.playerId,
    transactions: [txCards[0]!, txCards[1]!, blockCard],
    isPending: false,
  }

  let newState: GameState = { ...state, players: newPlayers, chain: [...state.chain, block] }

  // Calculate credits at half (floor)
  const fullCreditsMap = calculateBlockCredits(newState, action.playerId)
  const creditedPlayers: [typeof newPlayers[0], typeof newPlayers[1]] = [...newPlayers] as [
    typeof newPlayers[0],
    typeof newPlayers[1],
  ]
  for (let i = 0; i < creditedPlayers.length; i++) {
    const p = creditedPlayers[i]!
    const fullEarned = fullCreditsMap.get(p.id) ?? 0
    creditedPlayers[i] = { ...p, credits: p.credits + Math.floor(fullEarned / 2) }
  }

  // Reset Validator Redundancy after block
  newState = { ...newState, players: creditedPlayers, validatorRedundancyCount: 0 }
  return newState
}

// ---------------------------------------------------------------------------
// L2 effect functions
// ---------------------------------------------------------------------------

function applyDataBlob(state: GameState, action: PlayCardAction): GameState {
  const idx = getPlayerIndex(state, action.playerId)
  const player = state.players[idx]!

  const txCards = player.hand.filter((c) => c.type === CardType.TRANSACTION)
  if (txCards.length < 1) {
    throw new Error('DATA_BLOB requires at least 1 Transaction card in hand')
  }

  const blobCard = player.hand.find((c) => c.id === action.cardId)!
  const txCard = txCards[0]!
  const blockId = `block-${action.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const usedIds = new Set([action.cardId, txCard.id])
  const newHand = player.hand.filter((c) => !usedIds.has(c.id))
  const newDiscard = [...player.discardPile, blobCard, txCard]

  const newPlayer = { ...player, hand: newHand, discardPile: newDiscard }
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[idx] = newPlayer

  const block: Block = {
    id: blockId,
    publishedBy: action.playerId,
    transactions: [blobCard, txCard],
    isPending: false,
  }

  let newState: GameState = { ...state, players: newPlayers, chain: [...state.chain, block] }

  // Calculate credits
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

  // MEV steal: if mevActive is opponent, steal 2 from publisher
  let mevActive = newState.mevActive
  if (mevActive !== null && mevActive !== action.playerId) {
    const pubIdx = getPlayerIndex(newState, action.playerId)
    const mevIdx = getPlayerIndex(newState, mevActive)
    const stolen = Math.min(2, creditedPlayers[pubIdx]!.credits)
    creditedPlayers[pubIdx] = { ...creditedPlayers[pubIdx]!, credits: creditedPlayers[pubIdx]!.credits - stolen }
    creditedPlayers[mevIdx] = { ...creditedPlayers[mevIdx]!, credits: creditedPlayers[mevIdx]!.credits + stolen }
    mevActive = null
  }

  newState = {
    ...newState,
    players: creditedPlayers,
    validatorRedundancyCount: 0,
    bridgeActive: null,
    zkProofActive: newState.zkProofActive === action.playerId ? null : newState.zkProofActive,
    mevActive,
  }
  return newState
}

function applyOptimisticRollup(state: GameState, action: PlayCardAction): GameState {
  const idx = getPlayerIndex(state, action.playerId)
  const player = state.players[idx]!

  const txCards = player.hand.filter((c) => c.type === CardType.TRANSACTION)
  if (txCards.length < 2) {
    throw new Error('OPTIMISTIC_ROLLUP requires at least 2 Transaction cards in hand')
  }

  const orCard = player.hand.find((c) => c.id === action.cardId)!
  const tx1 = txCards[0]!
  const tx2 = txCards[1]!
  const blockId = `block-${action.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const isZkProven = state.zkProofActive === action.playerId

  const usedIds = new Set([action.cardId, tx1.id, tx2.id])
  const newHand = player.hand.filter((c) => !usedIds.has(c.id))
  const newDiscard = [...player.discardPile, orCard, tx1, tx2]

  const newPlayer = { ...player, hand: newHand, discardPile: newDiscard }
  const newPlayers: [typeof state.players[0], typeof state.players[1]] = [...state.players] as [
    typeof state.players[0],
    typeof state.players[1],
  ]
  newPlayers[idx] = newPlayer

  const block: Block = {
    id: blockId,
    publishedBy: action.playerId,
    transactions: [orCard, tx1, tx2],
    isPending: !isZkProven,
  }

  let newState: GameState = {
    ...state,
    players: newPlayers,
    chain: [...state.chain, block],
    zkProofActive: isZkProven ? null : state.zkProofActive,
  }

  // Calculate credits
  const creditsMap = calculateBlockCredits(newState, action.playerId)

  // Bridge multiplier for publisher
  const bridgeMultiplier = newState.bridgeActive === action.playerId ? 2 : 1

  // MEV steal
  let mevActive = newState.mevActive
  const mevOpponent = mevActive !== null && mevActive !== action.playerId ? mevActive : null

  if (isZkProven) {
    // Instant credits
    const creditedPlayers: [typeof newPlayers[0], typeof newPlayers[1]] = [...newPlayers] as [
      typeof newPlayers[0],
      typeof newPlayers[1],
    ]
    for (let i = 0; i < creditedPlayers.length; i++) {
      const p = creditedPlayers[i]!
      let earned = creditsMap.get(p.id) ?? 0
      if (p.id === action.playerId) earned *= bridgeMultiplier
      creditedPlayers[i] = { ...p, credits: p.credits + earned }
    }
    // MEV
    if (mevOpponent !== null) {
      const pubIdx = getPlayerIndex(newState, action.playerId)
      const mevIdx = getPlayerIndex(newState, mevOpponent)
      const stolen = Math.min(2, creditedPlayers[pubIdx]!.credits)
      creditedPlayers[pubIdx] = { ...creditedPlayers[pubIdx]!, credits: creditedPlayers[pubIdx]!.credits - stolen }
      creditedPlayers[mevIdx] = { ...creditedPlayers[mevIdx]!, credits: creditedPlayers[mevIdx]!.credits + stolen }
      mevActive = null
    }
    newState = {
      ...newState,
      players: creditedPlayers,
      validatorRedundancyCount: 0,
      bridgeActive: null,
      mevActive,
    }
  } else {
    // Escrow credits in pendingBatches
    const escrow: Partial<Record<PlayerId, number>> = {}
    for (const [pid, earned] of creditsMap.entries()) {
      let amt = earned
      if (pid === action.playerId) amt *= bridgeMultiplier
      if (amt > 0) escrow[pid] = amt
    }

    const pending: PendingBatch = {
      blockId,
      publishedBy: action.playerId,
      creditsEscrowed: escrow,
      isZkProven: false,
    }

    // MEV triggers regardless of escrow (steals from eventual publisher)
    const creditedPlayers: [typeof newPlayers[0], typeof newPlayers[1]] = [...newPlayers] as [
      typeof newPlayers[0],
      typeof newPlayers[1],
    ]
    if (mevOpponent !== null) {
      const pubIdx = getPlayerIndex(newState, action.playerId)
      const mevIdx = getPlayerIndex(newState, mevOpponent)
      const stolen = Math.min(2, creditedPlayers[pubIdx]!.credits)
      creditedPlayers[pubIdx] = { ...creditedPlayers[pubIdx]!, credits: creditedPlayers[pubIdx]!.credits - stolen }
      creditedPlayers[mevIdx] = { ...creditedPlayers[mevIdx]!, credits: creditedPlayers[mevIdx]!.credits + stolen }
      mevActive = null
    }

    newState = {
      ...newState,
      players: creditedPlayers,
      pendingBatches: [...newState.pendingBatches, pending],
      validatorRedundancyCount: 0,
      bridgeActive: null,
      mevActive,
    }
  }

  return newState
}

function applyFraudProof(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)

  // Find most recent (last) pending batch from opponent that is not ZK-proven
  const oppPending = stateAfterConsume.pendingBatches
    .filter((pb) => pb.publishedBy !== action.playerId && !pb.isZkProven)

  if (oppPending.length === 0) {
    // No-op
    return stateAfterConsume
  }

  const target = oppPending[oppPending.length - 1]!

  // Remove from pendingBatches; mark block as non-pending (cancelled) in chain
  const newPendingBatches = stateAfterConsume.pendingBatches.filter((pb) => pb.blockId !== target.blockId)
  const newChain = stateAfterConsume.chain.map((b) =>
    b.id === target.blockId ? { ...b, isPending: false } : b
  )

  return {
    ...stateAfterConsume,
    pendingBatches: newPendingBatches,
    chain: newChain,
  }
}

function applyZkProof(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return { ...stateAfterConsume, zkProofActive: action.playerId }
}

function applyMevBot(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return { ...stateAfterConsume, mevActive: action.playerId }
}

function applyBridge(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  return { ...stateAfterConsume, bridgeActive: action.playerId }
}

function applyGasSpike(state: GameState, action: PlayCardAction): GameState {
  const stateAfterConsume = consumeCard(state, action.playerId, action.cardId)
  const oppId = getOpponentId(state, action.playerId)
  return { ...stateAfterConsume, gasSpike: oppId }
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
  [CardType.BLOCK_REWARD]: applyBlockReward,
  // L2
  [CardType.SEQUENCER]: applySequencer,
  [CardType.DATA_BLOB]: applyDataBlob,
  [CardType.OPTIMISTIC_ROLLUP]: applyOptimisticRollup,
  [CardType.FRAUD_PROOF]: applyFraudProof,
  [CardType.ZK_PROOF]: applyZkProof,
  [CardType.MEV_BOT]: applyMevBot,
  [CardType.BRIDGE]: applyBridge,
  [CardType.GAS_SPIKE]: applyGasSpike,
  [CardType.HARD_FORK]: applyHardFork,
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
