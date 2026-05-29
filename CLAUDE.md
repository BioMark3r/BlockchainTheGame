# Blockchain: The Game — Project Context

## What This Is
A web-based 2-player card game where players compete to earn the most **credits** before the blockchain forks. Built with an agent team: one Lead coordinating parallel teammates across game engine, frontend UI, backend/multiplayer, and QA.

## Game Rules Summary

### Objective
Earn the most credits before the chain forks.

### Setup
- Each player has a 51-card deck. The genesis card is removed before play and placed in the center to start the chain — leaving 50 playable cards. The player who placed genesis goes first.
- Each player draws 5 cards. Player 2 draws 6 cards instead of 5 to offset the first-player advantage.

### Turn Actions (pick one)
1. Play an action card (validator, utility, or fork)
2. Publish a block — play exactly 3 transaction cards
3. Discard any number of cards and redraw

### Credits
- When any player publishes a block, **each player earns 1 credit per validator they have in play**.
- Chain Split utility changes this: from that point, each player's blocks only earn credits for themselves.
- Validator Redundancy doubles credits for the next block published only, then resets. It is not stackable.

### Fork Conditions (game end)
- A player plays the Fork card
- The first player runs out of cards

### Deck (50 cards each)
| Card | Count | Effect |
|---|---|---|
| Genesis | 1 | Removed before play; starts the chain |
| Validator | 10 | Placed next to chain; earns credit per block |
| Transaction | 25 | 3 required to publish a block |
| Reshuffle | 3 | Shuffle discard pile back into draw deck. Opponent draws 1 card. |
| Block Reward | 5 | Publish a block with only 2 Transaction cards. Earns half credits (rounded down). |
| Chain Split | 1 | Blocks only give the publishing player credits going forward |
| Validator Redundancy | 2 | Doubles credits for the next block published only, then resets. Not stackable. |
| Invalid Transaction | 2 | Remove one of the opponent's blocks from the chain |
| Chain Reorg | 1 | Remove the last 3 blocks from the chain (not all) |
| Fork | 1 | End the game immediately (chain forks) |

## Architecture

```
/src
  /engine       — game state, rules, turn logic, card effects (no DOM dependency)
  /ui           — React components, card rendering, chain visualization, animations
  /server       — WebSocket server, session/room management, game sync
  /shared       — types, constants, card definitions shared across engine/ui/server
/tests
  /engine       — unit tests for all game logic
  /integration  — full game flow tests
/public         — static assets, card art placeholders
```

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Game Engine**: pure TypeScript (no framework dependency)
- **Backend**: Node.js + WebSocket (`ws` library) for real-time online multiplayer
- **Testing**: Vitest
- **State**: Zustand for UI state; authoritative state lives in the engine (server-side)

## Multiplayer Model
- **Authoritative server**: all game state lives on the server. Clients send intents (e.g. `PLAY_CARD`, `PUBLISH_BLOCK`), server validates and broadcasts new state.
- **Room system**: players create or join a room via a short code. When both players are connected, the server deals and starts the game.
- **AI CPU player**: if a player starts a room and no human joins within a timeout (or explicitly chooses "vs CPU"), the server fills the second slot with an AI player.
- **AI strategy** (simple, deterministic):
  1. If hand has 3+ transaction cards → publish a block
  2. If hand has a validator and fewer than 3 validators in play → play validator
  3. If hand has a useful utility card → play it (priority: Reshuffle if deck empty, Validator Redundancy, Chain Split, Invalid Transaction if opponent has blocks)
  4. Otherwise → discard lowest-value cards and redraw
- **Reconnection**: server holds game state for 60 seconds after a client disconnects; client can rejoin with room code + player token.

## Code Standards
- TypeScript strict mode — no `any`
- Engine logic must be pure functions where possible (easy to test)
- Card effects are data-driven: each card type has an `applyEffect(state)` function
- Never mutate game state directly — return new state objects
- All game rule logic lives in `/src/engine` — UI never enforces rules directly

## File Ownership (to avoid conflicts)
- **Game Engine teammate** owns: `/src/engine/`, `/src/shared/`, `/tests/engine/`
- **UI teammate** owns: `/src/ui/`, `/public/`
- **Backend teammate** owns: `/src/server/` (includes AI player logic at `/src/server/ai.ts`)
- **QA teammate** owns: `/tests/integration/`

## Key Edge Cases to Handle
- Validator Redundancy doubles credits for the next block only, then resets — it does not stack across multiple plays
- Chain Reorg after Chain Split: last 3 blocks removed, but split state persists
- Invalid Transaction on a block that was already credited: no credit reversal, just block removed
- Fork triggered by running out of cards: only the **first** player (player 1) running out triggers fork, not player 2
- Player can Reshuffle only if they have cards in discard; no-op otherwise
- A player with 0 validators earns 0 credits per block regardless of other effects
- Block Reward uses the first 2 Transaction cards found in hand — the player does not choose which.
- Reshuffle opponent draw: if opponent has no draw pile cards, no card is drawn (no-op for opponent).
