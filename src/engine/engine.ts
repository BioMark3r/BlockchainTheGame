import { GameState, PlayerId, PlayerState } from '../shared/types'
import { buildDeck, dealHand, diversifyHand, shuffleDeck } from './deck'
export { applyAction } from './turn'
export { getWinner } from './winner'

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

export function createGame(
  player1Id: PlayerId,
  player2Id: PlayerId,
  player2IsCpu: boolean = false
): GameState {
  const { genesisCard, drawPile: rawDeck1 } = buildDeck(player1Id)
  const { drawPile: rawDeck2 } = buildDeck(player2Id)

  const shuffled1 = shuffleDeck(rawDeck1)
  const shuffled2 = shuffleDeck(rawDeck2)

  const { drawn: dealtHand1, remainingDrawPile: dealtPile1 } = dealHand(shuffled1, 5)
  const { drawn: dealtHand2, remainingDrawPile: dealtPile2 } = dealHand(shuffled2, 6)
  const { hand: hand1, drawPile: drawPile1 } = diversifyHand(dealtHand1, dealtPile1)
  const { hand: hand2, drawPile: drawPile2 } = diversifyHand(dealtHand2, dealtPile2)

  const player1: PlayerState = {
    id: player1Id,
    isCpu: false,
    credits: 0,
    hand: hand1,
    drawPile: drawPile1,
    discardPile: [],
    validators: [],
  }

  const player2: PlayerState = {
    id: player2Id,
    isCpu: player2IsCpu,
    credits: 0,
    hand: hand2,
    drawPile: drawPile2,
    discardPile: [],
    validators: [],
  }

  return {
    phase: 'playing',
    players: [player1, player2],
    currentTurn: player1Id, // player who placed genesis goes first
    chain: [], // genesis card is "placed" but not a publishable block
    chainSplit: { active: false, triggeredBy: null },
    validatorRedundancyCount: 0,
    winner: null,
    forkReason: null,
    genesisCard,
  }
}
