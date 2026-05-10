# 🃏 7 Cards Show — Full-Stack Multiplayer Card Game

A premium, real-time multiplayer Indian card game built with React, Node.js, Socket.IO, and MongoDB.

---

## 📁 Project Structure

```
7-cards-show/
├── shared/src/types.ts           # Shared TypeScript types (server + client)
├── server/                        # Node.js + Express + Socket.IO backend
│   └── src/
│       ├── engine/
│       │   ├── GameEngine.ts     # 🎮 Core game logic (pure stateless functions)
│       │   ├── DeckManager.ts    # Card deck creation, shuffling, joker selection
│       │   ├── ScoreEngine.ts    # Round/match scoring engine
│       │   └── BotPlayer.ts      # AI bot decision logic
│       ├── models/               # MongoDB/Mongoose schemas
│       ├── socket/handlers/      # Socket.IO event handlers
│       ├── routes/               # REST API routes
│       └── index.ts              # Server entry point
├── client/                        # React + TypeScript + Tailwind frontend
│   └── src/
│       ├── components/game/      # GameBoard, Card, PlayerHand, etc.
│       ├── components/lobby/     # CreateRoomModal, JoinRoomModal, RoomLobby
│       ├── components/ui/        # Button, Modal, Avatar, ThemeToggle
│       ├── store/                # Zustand state (gameStore, authStore)
│       ├── services/             # socket.ts, api.ts, sound.ts
│       └── pages/                # HomePage, LobbyPage, GamePage, etc.
├── docker-compose.yml
├── Dockerfile.server / Dockerfile.client
└── nginx/default.conf
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- (Optional) Docker + Docker Compose

### 1. Clone & Install

```bash
git clone <repo>
cd 7-cards-show

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values (MongoDB URI, Google OAuth keys, JWT secret)
```

### 3. Run Development

```bash
# Terminal 1 — Server
cd server && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

Open http://localhost:3000

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Production
docker-compose -f docker-compose.yml up -d
```

---

## 🎮 Game Rules Summary

### Setup
- 2–5 players, 7 cards each
- One random card (NOT 7 or J) is selected as Joker — all cards of that rank = 0 points
- Remaining cards form closed deck; first card starts the open (discard) pile

### Card Values
| Card | Points |
|------|--------|
| A    | 1      |
| 2–10 | Face value |
| J    | 10 (+ Skip power) |
| Q    | 10     |
| K    | 10     |
| Joker rank | 0 |

### Turn
1. Draw 1 card (closed deck OR top of discard pile)
2. Discard 1 card
3. Power card effects apply on discard

### Power Cards
**J (Skip):**
- Discard 1 J → next player skipped
- Discard 2 Js → next 2 players skipped

**7 (Attack):**
- Discard a 7 → next player must throw a 7 OR take 2 × (chain length) penalty cards
- Each additional 7 in chain increases penalty by 2
- Under attack, you cannot call SHOW

### SHOW
- Can only call SHOW if hand total ≤ 5 points
- Must have drawn a card that turn
- Cannot SHOW while under 7 attack
- All players reveal hands
- **SHOW player wins**: they have the lowest (or tied-lowest) score → they get 0 pts, others get their own score
- **SHOW player loses**: someone else has lower score → SHOW player gets SUM of all opponents' totals as penalty

### Match
- Multiple rounds until a player's cumulative score reaches the limit (50/100/200 pts)
- That player is eliminated; last player standing wins

---

## 🌐 REST API

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| POST | `/api/auth/guest` | Guest login `{ username }` |
| GET | `/api/auth/me` | Get current user (JWT) |
| POST | `/api/auth/logout` | Logout |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List public rooms |
| GET | `/api/rooms/:code` | Get room by code |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/leaderboard` | Top players |
| GET | `/api/users/:id/profile` | Public profile |
| PATCH | `/api/users/me` | Update own profile |

---

## ⚡ Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:create` | `{ name, maxPlayers, matchPointLimit, isPrivate, turnTimeLimit, botCount }` | Create a room |
| `room:join` | `code: string` | Join room by code |
| `room:leave` | — | Leave current room |
| `room:ready` | — | Toggle ready state |
| `room:start` | — | Start game (host only) |
| `game:draw` | `'deck' \| 'discard'` | Draw a card |
| `game:discard` | `cardIds: string[]` | Discard 1 or 2 Js |
| `game:show` | — | Call SHOW |
| `game:attack:respond` | `{ action: 'throw'\|'take', cardIds? }` | Respond to 7 attack |
| `game:reconnect` | `roomCode: string` | Reconnect to game |
| `chat:send` | `message: string` | Send chat message |
| `chat:reaction` | `emoji: string` | Send reaction emoji |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room:joined` | `Room` | Joined a room |
| `room:updated` | `Room` | Room state changed |
| `room:left` | — | Left the room |
| `room:error` | `string` | Room error |
| `game:state` | `ClientGameState` | Full game state (personalised) |
| `game:action` | `GameAction` | Action broadcast (draw, discard, etc.) |
| `game:match_end` | `MatchResult` | Match is over |
| `game:error` | `string` | Game error |
| `chat:received` | `ChatMessage` | Incoming chat/reaction |

---

## 🗄️ Database Schema

### User
```typescript
{
  googleId?: string,
  username: string (2–20 chars),
  email?: string,
  avatar: string,
  isGuest: boolean,
  stats: { gamesPlayed, gamesWon, roundsPlayed, roundsWon, totalPointsEarned, showAttempts, showSuccesses },
  friends: ObjectId[],
  timestamps
}
```

### Room
```typescript
{
  code: string (6-char unique),
  name: string,
  hostId: string,
  players: [{ userId, username, avatar, isReady, isHost, isBot, socketId }],
  config: { maxPlayers, matchPointLimit, isPrivate, turnTimeLimit, allowBots, botCount },
  status: 'waiting' | 'playing' | 'finished',
  gameId: string | null,
  TTL: 2 hours (auto-cleanup)
}
```

### Game
```typescript
{
  roomId: string,
  players: [{ userId, username, avatar, totalScore, isEliminated, isBot }],
  winnerId: string | null,
  matchPointLimit: 50 | 100 | 200,
  rounds: [{ roundNumber, jokerRank, showPlayerId, showPlayerWon, winnerId, playerResults, startedAt, endedAt }],
  status: 'playing' | 'finished',
  startedAt, endedAt
}
```

---

## 🏗️ Architecture

### Server-Authoritative
All game state lives on the server. Clients send *intent* (draw, discard), server validates, updates state, and broadcasts personalised views to each player.

### Game State Flow
```
Client action → Socket event → GameEngine.process*() → ActionResult
→ activeGames.set(newState) → broadcastGameState() → each client receives ClientGameState
```

### Key Design Decisions
- **Stateless engine**: `GameEngine` is pure functions. Input: state + action. Output: new state + actions list.
- **In-memory game state**: Ultra-low latency. MongoDB only used for persistence (round results, stats).
- **Personalised broadcasts**: Each client only receives their own hand. Other players see `handCount`.
- **Turn timer**: Server-side NodeJS.setTimeout — auto-advances turn on timeout.
- **Bot turns**: `setTimeout(delay)` after each turn if next player is a bot.

---

## 🔒 Security

- JWT authentication for all API routes
- Socket.IO middleware validates JWT/guestToken on connect
- Rate limiting on auth routes (20 req/15min) and API (100 req/15min)
- Server validates ALL game actions — clients cannot cheat
- Input sanitization on chat messages (200 char max, cleaned)
- Helmet.js for HTTP security headers
- CORS restricted to CLIENT_URL

---

## 🧪 Testing Strategy

```
server/
├── __tests__/
│   ├── engine/
│   │   ├── GameEngine.test.ts    # Unit test all game rules
│   │   ├── DeckManager.test.ts   # Deck creation, joker selection
│   │   └── ScoreEngine.test.ts   # Scoring edge cases
│   ├── socket/
│   │   └── game.integration.ts   # Socket event integration tests
│   └── routes/
│       └── auth.test.ts          # API route tests
```

Key test cases:
- Joker never selected as 7 or J
- J skip count (1 J = 1 skip, 2 Js = 2 skips)
- 7 attack chain penalty calculation (n sevens = 2n cards)
- SHOW validation (must ≤ 5, must have drawn, not under attack)
- SHOW player penalty = sum of opponents when SHOW fails
- Deck reshuffle when empty
- Match elimination when score ≥ limit

---

## 🚀 Production Deployment (Railway / Render / EC2)

### Railway
```bash
railway init
railway add mongodb
railway deploy
```

### Environment Variables (set in platform dashboard)
```
MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
SESSION_SECRET, CLIENT_URL, NODE_ENV=production
```

### SSL / Domain
Use your platform's automatic SSL or add Cloudflare in front.

---

## 📈 Scalability

**Horizontal scaling** (multiple server instances):
1. Replace in-memory game state (`activeGames` Map) with Redis (`ioredis`)
2. Use `@socket.io/redis-adapter` so Socket.IO events work across instances
3. Add Redis pub/sub for game state synchronization

```typescript
// server/src/socket/index.ts — add Redis adapter
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pub = createClient({ url: process.env.REDIS_URL });
const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub));
```

**CDN for client**: Build client with `npm run build` and serve from S3/Cloudflare.

---

## 🎨 UI Features

- **Dark/light themes** — system-based default with toggle
- **Casino felt table** background with CSS pattern
- **Neon glow effects** on joker cards, active turns, power plays
- **Framer Motion** animations — card deal, hover lift, select raise, confetti win
- **Card fan layout** — cards spread with slight rotation in player hand
- **Responsive** — works on mobile (cards scroll horizontally) and desktop
- **Avatar system** — 10 emoji avatars + Google profile photo support
- **Confetti** on match win (60 falling particles, 5 neon colors)
- **Real-time action toasts** — "Player X discarded K♠" appears briefly at bottom

---

## 🔮 Future Features

- [ ] Spectator mode (join room as observer)
- [ ] Replay last round
- [ ] Voice chat integration (WebRTC)
- [ ] Friend system with invites
- [ ] Season leaderboard (monthly reset)
- [ ] Card deal animation (staggered flying from center)
- [ ] Tournament brackets
- [ ] In-game store (cosmetic card backs, table themes)
- [ ] PWA / mobile app (Capacitor)
- [ ] Offline practice mode (vs bots, no server)

---

## 📋 Admin Panel (basics)

Accessible at `/admin` (add admin flag to User model):

- Live game monitor (active rooms, player counts)
- User management (ban, reset stats)
- Game history / analytics
- Server health dashboard (memory, active connections)

---

*Built with ❤️ using React 18, Node.js, Socket.IO 4, MongoDB, and Tailwind CSS*
