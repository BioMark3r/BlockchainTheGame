export type CpuDifficulty = 'easy' | 'normal' | 'hard'

export enum CardType {
  GENESIS = 'GENESIS',
  VALIDATOR = 'VALIDATOR',
  TRANSACTION = 'TRANSACTION',
  RESHUFFLE = 'RESHUFFLE',
  CHAIN_SPLIT = 'CHAIN_SPLIT',
  VALIDATOR_REDUNDANCY = 'VALIDATOR_REDUNDANCY',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  CHAIN_REORG = 'CHAIN_REORG',
  FORK = 'FORK',
}

export interface Card {
  id: string        // unique per card instance e.g. "validator-1"
  type: CardType
}

export interface Block {
  id: string
  publishedBy: PlayerId
  transactions: [Card, Card, Card]
}

export type PlayerId = 'player1' | 'player2' | 'cpu'

export interface PlayerState {
  id: PlayerId
  isCpu: boolean
  credits: number
  hand: Card[]
  drawPile: Card[]
  discardPile: Card[]
  validators: Card[]   // validators currently in play next to chain
}

export interface ChainSplitState {
  active: boolean
  triggeredBy: PlayerId | null
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'ended'
  players: [PlayerState, PlayerState]
  currentTurn: PlayerId
  chain: Block[]              // blocks published to the chain
  chainSplit: ChainSplitState
  validatorRedundancyCount: number  // 0, 1, or 2 — each doubles credits
  winner: PlayerId | null
  forkReason: 'fork_card' | 'player1_out_of_cards' | null
  genesisCard: Card
}

export type TurnActionType = 'PLAY_CARD' | 'PUBLISH_BLOCK' | 'DISCARD_REDRAW'

export interface PlayCardAction {
  type: 'PLAY_CARD'
  playerId: PlayerId
  cardId: string
  // for INVALID_TRANSACTION: target block to remove
  targetBlockId?: string
}

export interface PublishBlockAction {
  type: 'PUBLISH_BLOCK'
  playerId: PlayerId
  cardIds: [string, string, string]
}

export interface DiscardRedrawAction {
  type: 'DISCARD_REDRAW'
  playerId: PlayerId
  cardIdsToDiscard: string[]
}

export type TurnAction = PlayCardAction | PublishBlockAction | DiscardRedrawAction

export interface ActionResult {
  success: boolean
  state: GameState
  error?: string
}
