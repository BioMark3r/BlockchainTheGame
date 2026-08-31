import { describe, it, expect } from 'vitest'
import { applyAction } from '../../src/engine/turn'
import { applyEffect } from '../../src/engine/effects'
import { CardType } from '../../src/shared/types'
import { makeCard, makePlayer, makeState } from './helpers'

// ---------------------------------------------------------------------------
// Fork trigger — only player1 running out of cards ends the game
// ---------------------------------------------------------------------------

describe('Fork condition — only player1 empty hand triggers fork', () => {
  it('ends the game when player1 takes a DISCARD_REDRAW with no draw pile', () => {
    // Player1 has exactly 1 card to discard, empty draw pile and discard pile
    const card = makeCard(CardType.TRANSACTION, 't-1')
    const state = makeState({
      currentTurn: 'player1',
      players: [
        makePlayer('player1', { hand: [card], drawPile: [], discardPile: [] }),
        makePlayer('player2', { hand: [makeCard(CardType.TRANSACTION, 't-2')], drawPile: [], discardPile: [] }),
      ],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player1',
      cardIdsToDiscard: [card.id],
    })
    expect(result.success).toBe(true)
    expect(result.state.phase).toBe('ended')
    expect(result.state.forkReason).toBe('player1_out_of_cards')
  })

  it('does NOT end the game when player2 runs out of cards (takes a turn with empty deck)', () => {
    // Player2 has exactly 1 card, empty draw pile — player2's turn
    const card = makeCard(CardType.TRANSACTION, 't-2')
    const state = makeState({
      currentTurn: 'player2',
      players: [
        makePlayer('player1', { hand: [makeCard(CardType.TRANSACTION, 't-1')], drawPile: [], discardPile: [] }),
        makePlayer('player2', { hand: [card], drawPile: [], discardPile: [] }),
      ],
    })
    const result = applyAction(state, {
      type: 'DISCARD_REDRAW',
      playerId: 'player2',
      cardIdsToDiscard: [card.id],
    })
    expect(result.success).toBe(true)
    // game should NOT end — player2 emptying out doesn't fork
    expect(result.state.phase).toBe('playing')
    expect(result.state.forkReason).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Chain Reorg after Chain Split — split state persists
// ---------------------------------------------------------------------------

describe('Chain Reorg after Chain Split', () => {
  it('removes the last 3 blocks but chain split state persists', () => {
    // Set up 5 blocks and an active chain split
    const makeBlock = (id: string, by: 'player1' | 'player2') => ({
      id,
      publishedBy: by as const,
      transactions: [
        makeCard(CardType.TRANSACTION, `${id}-t1`),
        makeCard(CardType.TRANSACTION, `${id}-t2`),
        makeCard(CardType.TRANSACTION, `${id}-t3`),
      ] as [ReturnType<typeof makeCard>, ReturnType<typeof makeCard>, ReturnType<typeof makeCard>],
      isPending: false,
    })

    const crCard = makeCard(CardType.CHAIN_REORG, 'cr-1')
    const chain = [
      makeBlock('b1', 'player1'),
      makeBlock('b2', 'player2'),
      makeBlock('b3', 'player1'),
      makeBlock('b4', 'player2'),
      makeBlock('b5', 'player1'),
    ]

    const state = makeState({
      currentTurn: 'player1',
      chain,
      chainSplit: { active: true, triggeredBy: 'player2' },
      players: [
        makePlayer('player1', { hand: [crCard] }),
        makePlayer('player2'),
      ],
    })

    const action = { type: 'PLAY_CARD' as const, playerId: 'player1' as const, cardId: 'cr-1' }
    const next = applyEffect(state, action)

    // Last 3 blocks removed — only b1 and b2 remain
    expect(next.chain).toHaveLength(2)
    expect(next.chain[0]!.id).toBe('b1')
    expect(next.chain[1]!.id).toBe('b2')

    // Chain split state must persist
    expect(next.chainSplit.active).toBe(true)
    expect(next.chainSplit.triggeredBy).toBe('player2')
  })

  it('chain split credit logic still applies after reorg', () => {
    // After a reorg, the next block published should only credit the publishing player
    const makeBlock = (id: string, by: 'player1' | 'player2') => ({
      id,
      publishedBy: by as const,
      transactions: [
        makeCard(CardType.TRANSACTION, `${id}-t1`),
        makeCard(CardType.TRANSACTION, `${id}-t2`),
        makeCard(CardType.TRANSACTION, `${id}-t3`),
      ] as [ReturnType<typeof makeCard>, ReturnType<typeof makeCard>, ReturnType<typeof makeCard>],
      isPending: false,
    })

    const tx1 = makeCard(CardType.TRANSACTION, 'tx-1')
    const tx2 = makeCard(CardType.TRANSACTION, 'tx-2')
    const tx3 = makeCard(CardType.TRANSACTION, 'tx-3')
    const v1 = makeCard(CardType.VALIDATOR, 'v-1')

    const state = makeState({
      currentTurn: 'player1',
      chain: [makeBlock('b1', 'player2')],
      chainSplit: { active: true, triggeredBy: 'player2' },
      players: [
        makePlayer('player1', { hand: [tx1, tx2, tx3], validators: [v1], credits: 0 }),
        makePlayer('player2', { hand: [], validators: [makeCard(CardType.VALIDATOR, 'v-opp')], credits: 5 }),
      ],
    })

    const result = applyAction(state, {
      type: 'PUBLISH_BLOCK',
      playerId: 'player1',
      cardIds: [tx1.id, tx2.id, tx3.id],
    })

    expect(result.success).toBe(true)
    // With chain split active, only player1 earns credits (1 validator = 1 credit)
    expect(result.state.players[0]!.credits).toBe(1)
    // Player2's credits should NOT change
    expect(result.state.players[1]!.credits).toBe(5)
  })
})
