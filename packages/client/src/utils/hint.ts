import type { Card, GameState, PlayerId } from '@shared/types'
import { CardType } from '@shared/types'

export interface Hint {
  icon: string
  text: string
  priority: 'high' | 'medium' | 'low'
}

export function getHint(hand: Card[], state: GameState, playerId: PlayerId): Hint {
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
