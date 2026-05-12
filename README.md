# 🃏 7 Cards Show — Full-Stack Multiplayer Card Game

A premium, real-time multiplayer Indian card game built with React, Node.js, Socket.IO, and MongoDB.

---

## 📁 Project Structure

```
7-cards-show/
├── shared/src/types.ts                  # Shared TypeScript types (server + client)
├── server/
│   └── src/
│       ├── engine/
│       │   ├── GameEngine.ts            # Core game logic (pure stateless functions)
│       │   ├── DeckManager.ts           # Deck creation, shuffling, joker selection
│       │   ├── ScoreEngine.ts           # Round/match scoring engine
│       │   └── BotPlayer.ts             # AI bot decision logic
│       ├── models/
│       │   ├── User.ts                  # User schema (stats, ban flag)
│       │   ├── Room.ts                  # Room schema (config, players, status)
│       │   ├── Game.ts                  # Game history schema
│       │   └── AdminConfig.ts           # Singleton admin config (feature flags + game config)
│       ├── middleware/
│       │   ├── auth.ts                  # JWT requireAuth middleware
│       │   └── adminAuth.ts             # Admin-role JWT requireAdmin middleware
│       ├── socket/
│       │   ├── index.ts                 # Socket.IO setup, auth, online user tracking
│       │   └── handlers/
│       │       ├── gameHandler.ts       # Game socket events + bot turns
│       │       ├── roomHandler.ts       # Room create/join/leave/ready/start
│       │       ├── spectatorHandler.ts  # Spectator join/leave, state broadcast
│       │       └── voiceHandler.ts      # WebRTC signaling (offer/answer/ICE)
│       ├── routes/
│       │   ├── auth.ts                  # Google OAuth + guest login
│       │   ├── rooms.ts                 # Public room list (filtered by admin config)
│       │   ├── users.ts                 # Leaderboard, profile, stats
│       │   └── admin.ts                 # Full admin REST API (protected)
│       └── index.ts                     # Server entry point
├── client/
│   └── src/
│       ├── components/
│       │   ├── game/                    # GameBoard, Card, PlayerHand, etc.
│       │   ├── lobby/                   # CreateRoomModal, JoinRoomModal, RoomLobby, HistoryTab
│       │   └── ui/                      # Button, Modal, Avatar, ThemeToggle
│       ├── store/
│       │   ├── gameStore.ts             # Zustand game + room state
│       │   └── authStore.ts             # Auth user state
│       ├── services/
│       │   ├── socket.ts                # Socket.IO client (player + spectator sockets)
│       │   ├── api.ts                   # Axios instances (api + adminApi)
│       │   ├── sound.ts                 # Sound effects
│       │   └── notify.ts                # Toast notifications
│       └── pages/
│           ├── HomePage.tsx             # Login (guest/Google) — type ADMIN to access admin
│           ├── LobbyPage.tsx            # Game lobby with AI, multiplayer, spectate
│           ├── GamePage.tsx             # Active game view
│           ├── SpectatorPage.tsx        # Read-only live game spectator view
│           ├── AdminLoginPage.tsx       # Hidden admin login
│           └── AdminPage.tsx            # Full admin dashboard
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

cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment

Create `server/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/7cardsshow
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
ADMIN_SECRET=your_admin_password_here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:3005
PORT=5000
NODE_ENV=development
```

Create `client/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

### 3. Run Development

```bash
# Terminal 1 — Server (auto-reloads via ts-node-dev)
cd server && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

Open http://localhost:3005

---

## 🐳 Docker Deployment

```bash
docker-compose up --build
docker-compose -f docker-compose.yml up -d   # production
```

---

## 🎮 Game Rules Summary

### Setup
- 2–7 players, 7 cards each (deck limit: 57 cards − 1 joker selector = 56; 7 × 7 = 49 dealt, 7 remain)
- One random card (NOT 7 or J) is the Joker rank — all cards of that rank = 0 points
- Remaining cards form the closed deck; first valid card starts the discard pile

### Card Values
| Card | Points |
|------|--------|
| A | 1 |
| 2–10 | Face value |
| J | 10 (+ Skip power) |
| Q | 10 |
| K | 10 |
| Joker rank | 0 |
| Printed Joker | 0 |

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
- Each additional 7 in the chain doubles the penalty
- Cannot call SHOW while under a 7 attack

### SHOW
- Call SHOW only if hand total ≤ 5 points, after drawing, and not under attack
- All players reveal hands
- **SHOW wins**: caller has lowest (or tied) score → caller gets 0 pts, others get their own score
- **SHOW fails**: someone else has a lower score → caller gets the sum of all opponents' totals as penalty

### Match
- Multiple rounds; player eliminated when cumulative score reaches the limit
- Last player standing wins

---

## 👁 Spectator Mode

- Live matches appear in the lobby under **Live Matches** with a pulsing LIVE badge
- Click **Spectate** to watch in real time (separate socket connection)
- Spectators see player card counts and hand totals — never actual card faces
- Spectator count shown to both players and spectators
- Auto-redirects to lobby when the match ends
- Enable/disable via Admin → Features → Spectator Mode

---

## 🔐 Hidden Admin Panel

### Access
On the login screen, type **`ADMIN`** (all caps) as the guest name → redirected to `/admin/login`.

### Login
POST to `/api/admin/login` with the password set in `ADMIN_SECRET` env var.
A separate JWT with `role: 'admin'` is stored in `localStorage` as `adminToken`.

### Dashboard Sections

| Section | Features |
|---------|----------|
| **Overview** | Live stats: total users, online count, active games, live rooms |
| **Live Rooms** | View all active rooms, player/spectator counts, force-end, kick players |
| **Users** | Search + paginate users, ban/unban/kick/reset stats, online indicator |
| **Leaderboard** | View top 100 players, reset all stats |
| **Features** | Toggle Spectator Mode and Public Rooms on/off (live, no restart) |
| **Game Config** | Set min/max players (2–7), rounds, spectators, bots — applied to all new rooms |

### Admin API Routes (all require `Authorization: Bearer <adminToken>`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login → returns JWT |
| GET | `/api/admin/config/public` | Public config (no auth) |
| GET | `/api/admin/config` | Full config |
| PATCH | `/api/admin/config` | Update config (broadcasts live) |
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/rooms` | All active rooms |
| DELETE | `/api/admin/rooms/:code` | Force-end a room |
| POST | `/api/admin/rooms/:code/kick/:userId` | Kick player from room |
| GET | `/api/admin/users` | List users (search + pagination) |
| POST | `/api/admin/users/:id/ban` | Ban user |
| POST | `/api/admin/users/:id/unban` | Unban user |
| POST | `/api/admin/users/:id/kick` | Kick connected user |
| POST | `/api/admin/users/:id/reset-stats` | Reset user stats |
| GET | `/api/admin/leaderboard` | Top 100 |
| POST | `/api/admin/leaderboard/reset` | Reset all stats |

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
| GET | `/api/rooms` | List public rooms (waiting + live, filtered by admin config) |
| GET | `/api/rooms/:code` | Get room by code |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/leaderboard` | Top players |
| GET | `/api/users/:id/profile` | Public profile |
| PATCH | `/api/users/me` | Update own profile |

---

## ⚡ Socket.IO Events

### Client → Server (player socket)
| Event | Payload | Description |
|-------|---------|-------------|
| `room:create` | `{ name, maxPlayers, roundCount, isPrivate, turnTimeLimit, botCount }` | Create room |
| `room:join` | `code: string` | Join room by code |
| `room:leave` | — | Leave current room |
| `room:ready` | — | Toggle ready state |
| `room:start` | — | Start game (host only) |
| `room:set_bots` | `count: number` | Set bot count (host only) |
| `game:draw` | `'deck' \| 'discard'` | Draw a card |
| `game:discard` | `cardIds: string[]` | Discard card(s) |
| `game:show` | — | Call SHOW |
| `game:attack:respond` | `{ action: 'throw'\|'take', cardIds? }` | Respond to 7 attack |
| `game:reconnect` | `roomCode: string` | Reconnect to game |
| `game:round_ready` | — | Ready for next round |
| `chat:send` | `message: string` | Send chat message |
| `chat:reaction` | `emoji: string` | Send reaction emoji |
| `spectate:join` | `roomCode: string` | Join as spectator |
| `spectate:leave` | — | Leave spectator view |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room:joined` | `Room` | Successfully joined a room |
| `room:updated` | `Room` | Room state changed |
| `room:left` | — | Left the room |
| `room:error` | `string` | Room error message |
| `room:kicked` | `{ message }` | Kicked from room |
| `room:force_ended` | `{ message }` | Admin ended the room |
| `game:state` | `ClientGameState` | Full personalised game state |
| `game:action` | `GameAction` | Action broadcast |
| `game:round_end` | `RoundResult` | Round ended |
| `game:match_end` | `MatchResult` | Match is over |
| `game:error` | `string` | Game error |
| `game:can_resume` | `{ roomCode }` | Resumable game found |
| `game:round_ready_update` | `{ readyUserIds, total }` | Round-ready status |
| `game:force_ended` | `{ message }` | Admin force-ended game |
| `spectate:state` | `SpectatorGameState` | Live game state (no card faces) |
| `spectate:joined` | `{ roomCode, spectatorCount }` | Joined spectator view |
| `spectate:count` | `{ count }` | Spectator count updated |
| `spectate:error` | `string` | Spectator error |
| `spectate:game_ended` | `{ message, winner }` | Watched game ended |
| `chat:received` | `ChatMessage` | Incoming chat message |
| `lobby:rooms_updated` | — | Lobby room list changed |
| `admin:config_updated` | `PublicAdminConfig` | Live config change from admin |
| `auth:banned` | `{ message }` | Account was banned |
| `auth:kicked` | `{ message }` | Admin kicked this session |
| `voice:peers` | `{ userId, username }[]` | Current voice peers |
| `voice:peer_joined` | `{ userId, username }` | Peer joined voice |
| `voice:peer_left` | `{ userId }` | Peer left voice |
| `voice:offer` | `{ fromUserId, offer }` | WebRTC offer |
| `voice:answer` | `{ fromUserId, answer }` | WebRTC answer |
| `voice:ice_candidate` | `{ fromUserId, candidate }` | ICE candidate |

---

## 🗄️ Database Schema

### User
```typescript
{
  googleId?: string,
  username: string,           // 2–20 chars
  email?: string,
  avatar: string,
  isGuest: boolean,
  isBanned: boolean,          // admin can ban
  stats: {
    gamesPlayed, gamesWon,
    roundsPlayed, roundsWon,
    totalPointsEarned,
    showAttempts, showSuccesses
  },
  timestamps
}
```

### Room
```typescript
{
  code: string,               // 6-char unique uppercase
  name: string,
  hostId: string,
  players: [{ userId, username, avatar, isReady, isHost, isBot, socketId }],
  config: {
    maxPlayers: 2–7,          // deck limit: max 7 players
    roundCount: 1–50,
    isPrivate: boolean,
    turnTimeLimit: 15–60s,
    allowBots: boolean,
    botCount: 0–6             // max 6 bots (+ 1 human = 7 total)
  },
  status: 'waiting' | 'playing' | 'finished',
  gameId: string | null,
  TTL: 2 hours (auto-cleanup)
}
```

### Game
```typescript
{
  roomId: string,
  players: [{ userId, username, avatar, totalScore, isBot }],
  winnerId: string | null,
  winnerUsername: string,
  roundCount: number,
  rounds: [{
    roundNumber, jokerRank, showPlayerId, showPlayerWon,
    winnerId, playerResults, startedAt, endedAt
  }],
  status: 'playing' | 'finished',
  startedAt, endedAt
}
```

### AdminConfig (singleton)
```typescript
{
  featureFlags: {
    spectatorModeEnabled: boolean,   // show/hide spectate buttons
    publicRoomsEnabled: boolean,     // show/hide public room list
  },
  gameConfig: {
    minPlayers: number,     // default 2
    maxPlayers: number,     // default 6, hard cap 7
    minRounds: number,      // default 1
    maxRounds: number,      // default 20
    maxSpectators: number,  // default 10
    maxBots: number,        // default 4, hard cap 6
  }
}
```

---

## 🏗️ Architecture

### Server-Authoritative
All game state lives on the server. Clients send *intent* (draw, discard), server validates, updates state, and broadcasts personalised views to each player.

### Game State Flow
```
Client action → Socket event → GameEngine.process*() → ActionResult
→ activeGames.set(newState) → broadcastGameState() → each socket gets ClientGameState
                                                    → spectatorSocket gets SpectatorGameState
```

### Key Design Decisions
- **Stateless engine**: `GameEngine` is pure functions — input state + action → new state
- **In-memory game state**: Ultra-low latency; MongoDB used for persistence only
- **Personalised broadcasts**: Each client only sees their own hand; opponents see `handCount` + `handTotal`
- **Spectator isolation**: Separate socket connection; spectators receive `SpectatorGameState` with no card data
- **Turn timer**: Server-side `setTimeout` — auto-advances turn on timeout
- **Bot turns**: Scheduled `setTimeout` after each human turn if next player is a bot
- **Admin config live reload**: `admin:config_updated` socket event broadcast to all clients on every config change
- **Online user tracking**: Module-level `Map<userId, socketId>` updated on connect/disconnect

### Deck Constraint
The game uses a 57-card deck. One card is removed as the joker selector, leaving 56 usable cards. With 7 cards dealt per player, the hard maximum is **7 players** (7 × 7 = 49 dealt, 7 remain for deck + discard seed).

---

## 🔒 Security

- JWT authentication on all API and Socket.IO connections
- Separate admin JWT with `role: 'admin'` — 8h expiry
- `requireAdmin` middleware on all admin routes
- Ban enforcement at socket connect — banned users cannot reconnect
- Socket validates ALL game actions — clients cannot cheat
- Spectators never receive card face data — only `handCount` and `handTotal`
- Rate limiting on auth routes (20 req/15min) and general API (100 req/15min)
- Input sanitization on chat (200 char max)
- Helmet.js for HTTP security headers
- CORS restricted to `CLIENT_URL`

---

## 🎤 Voice Chat

Live WebRTC voice chat during games:
- Peer-to-peer audio via RTCPeerConnection
- Server handles signaling only (offer/answer/ICE via Socket.IO)
- Mute/unmute toggle in game UI
- Graceful fallback if microphone permission denied (Samsung Android fix included)

---

## 🎨 UI Features

- **Dark/light themes** — system default with toggle
- **Neon/glassmorphism design** — premium gaming aesthetic
- **Framer Motion** animations — card deal, hover lift, select raise, round transitions
- **Casino felt table** background
- **Neon glow** on joker cards, active turns, power plays
- **Responsive** — desktop, tablet, mobile (tested on Android/iOS)
- **Avatar system** — 10 emoji avatars + Google profile photo
- **Confetti** on match win
- **Real-time action toasts** — "Player X discarded K♠"
- **Bot badge** overlay on bot player cards
- **Spectator LIVE badge** with pulse animation and viewer count

---

## 🚀 Production Deployment

### Environment Variables
```env
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
ADMIN_SECRET=          # Admin panel password
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SESSION_SECRET=
CLIENT_URL=
NODE_ENV=production
PORT=5000
```

### Railway / Render
```bash
railway init
railway add mongodb
railway deploy
```

### SSL / Domain
Use your platform's automatic SSL or add Cloudflare in front.

---

## 📈 Scalability

For horizontal scaling (multiple server instances):

1. Replace in-memory `activeGames` Map with Redis
2. Use `@socket.io/redis-adapter` for cross-instance Socket.IO events
3. Add Redis pub/sub for game state sync

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pub = createClient({ url: process.env.REDIS_URL });
const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub));
```

---

## 🔮 Future Features

- [ ] Replay last round
- [ ] Friend system with invites
- [ ] Season leaderboard (monthly reset)
- [ ] Card deal animation (staggered flying from center)
- [ ] Tournament brackets
- [ ] In-game store (cosmetic card backs, table themes)
- [ ] PWA / mobile app (Capacitor)
- [ ] Offline practice mode (local bots, no server)

---

*Built with React 18, Node.js, Socket.IO 4, MongoDB, Tailwind CSS, Framer Motion, and WebRTC*
