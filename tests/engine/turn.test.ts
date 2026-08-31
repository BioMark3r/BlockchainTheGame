import { describe, it, expect } from 'vitest'
import { applyAction } from '../../src/engine/turn'
import { CardType } from '../../src/shared/types'
import { makeCard, makePlayer, makeState } from './helpers'

// ---------------------------------------------------------------------------
// PLAY_CARD tests
// ---------------------------------------------------------------------------

describe('applyAction — PLAY_CARD', () => {
  it('plays a validator card successfully', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-1' })
    expect(result.success).toBe(true)
    expect(result.state.players[0]!.validators).toHaveLength(1)
  })

  it('fails when it is not the player\'s turn', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      currentTurn: 'player2',
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-1' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/turn/i)
  })

  it('fails when card is not in hand', () => {
    const state = makeState({
      players: [makePlayer('player1', { hand: [] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-999' })
    expect(result.success).toBe(false)
  })

  it('fails when trying to play a TRANSACTION card directly', () => {
    const card = makeCard(CardType.TRANSACTION, 'tx-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'tx-1' })
    expect(result.success).toBe(false)
  })

  it('fails when game is not in playing phase', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      phase: 'ended',
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-1' })
    expect(result.success).toBe(false)
  })

  it('advances turn after playing a card', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      currentTurn: 'player1',
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-1' })
    expect(result.success).toBe(true)
    expect(result.state.currentTurn).toBe('player2')
  })

  it('INVALID_TRANSACTION fails without targetBlockId', () => {
    const card = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'it-1' })
    expect(result.success).toBe(false)
  })

  it('INVALID_TRANSACTION fails when target block does not exist', () => {
    const card = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
      chain: [],
    })
    const result = applyAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player1',
      cardId: 'it-1',
      targetBlockId: 'no-such-block',
    })
    expect(result.success).toBe(false)
  })

  it('FORK card ends the game', () => {
    const card = makeCard(CardType.FORK, 'fork-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'fork-1' })
    expect(result.success).toBe(true)
    expect(result.state.phase).toBe('ended')
    expect(result.state.forkReason).toBe('fork_card')
  })
})

// ---------------------------------------------------------------------------
// PUBLISH_BLOCK tests
// ---------------------------------------------------------------------------

describe('applyAction — PUBLISH_BLOCK', () => {
  function makeTxCards() {
    return [
      makeCard(CardType.TRANSACTION, 'tx-a'),
      makeCard(CardType.TRANSACTION, 'tx-b'),
      makeCard(CardType.TRANSACTION, 'tx-c'),
    ] as const
  }

  it('publishes a block and adds it to the chain', () => {
    const [t1, t2, t3] = makeTxCards()
    const state = makeState({
      players: [makePlayer('player1', { hand: [t1, t2, t3] }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    expect(result.success).toBe(true)
    expect(result.state.chain).toHaveLength(1)
    expect(result.state.chain[0]!.publishedBy).toBe('player1')
  })

  it('moves transaction cards to discard after publish', () => {
    const [t1, t2, t3] = makeTxCards()
    const state = makeState({
      players: [makePlayer('player1', { hand: [t1, t2, t3] }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    const p1 = result.state.players[0]!
    expect(p1.hand).toHaveLength(0)
    expect(p1.discardPile).toHaveLength(3)
  })

  it('awards credits to both players (no split)', () => {
    const [t1, t2, t3] = makeTxCards()
    const validator = makeCard(CardType.VALIDATOR, 'v-1')
    const p2validator = makeCard(CardType.VALIDATOR, 'v-2')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [t1, t2, t3], validators: [validator] }),
        makePlayer('player2', { validators: [p2validator] }),
      ],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    expect(result.state.players[0]!.credits).toBe(1)
    expect(result.state.players[1]!.credits).toBe(1)
  })

  it('only publisher earns credits when chain split is active', () => {
    const [t1, t2, t3] = makeTxCards()
    const v1 = makeCard(CardType.VALIDATOR, 'v-p1')
    const v2 = makeCard(CardType.VALIDATOR, 'v-p2')
    const state = makeState({
      chainSplit: { active: true, triggeredBy: 'player2' },
      players: [
        makePlayer('player1', { hand: [t1, t2, t3], validators: [v1] }),
        makePlayer('player2', { validators: [v2] }),
      ],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    expect(result.state.players[0]!.credits).toBe(1)
    expect(result.state.players[1]!.credits).toBe(0)
  })

  it('fails when not enough transaction cards', () => {
    const [t1, t2] = makeTxCards()
    const v1 = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [t1, t2, v1] }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'v-1'],
    })
    expect(result.success).toBe(false)
  })

  it('fails when card IDs not in hand', () => {
    const state = makeState({
      players: [makePlayer('player1', { hand: [] }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    expect(result.success).toBe(false)
  })

  it('advances turn after publish', () => {
    const [t1, t2, t3] = makeTxCards()
    const state = makeState({
      currentTurn: 'player1',
      players: [makePlayer('player1', { hand: [t1, t2, t3] }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-a', 'tx-b', 'tx-c'],
    })
    expect(result.state.currentTurn).toBe('player2')
  })
})

// ---------------------------------------------------------------------------
// DISCARD_REDRAW tests
// ---------------------------------------------------------------------------

describe('applyAction — DISCARD_REDRAW', () => {
  it('discards 0 cards but still draws up to 5', () => {
    const hand = [makeCard(CardType.TRANSACTION, 'tx-1'), makeCard(CardType.TRANSACTION, 'tx-2')]
    const drawCard = makeCard(CardType.VALIDATOR, 'v-draw')
    const state = makeState({
      players: [
        makePlayer('player1', { hand, drawPile: [drawCard] }),
        makePlayer('player2'),
      ],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: [],
    })
    expect(result.success).toBe(true)
    const p1 = result.state.players[0]!
    // hand was 2, draw pile had 1 → draws 1 to reach 3 (can't reach 5)
    expect(p1.hand).toHaveLength(3)
    expect(p1.discardPile).toHaveLength(0)
    expect(p1.drawPile).toHaveLength(0)
  })

  it('discards all 5 cards and draws up to 5', () => {
    const hand = Array.from({ length: 5 }, (_, i) => makeCard(CardType.TRANSACTION, `tx-${i}`))
    const drawCards = Array.from({ length: 5 }, (_, i) => makeCard(CardType.VALIDATOR, `v-${i}`))
    const state = makeState({
      players: [
        makePlayer('player1', { hand, drawPile: drawCards }),
        makePlayer('player2'),
      ],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: hand.map((c) => c.id),
    })
    expect(result.success).toBe(true)
    const p1 = result.state.players[0]!
    expect(p1.hand).toHaveLength(5)
    expect(p1.discardPile).toHaveLength(5)
    expect(p1.drawPile).toHaveLength(0)
  })

  it('draws fewer cards when draw pile is smaller than discarded count', () => {
    const hand = Array.from({ length: 3 }, (_, i) => makeCard(CardType.TRANSACTION, `tx-${i}`))
    const drawCards = [makeCard(CardType.VALIDATOR, 'v-only')]
    const state = makeState({
      players: [
        makePlayer('player1', { hand, drawPile: drawCards }),
        makePlayer('player2'),
      ],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: hand.map((c) => c.id),
    })
    const p1 = result.state.players[0]!
    expect(p1.hand).toHaveLength(1) // only 1 could be drawn
    expect(p1.discardPile).toHaveLength(3)
  })

  it('fails when discarding a card not in hand', () => {
    const hand = [makeCard(CardType.TRANSACTION, 'tx-1')]
    const state = makeState({
      players: [makePlayer('player1', { hand }), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: ['not-in-hand'],
    })
    expect(result.success).toBe(false)
  })

  it('advances turn after discard-redraw', () => {
    const state = makeState({
      currentTurn: 'player1',
      players: [makePlayer('player1'), makePlayer('player2')],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: [],
    })
    expect(result.state.currentTurn).toBe('player2')
  })
})

// ---------------------------------------------------------------------------
// Fork condition: player1 out of cards
// ---------------------------------------------------------------------------

describe('Fork condition — player1 out of cards', () => {
  it('triggers fork when player1 has no hand and no draw pile after action', () => {
    // player1 plays their last card (a validator), leaving hand empty and draw pile empty
    const card = makeCard(CardType.VALIDATOR, 'v-last')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], drawPile: [] }),
        makePlayer('player2', { hand: [makeCard(CardType.TRANSACTION, 'tx-p2')] }),
      ],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-last' })
    expect(result.state.phase).toBe('ended')
    expect(result.state.forkReason).toBe('player1_out_of_cards')
  })

  it('does NOT trigger fork when player2 plays their last card (only player1 running out forks)', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      currentTurn: 'player2',
      players: [
        makePlayer('player1', { hand: [makeCard(CardType.TRANSACTION, 'tx-1')] }),
        makePlayer('player2', { hand: [card], drawPile: [] }),
      ],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player2', cardId: 'v-1' })
    expect(result.success).toBe(true)
    expect(result.state.phase).toBe('playing')
    expect(result.state.forkReason).toBeNull()
  })

  it('player1 still has draw pile — no fork', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const drawCard = makeCard(CardType.TRANSACTION, 'tx-draw')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], drawPile: [drawCard] }),
        makePlayer('player2'),
      ],
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'v-1' })
    expect(result.state.phase).toBe('playing')
  })
})

// ---------------------------------------------------------------------------
// Chain Reorg preserves split state
// ---------------------------------------------------------------------------

describe('CHAIN_REORG after CHAIN_SPLIT', () => {
  it('removes all blocks but keeps chain split active', () => {
    const reorg = makeCard(CardType.CHAIN_REORG, 'cr-1')
    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const block = {
      id: 'b-1',
      publishedBy: 'player2' as const,
      transactions: [tx1, tx2, tx3] as [typeof tx1, typeof tx2, typeof tx3],
      isPending: false,
    }
    const state = makeState({
      players: [makePlayer('player1', { hand: [reorg] }), makePlayer('player2')],
      chain: [block],
      chainSplit: { active: true, triggeredBy: 'player2' },
    })
    const result = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'cr-1' })
    expect(result.success).toBe(true)
    expect(result.state.chain).toHaveLength(0)
    expect(result.state.chainSplit.active).toBe(true)
    expect(result.state.chainSplit.triggeredBy).toBe('player2')
  })
})

// ---------------------------------------------------------------------------
// Invalid Transaction — no credit reversal
// ---------------------------------------------------------------------------

describe('INVALID_TRANSACTION — no credit reversal', () => {
  it('removes block but does not reverse previously awarded credits', () => {
    const it1 = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const block = {
      id: 'b-1',
      publishedBy: 'player2' as const,
      transactions: [tx1, tx2, tx3] as [typeof tx1, typeof tx2, typeof tx3],
      isPending: false,
    }
    // Give player2 some credits simulating they were already earned
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [it1] }),
        makePlayer('player2', { credits: 5 }),
      ],
      chain: [block],
    })
    const result = applyAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player1',
      cardId: 'it-1',
      targetBlockId: 'b-1',
    })
    expect(result.success).toBe(true)
    expect(result.state.chain).toHaveLength(0)
    expect(result.state.players[1]!.credits).toBe(5) // credits not reversed
  })
})

// ---------------------------------------------------------------------------
// Validator Redundancy 4x credits
// ---------------------------------------------------------------------------

describe('Validator Redundancy x2 = 4x credits', () => {
  it('awards 4x credits when both redundancy cards played', () => {
    const vr1 = makeCard(CardType.VALIDATOR_REDUNDANCY, 'vr-1')
    const vr2 = makeCard(CardType.VALIDATOR_REDUNDANCY, 'vr-2')
    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const v1 = makeCard(CardType.VALIDATOR, 'v-1')

    // player1 plays VR, then publishes a block — VR is single-use (2x, not stackable)
    // Player2 needs enough cards to survive two turns without triggering fork
    const p2cards = Array.from({ length: 10 }, (_, i) => makeCard(CardType.TRANSACTION, `tx-p2-${i}`))
    let state = makeState({
      currentTurn: 'player1',
      players: [
        makePlayer('player1', { hand: [vr1, vr2, tx1, tx2, tx3], validators: [v1] }),
        makePlayer('player2', { hand: p2cards }),
      ],
    })
    // play vr1 (turn goes to p2, back to p1)
    state = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'vr-1' }).state
    state = applyAction(state, { type: 'DISCARD_REDRAW', playerId: 'player2', cardIdsToDiscard: [] }).state
    // play vr2 — count stays at 1 (no stacking)
    state = applyAction(state, { type: 'PLAY_CARD', playerId: 'player1', cardId: 'vr-2' }).state
    state = applyAction(state, { type: 'DISCARD_REDRAW', playerId: 'player2', cardIdsToDiscard: [] }).state

    expect(state.validatorRedundancyCount).toBe(1) // capped — second VR has no additional effect

    // publish block → should earn 1 validator * 2 = 2 credits (2x, not 4x)
    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: ['tx-1', 'tx-2', 'tx-3'],
    })
    expect(result.success).toBe(true)
    expect(result.state.players[0]!.credits).toBe(2)
    // VR resets after block is published
    expect(result.state.validatorRedundancyCount).toBe(0)
  })
})
