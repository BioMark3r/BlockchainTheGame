# ⛓️ Blockchain: The Game

**A 2-player card game where you race to earn credits before the chain forks.**

<!-- Add screenshot here -->

---

## 🎮 Game Overview

Blockchain: The Game is a competitive 2-player card game played with 50-card decks. Each turn you place validators, publish blocks, and play utility cards to earn credits. The game ends when a player plays the Fork card or the first player runs out of cards — whoever has the most credits wins.

---

## 🃏 Card Types

Each player's deck contains 50 cards (the Genesis card is removed before play and placed in the center to start the chain):

| Card | Count | Effect |
|---|---|---|
| Genesis | 1 | Removed before play; placed in the center to start the chain |
| Validator | 10 | Placed next to the chain; earns 1 credit per block published |
| Transaction | 30 | Play exactly 3 to publish a block |
| Reshuffle | 3 | Shuffle your discard pile back into your draw deck |
| Chain Split | 1 | From this point forward, only the publishing player earns credits for their blocks |
| Validator Redundancy | 2 | Doubles credits earned per validator for the rest of the game (stackable) |
| Invalid Transaction | 2 | Remove one of your opponent's blocks from the chain |
| Chain Reorg | 1 | Remove ALL blocks from the chain |
| Fork | 1 | End the game immediately |

---

## 🔄 Turn Actions

Each turn, choose one of the following:

1. **Play an action card** — play a validator, utility, or fork card from your hand
2. **Publish a block** — play exactly 3 transaction cards to publish a block and trigger credit payouts
3. **Discard and redraw** — discard any number of cards from your hand and draw back up

---

## 🏆 Winning

The game ends when a player plays the Fork card or the first player runs out of cards — the player with the most credits at that point wins.

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+ and npm

```bash
git clone https://github.com/BioMark3r/BlockchainTheGame
cd BlockchainTheGame
npm install
```

### Start both server and client (development)

```bash
npm run dev
```

This runs the WebSocket server and the Vite dev server concurrently. Open the URL printed by Vite (typically `http://localhost:5173`) in your browser.

### Start server and client separately

```bash
# Terminal 1 — game server
npm run dev --workspace=packages/server

# Terminal 2 — client
npm run dev --workspace=packages/client
```

### Production build

```bash
npm run build
npm start --workspace=packages/server
```

---

## 🌐 Playing Online / vs CPU

When you open the game, you can:

- **Create a room** — you'll receive a short room code to share with a friend. When both players have joined, the game starts automatically.
- **Join a room** — enter the code your friend shared to connect.
- **Play vs CPU** — start a room and choose "Play vs CPU" (or simply wait — if no second player joins within the timeout, an AI opponent fills the slot automatically).

---

## 🧪 Running Tests

```bash
npm test
```

---

## 🛠 Tech Stack

- **React 18** — UI framework
- **TypeScript 5** — strict typed throughout
- **Vite 5** — frontend build and dev server
- **Tailwind CSS 3** — styling
- **Node.js** — game server
- **ws 8** — WebSocket server for real-time multiplayer
- **Zustand 4** — client-side state management
- **Vitest 1** — unit and integration tests

---

## 📄 License

MIT
