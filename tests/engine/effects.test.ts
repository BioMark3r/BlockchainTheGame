import { describe, it, expect } from 'vitest'
import { applyEffect } from '../../src/engine/effects'
import { CardType } from '../../src/shared/types'
import { makeCard, makePlayer, makeState } from './helpers'

// Helper to build a PLAY_CARD action
function playCard(playerId: 'player1' | 'player2', cardId: string, targetBlockId?: string) {
  return { type: 'PLAY_CARD' as const, playerId, cardId, targetBlockId }
}

describe('VALIDATOR effect', () => {
  it('moves card from hand to validators', () => {
    const card = makeCard(CardType.VALIDATOR, 'v-1')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card] }),
        makePlayer('player2'),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'v-1'))
    const p1 = next.players[0]!
    expect(p1.hand).toHaveLength(0)
    expect(p1.validators).toHaveLength(1)
    expect(p1.validators[0]?.id).toBe('v-1')
    expect(p1.discardPile).toHaveLength(0)
  })

  it('can accumulate multiple validators', () => {
    const v1 = makeCard(CardType.VALIDATOR, 'v-1')
    const v2 = makeCard(CardType.VALIDATOR, 'v-2')
    let state = makeState({
      players: [makePlayer('player1', { hand: [v1, v2] }), makePlayer('player2')],
    })
    state = applyEffect(state, playCard('player1', 'v-1'))
    state = applyEffect(state, playCard('player1', 'v-2'))
    expect(state.players[0]!.validators).toHaveLength(2)
  })
})

describe('RESHUFFLE effect', () => {
  it('no-op when discard pile is empty — card still consumed', () => {
    const card = makeCard(CardType.RESHUFFLE, 'r-1')
    const draw = [makeCard(CardType.TRANSACTION, 't-1')]
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], drawPile: draw, discardPile: [] }),
        makePlayer('player2'),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'r-1'))
    const p1 = next.players[0]!
    expect(p1.hand).toHaveLength(0)
    expect(p1.discardPile).toHaveLength(1) // reshuffle card itself
    expect(p1.discardPile[0]?.id).toBe('r-1')
    expect(p1.drawPile).toHaveLength(1) // unchanged
  })

  it('shuffles discard back into draw pile when discard is non-empty', () => {
    const card = makeCard(CardType.RESHUFFLE, 'r-1')
    const discarded = [makeCard(CardType.TRANSACTION, 't-1'), makeCard(CardType.TRANSACTION, 't-2')]
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], drawPile: [], discardPile: discarded }),
        makePlayer('player2'),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'r-1'))
    const p1 = next.players[0]!
    expect(p1.hand).toHaveLength(0)
    // The 2 discarded tx cards returned to draw; reshuffle card stays in discard
    expect(p1.drawPile).toHaveLength(2)
    expect(p1.discardPile).toHaveLength(1)
    expect(p1.discardPile[0]?.id).toBe('r-1')
    // The draw pile should contain the formerly discarded cards
    const drawIds = p1.drawPile.map((c) => c.id)
    expect(drawIds).toContain('t-1')
    expect(drawIds).toContain('t-2')
  })
})

describe('CHAIN_SPLIT effect', () => {
  it('sets chainSplit to active', () => {
    const card = makeCard(CardType.CHAIN_SPLIT, 'cs-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const next = applyEffect(state, playCard('player1', 'cs-1'))
    expect(next.chainSplit.active).toBe(true)
    expect(next.chainSplit.triggeredBy).toBe('player1')
  })

  it('card is consumed from hand', () => {
    const card = makeCard(CardType.CHAIN_SPLIT, 'cs-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const next = applyEffect(state, playCard('player1', 'cs-1'))
    expect(next.players[0]!.hand).toHaveLength(0)
    expect(next.players[0]!.discardPile).toHaveLength(1)
  })
})

describe('VALIDATOR_REDUNDANCY effect', () => {
  it('increments validatorRedundancyCount by 1', () => {
    const card = makeCard(CardType.VALIDATOR_REDUNDANCY, 'vr-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    const next = applyEffect(state, playCard('player1', 'vr-1'))
    expect(next.validatorRedundancyCount).toBe(1)
  })

  it('increments twice to 2 when both copies played', () => {
    const vr1 = makeCard(CardType.VALIDATOR_REDUNDANCY, 'vr-1')
    const vr2 = makeCard(CardType.VALIDATOR_REDUNDANCY, 'vr-2')
    let state = makeState({
      players: [makePlayer('player1', { hand: [vr1, vr2] }), makePlayer('player2')],
    })
    state = applyEffect(state, playCard('player1', 'vr-1'))
    state = applyEffect(state, playCard('player1', 'vr-2'))
    expect(state.validatorRedundancyCount).toBe(2)
  })
})

describe('INVALID_TRANSACTION effect', () => {
  it('removes the target block from the chain', () => {
    const card = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const targetBlock = {
      id: 'block-1',
      publishedBy: 'player2' as const,
      transactions: [tx1, tx2, tx3] as [typeof tx1, typeof tx2, typeof tx3],
    }
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
      chain: [targetBlock],
    })
    const next = applyEffect(state, playCard('player1', 'it-1', 'block-1'))
    expect(next.chain).toHaveLength(0)
    expect(next.players[0]!.hand).toHaveLength(0)
  })

  it('throws when targetBlockId is missing', () => {
    const card = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    expect(() => applyEffect(state, playCard('player1', 'it-1'))).toThrow()
  })

  it('throws when targetBlock does not exist', () => {
    const card = makeCard(CardType.INVALID_TRANSACTION, 'it-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
      chain: [],
    })
    expect(() => applyEffect(state, playCard('player1', 'it-1', 'nonexistent-block'))).toThrow()
  })
})

describe('CHAIN_REORG effect', () => {
  it('clears all blocks from the chain', () => {
    const card = makeCard(CardType.CHAIN_REORG, 'cr-1')
    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const block = {
      id: 'block-1',
      publishedBy: 'player1' as const,
      transactions: [tx1, tx2, tx3] as [typeof tx1, typeof tx2, typeof tx3],
    }
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
      chain: [block],
    })
    const next = applyEffect(state, playCard('player1', 'cr-1'))
    expect(next.chain).toHaveLength(0)
  })

  it('preserves chain split state after reorg', () => {
    const card = makeCard(CardType.CHAIN_REORG, 'cr-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
      chainSplit: { active: true, triggeredBy: 'player2' },
    })
    const next = applyEffect(state, playCard('player1', 'cr-1'))
    expect(next.chainSplit.active).toBe(true)
    expect(next.chainSplit.triggeredBy).toBe('player2')
  })
})

describe('FORK effect', () => {
  it('sets phase to ended with forkReason fork_card', () => {
    const card = makeCard(CardType.FORK, 'fork-1')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], credits: 5 }),
        makePlayer('player2', { credits: 3 }),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'fork-1'))
    expect(next.phase).toBe('ended')
    expect(next.forkReason).toBe('fork_card')
  })

  it('determines the winner by credits', () => {
    const card = makeCard(CardType.FORK, 'fork-1')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], credits: 10 }),
        makePlayer('player2', { credits: 3 }),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'fork-1'))
    expect(next.winner).toBe('player1')
  })

  it('sets winner to null on a tie', () => {
    const card = makeCard(CardType.FORK, 'fork-1')
    const state = makeState({
      players: [
        makePlayer('player1', { hand: [card], credits: 5 }),
        makePlayer('player2', { credits: 5 }),
      ],
    })
    const next = applyEffect(state, playCard('player1', 'fork-1'))
    expect(next.winner).toBeNull()
  })
})

describe('applyEffect error cases', () => {
  it('throws when playing a TRANSACTION card directly', () => {
    const card = makeCard(CardType.TRANSACTION, 'tx-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    expect(() => applyEffect(state, playCard('player1', 'tx-1'))).toThrow()
  })

  it('throws when playing a GENESIS card', () => {
    const card = makeCard(CardType.GENESIS, 'gen-1')
    const state = makeState({
      players: [makePlayer('player1', { hand: [card] }), makePlayer('player2')],
    })
    expect(() => applyEffect(state, playCard('player1', 'gen-1'))).toThrow()
  })

  it('throws when card not in hand', () => {
    const state = makeState({
      players: [makePlayer('player1', { hand: [] }), makePlayer('player2')],
    })
    expect(() => applyEffect(state, playCard('player1', 'nonexistent'))).toThrow()
  })
})
