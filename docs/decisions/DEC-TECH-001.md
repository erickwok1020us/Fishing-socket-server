# DEC-TECH-001: Single-Player Tech Stack

TYPE: DECISION
STATUS: UNRESOLVED
SCOPE: GLOBAL
MODULE: CROSS-MODULE
AI_ACTION_ALLOWED: 0

## QUESTION

What tech stack should single-player mode use to achieve server-grade security without mandatory network?

## CONTEXT

- Current: Single-player runs entirely in browser (game.js), no server involvement
- Multiplayer: Uses Socket.IO to Node.js backend on Render
- Bible requires server authority for ALL game modes (M1)
- User priority: single-player first, multiplayer later
- Deployed frontend: Vercel (static hosting)
- Deployed backend: Render (Node.js)

## OPTIONS

| Option | Stack | Latency | Offline | Security | Complexity |
|--------|-------|---------|---------|----------|------------|
| A | Connect to Render backend via WebSocket (same as multiplayer) | 50-200ms | No | High (true server authority) | Low (reuse existing) |
| B | WebWorker running game engine in browser thread | <1ms | Yes | Medium (client can inspect) | Medium |
| C | WASM-compiled game engine in browser | <1ms | Yes | Medium (harder to tamper) | High |
| D | Local Node.js server (Electron/Tauri wrapper) | <5ms | Yes | High (separate process) | High |
| E | Hybrid: Option A with Option B fallback for offline | Variable | Partial | High online, Medium offline | High |

## TRADE-OFF ANALYSIS

### Option A (Recommended for casino compliance)
- Reuses 100% of existing multiplayer server code
- True server authority — client cannot tamper
- Requires internet connection
- Latency depends on user location to Render server
- Simplest implementation (single-player = multiplayer room with 1 player)

### Option B (Best for offline single-player)
- Game engine runs in WebWorker (separate thread)
- Same JS code as server, but in browser
- Technically inspectable by determined attackers
- No network dependency
- Moderate refactoring needed

## DEPENDENCIES

- Requires: DEC-M1-001 resolved first
- Blocks: All M1-M6 single-player implementation
- Affects: Frontend architecture, deployment model

## ALLOWED ACTIONS

NONE. Decision must be resolved before any tech stack changes.

## FORBIDDEN ACTIONS

- Do not refactor game architecture
- Do not add WebWorker infrastructure
- Do not modify deployment configuration
