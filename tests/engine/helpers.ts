import { Card, CardType, GameState, PlayerState } from '../../src/shared/types'

let cardCounter = 0

export function makeCard(type: CardType, id?: string): Card {
  return { id: id ?? `${type.toLowerCase()}-${++cardCounter}`, type }
}

export function makePlayer(
  id: 'player1' | 'player2' | 'cpu',
  overrides: Partial<PlayerState> = {}
): PlayerState {
  return {
    id,
    isCpu: false,
    credits: 0,
    hand: [],
    drawPile: [],
    discardPile: [],
    validators: [],
    ...overrides,
  }
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const p1 = makePlayer('player1')
  const p2 = makePlayer('player2')
  return {
    phase: 'playing',
    players: [p1, p2],
    currentTurn: 'player1',
    chain: [],
    chainSplit: { active: false, triggeredBy: null },
    validatorRedundancyCount: 0,
    winner: null,
    forkReason: null,
    genesisCard: makeCard(CardType.GENESIS, 'genesis-1'),
    ...overrides,
  }
}
