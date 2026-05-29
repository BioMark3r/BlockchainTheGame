import { Card, CardType, PlayerId } from '../shared/types'

// Card counts per deck (50 total including genesis)
const DECK_COMPOSITION: Array<{ type: CardType; count: number }> = [
  { type: CardType.GENESIS, count: 1 },
  { type: CardType.VALIDATOR, count: 10 },
  { type: CardType.TRANSACTION, count: 25 },
  { type: CardType.BLOCK_REWARD, count: 5 },
  { type: CardType.RESHUFFLE, count: 3 },
  { type: CardType.CHAIN_SPLIT, count: 1 },
  { type: CardType.VALIDATOR_REDUNDANCY, count: 2 },
  { type: CardType.INVALID_TRANSACTION, count: 2 },
  { type: CardType.CHAIN_REORG, count: 1 },
  { type: CardType.FORK, count: 1 },
]

/** Build a full 50-card deck for a player. Returns the genesis card separately. */
export function buildDeck(playerId: PlayerId): { genesisCard: Card; drawPile: Card[] } {
  const allCards: Card[] = []

  for (const { type, count } of DECK_COMPOSITION) {
    const typeName = type.toLowerCase().replace(/_/g, '-')
    for (let i = 1; i <= count; i++) {
      allCards.push({ id: `${playerId}-${typeName}-${i}`, type })
    }
  }

  const genesisCard = allCards.find((c) => c.type === CardType.GENESIS)
  if (!genesisCard) throw new Error('Genesis card missing from deck composition')

  const drawPile = allCards.filter((c) => c.type !== CardType.GENESIS)
  return { genesisCard, drawPile }
}

/** Fisher-Yates shuffle — returns a new array, does not mutate input. */
export function shuffleDeck(cards: Card[]): Card[] {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

/** Draw `count` cards from the top of drawPile. Returns new hand slice + remaining drawPile. */
export function dealHand(
  drawPile: Card[],
  count: number
): { drawn: Card[]; remainingDrawPile: Card[] } {
  const drawn = drawPile.slice(0, count)
  const remainingDrawPile = drawPile.slice(count)
  return { drawn, remainingDrawPile }
}

/**
 * Ensure a starting hand has at least 2 distinct card types.
 * If all 5 cards share the same type, swap one with the first
 * differently-typed card found in the remaining draw pile.
 * Returns updated hand and drawPile (both remain the same total size).
 */
export function diversifyHand(
  hand: Card[],
  drawPile: Card[]
): { hand: Card[]; drawPile: Card[] } {
  const allSameType = hand.every((c) => c.type === hand[0]!.type)
  if (!allSameType) return { hand, drawPile }

  const swapIdx = drawPile.findIndex((c) => c.type !== hand[0]!.type)
  if (swapIdx === -1) return { hand, drawPile } // no alternative exists, leave as-is

  const newHand = [...hand]
  const newDrawPile = [...drawPile]
  // Swap last card in hand with the found card in draw pile
  const tmp = newDrawPile[swapIdx]!
  newDrawPile[swapIdx] = newHand[newHand.length - 1]!
  newHand[newHand.length - 1] = tmp

  return { hand: newHand, drawPile: newDrawPile }
}
