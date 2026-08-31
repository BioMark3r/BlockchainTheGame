export type CpuDifficulty = 'easy' | 'normal' | 'hard'

export const CardType = {
  GENESIS: 'GENESIS',
  VALIDATOR: 'VALIDATOR',
  TRANSACTION: 'TRANSACTION',
  RESHUFFLE: 'RESHUFFLE',
  CHAIN_SPLIT: 'CHAIN_SPLIT',
  VALIDATOR_REDUNDANCY: 'VALIDATOR_REDUNDANCY',
  INVALID_TRANSACTION: 'INVALID_TRANSACTION',
  CHAIN_REORG: 'CHAIN_REORG',
  FORK: 'FORK',
  BLOCK_REWARD: 'BLOCK_REWARD',
  // L2 cards
  SEQUENCER: 'SEQUENCER',
  DATA_BLOB: 'DATA_BLOB',
  OPTIMISTIC_ROLLUP: 'OPTIMISTIC_ROLLUP',
  FRAUD_PROOF: 'FRAUD_PROOF',
  ZK_PROOF: 'ZK_PROOF',
  MEV_BOT: 'MEV_BOT',
  BRIDGE: 'BRIDGE',
  GAS_SPIKE: 'GAS_SPIKE',
  HARD_FORK: 'HARD_FORK',
} as const

export type CardType = typeof CardType[keyof typeof CardType]

export interface Card {
  id: string        // unique per card instance e.g. "validator-1"
  type: CardType
}

export interface Block {
  id: string
  publishedBy: PlayerId
  transactions: Card[]
  isPending: boolean
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

export interface PendingBatch {
  blockId: string
  publishedBy: PlayerId
  creditsEscrowed: Partial<Record<PlayerId, number>>
  isZkProven: boolean
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'ended'
  players: [PlayerState, PlayerState]
  currentTurn: PlayerId
  chain: Block[]              // blocks published to the chain
  chainSplit: ChainSplitState
  validatorRedundancyCount: number  // 0 or 1 — active for the next block published, then resets
  winner: PlayerId | null
  forkReason: 'fork_card' | 'player1_out_of_cards' | 'player2_out_of_cards' | null
  genesisCard: Card
  gameMode: 'l1' | 'l2'
  pendingBatches: PendingBatch[]
  zkProofActive: PlayerId | null
  bridgeActive: PlayerId | null
  mevActive: PlayerId | null
  gasSpike: PlayerId | null
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
  cardIds: string[]
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
