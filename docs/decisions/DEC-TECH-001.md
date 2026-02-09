# DEC-TECH-001: Single-Player Tech Stack

TYPE: DECISION
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: CROSS-MODULE
AI_ACTION_ALLOWED: 1

## RESOLUTION

**Option A: Connect to Render backend via WebSocket (same as multiplayer)**

Single-player mode connects to the existing Render-hosted Node.js backend via Socket.IO. Single-player = multiplayer room with 1 player.

RESOLVED BY: User directive (DEC-M1-001 = server authority) + technical analysis

## RATIONALE

- Reuses 100% of existing multiplayer server code — lowest implementation effort
- True server authority — client cannot tamper with any game logic
- Same security model, same codebase, same deployment for all modes
- No new infrastructure (WebWorker, WASM, Electron) needed
- Consistent behavior: single-player and multiplayer share identical game engine

## TRADE-OFFS ACCEPTED

- Requires internet connection (no offline single-player)
- Latency: 50-200ms to Render server (acceptable per DEC-M1-003)
- Server downtime = no game (mitigated by Render's uptime SLA)
- No local/offline fallback for MVP

## IMPLEMENTATION NOTES

- Client: connect to wss://fishing-socket-server.onrender.com
- Server: create room with maxPlayers=1 for single-player
- Room type flag: { mode: 'singleplayer' } to adjust finisher pool (DEC-M2-002)
- All existing server-side validation applies automatically
- Client game.js: remove local hit detection, reward calculation, Math.random() for single-player
- Client sends: shoot events with target position
- Server returns: hit/miss result, reward, fish state updates

## DEPENDENCIES UNBLOCKED

- All M1-M6 single-player implementation
- Frontend architecture changes
