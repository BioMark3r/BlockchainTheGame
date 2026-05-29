# ⛓️ Blockchain: The Game

**A 2-player card game where you race to earn credits before the chain forks.**

<!-- Add screenshot here -->

---

## 🎮 Game Overview

Blockchain: The Game is a competitive 2-player card game played with 50-card decks. Players race to earn the most credits by building a validator network and publishing blocks to the chain — but the game can end at any moment when someone plays the Fork card or runs out of cards.

---

## 💡 How Credits Work

**Validators are the engine of the game.** Credits are earned whenever *any* player publishes a block — but only for the validators you have in play at that moment.

- **No validators in play = 0 credits per block**, even if you published the block yourself.
- **1 validator in play = 1 credit** every time any block is published.
- **3 validators in play = 3 credits** every time any block is published.

This means you earn credits both when you publish blocks *and* when your opponent does — as long as you have validators on the field.

**The core loop:**
1. Play Validator cards early to build your credit-earning engine.
2. Collect Transaction cards and publish blocks often.
3. Both players earn credits per block — so the more blocks published, the more your validators pay out.

**Credit modifiers:**
- **Validator Redundancy** doubles your credits for the next block published, then resets to 1×. It is not stackable.
- **Chain Split** breaks the shared credit model — after it is played, only the player who publishes a block earns credits for that block. Your opponent earns nothing even if they have validators.

---

## 🃏 Card Types

Each player's deck contains 50 cards (the Genesis card is removed before play and placed in the center to start the chain):

| Card | Count | Effect |
|---|---|---|
| Genesis | 1 | Removed before play; placed in the center to start the chain |
| Validator | 10 | **Play this to your field.** Earns you 1 credit every time any player publishes a block. You need validators to earn any credits at all. |
| Transaction | 25 | Play exactly 3 to publish a block and trigger credit payouts for all validators in play |
| Reshuffle | 3 | Shuffle your discard pile back into your draw deck. Opponent draws 1 card. |
| Block Reward | 5 | Publish a block with 2 Transaction cards. Earns half credits. |
| Validator Redundancy | 2 | Doubles your credits for the next block published, then resets. Not stackable. |
| Chain Split | 1 | From this point, only the publishing player earns credits — opponents earn nothing per block even with validators |
| Invalid Transaction | 2 | Remove one block from the chain (does not reverse credits already earned) |
| Chain Reorg | 1 | Remove the last 3 blocks from the chain (Chain Split state persists) |
| Fork | 1 | End the game immediately — highest credits wins |

---

## 🔄 Turn Actions

Each turn, choose **one** of the following:

1. **Play a card** — play a Validator, utility card (Reshuffle, Chain Split, Validator Redundancy, Invalid Transaction, Chain Reorg), or Fork from your hand. You must play it immediately; you cannot hold special cards for a later phase.
2. **Publish a block** — select exactly 3 Transaction cards from your hand and click "Publish Block". This adds a block to the chain and triggers credit payouts: every player earns 1 credit per validator they have in play (modified by Validator Redundancy and Chain Split).
3. **Discard and redraw** — select any number of cards to discard, then draw back up to a hand of 5. Use this to cycle through your deck looking for Transaction cards or Validators.

After every action your hand is automatically refilled to 5 cards.

---

## 📋 Strategy Tips

- **Play Validators early.** A Validator played on turn 1 earns you credits for every block published for the rest of the game — by you or your opponent.
- **Both players earn on every block.** If your opponent has more validators than you, publishing blocks actually benefits them more. Either catch up with your own validators or use Chain Split to cut them off.
- **Cycle aggressively.** Use Discard and Redraw to find Transaction cards when you don't have 3 in hand. Getting to 3 Transactions fast means more blocks, more credits.
- **Save Chain Split for when you're ahead.** It only helps you if you have more validators than your opponent, or if you plan to publish several more blocks before the game ends.
- **Invalid Transaction is denial, not value.** Use it to remove a block that your opponent got disproportionate credit from, or to set up a Chain Reorg play to strip the last 3 blocks.
- **Fork when you're winning.** The Fork card ends the game instantly — use it when you're ahead in credits and running low on cards, before your opponent can catch up.

---

## 🏆 Winning

The game ends when:
- A player plays the **Fork** card, or
- **Player 1** runs out of cards (hand and draw pile both empty)

The player with the **most credits** at that point wins. If it is a tie, the game is declared a draw.

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

## 🐳 Docker Setup

The easiest way to run the full game is with Docker Compose:

```bash
docker compose up --build
```

Then open **http://localhost** in your browser. The WebSocket server runs on port 3001 and the client is served by nginx on port 80.

**Deploying to a remote server** — the WebSocket URL is baked into the client bundle at build time, so set it before building:

```bash
VITE_WS_URL=ws://your-server-ip:3001 docker compose up --build
```

---

## 🚀 Deployment

You can also host the server and client separately on any Node.js host and static file host.

### Environment variables
| Variable | Default | Description |
|---|---|---|
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket server URL (set at client build time) |
| `PORT` | `3001` | Port the WebSocket server listens on |

### Client (any static host)
1. Set `VITE_WS_URL` to your server's WebSocket URL (e.g. `wss://yourdomain.com/ws`)
2. Run `npm run build --workspace=packages/client`
3. Deploy `packages/client/dist/` to Vercel, Netlify, or any static host

### Local development
Copy `.env.example` to `packages/client/.env.local` and adjust `VITE_WS_URL` if needed.

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
