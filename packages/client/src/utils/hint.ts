import type { Card, GameState, PlayerId } from '@shared/types'
import { CardType } from '@shared/types'

function getHintL2(hand: Card[], state: GameState, playerId: PlayerId): Hint | null {
  const txCards = hand.filter(c => c.type === CardType.TRANSACTION)
  const me = state.players.find(p => p.id === playerId)!
  const opp = state.players.find(p => p.id !== playerId)!
  const mySequencers = me.validators.length
  const creditDiff = me.credits - opp.credits

  const dataBlobCard = hand.find(c => c.type === CardType.DATA_BLOB)
  const orCard = hand.find(c => c.type === CardType.OPTIMISTIC_ROLLUP)
  const fraudProofCard = hand.find(c => c.type === CardType.FRAUD_PROOF)
  const zkCard = hand.find(c => c.type === CardType.ZK_PROOF)
  const sequencerCard = hand.find(c => c.type === CardType.SEQUENCER)
  const mevCard = hand.find(c => c.type === CardType.MEV_BOT)
  const bridgeCard = hand.find(c => c.type === CardType.BRIDGE)
  const hardForkCard = hand.find(c => c.type === CardType.HARD_FORK)

  const oppPendingBatches = state.pendingBatches.filter(pb => pb.publishedBy !== playerId && !pb.isZkProven)

  if (txCards.length >= 3) {
    return { icon: '⚡', text: `You have ${txCards.length} Transaction cards — publish a batch now to earn credits!`, priority: 'high' }
  }
  if (dataBlobCard && txCards.length >= 1) {
    return { icon: '💾', text: `Play Data Blob with 1 Transaction card to publish a fast batch and earn full credits.`, priority: 'high' }
  }
  if (orCard && txCards.length >= 2 && zkCard) {
    return { icon: '🔐', text: `Play ZK Proof first, then Optimistic Rollup for instant credits that can't be fraud-proofed!`, priority: 'high' }
  }
  if (orCard && txCards.length >= 2) {
    return { icon: '🔮', text: `Play Optimistic Rollup to publish a batch. Credits go into escrow — play ZK Proof next time to skip escrow.`, priority: 'medium' }
  }
  if (fraudProofCard && oppPendingBatches.length > 0) {
    return { icon: '🕵️', text: `Opponent has a pending batch in escrow — play Fraud Proof to cancel it and deny their credits!`, priority: 'high' }
  }
  if (mevCard) {
    return { icon: '🤖', text: `Play MEV Bot to steal 2 credits when your opponent next publishes a batch.`, priority: 'medium' }
  }
  if (bridgeCard && mySequencers >= 2) {
    return { icon: '🌉', text: `Play Bridge before your next batch to double your credits as the publisher.`, priority: 'medium' }
  }
  if (sequencerCard && mySequencers < 3) {
    return { icon: '🔵', text: `Play a Sequencer to increase your credit income. You earn ${mySequencers} cr/batch — add one for ${mySequencers + 1}.`, priority: mySequencers === 0 ? 'high' : 'medium' }
  }
  if (hardForkCard && creditDiff >= 5) {
    return { icon: '⚡', text: `You're ahead by ${creditDiff} credits — play Hard Fork to end the game and secure your win!`, priority: 'high' }
  }
  return null
}

export interface Hint {
  icon: string
  text: string
  priority: 'high' | 'medium' | 'low'
}

export function getHint(hand: Card[], state: GameState, playerId: PlayerId): Hint {
  if (state.gameMode === 'l2') {
    const l2Hint = getHintL2(hand, state, playerId)
    if (l2Hint) return l2Hint
  }
  const txCards = hand.filter(c => c.type === CardType.TRANSACTION)
  const validators = hand.filter(c => c.type === CardType.VALIDATOR)
  const blockReward = hand.find(c => c.type === CardType.BLOCK_REWARD)
  const vr = hand.find(c => c.type === CardType.VALIDATOR_REDUNDANCY)
  const chainSplit = hand.find(c => c.type === CardType.CHAIN_SPLIT)
  const fork = hand.find(c => c.type === CardType.FORK)
  const invalidTx = hand.find(c => c.type === CardType.INVALID_TRANSACTION)
  const reshuffle = hand.find(c => c.type === CardType.RESHUFFLE)
  const reorg = hand.find(c => c.type === CardType.CHAIN_REORG)

  const me = state.players.find(p => p.id === playerId)!
  const opp = state.players.find(p => p.id !== playerId)!
  const myValidators = me.validators.length
  const oppValidators = opp.validators.length
  const myCredits = me.credits
  const oppCredits = opp.credits
  const creditDiff = myCredits - oppCredits
  const oppHasBlocks = state.chain.some(b => b.publishedBy !== playerId)
  const chainLength = state.chain.length
  const myDrawPile = me.drawPile.length

  // Highest priority: publish if 3+ TX
  if (txCards.length >= 3) {
    const boost = state.validatorRedundancyCount > 0 ? ' Validator Redundancy is active — double credits!' : ''
    return {
      icon: '📦',
      text: `You have ${txCards.length} Transaction cards — publish a block now to earn ${myValidators} credit${myValidators !== 1 ? 's' : ''}!${boost}`,
      priority: 'high',
    }
  }

  // Block Reward with 2 TX
  if (blockReward && txCards.length >= 2) {
    return {
      icon: '🪙',
      text: `Play your Block Reward card to publish a block with just 2 Transaction cards (half credits). Better than waiting!`,
      priority: 'high',
    }
  }

  // Play validator if behind or early game
  if (validators.length > 0 && myValidators < 3) {
    return {
      icon: '🛡️',
      text: `Play a Validator to boost your credit income. You currently earn ${myValidators} cr/block — add one for ${myValidators + 1}.`,
      priority: myValidators === 0 ? 'high' : 'medium',
    }
  }

  // Fork if winning and low on cards
  if (fork && creditDiff >= 5 && myDrawPile <= 8) {
    return {
      icon: '⑂',
      text: `You're ahead by ${creditDiff} credits with few cards left — play Fork to end the game and secure your win!`,
      priority: 'high',
    }
  }

  // Invalid Transaction if opponent has blocks
  if (invalidTx && oppHasBlocks) {
    return {
      icon: '❌',
      text: `Play Invalid Transaction to remove one of your opponent's blocks from the chain.`,
      priority: 'medium',
    }
  }

  // Chain Reorg if opponent has many blocks
  if (reorg && chainLength >= 3) {
    return {
      icon: '🔄',
      text: `Play Chain Reorg to remove the last 3 blocks from the chain — useful if your opponent built them.`,
      priority: 'medium',
    }
  }

  // VR if have validators
  if (vr && myValidators >= 2 && txCards.length >= 2) {
    return {
      icon: '⚡',
      text: `Play Validator Redundancy now, then publish a block next turn for double credits (${myValidators * 2} instead of ${myValidators}).`,
      priority: 'medium',
    }
  }

  // Chain Split if winning on validators
  if (chainSplit && myValidators > oppValidators) {
    return {
      icon: '🔱',
      text: `You have more validators (${myValidators} vs ${oppValidators}) — play Chain Split so only you earn credits per block.`,
      priority: 'medium',
    }
  }

  // Reshuffle if low on TX cards and have discard
  if (reshuffle && me.discardPile.length > 3) {
    return {
      icon: '🔀',
      text: `Play Reshuffle to refill your deck from ${me.discardPile.length} discarded cards. Note: opponent will draw 1 card.`,
      priority: 'low',
    }
  }

  // Default: discard to cycle
  if (txCards.length < 3) {
    return {
      icon: '🃏',
      text: `You need ${3 - txCards.length} more Transaction card${3 - txCards.length !== 1 ? 's' : ''} to publish. Discard non-Transaction cards and redraw to cycle your hand.`,
      priority: 'low',
    }
  }

  return {
    icon: '💡',
    text: `Consider your options — play a utility card or discard to improve your hand.`,
    priority: 'low',
  }
}
