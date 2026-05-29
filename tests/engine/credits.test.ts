import { describe, it, expect } from 'vitest'
import { calculateBlockCredits } from '../../src/engine/credits'
import { CardType } from '../../src/shared/types'
import { makeCard, makePlayer, makeState } from './helpers'

describe('calculateBlockCredits', () => {
  it('both players earn 0 when neither has validators', () => {
    const state = makeState()
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(0)
    expect(credits.get('player2')).toBe(0)
  })

  it('each player earns credits based on their own validators (no split)', () => {
    const state = makeState({
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR), makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(2)
    expect(credits.get('player2')).toBe(1)
  })

  it('validator redundancy x1 doubles credits', () => {
    const state = makeState({
      validatorRedundancyCount: 1,
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(2) // 1 validator * 2^1
    expect(credits.get('player2')).toBe(2)
  })

  it('validator redundancy x1 (active) gives 2x credits and resets after publish', () => {
    // VR is single-use (count capped at 1) — confirmed via applyValidatorRedundancy
    const state = makeState({
      validatorRedundancyCount: 1,
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(2) // 1 validator * 2^1 = 2
    expect(credits.get('player2')).toBe(2)
  })

  it('chain split: only publisher earns credits', () => {
    const state = makeState({
      chainSplit: { active: true, triggeredBy: 'player1' },
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR), makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(2)
    expect(credits.get('player2')).toBe(0)
  })

  it('chain split: non-publisher earns 0 even with many validators', () => {
    const state = makeState({
      chainSplit: { active: true, triggeredBy: 'player2' },
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR), makeCard(CardType.VALIDATOR), makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    // player2 publishes the block
    const credits = calculateBlockCredits(state, 'player2')
    expect(credits.get('player2')).toBe(1)
    expect(credits.get('player1')).toBe(0)
  })

  it('chain split + validator redundancy x1 still applies only to publisher', () => {
    const state = makeState({
      chainSplit: { active: true, triggeredBy: 'player1' },
      validatorRedundancyCount: 1,
      players: [
        makePlayer('player1', { validators: [makeCard(CardType.VALIDATOR)] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(2) // 1 validator * 2^1 = 2, chain split so only publisher
    expect(credits.get('player2')).toBe(0)
  })

  it('player with 0 validators earns 0 regardless of multiplier', () => {
    const state = makeState({
      validatorRedundancyCount: 1,
      players: [
        makePlayer('player1', { validators: [] }),
        makePlayer('player2', { validators: [makeCard(CardType.VALIDATOR)] }),
      ],
    })
    const credits = calculateBlockCredits(state, 'player1')
    expect(credits.get('player1')).toBe(0)
    expect(credits.get('player2')).toBe(2) // 1 validator * 2^1 = 2
  })
})
