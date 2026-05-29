import { describe, it, expect } from 'vitest'
import { buildDeck, shuffleDeck, dealHand } from '../../src/engine/deck'
import { CardType } from '../../src/shared/types'

describe('buildDeck', () => {
  it('returns 50 cards in drawPile + 1 genesis card = 51 total (genesis removed before play)', () => {
    const { genesisCard, drawPile } = buildDeck('player1')
    expect(drawPile.length).toBe(50)
    expect(genesisCard.type).toBe(CardType.GENESIS)
  })

  it('genesis card is not in the drawPile', () => {
    const { drawPile } = buildDeck('player1')
    expect(drawPile.every((c) => c.type !== CardType.GENESIS)).toBe(true)
  })

  it('drawPile has correct card counts', () => {
    const { drawPile } = buildDeck('player1')
    const count = (type: CardType) => drawPile.filter((c) => c.type === type).length
    expect(count(CardType.VALIDATOR)).toBe(10)
    expect(count(CardType.TRANSACTION)).toBe(25)
    expect(count(CardType.RESHUFFLE)).toBe(3)
    expect(count(CardType.CHAIN_SPLIT)).toBe(1)
    expect(count(CardType.VALIDATOR_REDUNDANCY)).toBe(2)
    expect(count(CardType.INVALID_TRANSACTION)).toBe(2)
    expect(count(CardType.CHAIN_REORG)).toBe(1)
    expect(count(CardType.FORK)).toBe(1)
    expect(count(CardType.BLOCK_REWARD)).toBe(5)
  })

  it('all card IDs are unique', () => {
    const { genesisCard, drawPile } = buildDeck('player1')
    const allIds = [genesisCard.id, ...drawPile.map((c) => c.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('card IDs are scoped to the player', () => {
    const { drawPile } = buildDeck('player2')
    expect(drawPile.every((c) => c.id.startsWith('player2-'))).toBe(true)
  })

  it('two players have non-overlapping IDs', () => {
    const { drawPile: d1, genesisCard: g1 } = buildDeck('player1')
    const { drawPile: d2, genesisCard: g2 } = buildDeck('player2')
    const ids1 = new Set([g1.id, ...d1.map((c) => c.id)])
    const ids2 = new Set([g2.id, ...d2.map((c) => c.id)])
    const overlap = [...ids1].filter((id) => ids2.has(id))
    expect(overlap.length).toBe(0)
  })
})

describe('shuffleDeck', () => {
  it('returns same number of cards', () => {
    const { drawPile } = buildDeck('player1')
    expect(shuffleDeck(drawPile).length).toBe(drawPile.length)
  })

  it('contains the same cards', () => {
    const { drawPile } = buildDeck('player1')
    const shuffled = shuffleDeck(drawPile)
    expect(shuffled.map((c) => c.id).sort()).toEqual(drawPile.map((c) => c.id).sort())
  })

  it('does not mutate the input array', () => {
    const { drawPile } = buildDeck('player1')
    const original = [...drawPile]
    shuffleDeck(drawPile)
    expect(drawPile).toEqual(original)
  })

  it('produces a different order with high probability on a large deck', () => {
    const { drawPile } = buildDeck('player1')
    const shuffled = shuffleDeck(drawPile)
    // Chance of identical order is astronomically small for 49 cards
    const identical = shuffled.every((c, i) => c.id === drawPile[i]?.id)
    expect(identical).toBe(false)
  })
})

describe('dealHand', () => {
  it('draws the requested number of cards', () => {
    const { drawPile } = buildDeck('player1')
    const { drawn } = dealHand(drawPile, 5)
    expect(drawn.length).toBe(5)
  })

  it('remaining draw pile shrinks correctly', () => {
    const { drawPile } = buildDeck('player1')
    const { remainingDrawPile } = dealHand(drawPile, 5)
    expect(remainingDrawPile.length).toBe(drawPile.length - 5)
  })

  it('drawn cards are from the top of the pile', () => {
    const { drawPile } = buildDeck('player1')
    const { drawn } = dealHand(drawPile, 5)
    expect(drawn).toEqual(drawPile.slice(0, 5))
  })

  it('draws 0 cards when count is 0', () => {
    const { drawPile } = buildDeck('player1')
    const { drawn, remainingDrawPile } = dealHand(drawPile, 0)
    expect(drawn.length).toBe(0)
    expect(remainingDrawPile.length).toBe(drawPile.length)
  })

  it('draws up to available cards when deck is smaller than count', () => {
    const { drawPile } = buildDeck('player1')
    const smallPile = drawPile.slice(0, 3)
    const { drawn, remainingDrawPile } = dealHand(smallPile, 10)
    expect(drawn.length).toBe(3)
    expect(remainingDrawPile.length).toBe(0)
  })
})
